// Frostpeak Drift — every tuning number, colour and mission in one place.
// The world is a 3200 x 3200 snowy mountain resort town; the camera shows a
// 1280 x 720 window of it. Nothing here names any commercial game.

export const WORLD = { size: 3200, viewW: 1280, viewH: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'frostpeak-drift.save.v1';

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  punchRange: 48,
  punchDamage: 34,
  punchCooldown: 0.35,
};

export const CAR = {
  length: 54,
  width: 28,
  accel: 430,
  brake: 640,
  maxSpeed: 590,
  reverseMax: 165,
  steer: 2.6,
  // Icy mountain roads: grip is low, so cars slide and drift.
  grip: 2.4,
  ramDamage: 30,
};

export const WANTED_MAX = 5;

export const POLICE = {
  accel: 460,
  maxSpeed: 520,
  // One ram is a small hit: the player also gets a short invulnerability
  // window after any ram, so even three police cars cannot drain health
  // faster than about 1 HP a second — a 30-second chase stays survivable.
  ramDamage: 1,
  ramCooldown: 1.0,
  bustTime: 1.2,
};

export const PALETTE = {
  snow: '#e8eef7',
  snowShade: '#cdd9ea',
  snowDrift: '#f4f8ff',
  pine: '#1d4a33',
  pineSnow: '#dcebf5',
  road: '#3a4150',
  roadEdge: '#6b7688',
  roadLine: '#e8d44d',
  lake: '#9fd4e8',
  lakeIce: '#cfeaf7',
  cabinWood: '#7a5230',
  cabinRoof: '#f2f6fb',
  building: '#5a6b84',
  buildingWarm: '#8a6b4a',
  windowLit: '#ffd97a',
  windowDark: '#2c3547',
  liftTower: '#4a5568',
  playerCoat: '#d63031',
  police: '#1f2a37',
  policeLight: '#ff3b30',
  policeLight2: '#2f7bff',
  gangWhiteout: '#dfe6ee',
  gangAvalanche: '#5b2d8e',
  hudPanel: 'rgba(10, 18, 32, 0.72)',
  hudText: '#f2f6fb',
  hudMuted: '#aebdd2',
  star: '#ffd23e',
  starEmpty: '#5a6b84',
  marker: '#ffcf3f',
  markerRing: '#ff5a3c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Six story missions for Raka, a snowplow driver at the Frostpeak resort who
// gets pulled into a turf war between the Whiteout Crew and the Avalanche Kings.
export const MISSIONS = [
  {
    id: 1,
    title: 'Salju Pertama',
    giver: 'Mara, dispatcher resort',
    brief: 'Badai menutup jalan desa. Ambil snowplow di depot dan bersihkan 3 tumpukan salju.',
    reward: 400,
    steps: [
      { type: 'enterCar', label: 'Naik snowplow di depot (tekan E di dekatnya)', target: { x: 1000, y: 1000 } },
      { type: 'goto', label: 'Bersihkan salju di pertigaan utara', target: { x: 1600, y: 400 }, radius: 90 },
      { type: 'goto', label: 'Bersihkan salju di alun-alun resort', target: { x: 1600, y: 1600 }, radius: 90 },
      { type: 'goto', label: 'Bersihkan salju di jalan danau', target: { x: 2200, y: 1000 }, radius: 90 },
    ],
  },
  {
    id: 2,
    title: 'Paket Badai',
    giver: 'Mara',
    brief: 'Obat untuk klinik lereng timur harus sampai sebelum badai makin parah. Antar paketnya, ada batas waktu.',
    reward: 600,
    timeLimit: 75,
    steps: [
      { type: 'goto', label: 'Ambil paket di lobi resort', target: { x: 1600, y: 1500 }, radius: 70, onFootOk: true },
      { type: 'goto', label: 'Antar paket ke klinik lereng timur', target: { x: 2800, y: 2200 }, radius: 80 },
    ],
  },
  {
    id: 3,
    title: 'Jejak Whiteout',
    giver: 'Dimas, penjaga lift ski',
    brief: 'Kurir Whiteout Crew menyelundupkan barang lewat jalan es. Tabrak mobilnya 3 kali sampai ia berhenti.',
    reward: 800,
    steps: [
      { type: 'ram', label: 'Tabrak mobil kurir Whiteout 3 kali', target: { x: 2200, y: 1600 }, count: 3 },
    ],
  },
  {
    id: 4,
    title: 'Longsor di Jalur 7',
    giver: 'Mara',
    brief: 'Longsor menimbun jalur ski 7. Selamatkan 3 pemain ski yang terjebak sebelum mereka kedinginan.',
    reward: 900,
    timeLimit: 90,
    steps: [
      { type: 'rescue', label: 'Selamatkan pemain ski yang terjebak (3)', target: { x: 600, y: 2200 }, count: 3 },
    ],
  },
  {
    id: 5,
    title: 'Perang Salju',
    giver: 'Dimas',
    brief: 'Avalanche Kings menyerbu kabin kayu di hutan pinus. Usir 4 anggota geng itu.',
    reward: 1200,
    steps: [
      { type: 'defeat', label: 'Kalahkan anggota Avalanche Kings (4)', target: { x: 600, y: 600 }, count: 4 },
    ],
  },
  {
    id: 6,
    title: 'Puncak Frostpeak',
    giver: 'Mara',
    brief: 'Bukti penyelundupan ada di pondok puncak. Ambil, lalu kabur dari kejaran polisi menuju gerbang selatan.',
    reward: 2000,
    steps: [
      { type: 'goto', label: 'Ambil bukti di pondok puncak', target: { x: 2800, y: 400 }, radius: 80, onFootOk: true },
      { type: 'goto', label: 'Kabur ke gerbang selatan Frostpeak', target: { x: 1600, y: 2900 }, radius: 100 },
    ],
  },
];

export const STORY_INTRO = [
  'Frostpeak — kota resort di pegunungan bersalju.',
  'Raka, sopir snowplow, hanya ingin jalannya bersih.',
  'Tapi Whiteout Crew dan Avalanche Kings berebut kota ini.',
  'Enam pekerjaan. Satu musim dingin. Jangan sampai ketangkap.',
];
