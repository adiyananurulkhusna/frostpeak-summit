// Drawing only: the town, the people, the cars, the snow, the HUD with its
// minimap, and the title / pause / game-over / victory panels. The camera
// shows a 1280 x 720 window of the 3200 x 3200 town, scaled to fit the
// browser window.

import { CAR, FONT, MISSIONS, PALETTE, PLAYER, STORY_INTRO, WANTED_MAX, WORLD } from './config.js';
import { ROADS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const FLAKE_COUNT = 260;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const flakes = [];
  for (let i = 0; i < FLAKE_COUNT; i += 1) {
    flakes.push({
      x: Math.random() * WORLD.viewW,
      y: Math.random() * WORLD.viewH,
      size: 1 + Math.random() * 2.6,
      fall: 30 + Math.random() * 70,
      sway: Math.random() * Math.PI * 2,
    });
  }
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / WORLD.viewW, height / WORLD.viewH);
    view.x = (width - WORLD.viewW * view.scale) / 2;
    view.y = (height - WORLD.viewH * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h, alpha) {
    context.fillStyle = alpha || PALETTE.hudPanel;
    context.fillRect(x, y, w, h);
    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawTown(world, cam) {
    const { buildings, trees, lake, lift } = world.town;
    // Snow ground.
    context.fillStyle = PALETTE.snow;
    context.fillRect(cam.x - 20, cam.y - 20, WORLD.viewW + 40, WORLD.viewH + 40);
    // Soft drifts: pale blobs scattered on a fixed grid so they never flicker.
    context.fillStyle = PALETTE.snowDrift;
    const gx0 = Math.floor(cam.x / 260);
    const gy0 = Math.floor(cam.y / 260);
    for (let gx = gx0; gx < gx0 + 7; gx += 1) {
      for (let gy = gy0; gy < gy0 + 5; gy += 1) {
        const hx = ((gx * 73856093) ^ (gy * 19349663)) % 260;
        const hy = ((gx * 83492791) ^ (gy * 2971215073)) % 260;
        context.beginPath();
        context.ellipse(gx * 260 + ((hx + 260) % 260), gy * 260 + ((hy + 260) % 260), 90, 34, 0, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Frozen lake, north-east.
    context.fillStyle = PALETTE.lake;
    context.beginPath();
    context.ellipse(lake.x, lake.y, lake.rx, lake.ry, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.lakeIce;
    context.beginPath();
    context.ellipse(lake.x - 30, lake.y - 20, lake.rx * 0.55, lake.ry * 0.5, 0, 0, Math.PI * 2);
    context.fill();
    text('DANAU BEKU', lake.x - 52, lake.y + 6, 15, '#4a7a94', 'left');
    // Roads: dark asphalt with snowy shoulders and a dashed centre line.
    context.fillStyle = PALETTE.road;
    for (const road of ROADS) {
      context.fillRect(road - 55, cam.y - 20, 110, WORLD.viewH + 40);
      context.fillRect(cam.x - 20, road - 55, WORLD.viewW + 40, 110);
    }
    context.fillStyle = PALETTE.roadEdge;
    for (const road of ROADS) {
      context.fillRect(road - 58, cam.y - 20, 5, WORLD.viewH + 40);
      context.fillRect(road + 53, cam.y - 20, 5, WORLD.viewH + 40);
      context.fillRect(cam.x - 20, road - 58, WORLD.viewW + 40, 5);
      context.fillRect(cam.x - 20, road + 53, WORLD.viewW + 40, 5);
    }
    context.fillStyle = PALETTE.roadLine;
    const dash = 34;
    for (const road of ROADS) {
      for (let d = Math.floor(cam.y / dash) * dash; d < cam.y + WORLD.viewH; d += dash * 2) {
        context.fillRect(road - 2, d, 4, dash);
      }
      for (let d = Math.floor(cam.x / dash) * dash; d < cam.x + WORLD.viewW; d += dash * 2) {
        context.fillRect(d, road - 2, dash, 4);
      }
    }
    // Ski lift on the west slope: towers, cable and chairs.
    context.strokeStyle = PALETTE.liftTower;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(lift.x1, lift.y1);
    context.lineTo(lift.x2, lift.y2);
    context.stroke();
    const towers = 5;
    for (let i = 0; i <= towers; i += 1) {
      const t = i / towers;
      const x = lift.x1 + (lift.x2 - lift.x1) * t;
      const y = lift.y1 + (lift.y2 - lift.y1) * t;
      context.fillStyle = PALETTE.liftTower;
      context.fillRect(x - 4, y - 26, 8, 26);
      context.fillStyle = '#c0392b';
      context.fillRect(x - 8, y - 4, 16, 12);
    }
    text('LIFT SKI', lift.x1 + 10, lift.y1 - 34, 15, '#4a5568', 'left');
    // Buildings: walls, snowy roofs, lit windows.
    for (const b of buildings) {
      if (b.x > cam.x + WORLD.viewW + 40 || b.x + b.w < cam.x - 40) continue;
      if (b.y > cam.y + WORLD.viewH + 40 || b.y + b.h < cam.y - 40) continue;
      context.fillStyle = b.cabin ? '#7a5230' : b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.cabinRoof;
      context.fillRect(b.x - 6, b.y - 10, b.w + 12, 16);
      context.fillStyle = b.cabin ? '#8a6b4a' : '#3a4a63';
      context.fillRect(b.x - 6, b.y - 10, b.w + 12, 4);
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 44));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const lit = ((cx * 7 + cy * 13 + Math.floor(b.x)) % 5) < (b.lit ? 3 : 1);
          context.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
          context.fillRect(b.x + 12 + cx * 44, b.y + 16 + cy * 42, 18, 20);
        }
      }
    }
    // Resort plaza label at the centre.
    text('ALUN-ALUN RESORT', 1600 - 78, 1600 - 96, 16, '#4a5568', 'left');
    // Pines: dark triangles with snow caps.
    for (const tree of trees) {
      if (tree.x < cam.x - 40 || tree.x > cam.x + WORLD.viewW + 40) continue;
      if (tree.y < cam.y - 40 || tree.y > cam.y + WORLD.viewH + 40) continue;
      const s = tree.size;
      context.fillStyle = PALETTE.pine;
      context.beginPath();
      context.moveTo(tree.x, tree.y - s);
      context.lineTo(tree.x - s * 0.7, tree.y + s * 0.6);
      context.lineTo(tree.x + s * 0.7, tree.y + s * 0.6);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.pineSnow;
      context.beginPath();
      context.moveTo(tree.x, tree.y - s);
      context.lineTo(tree.x - s * 0.32, tree.y - s * 0.35);
      context.lineTo(tree.x + s * 0.32, tree.y - s * 0.35);
      context.closePath();
      context.fill();
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Shadow on the snow.
    context.fillStyle = 'rgba(20, 30, 50, 0.25)';
    context.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    context.fillStyle = car.kind === 'police' ? '#f2f6fb' : car.color;
    context.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
    if (car.kind === 'police') {
      context.fillStyle = PALETTE.police;
      context.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length * 0.45, CAR.width);
      context.fillStyle = '#dfe6ee';
      text('POLISI', -CAR.length / 2 + 6, 4, 9, '#1f2a37', 'left');
    }
    if (car.kind === 'plow') {
      context.fillStyle = '#8a94a6';
      context.fillRect(CAR.length / 2 - 2, -CAR.width / 2 - 4, 10, CAR.width + 8);
      text('PLOW', -14, 4, 10, '#1f2a37', 'left');
    }
    if (car.kind === 'courier') {
      context.fillStyle = '#5b2d8e';
      context.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 3, 12, CAR.width - 6);
    }
    // Windshield and roof.
    context.fillStyle = '#9fd4e8';
    context.fillRect(-6, -CAR.width / 2 + 4, 14, CAR.width - 8);
    context.fillStyle = 'rgba(20,30,50,0.35)';
    context.fillRect(4, -CAR.width / 2 + 4, 12, CAR.width - 8);
    // Headlights.
    context.fillStyle = '#ffe9a3';
    context.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 2, 3, 5);
    context.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 7, 3, 5);
    // Police light bar, flashing red / blue.
    if (car.kind === 'police') {
      const red = Math.floor(time * 6 + car.sirenPhase) % 2 === 0;
      context.fillStyle = red ? PALETTE.policeLight : PALETTE.policeLight2;
      context.beginPath();
      context.arc(0, 0, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = red ? 'rgba(255,59,48,0.25)' : 'rgba(47,123,255,0.25)';
      context.beginPath();
      context.arc(0, 0, 26, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPed(ped, time) {
    if (ped.rescued) return;
    context.save();
    context.translate(ped.x, ped.y);
    if (ped.down) {
      context.rotate(Math.PI / 2);
      context.fillStyle = ped.kind === 'skier' ? '#f39c12' : ped.color;
      context.fillRect(-12, -8, 24, 16);
      context.restore();
      return;
    }
    const bob = ped.kind === 'skier' ? 0 : Math.sin(time * 8 + ped.x) * 2;
    // Shadow, coat, head, facing tick.
    context.fillStyle = 'rgba(20, 30, 50, 0.25)';
    context.beginPath();
    context.ellipse(0, 9, 12, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(0, bob * 0.4, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 + bob * 0.4, 5.5, 0, Math.PI * 2);
    context.fill();
    if (ped.kind === 'gang') {
      context.fillStyle = '#ffd23e';
      context.fillRect(-7, -16 + bob * 0.4, 14, 4);
    }
    if (ped.kind === 'skier') {
      // Waving for help.
      context.strokeStyle = '#c0392b';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(8, -6);
      context.lineTo(16, -18 + Math.sin(time * 10) * 4);
      context.stroke();
      text('!', -3, -18, 18, '#c0392b', 'left');
    }
    context.restore();
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (player.onFoot) {
      const bob = player.moving ? Math.sin(time * 12) * 2 : 0;
      context.save();
      context.translate(player.x, player.y);
      context.fillStyle = 'rgba(20, 30, 50, 0.3)';
      context.beginPath();
      context.ellipse(0, 10, 13, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.playerCoat;
      context.beginPath();
      context.arc(0, bob * 0.4, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath();
      context.arc(Math.cos(player.angle) * 3, Math.sin(player.angle) * 3 + bob * 0.4, 6, 0, Math.PI * 2);
      context.fill();
      // Red beanie.
      context.fillStyle = '#c0392b';
      context.beginPath();
      context.arc(Math.cos(player.angle) * 3, Math.sin(player.angle) * 3 + bob * 0.4 - 3, 6, Math.PI, 0);
      context.fill();
      // Punch swing arc.
      if (player.punchCooldown > PLAYER.punchCooldown - 0.15) {
        context.strokeStyle = 'rgba(255,255,255,0.85)';
        context.lineWidth = 4;
        context.beginPath();
        context.arc(0, 0, 26, player.angle - 0.7, player.angle + 0.7);
        context.stroke();
      }
      context.restore();
    }
  }

  function drawMissionMarker(world, time) {
    const mission = MISSIONS[world.state.missionIndex];
    if (!mission) return;
    const step = mission.steps[world.state.missionStep];
    if (!step || !step.target) return;
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    const radius = (step.radius || 60) * pulse;
    context.save();
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 3;
    context.setLineDash([10, 8]);
    context.beginPath();
    context.arc(step.target.x, step.target.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    // Diamond marker above the target.
    const bobY = Math.sin(time * 3) * 6;
    context.fillStyle = PALETTE.markerRing;
    context.beginPath();
    context.moveTo(step.target.x, step.target.y - 66 + bobY);
    context.lineTo(step.target.x + 12, step.target.y - 50 + bobY);
    context.lineTo(step.target.x, step.target.y - 34 + bobY);
    context.lineTo(step.target.x - 12, step.target.y - 50 + bobY);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawSnow(state) {
    const wind = state.blizzard * 90;
    context.fillStyle = 'rgba(255,255,255,0.9)';
    for (const flake of flakes) {
      const x = (flake.x + state.time * wind * 0.3 + Math.sin(state.time + flake.sway) * 12) % WORLD.viewW;
      const y = (flake.y + state.time * flake.fall) % WORLD.viewH;
      context.fillRect(state.camera.x + ((x + WORLD.viewW) % WORLD.viewW), state.camera.y + ((y + WORLD.viewH) % WORLD.viewH), flake.size, flake.size);
    }
    if (state.blizzard > 0.55) {
      context.fillStyle = `rgba(230, 240, 252, ${(state.blizzard - 0.55) * 0.35})`;
      context.fillRect(state.camera.x, state.camera.y, WORLD.viewW, WORLD.viewH);
    }
  }

  function drawMinimap(world) {
    const state = world.state;
    const size = 168;
    const mx = 16;
    const my = WORLD.viewH - size - 16;
    const scale = size / 3200;
    panel(mx - 6, my - 6, size + 12, size + 12);
    context.save();
    context.beginPath();
    context.rect(mx, my, size, size);
    context.clip();
    context.fillStyle = '#dfe9f5';
    context.fillRect(mx, my, size, size);
    context.fillStyle = '#9fd4e8';
    context.beginPath();
    context.ellipse(mx + world.town.lake.x * scale, my + world.town.lake.y * scale, world.town.lake.rx * scale, world.town.lake.ry * scale, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#3a4150';
    for (const road of ROADS) {
      context.fillRect(mx, my + road * scale - 2, size, 4);
      context.fillRect(mx + road * scale - 2, my, 4, size);
    }
    const mission = MISSIONS[state.missionIndex];
    if (mission) {
      const step = mission.steps[state.missionStep];
      if (step && step.target) {
        context.fillStyle = PALETTE.marker;
        context.beginPath();
        context.arc(mx + step.target.x * scale, my + step.target.y * scale, 6, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const car of state.cars) {
      if (car.kind === 'police') {
        context.fillStyle = PALETTE.policeLight2;
        context.fillRect(mx + car.x * scale - 2, my + car.y * scale - 2, 4, 4);
      }
    }
    // Player arrow.
    context.save();
    context.translate(mx + state.player.x * scale, my + state.player.y * scale);
    context.rotate(state.player.angle);
    context.fillStyle = '#e74c3c';
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    // Viewport rectangle.
    context.strokeStyle = 'rgba(255,255,255,0.7)';
    context.lineWidth = 1;
    context.strokeRect(mx + state.camera.x * scale, my + state.camera.y * scale, WORLD.viewW * scale, WORLD.viewH * scale);
    context.restore();
    text('FROSTPEAK', mx, my - 10, 12, PALETTE.hudText, 'left');
  }

  function drawHud(world, best) {
    const state = world.state;
    const mission = MISSIONS[state.missionIndex];
    // Top-left: cash, health, speed.
    panel(16, 14, 250, 92);
    text(`$ ${state.cash.toLocaleString('en-US')}`, 28, 44, 26, '#ffd23e', 'left');
    text('KESEHATAN', 28, 68, 12, PALETTE.hudMuted, 'left');
    context.fillStyle = '#2c3547';
    context.fillRect(110, 56, 130, 12);
    context.fillStyle = state.player.health > 30 ? '#27ae60' : '#e74c3c';
    context.fillRect(110, 56, 130 * clamp(state.player.health / 100, 0, 1), 12);
    const speed = Math.round(state.player.speed * 0.18);
    text(state.player.onFoot ? 'JALAN KAKI' : `${speed} km/j`, 28, 94, 14, PALETTE.hudText, 'left');
    // Top-right: wanted stars, always 0..5, never undefined.
    const wanted = clamp(state.wanted || 0, 0, WANTED_MAX);
    panel(WORLD.viewW - 246, 14, 230, 52);
    text('WANTED', WORLD.viewW - 234, 34, 12, PALETTE.hudMuted, 'left');
    for (let i = 0; i < WANTED_MAX; i += 1) {
      text('★', WORLD.viewW - 168 + i * 26, 48, 24, i < wanted ? PALETTE.star : PALETTE.starEmpty, 'left');
    }
    // Mission objective, top centre.
    if (mission) {
      const step = mission.steps[state.missionStep];
      const label = step ? step.label : '';
      const timer = state.missionTimer > 0 ? `  ⏱ ${Math.ceil(state.missionTimer)} dtk` : '';
      const title = `MISI ${mission.id}/6 — ${mission.title}${timer}`;
      const w = 460;
      panel((WORLD.viewW - w) / 2, 14, w, 62);
      text(title, WORLD.viewW / 2, 38, 15, PALETTE.marker, 'center');
      text(label, WORLD.viewW / 2, 62, 14, PALETTE.hudText, 'center');
    }
    // Controls hint, bottom-right.
    text('WASD gerak/kemudi · E naik/turun mobil · F pukul · Shift lari · P jeda · M suara', WORLD.viewW - 16, WORLD.viewH - 14, 12, 'rgba(10,18,32,0.75)', 'right');
    // Toast.
    if (state.toastTimer > 0 && state.missionToast) {
      panel((WORLD.viewW - 560) / 2, WORLD.viewH - 118, 560, 40);
      text(state.missionToast, WORLD.viewW / 2, WORLD.viewH - 91, 15, PALETTE.hudText, 'center');
    }
    // Busted warning while a police car touches the player on foot.
    if (state.player.bustTimer > 0) {
      text('POLISI MENANGKAPMU — KABUR!', WORLD.viewW / 2, 110, 22, '#ff3b30', 'center');
    }
    drawMinimap(world);
  }

  function drawPanelScreen(title, lines, prompt, accent) {
    context.fillStyle = 'rgba(8, 14, 26, 0.62)';
    context.fillRect(0, 0, WORLD.viewW, WORLD.viewH);
    const w = 680;
    const h = 130 + lines.length * 30 + 70;
    const x = (WORLD.viewW - w) / 2;
    const y = (WORLD.viewH - h) / 2;
    panel(x, y, w, h, 'rgba(10, 18, 32, 0.92)');
    text(title, WORLD.viewW / 2, y + 64, 44, accent || PALETTE.hudText, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], WORLD.viewW / 2, y + 112 + i * 30, 18, PALETTE.hudMuted, 'center');
    }
    text(prompt, WORLD.viewW / 2, y + h - 30, 20, PALETTE.marker, 'center');
  }

  function draw(world, screen, best) {
    const state = world.state;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b1220';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // World space: translate so the camera window is the 1280x720 view.
    context.save();
    context.translate(-state.camera.x, -state.camera.y);
    drawTown(world, state.camera);
    drawMissionMarker(world, state.time);
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      const bob = Math.sin(pickup.bob * 3) * 3;
      context.fillStyle = pickup.kind === 'cash' ? '#ffd23e' : '#27ae60';
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1f2a37';
      text(pickup.kind === 'cash' ? '$' : '+', pickup.x - 4, pickup.y + bob + 5, 14, '#1f2a37', 'left');
    }
    for (const car of state.cars) drawCar(car, state.time);
    for (const ped of state.peds) drawPed(ped, state.time);
    drawPlayer(state, state.time);
    drawSnow(state);
    context.restore();
    // Screen-space HUD and panels (no camera transform).
    if (screen === SCREEN_TITLE) {
      drawHud(world, best);
      const lines = [...STORY_INTRO, '', 'WASD / panah: jalan & kemudi   E: naik mobil   F: pukul   P: jeda'];
      drawPanelScreen('FROSTPEAK DRIFT', lines, 'Tekan Enter / Space / klik untuk mulai', '#bfe3ff');
    } else if (screen === SCREEN_PAUSED) {
      drawHud(world, best);
      drawPanelScreen('JEDA', ['Istirahat dulu — badai salju menunggu.', `Uang: $${state.cash} · Misi ${Math.min(state.missionIndex + 1, 6)}/6`], 'Tekan P untuk lanjut', PALETTE.hudText);
    } else if (screen === SCREEN_OVER) {
      drawHud(world, best);
      drawPanelScreen('GAME OVER', [state.overReason || 'Raka tumbang di salju.', `Uang terkumpul: $${state.cash} · Misi selesai: ${state.missionIndex}/6`, `Terbaik: $${best}`], 'Tekan Enter untuk main lagi', '#ff6b5e');
    } else if (screen === SCREEN_WIN) {
      drawHud(world, best);
      drawPanelScreen('FROSTPEAK DITAKLUKKAN!', ['Enam misi selesai. Whiteout Crew dan Avalanche Kings', 'mundur dari kota resort. Raka kembali membersihkan salju.', `Total uang: $${state.cash}`], 'Tekan Enter untuk main lagi', '#ffd23e');
    } else {
      drawHud(world, best);
    }
    // Low-health vignette.
    if (state.player.health < 30 && screen === SCREEN_PLAY) {
      context.fillStyle = `rgba(231, 76, 60, ${0.14 + 0.1 * Math.sin(state.time * 6)})`;
      context.fillRect(0, 0, WORLD.viewW, WORLD.viewH);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
