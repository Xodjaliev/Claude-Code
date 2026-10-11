import { CarDefinition, CarStats, RimStyle, SpoilerType, StatKey, STAT_KEYS } from './CarCatalog';

/** Performance upgrades: each stat has 5 levels, +0.4 stat points per level. */
export const UPGRADE_MAX_LEVEL = 5;
export const STAT_PER_LEVEL = 0.4;
const BASE_UPGRADE_COST = [500, 900, 1500, 2300, 3400];

export const UPGRADE_NAMES: Record<StatKey, string> = {
  speed: 'Engine Tune',
  acceleration: 'Turbo & ECU',
  handling: 'Tyres & Suspension',
  braking: 'Carbon Brakes',
  nitro: 'Nitro System',
  drift: 'Drift Differential',
};

export type BodyKit = 'stock' | 'sport' | 'wide';
export type DecalType = 'none' | 'stripes' | 'racing' | 'side';
export type PaintFinish = 'gloss' | 'metallic' | 'matte' | 'pearl';

export interface VisualConfig {
  spoiler: SpoilerType;
  rims: RimStyle;
  bodyKit: BodyKit;
  decal: DecalType;
  /** Underglow neon colour, or null when not installed. */
  underglow: string | null;
  /** Window tint 0 (clear) .. 1 (limo). */
  tint: number;
}

export type Upgrades = Record<StatKey, number>;

export interface CarConfig {
  color: string;
  accentColor: string;
  rimColor: string;
  finish: PaintFinish;
  upgrades: Upgrades;
  visual: VisualConfig;
  /** Owned visual parts, e.g. "spoiler:wing", "rims:mesh". */
  ownedParts: string[];
  /** Race number painted with the "racing" decal. */
  raceNumber: number;
}

export interface VisualPartOption<T extends string | null> {
  value: T;
  label: string;
  price: number;
}

export const SPOILER_OPTIONS: VisualPartOption<SpoilerType>[] = [
  { value: 'none', label: 'None', price: 0 },
  { value: 'lip', label: 'Lip', price: 400 },
  { value: 'ducktail', label: 'Ducktail', price: 600 },
  { value: 'wing', label: 'Street Wing', price: 900 },
  { value: 'gt', label: 'GT Wing', price: 1500 },
];

export const RIM_OPTIONS: VisualPartOption<RimStyle>[] = [
  { value: 'sport', label: 'Sport 5', price: 500 },
  { value: 'mesh', label: 'Mesh', price: 700 },
  { value: 'turbine', label: 'Turbine', price: 900 },
  { value: 'classic', label: 'Classic Dish', price: 600 },
  { value: 'split', label: 'Split Spoke', price: 800 },
];

export const BODYKIT_OPTIONS: VisualPartOption<BodyKit>[] = [
  { value: 'stock', label: 'Stock', price: 0 },
  { value: 'sport', label: 'Sport Kit', price: 1200 },
  { value: 'wide', label: 'Widebody', price: 2400 },
];

export const DECAL_OPTIONS: VisualPartOption<DecalType>[] = [
  { value: 'none', label: 'None', price: 0 },
  { value: 'stripes', label: 'Twin Stripes', price: 350 },
  { value: 'side', label: 'Side Stripe', price: 300 },
  { value: 'racing', label: 'Race Livery', price: 700 },
];

export const UNDERGLOW_OPTIONS: VisualPartOption<string | null>[] = [
  { value: null, label: 'Off', price: 0 },
  { value: '#00e5ff', label: 'Cyan', price: 800 },
  { value: '#ff2bd6', label: 'Magenta', price: 800 },
  { value: '#7cff4f', label: 'Toxic', price: 800 },
  { value: '#ff7a1a', label: 'Amber', price: 800 },
  { value: '#7b5cff', label: 'Violet', price: 800 },
];

export const FINISH_OPTIONS: VisualPartOption<PaintFinish>[] = [
  { value: 'gloss', label: 'Gloss', price: 0 },
  { value: 'metallic', label: 'Metallic', price: 0 },
  { value: 'pearl', label: 'Pearl', price: 0 },
  { value: 'matte', label: 'Matte', price: 0 },
];

export function partKey(category: string, value: string | null): string {
  return `${category}:${value ?? 'none'}`;
}

export function emptyUpgrades(): Upgrades {
  return { speed: 0, acceleration: 0, handling: 0, braking: 0, nitro: 0, drift: 0 };
}

export function defaultCarConfig(def: CarDefinition): CarConfig {
  return {
    color: def.defaultColor,
    accentColor: '#111111',
    rimColor: def.defaultRimColor,
    finish: 'metallic',
    upgrades: emptyUpgrades(),
    visual: {
      spoiler: def.defaultSpoiler,
      rims: def.defaultRims,
      bodyKit: 'stock',
      decal: 'none',
      underglow: null,
      tint: 0.6,
    },
    ownedParts: [
      partKey('spoiler', def.defaultSpoiler),
      partKey('spoiler', 'none'),
      partKey('rims', def.defaultRims),
      partKey('bodyKit', 'stock'),
      partKey('decal', 'none'),
      partKey('underglow', null),
    ],
    raceNumber: Math.floor(Math.random() * 98) + 1,
  };
}

export function upgradeCost(def: CarDefinition, currentLevel: number): number {
  if (currentLevel >= UPGRADE_MAX_LEVEL) return Infinity;
  return Math.round((BASE_UPGRADE_COST[currentLevel] * def.tier) / 50) * 50;
}

export function effectiveStats(def: CarDefinition, upgrades: Upgrades): CarStats {
  const out = { ...def.stats };
  for (const k of STAT_KEYS) out[k] = def.stats[k] + (upgrades[k] ?? 0) * STAT_PER_LEVEL;
  return out;
}

/** Overall performance index shown in the UI (like "PI 540"). */
export function performanceIndex(stats: CarStats): number {
  const s = stats.speed * 1.4 + stats.acceleration * 1.2 + stats.handling * 1.2 + stats.braking * 0.7 + stats.nitro * 0.7 + stats.drift * 0.3;
  return Math.round(s * 12);
}
