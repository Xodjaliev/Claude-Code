import type { TimeOfDay } from './Atmosphere';

/**
 * Track catalogue. Tracks are described as a closed polygon whose corners are rounded
 * with the given radius (a classic street-circuit construction). Adding a new track =
 * adding an entry here and (optionally) a new environment theme.
 */

export type ThemeId = 'city' | 'desert' | 'mountain';

export interface TrackVertex {
  x: number;
  z: number;
  /** Corner radius (m). */
  r: number;
  /** Elevation (m). */
  y?: number;
  /** Optional half width override at this corner. */
  w?: number;
}

/** A range on the straight part of an edge (edge k = vertex k -> vertex k+1), 0..1. */
export interface EdgeRange {
  edge: number;
  from: number;
  to: number;
}

export interface CliffRange {
  fromEdge: number;
  toEdge: number;
  /** +1 = drop on the right side of the road, -1 = left */
  side: 1 | -1;
}

export interface TrackDefinition {
  id: string;
  name: string;
  location: string;
  description: string;
  theme: ThemeId;
  vertices: TrackVertex[];
  scale: number;
  halfWidth: number;
  /** Run-off between road edge and barrier (m). */
  shoulder: number;
  start: { edge: number; at: number };
  laps: number;
  checkpointCount: number;
  tunnels: EdgeRange[];
  cliffs: CliffRange[];
  timeOfDay: TimeOfDay;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  unlockLevel: number;
  unlockCost: number;
  rewardMultiplier: number;
  seed: number;
  accent: string;
}

export const TRACK_CATALOG: TrackDefinition[] = [
  {
    id: 'city-circuit',
    name: 'City Circuit',
    location: 'Neo Harbor, downtown',
    description: 'A neon-lit night street race between skyscrapers, with a long tunnel blast down the main straight and tight 90° corners.',
    theme: 'city',
    vertices: [
      { x: 0, z: -160, r: 30 },
      { x: 0, z: 600, r: 34 },
      { x: 300, z: 600, r: 28 },
      { x: 300, z: 420, r: 24 },
      { x: 520, z: 420, r: 34 },
      { x: 520, z: 80, r: 42 },
      { x: 380, z: -60, r: 32 },
      { x: 200, z: -60, r: 28 },
      { x: 120, z: -160, r: 24 },
    ],
    scale: 1,
    halfWidth: 8,
    shoulder: 1.4,
    start: { edge: 0, at: 0.16 },
    laps: 3,
    checkpointCount: 6,
    tunnels: [{ edge: 0, from: 0.5, to: 0.8 }],
    cliffs: [],
    timeOfDay: 'night',
    difficulty: 'Easy',
    unlockLevel: 1,
    unlockCost: 0,
    rewardMultiplier: 1,
    seed: 1337,
    accent: '#00e5ff',
  },
  {
    id: 'desert-road',
    name: 'Desert Road',
    location: 'Red Mesa Highway',
    description: 'Blistering sun, endless sand and mile-long straights. Flat out at top speed between towering mesas.',
    theme: 'desert',
    vertices: [
      { x: 0, z: -400, r: 120, y: 0 },
      { x: 0, z: 700, r: 150, y: 6 },
      { x: 450, z: 1000, r: 110, y: 14 },
      { x: 900, z: 700, r: 90, y: 8 },
      { x: 700, z: 300, r: 70, y: 1 },
      { x: 1000, z: 0, r: 120, y: 10 },
      { x: 750, z: -500, r: 140, y: 4 },
      { x: 300, z: -650, r: 100, y: 0 },
    ],
    scale: 0.85,
    halfWidth: 9,
    shoulder: 7,
    start: { edge: 0, at: 0.25 },
    laps: 3,
    checkpointCount: 8,
    tunnels: [],
    cliffs: [],
    timeOfDay: 'day',
    difficulty: 'Medium',
    unlockLevel: 2,
    unlockCost: 2500,
    rewardMultiplier: 1.25,
    seed: 4242,
    accent: '#ff9d2e',
  },
  {
    id: 'mountain-track',
    name: 'Mountain Track',
    location: 'Alpine Pass',
    description: 'Hairpins carved into the cliffs, rock tunnels and sheer drops to the lake below. One mistake and you are in the barrier.',
    theme: 'mountain',
    vertices: [
      { x: 0, z: 0, r: 40, y: 0 },
      { x: 0, z: 400, r: 60, y: 12 },
      { x: 200, z: 600, r: 22, y: 26 },
      { x: 60, z: 700, r: 24, y: 34 },
      { x: 300, z: 820, r: 50, y: 44 },
      { x: 600, z: 700, r: 70, y: 52 },
      { x: 650, z: 400, r: 25, y: 44 },
      { x: 450, z: 300, r: 30, y: 34 },
      { x: 600, z: 100, r: 45, y: 24 },
      { x: 450, z: -150, r: 60, y: 12 },
      { x: 150, z: -200, r: 50, y: 4 },
    ],
    scale: 0.85,
    halfWidth: 6.5,
    shoulder: 1.8,
    start: { edge: 0, at: 0.12 },
    laps: 3,
    checkpointCount: 8,
    tunnels: [
      { edge: 0, from: 0.42, to: 0.78 },
      { edge: 4, from: 0.25, to: 0.72 },
    ],
    cliffs: [
      { fromEdge: 3, toEdge: 3, side: 1 },
      { fromEdge: 5, toEdge: 5, side: 1 },
      { fromEdge: 8, toEdge: 9, side: 1 },
    ],
    timeOfDay: 'morning',
    difficulty: 'Hard',
    unlockLevel: 4,
    unlockCost: 5000,
    rewardMultiplier: 1.5,
    seed: 9001,
    accent: '#7cff4f',
  },
];

export function getTrackDefinition(id: string): TrackDefinition {
  return TRACK_CATALOG.find((t) => t.id === id) ?? TRACK_CATALOG[0];
}
