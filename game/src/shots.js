// The screenshot scenes behind ?shot=cover|drive|town|mission. Each one sets
// the real world to a staged moment — a police chase in the snow, driving the
// icy mountain road, walking the resort village, a rescue mission under way —
// then the renderer paints it exactly as the game paints live play. The same
// seed always gives the same frame.

import { MISSIONS } from './config.js';
import { SCREEN_PLAY } from './render.js';

function placePlayerInCar(world, x, y, angle, color) {
  const state = world.state;
  const car = state.cars.find((c) => c.kind === 'parked' || c.kind === 'traffic');
  if (!car) return null;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 260;
  car.driver = 'player';
  car.color = color || '#c0392b';
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.speed = 260;
  return car;
}

function placePolice(world, offsets) {
  const state = world.state;
  state.wanted = Math.min(5, offsets.length);
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  offsets.forEach(([dx, dy, angle], i) => {
    const car = {
      id: 900 + i, kind: 'police', x: state.player.x + dx, y: state.player.y + dy,
      angle, speed: 320, color: '#1f2a37', driver: 'ai', road: null,
      axis: 'h', dir: 1, lane: 28, cruise: 560, stolen: false, ramCooldown: 0,
      ramHitCooldown: 0, sirenPhase: i * 2.1,
    };
    state.cars.push(car);
  });
}

function centreCamera(world) {
  const state = world.state;
  state.camera.x = Math.min(1920, Math.max(0, state.player.x - 640));
  state.camera.y = Math.min(2480, Math.max(0, state.player.y - 360));
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  state.time = 42;
  state.blizzard = 0.55;

  if (name === 'drive') {
    // Icy mountain road through the pines, mission 2 running.
    state.missionIndex = 1;
    state.missionStep = 1;
    state.missionTimer = 58;
    state.cash = 400;
    placePlayerInCar(world, 1000, 1300, Math.PI / 2, '#2e86de');
    state.player.x = 1000;
    state.player.y = 1300;
    // Traffic sharing the same icy road, so the drive reads as a real road.
    const traffic = state.cars.filter((c) => c.kind === 'traffic');
    if (traffic[0]) {
      traffic[0].x = 1028; traffic[0].y = 1560; traffic[0].angle = Math.PI / 2;
      traffic[0].speed = 180; traffic[0].axis = 'v'; traffic[0].dir = 1; traffic[0].lane = 28;
    }
    if (traffic[1]) {
      traffic[1].x = 972; traffic[1].y = 1060; traffic[1].angle = -Math.PI / 2;
      traffic[1].speed = 200; traffic[1].axis = 'v'; traffic[1].dir = -1; traffic[1].lane = -28;
    }
    centreCamera(world);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'town') {
    // On foot in the resort village square, skiers and shoppers about.
    state.missionIndex = 0;
    state.missionStep = 0;
    state.cash = 120;
    state.player.x = 1600;
    state.player.y = 1560;
    state.player.angle = -Math.PI / 2;
    state.player.onFoot = true;
    state.player.car = null;
    for (let i = 0; i < 6; i += 1) {
      const ped = state.peds[i];
      if (ped) {
        ped.x = 1500 + i * 55;
        ped.y = 1480 + (i % 2) * 90;
      }
    }
    centreCamera(world);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    // Mission 4: rescuing skiers buried by the avalanche on trail 7.
    state.missionIndex = 3;
    state.missionStep = 0;
    state.missionTimer = 64;
    state.missionProgress = 1;
    state.cash = 1000;
    state.wanted = 1;
    state.player.x = 640;
    state.player.y = 2260;
    state.player.angle = 0;
    state.player.onFoot = true;
    state.player.car = null;
    state.peds = state.peds.filter((p) => p.kind !== 'skier');
    const skiers = [
      [560, 2180], [690, 2240], [600, 2320],
    ];
    skiers.forEach(([x, y], i) => {
      state.peds.push({
        kind: 'skier', x, y, angle: 0, speed: 0, health: 30, down: i === 0,
        downTimer: 999, wanderTimer: 0, attackTimer: 0, rescued: i === 0,
        color: '#e67e22',
      });
    });
    state.missionToast = 'Pemain ski diselamatkan (1/3).';
    state.toastTimer = 4;
    placePolice(world, [[420, -260, Math.PI * 0.8]]);
    state.wanted = 1;
    centreCamera(world);
    return { screen: SCREEN_PLAY };
  }

  // Cover: a police chase in the snow — wanted 3, mission 3, minimap and
  // objective on the HUD, the player drifting a red car past the resort.
  state.missionIndex = 2;
  state.missionStep = 0;
  state.missionProgress = 2;
  state.cash = 1000;
  placePlayerInCar(world, 1600, 1600, -Math.PI / 2, '#c0392b');
  const courier = state.cars.find((c) => c.kind === 'traffic');
  if (courier) {
    courier.kind = 'courier';
    courier.x = 1600;
    courier.y = 1330;
    courier.angle = -Math.PI / 2;
    courier.speed = 300;
    courier.color = '#dfe6ee';
    state.courier = courier;
  }
  placePolice(world, [
    // All three police cars sit ON the roads around the player, white bodies
    // on dark asphalt with their light bars flashing, so the chase reads.
    [0, 260, -Math.PI / 2],
    [-300, 0, 0],
    [300, 0, Math.PI],
  ]);
  state.missionToast = 'Tabrak mobil kurir Whiteout 3 kali (2/3).';
  state.toastTimer = 4;
  centreCamera(world);
  return { screen: SCREEN_PLAY };
}

export const SHOT_NAMES = ['cover', 'drive', 'town', 'mission'];
export { MISSIONS };
