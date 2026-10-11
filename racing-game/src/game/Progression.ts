import { CAR_CATALOG, getCarDefinition, StatKey } from '../car/CarCatalog';
import { defaultCarConfig, partKey, UPGRADE_MAX_LEVEL, upgradeCost } from '../car/Upgrades';
import { getTrackDefinition, TRACK_CATALOG } from '../tracks/TrackCatalog';
import type { Difficulty, GameModeId, SaveManager } from './SaveManager';

export const MAX_LEVEL = 50;

export function xpForLevel(level: number): number {
  return Math.round(300 * Math.pow(Math.max(0, level - 1), 1.6));
}

export function levelInfo(xp: number): { level: number; current: number; next: number; progress: number } {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current, next, progress: level >= MAX_LEVEL ? 1 : (xp - current) / (next - current) };
}

export interface RewardInput {
  mode: GameModeId;
  position: number;
  racers: number;
  difficulty: Difficulty;
  trackId: string;
  laps: number;
  newBestLap: boolean;
  newBestRace: boolean;
  driftScore: number;
  wallHits: number;
}

export interface RewardLine {
  label: string;
  coins: number;
  xp: number;
}

export interface Rewards {
  coins: number;
  xp: number;
  lines: RewardLine[];
}

const POSITION_COINS = [600, 420, 320, 250, 200, 160, 130, 100];
const POSITION_XP = [320, 240, 190, 150, 120, 100, 85, 70];
const DIFFICULTY_MUL: Record<Difficulty, number> = { easy: 0.75, normal: 1, hard: 1.4 };

export function computeRewards(r: RewardInput): Rewards {
  const track = getTrackDefinition(r.trackId);
  const lapMul = Math.max(0.5, r.laps / 3);
  const mul = DIFFICULTY_MUL[r.difficulty] * track.rewardMultiplier * lapMul;
  const lines: RewardLine[] = [];
  if (r.mode === 'race') {
    const field = 0.55 + 0.45 * Math.min(1, (r.racers - 1) / 7);
    const i = Math.min(POSITION_COINS.length - 1, r.position - 1);
    lines.push({ label: `Finished ${r.position}${['st', 'nd', 'rd'][r.position - 1] ?? 'th'}`, coins: Math.round(POSITION_COINS[i] * mul * field), xp: Math.round(POSITION_XP[i] * mul * field) });
    if (r.position === 1 && r.racers > 1) lines.push({ label: 'Victory bonus', coins: Math.round(150 * mul), xp: Math.round(60 * mul) });
  } else {
    lines.push({ label: 'Time trial complete', coins: Math.round(160 * mul), xp: Math.round(120 * mul) });
    if (r.newBestRace) lines.push({ label: 'New personal best', coins: Math.round(250 * mul), xp: 80 });
  }
  if (r.newBestLap) lines.push({ label: 'Lap record', coins: 150, xp: 50 });
  if (r.driftScore >= 40) lines.push({ label: 'Drift bonus', coins: Math.min(400, Math.floor(r.driftScore / 40)), xp: Math.min(150, Math.floor(r.driftScore / 100)) });
  if (r.wallHits <= 2) lines.push({ label: 'Clean race', coins: 100, xp: 40 });
  return { coins: lines.reduce((s, l) => s + l.coins, 0), xp: lines.reduce((s, l) => s + l.xp, 0), lines };
}

export type PurchaseResult = { ok: true } | { ok: false; reason: string };

/** All economy rules: buying cars, upgrades, parts and tracks, applying race rewards. */
export class Progression {
  constructor(private readonly save: SaveManager) {}

  get level(): number {
    return levelInfo(this.save.profile.xp).level;
  }

  get coins(): number {
    return this.save.profile.coins;
  }

  isCarOwned(id: string): boolean {
    return this.save.profile.ownedCars.includes(id);
  }

  carLockReason(id: string): string | null {
    const def = getCarDefinition(id);
    if (this.isCarOwned(id)) return null;
    if (this.level < def.unlockLevel) return `Reach level ${def.unlockLevel}`;
    return null;
  }

  buyCar(id: string): PurchaseResult {
    const def = getCarDefinition(id);
    if (this.isCarOwned(id)) return { ok: false, reason: 'Already owned' };
    if (this.level < def.unlockLevel) return { ok: false, reason: `Requires level ${def.unlockLevel}` };
    if (this.coins < def.price) return { ok: false, reason: 'Not enough coins' };
    this.save.update((p) => {
      p.coins -= def.price;
      p.ownedCars.push(id);
      p.carConfigs[id] = p.carConfigs[id] ?? defaultCarConfig(def);
      p.selectedCar = id;
    });
    return { ok: true };
  }

  selectCar(id: string): void {
    if (!this.isCarOwned(id)) return;
    this.save.update((p) => (p.selectedCar = id));
  }

  upgrade(carId: string, stat: StatKey): PurchaseResult {
    const def = getCarDefinition(carId);
    const cfg = this.save.carConfig(carId);
    const lvl = cfg.upgrades[stat];
    if (lvl >= UPGRADE_MAX_LEVEL) return { ok: false, reason: 'Maxed out' };
    const cost = upgradeCost(def, lvl);
    if (this.coins < cost) return { ok: false, reason: 'Not enough coins' };
    this.save.update((p) => {
      p.coins -= cost;
      p.carConfigs[carId].upgrades[stat] = lvl + 1;
    });
    return { ok: true };
  }

  ownsPart(carId: string, category: string, value: string | null): boolean {
    return this.save.carConfig(carId).ownedParts.includes(partKey(category, value));
  }

  /** Buys (if needed) and equips a visual part. */
  equipPart(carId: string, category: 'spoiler' | 'rims' | 'bodyKit' | 'decal' | 'underglow', value: string | null, price: number): PurchaseResult {
    const owned = this.ownsPart(carId, category, value);
    if (!owned && this.coins < price) return { ok: false, reason: 'Not enough coins' };
    this.save.update((p) => {
      const cfg = p.carConfigs[carId];
      if (!owned) {
        p.coins -= price;
        cfg.ownedParts.push(partKey(category, value));
      }
      (cfg.visual as unknown as Record<string, unknown>)[category] = value;
    });
    return { ok: true };
  }

  isTrackUnlocked(id: string): boolean {
    return this.save.profile.unlockedTracks.includes(id) || this.level >= getTrackDefinition(id).unlockLevel;
  }

  unlockTrack(id: string): PurchaseResult {
    const def = getTrackDefinition(id);
    if (this.isTrackUnlocked(id)) return { ok: false, reason: 'Already unlocked' };
    if (this.coins < def.unlockCost) return { ok: false, reason: 'Not enough coins' };
    this.save.update((p) => {
      p.coins -= def.unlockCost;
      p.unlockedTracks.push(id);
    });
    return { ok: true };
  }

  /** Applies rewards + stats. Returns what got unlocked by levelling up. */
  applyRewards(rewards: Rewards, stats: { position: number; racers: number; mode: GameModeId; distanceKm: number; drift: number }) {
    const before = this.level;
    this.save.update((p) => {
      p.coins += rewards.coins;
      p.xp += rewards.xp;
      p.stats.races++;
      if (stats.mode === 'race' && stats.racers > 1) {
        if (stats.position === 1) p.stats.wins++;
        if (stats.position <= 3) p.stats.podiums++;
      }
      p.stats.distanceKm += stats.distanceKm;
      p.stats.bestDrift = Math.max(p.stats.bestDrift, stats.drift);
    });
    const after = this.level;
    const tracks = TRACK_CATALOG.filter((t) => t.unlockLevel > before && t.unlockLevel <= after).map((t) => t.name);
    const cars = CAR_CATALOG.filter((c) => c.unlockLevel > before && c.unlockLevel <= after).map((c) => c.name);
    if (tracks.length)
      this.save.update((p) => {
        for (const t of TRACK_CATALOG) if (t.unlockLevel <= after && !p.unlockedTracks.includes(t.id)) p.unlockedTracks.push(t.id);
      });
    return { levelUp: after > before, level: after, tracks, cars };
  }
}
