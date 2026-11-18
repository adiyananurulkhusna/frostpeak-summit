// Keyboard and pointer input for Frostpeak Drift. Held keys give a movement
// vector (WASD or arrows) and a run flag; one-shot presses (start, pause,
// enter/exit a car, punch, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted
// twice. The main loop hands the flags to the world's first fixed step only,
// so one E press can never enter and leave a car in the same frame.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code)
      || DOWN.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
    } else if (!event.repeat) {
      press(event.code);
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur so the player never keeps walking on their own.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector {x, y}: -1..1 on each axis, from WASD / arrow keys. */
    move() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      return { x, y };
    },
    /** True while either Shift key is held. */
    run() {
      return has(RUN);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
