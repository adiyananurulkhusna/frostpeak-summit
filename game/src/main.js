// Frostpeak Drift — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over
// and victory.
//
// ?seed=N fixes the town layout. ?shot=cover|drive|town|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_PICKUP, EVENT_WASTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
// Debug handle for automated play-testing (read the world, never for play).
window.__frostpeak = world;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: 0, missions: 0, best: 0 };
    const save = JSON.parse(raw);
    return {
      cash: Number(save.cash) || 0,
      missions: Number(save.missions) || 0,
      best: Number(save.best) || 0,
    };
  } catch {
    return { cash: 0, missions: 0, best: 0 };
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  // One-shot step actions (E, F) wait here until a fixed step consumes them:
  // a frame that runs no step (a fast display) must never swallow a press.
  let queuedStepActions = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    // Returning players keep their earned cash as a head start.
    world.state.cash = save.cash;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Bermain. Ikuti penanda misi kuning di peta.');
  }

  function endGame(reason) {
    screen = SCREEN_OVER;
    world.state.overReason = reason;
    save.best = Math.max(save.best, world.state.cash);
    save.missions = Math.max(save.missions, world.state.missionIndex);
    writeSave(save);
    audio.busted();
    announce(`Game over. ${reason}`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    save.best = Math.max(save.best, world.state.cash);
    save.missions = 6;
    save.cash = world.state.cash;
    writeSave(save);
    announce('Kamu menaklukkan Frostpeak!');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Suara mati.' : 'Suara hidup.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Bermain.');
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY) {
      // One-shot actions (E, F) go to the first step only: handing the same
      // press to every step of one frame would enter and leave a car at once.
      // They queue across frames until a step runs, so a press on a frame
      // with no step is never lost.
      queuedStepActions |= actions & (ACTION_ENTER | ACTION_PUNCH);
      let stepActions = queuedStepActions;
      while (accumulator >= STEP) {
        const move = input.move();
        const events = world.step(STEP, move, input.run(), stepActions);
        stepActions = 0;
        queuedStepActions = 0;
        if (events & EVENT_MISSION) {
          audio.missionDone();
          save.cash = world.state.cash;
          save.missions = Math.max(save.missions, world.state.missionIndex);
          save.best = Math.max(save.best, world.state.cash);
          writeSave(save);
        }
        if (events & EVENT_PICKUP) audio.pickup();
        if (events & EVENT_BUSTED) {
          endGame(world.state.overReason);
          break;
        }
        if (events & EVENT_WASTED) {
          endGame(world.state.overReason);
          break;
        }
        if (events & EVENT_WIN) {
          audio.missionDone();
          winGame();
          break;
        }
        accumulator -= STEP;
      }
      if (screen === SCREEN_PLAY) accumulator = 0;
    } else {
      accumulator = 0;
      queuedStepActions = 0;
    }
    const state = world.state;
    audio.update({
      speed: state.player.speed || 0,
      driving: !state.player.onFoot,
      wanted: state.wanted || 0,
      blizzard: state.blizzard || 0,
      time: state.time,
    });
    renderer.draw(world, screen, save.best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Frostpeak Drift. Tekan Space atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
