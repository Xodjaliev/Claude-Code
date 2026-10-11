import { storage } from '../utils/storage';

export interface LeaderboardEntry {
  name: string;
  carId: string;
  /** total race time (s) or null for lap-only records */
  raceTime: number | null;
  bestLap: number;
  laps: number;
  date: number;
}

/**
 * Leaderboard abstraction. LocalLeaderboard keeps the top 10 per track in localStorage;
 * an online implementation only needs to implement this interface.
 */
export interface LeaderboardService {
  submit(trackId: string, entry: LeaderboardEntry): Promise<{ lapRank: number; raceRank: number }>;
  top(trackId: string, by: 'lap' | 'race', limit?: number): Promise<LeaderboardEntry[]>;
  personalBest(trackId: string): { lap: number | null; race: number | null };
}

const KEY = 'velocity-rush-leaderboard-v1';

export class LocalLeaderboard implements LeaderboardService {
  private data: Record<string, LeaderboardEntry[]> = storage.load(KEY) ?? {};

  async submit(trackId: string, entry: LeaderboardEntry) {
    const list = (this.data[trackId] ??= []);
    list.push(entry);
    list.sort((a, b) => a.bestLap - b.bestLap);
    const lapRank = list.indexOf(entry) + 1;
    const races = list.filter((e) => e.raceTime !== null).sort((a, b) => a.raceTime! - b.raceTime!);
    const raceRank = entry.raceTime !== null ? races.indexOf(entry) + 1 : 0;
    // keep the 10 best laps and the 10 best races
    const keep = new Set([...list.slice(0, 10), ...races.slice(0, 10)]);
    this.data[trackId] = list.filter((e) => keep.has(e));
    storage.save(KEY, this.data);
    return { lapRank, raceRank };
  }

  async top(trackId: string, by: 'lap' | 'race', limit = 10) {
    const list = [...(this.data[trackId] ?? [])];
    if (by === 'lap') return list.sort((a, b) => a.bestLap - b.bestLap).slice(0, limit);
    return list
      .filter((e) => e.raceTime !== null)
      .sort((a, b) => a.raceTime! - b.raceTime!)
      .slice(0, limit);
  }

  personalBest(trackId: string) {
    const list = this.data[trackId] ?? [];
    const lap = list.length ? Math.min(...list.map((e) => e.bestLap)) : null;
    const races = list.filter((e) => e.raceTime !== null).map((e) => e.raceTime!);
    return { lap, race: races.length ? Math.min(...races) : null };
  }

  clear(): void {
    this.data = {};
    storage.save(KEY, this.data);
  }
}
