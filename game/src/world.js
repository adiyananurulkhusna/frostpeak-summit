// Frostpeak Drift — the rules and state, with no drawing and no browser in
// it: the snowy resort town, the player on foot and in cars, traffic and
// pedestrians, stealing cars, the wanted level and the police who chase it,
// combat, pickups and the six story missions. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound.

import { CAR, MISSIONS, PLAYER, POLICE, STEP, WANTED_MAX, WORLD } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_MISSION = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WASTED = 16;
export const EVENT_WIN = 32;
export const EVENT_CRIME = 64;

export const ROADS = [400, 1000, 1600, 2200, 2800];
const ROAD_HALF = 55;
const CAR_COLORS = ['#c0392b', '#2e86de', '#e67e22', '#16a085', '#8e44ad', '#dfe6ee', '#f39c12', '#27ae60'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function nearestRoad(value) {
  let best = ROADS[0];
  for (const road of ROADS) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  return best;
}
function onRoad(x, y) {
  for (const road of ROADS) {
    if (Math.abs(x - road) < ROAD_HALF || Math.abs(y - road) < ROAD_HALF) return true;
  }
  return false;
}

export function createWorld(random) {
  // ---- Static town: buildings, cabins, pines, ski lift, frozen lake ----
  const buildings = [];
  const trees = [];
  const lake = { x: 2520, y: 620, rx: 210, ry: 150 };
  for (let bx = 0; bx < ROADS.length - 1; bx += 1) {
    for (let by = 0; by < ROADS.length - 1; by += 1) {
      const x0 = ROADS[bx] + ROAD_HALF + 24;
      const y0 = ROADS[by] + ROAD_HALF + 24;
      const x1 = ROADS[bx + 1] - ROAD_HALF - 24;
      const y1 = ROADS[by + 1] - ROAD_HALF - 24;
      const centre = bx === 2 && by === 2;
      const count = centre ? 2 : random.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        // Retry a few times so no two buildings overlap: overlapping rects
        // form concave pockets that trap a walker in their corner.
        let placed = false;
        for (let attempt = 0; attempt < 8 && !placed; attempt += 1) {
          const w = random.range(90, 170);
          const h = random.range(80, 150);
          const x = random.range(x0, Math.max(x0 + 1, x1 - w));
          const y = random.range(y0, Math.max(y0 + 1, y1 - h));
          const inLake = (x - lake.x) ** 2 / lake.rx ** 2 + (y - lake.y) ** 2 / lake.ry ** 2 < 1.4;
          if (inLake) continue;
          const GAP = 30;
          const overlaps = buildings.some((b) => (
            x < b.x + b.w + GAP && x + w + GAP > b.x && y < b.y + b.h + GAP && y + h + GAP > b.y
          ));
          if (overlaps) continue;
          buildings.push({
            x, y, w, h,
            cabin: random.next() < 0.35,
            color: random.pick(['#5a6b84', '#8a6b4a', '#6b7f96', '#7a5230', '#4a6b8a']),
            lit: random.next() < 0.6,
          });
          placed = true;
        }
      }
      const treeCount = random.int(3, 7);
      for (let i = 0; i < treeCount; i += 1) {
        trees.push({
          x: random.range(x0, x1),
          y: random.range(y0, y1),
          size: random.range(16, 30),
        });
      }
    }
  }
  // A pine forest on the west slope, outside the road grid, and another in
  // the south-east corner.
  for (let i = 0; i < 46; i += 1) {
    trees.push({ x: random.range(60, 320), y: random.range(60, 3140), size: random.range(18, 34) });
  }
  for (let i = 0; i < 30; i += 1) {
    trees.push({ x: random.range(2880, 3140), y: random.range(2400, 3140), size: random.range(18, 32) });
  }
  const lift = { x1: 320, y1: 2350, x2: 820, y2: 2920 };

  // ---- Dynamic state ----
  const state = {
    time: 0,
    blizzard: 0.35,
    player: {
      x: 1600, y: 1750, angle: -Math.PI / 2, health: PLAYER.health,
      onFoot: true, car: null, punchCooldown: 0, invulnerable: 0, bustTimer: 0,
      speed: 0, moving: false,
    },
    cars: [],
    peds: [],
    pickups: [],
    missionIndex: 0,
    missionStep: 0,
    missionTimer: 0,
    missionProgress: 0,
    missionToast: '',
    toastTimer: 0,
    cash: 0,
    wanted: 0,
    crimeTimer: 0,
    camera: { x: 960, y: 1390 },
    won: false,
    over: false,
    overReason: '',
    courier: null,
    rescueTimer: 0,
  };

  let carId = 0;
  function makeCar(kind, x, y, angle, color, driver) {
    const car = {
      id: carId += 1, kind, x, y, angle, speed: 0, color,
      driver: driver || 'ai', road: null, axis: 'v', dir: 1, lane: 28,
      cruise: 150, stolen: false, ramCooldown: 0, ramHitCooldown: 0, sirenPhase: random.next() * 6,
    };
    state.cars.push(car);
    return car;
  }

  function makePed(kind, x, y) {
    const ped = {
      kind, x, y, angle: random.range(0, Math.PI * 2), speed: 0,
      health: kind === 'gang' ? 60 : 30, down: false, downTimer: 0,
      wanderTimer: random.range(1, 4), attackTimer: 0, rescued: false,
      color: kind === 'gang' ? '#5b2d8e' : kind === 'skier' ? '#e67e22' : '#2e86de',
    };
    state.peds.push(ped);
    return ped;
  }

  function spawnTraffic() {
    for (let i = 0; i < 10; i += 1) {
      const vertical = random.next() < 0.5;
      const road = random.pick(ROADS);
      const along = random.range(100, WORLD.size - 100);
      const car = makeCar('traffic', vertical ? road : along, vertical ? along : road,
        vertical ? Math.PI / 2 : 0, random.pick(CAR_COLORS), 'ai');
      car.axis = vertical ? 'v' : 'h';
      car.dir = random.next() < 0.5 ? 1 : -1;
      car.lane = random.next() < 0.5 ? 28 : -28;
      car.cruise = random.range(120, 210);
      car.speed = car.cruise;
      car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    }
  }

  function spawnParked() {
    const spots = [
      [1540, 900, 0], [1660, 900, 0], [1540, 2300, Math.PI], [2300, 1540, Math.PI / 2],
      [900, 1660, -Math.PI / 2], [2900, 900, Math.PI], [1060, 1540, 0], [460, 1540, Math.PI / 2],
      [2260, 460, 0], [460, 2260, Math.PI],
    ];
    for (const [x, y, angle] of spots) {
      makeCar('parked', x, y, angle, random.pick(CAR_COLORS), null);
    }
    // The mission snowplow, parked at the depot by the west road.
    const plow = makeCar('plow', 1060, 940, 0, '#f39c12', null);
    plow.cruise = 260;
    return plow;
  }

  function spawnPeds() {
    for (let i = 0; i < 18; i += 1) {
      let x = 1600;
      let y = 1600;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        x = random.range(300, WORLD.size - 300);
        y = random.range(300, WORLD.size - 300);
        if (!onRoad(x, y)) break;
      }
      makePed('civilian', x, y);
    }
  }

  function spawnPickups() {
    const spots = [
      [1560, 1450, 'cash'], [2300, 2300, 'cash'], [700, 1500, 'cash'],
      [2900, 1500, 'cash'], [1500, 700, 'health'], [2400, 2900, 'health'],
      [500, 2800, 'cash'], [2900, 2600, 'cash'],
    ];
    for (const [x, y, kind] of spots) state.pickups.push({ x, y, kind, active: true, bob: random.range(0, 6) });
  }

  function collideBuildings(entity, radius) {
    for (const b of buildings) {
      const cx = clamp(entity.x, b.x, b.x + b.w);
      const cy = clamp(entity.y, b.y, b.y + b.h);
      const dx = entity.x - cx;
      const dy = entity.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius && d2 > 0.01) {
        const d = Math.sqrt(d2);
        entity.x = cx + (dx / d) * radius;
        entity.y = cy + (dy / d) * radius;
      } else if (d2 <= 0.01) {
        entity.y = b.y - radius;
      }
    }
  }

  // Move one axis at a time, resolving building collisions after each: a
  // diagonal push into a wall then slides along it instead of wedging the
  // mover into the corner, which a single combined move would do.
  function moveWithCollision(entity, dx, dy, radius) {
    entity.x += dx;
    collideBuildings(entity, radius);
    entity.y += dy;
    collideBuildings(entity, radius);
  }

  function addWanted(amount) {
    // Wanted is always an integer in 0..5 — never undefined, never above 5.
    const next = clamp((state.wanted || 0) + amount, 0, WANTED_MAX);
    state.wanted = next;
    state.crimeTimer = 0;
    return next;
  }

  function currentMission() {
    return MISSIONS[state.missionIndex] || null;
  }

  function currentStep() {
    const mission = currentMission();
    return mission ? mission.steps[state.missionStep] : null;
  }

  function setToast(text) {
    state.missionToast = text;
    state.toastTimer = 4;
  }

  function startMissionStep() {
    const step = currentStep();
    if (!step) return;
    if (step.type === 'ram') {
      const courier = makeCar('courier', step.target.x + 120, step.target.y, 0, '#dfe6ee', 'ai');
      courier.axis = 'h';
      courier.dir = 1;
      courier.cruise = 260;
      courier.speed = 260;
      state.courier = courier;
      setToast('Kurir Whiteout kabur! Kejar dan tabrak mobilnya.');
    }
    if (step.type === 'rescue') {
      for (let i = 0; i < 3; i += 1) {
        makePed('skier', step.target.x + (i - 1) * 90, step.target.y + (i % 2) * 70 - 35);
      }
      setToast('Tiga pemain ski terjebak longsor. Dekati mereka untuk menyelamatkan.');
    }
    if (step.type === 'defeat') {
      for (let i = 0; i < 4; i += 1) {
        makePed('gang', step.target.x + (i - 1) * 80, step.target.y + (i % 2) * 80 - 40);
      }
      setToast('Avalanche Kings menyerbu kabin! Usir mereka dengan pukulan (F).');
    }
    if (step.type === 'goto' && state.missionIndex === 5 && state.missionStep === 0) {
      addWanted(2);
      setToast('Bukti didapat — polisi mengejarmu! Kabur ke gerbang selatan.');
    }
  }

  function completeStep() {
    const mission = currentMission();
    state.missionStep += 1;
    state.missionProgress = 0;
    if (state.missionStep >= mission.steps.length) {
      state.cash += mission.reward;
      setToast(`Misi selesai: ${mission.title} — +$${mission.reward}`);
      state.missionIndex += 1;
      state.missionStep = 0;
      state.missionTimer = 0;
      if (state.missionIndex >= MISSIONS.length) {
        state.won = true;
        return EVENT_MISSION | EVENT_WIN;
      }
      const next = currentMission();
      state.missionTimer = next.timeLimit || 0;
      startMissionStep();
      return EVENT_MISSION;
    }
    startMissionStep();
    return EVENT_MISSION;
  }

  function failMission(reason) {
    const mission = currentMission();
    setToast(`Misi gagal: ${reason}. Coba lagi dari awal misi.`);
    // Remove mission-spawned actors, then restart the mission.
    state.cars = state.cars.filter((c) => c.kind !== 'courier');
    state.peds = state.peds.filter((p) => p.kind !== 'skier' && p.kind !== 'gang');
    state.courier = null;
    state.missionStep = 0;
    state.missionProgress = 0;
    state.missionTimer = mission.timeLimit || 0;
    state.wanted = clamp(state.wanted, 0, 2);
    startMissionStep();
  }

  function enterNearestCar() {
    const player = state.player;
    let best = null;
    let bestDist = 90;
    for (const car of state.cars) {
      if (car.driver === 'player') continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    if (!best) return false;
    if (best.kind === 'police') return false;
    if (best.kind !== 'plow' && best.kind !== 'courier' && !best.stolen) {
      best.stolen = true;
      addWanted(1);
      setToast('Mobil dicuri! Polisi bisa mengejarmu.');
    }
    best.driver = 'player';
    player.car = best;
    player.onFoot = false;
    player.x = best.x;
    player.y = best.y;
    return true;
  }

  function exitCar() {
    const player = state.player;
    const car = player.car;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    player.car = null;
    player.onFoot = true;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    player.angle = car.angle;
  }

  function punch() {
    const player = state.player;
    if (player.punchCooldown > 0) return 0;
    player.punchCooldown = PLAYER.punchCooldown;
    let events = 0;
    let best = null;
    let bestDist = PLAYER.punchRange;
    for (const ped of state.peds) {
      if (ped.down) continue;
      const d = dist(player.x, player.y, ped.x, ped.y);
      if (d < bestDist) {
        bestDist = d;
        best = ped;
      }
    }
    if (best) {
      best.health -= PLAYER.punchDamage;
      best.x += Math.cos(angleTo(player.x, player.y, best.x, best.y)) * 26;
      best.y += Math.sin(angleTo(player.x, player.y, best.x, best.y)) * 26;
      events |= EVENT_HIT;
      if (best.kind === 'civilian') addWanted(1);
      if (best.health <= 0) {
        best.down = true;
        best.downTimer = 8;
        if (best.kind === 'gang') {
          const step = currentStep();
          if (step && step.type === 'defeat') {
            state.missionProgress += 1;
            if (state.missionProgress >= step.count) events |= completeStep();
          }
        }
      }
    }
    return events;
  }

  function driveCar(car, move, dt) {
    const throttle = -move.y; // W / Up accelerates.
    const steering = move.x;
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
    else car.speed -= car.speed * 0.6 * dt;
    car.speed = clamp(car.speed, -CAR.reverseMax, car.kind === 'police' ? POLICE.maxSpeed : CAR.maxSpeed);
    const slide = clamp(Math.abs(car.speed) / CAR.maxSpeed, 0, 1);
    // Steering authority grows with speed only up to a point, so the car
    // stays controllable at top speed instead of spinning on full lock.
    const steerAuthority = clamp(Math.abs(car.speed) / 350, 0, 1);
    car.angle += steering * CAR.steer * dt * steerAuthority * (car.speed < 0 ? -1 : 1) * (1 + slide * 0.25);
    const vx = Math.cos(car.angle) * car.speed;
    const vy = Math.sin(car.angle) * car.speed;
    // Icy slide: keep a little sideways drift on snow.
    const slideX = -Math.sin(car.angle) * car.speed * 0.06 * slide;
    const slideY = Math.cos(car.angle) * car.speed * 0.06 * slide;
    moveWithCollision(car, (vx + slideX) * dt, (vy + slideY) * dt, 30);
    car.x = clamp(car.x, 40, WORLD.size - 40);
    car.y = clamp(car.y, 40, WORLD.size - 40);
    return { vx, vy };
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.driver !== 'ai') continue;
      if (car.kind === 'courier') {
        // The courier flees from the player along the roads.
        const player = state.player;
        const flee = angleTo(player.x, player.y, car.x, car.y);
        const targetAngle = Math.abs(angleDiff(flee, 0)) < Math.abs(angleDiff(flee, Math.PI / 2))
          ? (Math.abs(flee) < Math.PI / 2 ? 0 : Math.PI)
          : (flee > 0 ? Math.PI / 2 : -Math.PI / 2);
        car.angle += clamp(angleDiff(targetAngle, car.angle), -1.8 * dt, 1.8 * dt);
        car.speed = Math.min(car.cruise, car.speed + 200 * dt);
        moveWithCollision(car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 30);
        car.x = clamp(car.x, 40, WORLD.size - 40);
        car.y = clamp(car.y, 40, WORLD.size - 40);
        continue;
      }
      if (car.kind !== 'traffic') continue;
      car.speed = car.cruise;
      if (car.axis === 'v') car.y += car.dir * car.speed * dt;
      else car.x += car.dir * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const along = car.axis === 'v' ? car.y : car.x;
      const cross = car.axis === 'v' ? car.x : car.y;
      for (const road of ROADS) {
        if (Math.abs(along - road) < 6 && Math.abs(cross - nearestRoad(cross)) < 4 && random.next() < 0.004) {
          car.axis = car.axis === 'v' ? 'h' : 'v';
          car.dir = random.next() < 0.5 ? 1 : -1;
          break;
        }
      }
      if (car.axis === 'v') {
        if (car.y < 60) { car.y = WORLD.size - 60; }
        if (car.y > WORLD.size - 60) { car.y = 60; }
        car.x = nearestRoad(car.x) + car.lane;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        if (car.x < 60) { car.x = WORLD.size - 60; }
        if (car.x > WORLD.size - 60) { car.x = 60; }
        car.y = nearestRoad(car.y) + car.lane;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
    }
  }

  function updatePolice(dt) {
    const player = state.player;
    // Exactly `wanted` police cars (0..5) — always a defined number.
    const desired = clamp(state.wanted || 0, 0, WANTED_MAX);
    let police = state.cars.filter((c) => c.kind === 'police');
    // Spawn what is missing, on a road near the player.
    while (police.length < desired) {
      const angle = random.range(0, Math.PI * 2);
      const px = clamp(player.x + Math.cos(angle) * 650, 100, WORLD.size - 100);
      const py = clamp(player.y + Math.sin(angle) * 650, 100, WORLD.size - 100);
      const car = makeCar('police', nearestRoad(px), nearestRoad(py), 0, '#1f2a37', 'ai');
      car.cruise = POLICE.maxSpeed;
      car.speed = 300;
      police.push(car);
    }
    // Remove the surplus when the wanted level falls.
    while (police.length > desired) {
      const car = police.pop();
      state.cars.splice(state.cars.indexOf(car), 1);
    }
    for (const car of police) {
      const targetAngle = angleTo(car.x, car.y, player.x, player.y);
      car.angle += clamp(angleDiff(targetAngle, car.angle), -2.4 * dt, 2.4 * dt);
      car.speed = Math.min(POLICE.maxSpeed, car.speed + POLICE.accel * dt);
      moveWithCollision(car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 30);
      car.x = clamp(car.x, 40, WORLD.size - 40);
      car.y = clamp(car.y, 40, WORLD.size - 40);
      const d = dist(car.x, car.y, player.x, player.y);
      if (d < 300) state.crimeTimer = 0; // Seen by the police: the heat does not cool off.
      if (car.ramHitCooldown > 0) car.ramHitCooldown -= dt;
      if (d < 56) {
        if (player.onFoot) {
          player.bustTimer += dt;
          if (player.bustTimer >= POLICE.bustTime) {
            state.over = true;
            state.overReason = 'Ditangkap polisi Frostpeak.';
            return EVENT_BUSTED;
          }
        } else if (car.ramHitCooldown <= 0 && player.invulnerable <= 0) {
          // A ram is one small hit with a cooldown, and the police car
          // bounces off; the player is briefly invulnerable afterwards, so
          // a chase stays survivable instead of draining health every frame.
          car.ramHitCooldown = POLICE.ramCooldown;
          player.invulnerable = 1.0;
          player.health = Math.max(0, player.health - POLICE.ramDamage);
          if (player.car) player.car.speed *= 0.85;
          car.speed *= 0.4;
          car.x -= Math.cos(car.angle) * 30;
          car.y -= Math.sin(car.angle) * 30;
          if (player.health <= 0) {
            state.over = true;
            state.overReason = 'Mobilmu hancur dalam kejaran polisi.';
            return EVENT_WASTED;
          }
        }
      } else if (player.onFoot) {
        player.bustTimer = Math.max(0, player.bustTimer - dt * 2);
      }
    }
    return 0;
  }

  function updatePeds(dt) {
    const player = state.player;
    for (const ped of state.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.health = ped.kind === 'gang' ? 60 : 30;
          ped.x = clamp(ped.x + random.range(-200, 200), 100, WORLD.size - 100);
          ped.y = clamp(ped.y + random.range(-200, 200), 100, WORLD.size - 100);
        }
        continue;
      }
      if (ped.kind === 'skier') continue; // Trapped skiers wait to be rescued.
      const dPlayer = dist(ped.x, ped.y, player.x, player.y);
      if (ped.kind === 'gang' && dPlayer < 220 && player.onFoot) {
        // Gang members close in and swing at the player on foot.
        ped.angle = angleTo(ped.x, ped.y, player.x, player.y);
        const speed = 150;
        moveWithCollision(ped, Math.cos(ped.angle) * speed * dt, Math.sin(ped.angle) * speed * dt, 14);
        ped.attackTimer -= dt;
        if (dPlayer < 40 && ped.attackTimer <= 0) {
          ped.attackTimer = 1;
          player.health = Math.max(0, player.health - 8);
          if (player.health <= 0) {
            state.over = true;
            state.overReason = 'Dikeroyok Avalanche Kings di hutan pinus.';
            return EVENT_WASTED;
          }
        }
        continue;
      }
      if (ped.kind === 'civilian' && dPlayer < 140 && state.wanted > 0) {
        // Civilians run from trouble.
        ped.angle = angleTo(player.x, player.y, ped.x, ped.y);
        moveWithCollision(ped, Math.cos(ped.angle) * 200 * dt, Math.sin(ped.angle) * 200 * dt, 14);
        continue;
      }
      ped.wanderTimer -= dt;
      if (ped.wanderTimer <= 0) {
        ped.wanderTimer = random.range(2, 5);
        ped.angle = random.range(0, Math.PI * 2);
      }
      const speed = ped.kind === 'gang' ? 60 : 55;
      moveWithCollision(ped, Math.cos(ped.angle) * speed * dt, Math.sin(ped.angle) * speed * dt, 14);
      ped.x = clamp(ped.x, 60, WORLD.size - 60);
      ped.y = clamp(ped.y, 60, WORLD.size - 60);
    }
    return 0;
  }

  function updateCarCollisions(dt) {
    const player = state.player;
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 52 && d > 0.01) {
          const push = (52 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          if (a.driver !== 'player') { a.x -= nx * push; a.y -= ny * push; }
          if (b.driver !== 'player') { b.x += nx * push; b.y += ny * push; }
          // Ramming the courier counts toward mission 3.
          const courier = a.kind === 'courier' ? a : b.kind === 'courier' ? b : null;
          const other = courier === a ? b : a;
          if (courier && other.driver === 'player' && courier.ramCooldown <= 0) {
            const impact = Math.abs(other.speed) + Math.abs(courier.speed);
            if (impact > 220) {
              courier.ramCooldown = 1;
              const step = currentStep();
              if (step && step.type === 'ram') {
                state.missionProgress += 1;
                if (state.missionProgress >= step.count) {
                  courier.driver = null;
                  courier.speed = 0;
                  return completeStep();
                }
              }
            }
          }
        }
      }
    }
    for (const car of cars) {
      if (car.ramCooldown > 0) car.ramCooldown -= dt;
    }
    // The player's car hitting a pedestrian.
    if (player.car && Math.abs(player.car.speed) > 120) {
      for (const ped of state.peds) {
        if (ped.down || ped.kind === 'gang') continue;
        if (dist(player.car.x, player.car.y, ped.x, ped.y) < 40) {
          ped.down = true;
          ped.downTimer = 6;
          ped.health = 0;
          addWanted(2);
          setToast('Kamu menabrak pejalan kaki! Wanted naik.');
        }
      }
    }
    return 0;
  }

  function updateMission(dt) {
    const mission = currentMission();
    if (!mission) return 0;
    let events = 0;
    if (mission.timeLimit) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        failMission('waktu habis');
        return events;
      }
    }
    const step = currentStep();
    if (!step) return events;
    const player = state.player;
    if (step.type === 'enterCar') {
      if (!player.onFoot && dist(player.x, player.y, step.target.x, step.target.y) < 160) {
        events |= completeStep();
      }
    } else if (step.type === 'goto') {
      if (dist(player.x, player.y, step.target.x, step.target.y) < step.radius) {
        events |= completeStep();
      }
    } else if (step.type === 'rescue') {
      // The rescue timer only resets when the player walks away from every
      // skier: resetting it on any step without a completed rescue would
      // wipe the progress every frame and make rescues impossible.
      let nearSkier = false;
      for (const ped of state.peds) {
        if (ped.kind !== 'skier' || ped.rescued || ped.down) continue;
        if (player.onFoot && dist(player.x, player.y, ped.x, ped.y) < 48) {
          nearSkier = true;
          state.rescueTimer += dt;
          if (state.rescueTimer > 0.6) {
            ped.rescued = true;
            ped.down = true;
            ped.downTimer = 999;
            state.rescueTimer = 0;
            state.missionProgress += 1;
            events |= EVENT_PICKUP;
            setToast(`Pemain ski diselamatkan (${state.missionProgress}/3).`);
            if (state.missionProgress >= step.count) events |= completeStep();
          }
          break; // Only count one skier per step.
        }
      }
      if (!nearSkier) state.rescueTimer = 0;
    }
    return events;
  }

  function updatePickups() {
    const player = state.player;
    let events = 0;
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      pickup.bob += STEP;
      if (dist(player.x, player.y, pickup.x, pickup.y) < 36) {
        pickup.active = false;
        if (pickup.kind === 'cash') {
          state.cash += 50;
          setToast('+$50 uang tunai ditemukan di salju.');
        } else {
          player.health = Math.min(PLAYER.health, player.health + 40);
          setToast('P3K: kesehatan pulih.');
        }
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function reset() {
    state.time = 0;
    state.cash = 0;
    state.wanted = 0;
    state.crimeTimer = 0;
    state.missionIndex = 0;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.missionProgress = 0;
    state.missionToast = '';
    state.toastTimer = 0;
    state.won = false;
    state.over = false;
    state.overReason = '';
    state.courier = null;
    state.rescueTimer = 0;
    state.cars = [];
    state.peds = [];
    state.pickups = [];
    carId = 0;
    const player = state.player;
    player.x = 1600;
    player.y = 1750;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.onFoot = true;
    player.car = null;
    player.punchCooldown = 0;
    player.invulnerable = 0;
    player.bustTimer = 0;
    player.speed = 0;
    spawnParked();
    spawnTraffic();
    spawnPeds();
    spawnPickups();
    state.camera.x = clamp(player.x - WORLD.viewW / 2, 0, WORLD.size - WORLD.viewW);
    state.camera.y = clamp(player.y - WORLD.viewH / 2, 0, WORLD.size - WORLD.viewH);
    const mission = currentMission();
    if (mission && mission.timeLimit) state.missionTimer = mission.timeLimit;
    startMissionStep();
  }

  function step(dt, move, run, actions) {
    let events = 0;
    state.time += dt;
    // The blizzard breathes: calm spells and whiteout gusts.
    state.blizzard = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * 0.11) * Math.sin(state.time * 0.043 + 2));
    if (state.toastTimer > 0) state.toastTimer -= dt;

    const player = state.player;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;

    if (actions & 4) { // ACTION_ENTER
      if (player.onFoot) enterNearestCar();
      else exitCar();
    }
    if (actions & 8) { // ACTION_PUNCH
      if (player.onFoot) events |= punch();
    }

    if (player.onFoot) {
      const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const mx = move.x;
      const my = move.y;
      const len = Math.hypot(mx, my);
      player.moving = len > 0;
      if (len > 0) {
        player.angle = Math.atan2(my, mx);
        moveWithCollision(player, (mx / len) * speed * dt, (my / len) * speed * dt, PLAYER.radius);
      }
      player.x = clamp(player.x, 30, WORLD.size - 30);
      player.y = clamp(player.y, 30, WORLD.size - 30);
      player.speed = len > 0 ? speed : 0;
    } else if (player.car) {
      driveCar(player.car, move, dt);
      player.x = player.car.x;
      player.y = player.car.y;
      player.angle = player.car.angle;
      player.speed = Math.abs(player.car.speed);
      player.moving = Math.abs(player.car.speed) > 10;
    }

    // Wanted decays when the player stays clean and out of sight.
    state.crimeTimer += dt;
    if (state.wanted > 0 && state.crimeTimer > 25) {
      state.wanted = clamp(state.wanted - 1, 0, WANTED_MAX);
      state.crimeTimer = 0;
      setToast('Polisi kehilangan jejakmu. Wanted turun.');
    }
    if (state.wanted === 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 2 * dt);
    }

    updateTraffic(dt);
    events |= updatePolice(dt);
    if (state.over) return events;
    events |= updatePeds(dt);
    if (state.over) return events;
    events |= updateCarCollisions(dt);
    events |= updateMission(dt);
    events |= updatePickups();

    // Camera follows the player, clamped inside the town.
    state.camera.x = clamp(player.x - WORLD.viewW / 2, 0, WORLD.size - WORLD.viewW);
    state.camera.y = clamp(player.y - WORLD.viewH / 2, 0, WORLD.size - WORLD.viewH);
    return events;
  }

  reset();
  return {
    state, reset, step, addWanted, enterNearestCar, exitCar,
    currentMission, currentStep,
    town: { buildings, trees, lake, lift },
  };
}
