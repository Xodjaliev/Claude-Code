/**
 * Car catalogue. Adding a new car = adding one entry to CAR_CATALOG.
 * Everything (physics, visuals, sound, shop) is derived from this data.
 */

export interface CarStats {
  speed: number;
  acceleration: number;
  handling: number;
  braking: number;
  nitro: number;
  drift: number;
}

export type StatKey = keyof CarStats;
export const STAT_KEYS: StatKey[] = ['speed', 'acceleration', 'handling', 'braking', 'nitro', 'drift'];
export const STAT_LABELS: Record<StatKey, string> = {
  speed: 'Speed',
  acceleration: 'Acceleration',
  handling: 'Handling',
  braking: 'Braking',
  nitro: 'Nitro',
  drift: 'Drift',
};

export type HeadlightStyle = 'slim' | 'round' | 'wide' | 'pop' | 'led';
export type TaillightStyle = 'bar' | 'round' | 'split' | 'led';
export type SpoilerType = 'none' | 'lip' | 'ducktail' | 'wing' | 'gt';
export type RimStyle = 'sport' | 'mesh' | 'turbine' | 'classic' | 'split';

/** Procedural body description (meters). Z is forward, Y is up, origin at ground level between the axles. */
export interface CarBodyShape {
  length: number;
  width: number;
  clearance: number;
  wheelRadius: number;
  wheelWidth: number;
  wheelBase: number;
  /** Shifts both axles forward (+) or back (-). */
  axleShift: number;
  trackWidth: number;
  noseHeight: number;
  beltHeight: number;
  deckHeight: number;
  tailHeight: number;
  roofHeight: number;
  /** Z of the windshield base. */
  cowlZ: number;
  /** Z of the windshield top / roof start. */
  windshieldTopZ: number;
  /** Z of the roof end. */
  roofEndZ: number;
  /** Z of the rear window base. */
  rearBaseZ: number;
  /** Cabin width as a fraction of body width. */
  cabinWidth: number;
  /** Roof width as a fraction of cabin width. */
  roofWidth: number;
  /** 0..1 how much the upper body tucks in (tumblehome). */
  sideTaper: number;
  /** Fender bulge over the wheels. */
  flare: number;
  headlights: HeadlightStyle;
  taillights: TaillightStyle;
  hoodScoop?: boolean;
  sideIntakes?: boolean;
  fins?: boolean;
  exhaustCount: 1 | 2 | 4;
  exhaustCenter?: boolean;
}

export interface EngineProfile {
  cylinders: number;
  idleRpm: number;
  maxRpm: number;
  /** Fraction of top speed reached at max rpm in each gear. */
  gears: number[];
  /** 0..1 how raspy / aggressive the synth sounds. */
  grit: number;
  /** Turbo whistle + blow-off. */
  turbo: boolean;
}

export type CarClass = 'C' | 'B' | 'A' | 'S';

export interface CarDefinition {
  id: string;
  name: string;
  maker: string;
  carClass: CarClass;
  description: string;
  stats: CarStats;
  massKg: number;
  body: CarBodyShape;
  engine: EngineProfile;
  defaultColor: string;
  defaultRimColor: string;
  defaultSpoiler: SpoilerType;
  defaultRims: RimStyle;
  price: number;
  unlockLevel: number;
  /** Multiplies upgrade costs. */
  tier: number;
}

const SIX_GEARS = [0.27, 0.42, 0.56, 0.7, 0.85, 1.0];

export const CAR_CATALOG: CarDefinition[] = [
  {
    id: 'volt-gt',
    name: 'Volt GT',
    maker: 'Arcadia',
    carClass: 'C',
    description: 'A balanced grand tourer. Forgiving, quick and the perfect car to learn every track.',
    stats: { speed: 6, acceleration: 6, handling: 6, braking: 6, nitro: 5, drift: 5 },
    massKg: 1450,
    body: {
      length: 4.45, width: 1.95, clearance: 0.15, wheelRadius: 0.34, wheelWidth: 0.26, wheelBase: 2.65, axleShift: 0,
      trackWidth: 1.64, noseHeight: 0.64, beltHeight: 0.88, deckHeight: 0.94, tailHeight: 0.92, roofHeight: 1.28,
      cowlZ: 0.6, windshieldTopZ: -0.22, roofEndZ: -0.78, rearBaseZ: -1.5, cabinWidth: 0.8, roofWidth: 0.8,
      sideTaper: 0.6, flare: 0.04, headlights: 'slim', taillights: 'bar', exhaustCount: 2,
    },
    engine: { cylinders: 6, idleRpm: 900, maxRpm: 7400, gears: SIX_GEARS, grit: 0.45, turbo: true },
    defaultColor: '#1f7bff',
    defaultRimColor: '#c9ced6',
    defaultSpoiler: 'lip',
    defaultRims: 'sport',
    price: 0,
    unlockLevel: 1,
    tier: 1,
  },
  {
    id: 'hornet-rs',
    name: 'Hornet RS',
    maker: 'Stinger',
    carClass: 'C',
    description: 'Light, nimble rally-bred hatchback. Low top speed, but it carves corners like nothing else.',
    stats: { speed: 4.5, acceleration: 7, handling: 8.5, braking: 7, nitro: 5, drift: 6.5 },
    massKg: 1180,
    body: {
      length: 4.0, width: 1.86, clearance: 0.17, wheelRadius: 0.33, wheelWidth: 0.24, wheelBase: 2.52, axleShift: 0.02,
      trackWidth: 1.58, noseHeight: 0.7, beltHeight: 0.94, deckHeight: 1.04, tailHeight: 1.02, roofHeight: 1.44,
      cowlZ: 0.78, windshieldTopZ: 0.02, roofEndZ: -1.58, rearBaseZ: -1.86, cabinWidth: 0.84, roofWidth: 0.86,
      sideTaper: 0.45, flare: 0.07, headlights: 'wide', taillights: 'split', exhaustCount: 1, exhaustCenter: true,
    },
    engine: { cylinders: 4, idleRpm: 1000, maxRpm: 8200, gears: SIX_GEARS, grit: 0.7, turbo: true },
    defaultColor: '#ffcc00',
    defaultRimColor: '#1b1b1b',
    defaultSpoiler: 'none',
    defaultRims: 'mesh',
    price: 3500,
    unlockLevel: 1,
    tier: 1.15,
  },
  {
    id: 'kitsune-s',
    name: 'Kitsune S',
    maker: 'Kaze Works',
    carClass: 'B',
    description: 'Turbocharged JDM drift legend. Slides on command and refills nitro faster while sideways.',
    stats: { speed: 6.2, acceleration: 6.5, handling: 6.5, braking: 6, nitro: 7.5, drift: 9.5 },
    massKg: 1260,
    body: {
      length: 4.4, width: 1.82, clearance: 0.13, wheelRadius: 0.33, wheelWidth: 0.25, wheelBase: 2.56, axleShift: 0.05,
      trackWidth: 1.56, noseHeight: 0.6, beltHeight: 0.84, deckHeight: 0.9, tailHeight: 0.92, roofHeight: 1.25,
      cowlZ: 0.62, windshieldTopZ: -0.2, roofEndZ: -0.82, rearBaseZ: -1.32, cabinWidth: 0.8, roofWidth: 0.82,
      sideTaper: 0.5, flare: 0.05, headlights: 'pop', taillights: 'round', exhaustCount: 1,
    },
    engine: { cylinders: 6, idleRpm: 950, maxRpm: 8000, gears: SIX_GEARS, grit: 0.55, turbo: true },
    defaultColor: '#f2f2f2',
    defaultRimColor: '#d4a017',
    defaultSpoiler: 'gt',
    defaultRims: 'split',
    price: 6000,
    unlockLevel: 2,
    tier: 1.35,
  },
  {
    id: 'phantom-v8',
    name: 'Phantom V8',
    maker: 'Ironside',
    carClass: 'B',
    description: 'Old-school muscle with a supercharged V8. Monstrous straight-line pace, heavy in the bends.',
    stats: { speed: 7.6, acceleration: 8.2, handling: 4.6, braking: 5, nitro: 6.5, drift: 7.2 },
    massKg: 1720,
    body: {
      length: 4.85, width: 2.0, clearance: 0.15, wheelRadius: 0.36, wheelWidth: 0.3, wheelBase: 2.85, axleShift: -0.07,
      trackWidth: 1.7, noseHeight: 0.8, beltHeight: 0.96, deckHeight: 0.99, tailHeight: 1.0, roofHeight: 1.33,
      cowlZ: 0.22, windshieldTopZ: -0.45, roofEndZ: -0.98, rearBaseZ: -1.72, cabinWidth: 0.82, roofWidth: 0.86,
      sideTaper: 0.35, flare: 0.06, headlights: 'round', taillights: 'split', hoodScoop: true, exhaustCount: 2,
    },
    engine: { cylinders: 8, idleRpm: 750, maxRpm: 6800, gears: SIX_GEARS, grit: 0.85, turbo: false },
    defaultColor: '#8e0e18',
    defaultRimColor: '#e6e6e6',
    defaultSpoiler: 'ducktail',
    defaultRims: 'classic',
    price: 9000,
    unlockLevel: 3,
    tier: 1.6,
  },
  {
    id: 'kaiju-x',
    name: 'Kaiju X',
    maker: 'Fulmine',
    carClass: 'A',
    description: 'Mid-engined V10 wedge. Razor sharp, brutally fast and loud enough to wake the whole city.',
    stats: { speed: 8.6, acceleration: 8.6, handling: 7.6, braking: 8, nitro: 7, drift: 6 },
    massKg: 1500,
    body: {
      length: 4.6, width: 2.05, clearance: 0.12, wheelRadius: 0.35, wheelWidth: 0.3, wheelBase: 2.7, axleShift: -0.05,
      trackWidth: 1.72, noseHeight: 0.56, beltHeight: 0.86, deckHeight: 0.96, tailHeight: 0.96, roofHeight: 1.14,
      cowlZ: 0.88, windshieldTopZ: 0.05, roofEndZ: -0.42, rearBaseZ: -1.62, cabinWidth: 0.74, roofWidth: 0.78,
      sideTaper: 0.7, flare: 0.07, headlights: 'led', taillights: 'led', sideIntakes: true, exhaustCount: 4, exhaustCenter: true,
    },
    engine: { cylinders: 10, idleRpm: 1000, maxRpm: 8800, gears: [0.24, 0.38, 0.52, 0.66, 0.8, 0.91, 1.0], grit: 0.6, turbo: false },
    defaultColor: '#8fdc00',
    defaultRimColor: '#202020',
    defaultSpoiler: 'wing',
    defaultRims: 'turbine',
    price: 15000,
    unlockLevel: 5,
    tier: 2,
  },
  {
    id: 'spectre-lm',
    name: 'Spectre LM',
    maker: 'Valkyr',
    carClass: 'S',
    description: 'A road-legal Le Mans prototype. Maximum downforce, maximum speed, maximum respect.',
    stats: { speed: 9.5, acceleration: 9.1, handling: 9, braking: 9, nitro: 8, drift: 5 },
    massKg: 1250,
    body: {
      length: 4.9, width: 2.05, clearance: 0.1, wheelRadius: 0.36, wheelWidth: 0.31, wheelBase: 2.9, axleShift: -0.02,
      trackWidth: 1.74, noseHeight: 0.5, beltHeight: 0.8, deckHeight: 0.98, tailHeight: 1.0, roofHeight: 1.09,
      cowlZ: 0.98, windshieldTopZ: 0.18, roofEndZ: -0.32, rearBaseZ: -0.95, cabinWidth: 0.62, roofWidth: 0.72,
      sideTaper: 0.75, flare: 0.09, headlights: 'led', taillights: 'bar', fins: true, sideIntakes: true, exhaustCount: 2, exhaustCenter: true,
    },
    engine: { cylinders: 12, idleRpm: 1100, maxRpm: 9500, gears: [0.24, 0.38, 0.52, 0.66, 0.8, 0.91, 1.0], grit: 0.4, turbo: true },
    defaultColor: '#ff5a00',
    defaultRimColor: '#111111',
    defaultSpoiler: 'gt',
    defaultRims: 'turbine',
    price: 25000,
    unlockLevel: 7,
    tier: 2.4,
  },
];

export function getCarDefinition(id: string): CarDefinition {
  return CAR_CATALOG.find((c) => c.id === id) ?? CAR_CATALOG[0];
}

export const PAINT_SWATCHES = [
  '#f2f2f2', '#1b1b1d', '#8a8f98', '#d0021b', '#8e0e18', '#ff5a00', '#ffcc00', '#8fdc00',
  '#00b26b', '#00c8d7', '#1f7bff', '#2a2fb8', '#7b2cff', '#ff2bd6', '#c48a3a', '#3e5a36',
];

export const RIM_SWATCHES = ['#c9ced6', '#e6e6e6', '#202020', '#111111', '#d4a017', '#b87333', '#ff2bd6', '#1f7bff', '#d0021b', '#8fdc00'];
