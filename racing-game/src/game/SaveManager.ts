import { CAR_CATALOG, getCarDefinition } from '../car/CarCatalog';
import { CarConfig, defaultCarConfig } from '../car/Upgrades';
import { TRACK_CATALOG } from '../tracks/TrackCatalog';
import type { TimeOfDay } from '../tracks/Atmosphere';
import { EventEmitter } from '../utils/EventEmitter';
import { storage } from '../utils/storage';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameModeId = 'race' | 'timeTrial';

export interface RaceSetup {
  trackId: string;
  laps: number;
  opponents: number;
  difficulty: Difficulty;
  mode: GameModeId;
  timeOfDay: TimeOfDay | 'auto';
}

export interface PlayerStats {
  races: number;
  wins: number;
  podiums: number;
  distanceKm: number;
  bestDrift: number;
}

export interface PlayerProfile {
  version: number;
  coins: number;
  xp: number;
  ownedCars: string[];
  selectedCar: string;
  carConfigs: Record<string, CarConfig>;
  unlockedTracks: string[];
  setup: RaceSetup;
  stats: PlayerStats;
}

const KEY = 'velocity-rush-save-v1';
const VERSION = 1;
export const STARTING_COINS = 2000;

function freshProfile(): PlayerProfile {
  const starter = CAR_CATALOG[0];
  return {
    version: VERSION,
    coins: STARTING_COINS,
    xp: 0,
    ownedCars: [starter.id],
    selectedCar: starter.id,
    carConfigs: { [starter.id]: defaultCarConfig(starter) },
    unlockedTracks: [TRACK_CATALOG[0].id],
    setup: { trackId: TRACK_CATALOG[0].id, laps: 3, opponents: 7, difficulty: 'normal', mode: 'race', timeOfDay: 'auto' },
    stats: { races: 0, wins: 0, podiums: 0, distanceKm: 0, bestDrift: 0 },
  };
}

/** Persistent player profile (localStorage). Emits `change` after every mutation. */
export class SaveManager extends EventEmitter<{ change: PlayerProfile }> {
  private data: PlayerProfile;

  constructor() {
    super();
    const saved = storage.load<PlayerProfile>(KEY);
    this.data = saved && saved.version === VERSION ? this.migrate(saved) : freshProfile();
  }

  private migrate(p: PlayerProfile): PlayerProfile {
    const fresh = freshProfile();
    const out: PlayerProfile = { ...fresh, ...p, setup: { ...fresh.setup, ...p.setup }, stats: { ...fresh.stats, ...p.stats } };
    // make sure every owned car has a config and the selection is valid
    for (const id of out.ownedCars) if (!out.carConfigs[id]) out.carConfigs[id] = defaultCarConfig(getCarDefinition(id));
    if (!out.ownedCars.includes(out.selectedCar)) out.selectedCar = out.ownedCars[0];
    if (!out.unlockedTracks.length) out.unlockedTracks = [TRACK_CATALOG[0].id];
    return out;
  }

  get profile(): Readonly<PlayerProfile> {
    return this.data;
  }

  /** Mutate the profile, then persist + notify. */
  update(fn: (p: PlayerProfile) => void): void {
    fn(this.data);
    storage.save(KEY, this.data);
    this.emit('change', this.data);
  }

  carConfig(carId: string): CarConfig {
    let c = this.data.carConfigs[carId];
    if (!c) {
      c = defaultCarConfig(getCarDefinition(carId));
      this.data.carConfigs[carId] = c;
    }
    return c;
  }

  resetProgress(): void {
    this.data = freshProfile();
    storage.save(KEY, this.data);
    this.emit('change', this.data);
  }
}
