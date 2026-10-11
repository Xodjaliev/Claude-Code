import { clamp, loopDelta, wrap } from '../utils/math';
import { buildTrackPath } from './TrackPath';
import type { TrackDefinition } from './TrackCatalog';

export interface TrackSample {
  x: number;
  y: number;
  z: number;
  /** unit tangent (XZ) */
  tx: number;
  tz: number;
  /** unit right vector (XZ) */
  rx: number;
  rz: number;
  dist: number;
  halfWidth: number;
  /** distance from centre to the barrier on each side */
  wallLeft: number;
  wallRight: number;
  /** signed curvature (1/m), positive = right turn */
  curvature: number;
  slope: number;
  tunnel: boolean;
  /** +1 drop on the right, -1 drop on the left, 0 none */
  cliff: number;
}

export interface TrackQuery {
  index: number;
  t: number;
  dist: number;
  lateral: number;
  height: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  halfWidth: number;
  wallLeft: number;
  wallRight: number;
  slope: number;
  tunnel: boolean;
}

export function emptyQuery(): TrackQuery {
  return { index: -1, t: 0, dist: 0, lateral: 0, height: 0, tx: 0, tz: 1, rx: -1, rz: 0, halfWidth: 8, wallLeft: 10, wallRight: 10, slope: 0, tunnel: false };
}

export interface NearestInfo {
  index: number;
  distance: number;
  lateral: number;
  height: number;
  along: number;
}

const CELL = 24;

/** Coarse nearest-centreline lookup for big batch queries (terrain generation). */
export class DistanceField {
  private readonly idx: Int32Array;
  private readonly w: number;
  private readonly h: number;
  private readonly x0: number;
  private readonly z0: number;

  constructor(
    private readonly track: Track,
    private readonly maxDist: number,
    private readonly cell: number,
  ) {
    const b = track.bounds;
    this.x0 = b.minX - maxDist - cell;
    this.z0 = b.minZ - maxDist - cell;
    this.w = Math.ceil((b.maxX - b.minX + 2 * (maxDist + cell)) / cell) + 1;
    this.h = Math.ceil((b.maxZ - b.minZ + 2 * (maxDist + cell)) / cell) + 1;
    this.idx = new Int32Array(this.w * this.h).fill(-1);
    const dist = new Float32Array(this.w * this.h).fill(Infinity);
    const r = Math.ceil(maxDist / cell) + 1;
    const samples = track.samples;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const ci = Math.floor((s.x - this.x0) / cell);
      const cj = Math.floor((s.z - this.z0) / cell);
      for (let dj = -r; dj <= r; dj++) {
        const j = cj + dj;
        if (j < 0 || j >= this.h) continue;
        const pz = this.z0 + (j + 0.5) * cell;
        for (let di = -r; di <= r; di++) {
          const ii = ci + di;
          if (ii < 0 || ii >= this.w) continue;
          const px = this.x0 + (ii + 0.5) * cell;
          const d = (px - s.x) * (px - s.x) + (pz - s.z) * (pz - s.z);
          const k = j * this.w + ii;
          if (d < dist[k]) {
            dist[k] = d;
            this.idx[k] = i;
          }
        }
      }
    }
  }

  nearest(x: number, z: number): NearestInfo | null {
    const i = Math.floor((x - this.x0) / this.cell);
    const j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return null;
    const i0 = this.idx[j * this.w + i];
    if (i0 < 0) return null;
    const n = this.track.sampleCount;
    let best = i0;
    let bestD = Infinity;
    for (let k = -24; k <= 24; k++) {
      const ii = (i0 + k + n) % n;
      const s = this.track.samples[ii];
      const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
      if (d < bestD) {
        bestD = d;
        best = ii;
      }
    }
    const distance = Math.sqrt(bestD);
    if (distance > this.maxDist) return null;
    const s = this.track.samples[best];
    const lateral = (x - s.x) * s.rx + (z - s.z) * s.rz;
    const along = (x - s.x) * s.tx + (z - s.z) * s.tz;
    return { index: best, distance, lateral, height: s.y + s.slope * along, along };
  }
}

/** Runtime track: evenly sampled centreline with fast nearest-point queries. */
export class Track {
  readonly def: TrackDefinition;
  readonly samples: TrackSample[] = [];
  readonly length: number;
  readonly spacing: number;
  readonly checkpoints: number[] = [];
  readonly bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, minY: Infinity, maxY: -Infinity };
  readonly edgeStart: number[];
  readonly edgeEnd: number[];
  private grid = new Map<number, number[]>();

  constructor(def: TrackDefinition) {
    this.def = def;
    const path = buildTrackPath(def, 2);
    this.spacing = path.spacing;
    this.length = path.length;
    this.edgeStart = path.edgeStart;
    this.edgeEnd = path.edgeEnd;
    const pts = path.points;
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n];
      const b = pts[(i + 1) % n];
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const p = pts[i];
      this.samples.push({
        x: p.x,
        y: p.y,
        z: p.z,
        tx,
        tz,
        rx: -tz,
        rz: tx,
        dist: i * this.spacing,
        halfWidth: p.w,
        wallLeft: p.w + def.shoulder,
        wallRight: p.w + def.shoulder,
        curvature: 0,
        slope: (b.y - a.y) / (2 * this.spacing),
        tunnel: false,
        cliff: 0,
      });
    }
    // curvature
    for (let i = 0; i < n; i++) {
      const a = this.samples[(i - 2 + n) % n];
      const b = this.samples[(i + 2) % n];
      const s = this.samples[i];
      const dtx = b.tx - a.tx;
      const dtz = b.tz - a.tz;
      s.curvature = (dtx * s.rx + dtz * s.rz) / (4 * this.spacing);
    }
    // tunnels
    for (const t of def.tunnels) {
      const from = this.edgeDistance(t.edge, t.from);
      const to = this.edgeDistance(t.edge, t.to);
      this.forRange(from, to, (s) => {
        s.tunnel = true;
        s.wallLeft = s.halfWidth + 1.0;
        s.wallRight = s.halfWidth + 1.0;
      });
    }
    // cliffs
    for (const c of def.cliffs) {
      const from = this.edgeDistance(c.fromEdge, 0);
      const to = this.edgeDistance(c.toEdge, 1);
      this.forRange(from, to, (s) => {
        if (!s.tunnel) s.cliff = c.side;
      });
    }
    // checkpoints: evenly spaced, the last one is the finish line itself
    for (let i = 1; i <= def.checkpointCount; i++) this.checkpoints.push((this.length * i) / def.checkpointCount);

    for (let i = 0; i < n; i++) {
      const s = this.samples[i];
      this.bounds.minX = Math.min(this.bounds.minX, s.x);
      this.bounds.maxX = Math.max(this.bounds.maxX, s.x);
      this.bounds.minZ = Math.min(this.bounds.minZ, s.z);
      this.bounds.maxZ = Math.max(this.bounds.maxZ, s.z);
      this.bounds.minY = Math.min(this.bounds.minY, s.y);
      this.bounds.maxY = Math.max(this.bounds.maxY, s.y);
      const key = this.cellKey(Math.floor(s.x / CELL), Math.floor(s.z / CELL));
      let list = this.grid.get(key);
      if (!list) this.grid.set(key, (list = []));
      list.push(i);
    }
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  /** Distance from the start line of a point on the straight part of an edge. */
  edgeDistance(edge: number, t: number): number {
    const a = this.edgeStart[edge];
    let b = this.edgeEnd[edge];
    if (b < a) b += this.length;
    return wrap(a + (b - a) * t, this.length);
  }

  private forRange(from: number, to: number, fn: (s: TrackSample) => void): void {
    const len = wrap(to - from, this.length);
    const count = Math.ceil(len / this.spacing);
    const start = Math.round(from / this.spacing);
    for (let k = 0; k <= count; k++) fn(this.samples[(start + k) % this.samples.length]);
  }

  private cellKey(cx: number, cz: number): number {
    return (cx + 2048) * 4096 + (cz + 2048);
  }

  sample(i: number): TrackSample {
    const n = this.samples.length;
    return this.samples[((i % n) + n) % n];
  }

  /** Interpolated centreline frame at a distance from the start line. */
  frameAt(dist: number, out: { x: number; y: number; z: number; tx: number; tz: number; rx: number; rz: number; halfWidth: number }) {
    const d = wrap(dist, this.length);
    const f = d / this.spacing;
    const i = Math.floor(f);
    const t = f - i;
    const a = this.sample(i);
    const b = this.sample(i + 1);
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    let tx = a.tx + (b.tx - a.tx) * t;
    let tz = a.tz + (b.tz - a.tz) * t;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    out.tx = tx;
    out.tz = tz;
    out.rx = -tz;
    out.rz = tx;
    out.halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
    return out;
  }

  /** Index of the closest sample, searching locally around `hint` when given. */
  nearestIndex(x: number, z: number, hint = -1): number {
    const n = this.samples.length;
    if (hint >= 0) {
      let best = hint;
      let bestD = Infinity;
      const R = 14;
      for (let k = -R; k <= R; k++) {
        const i = (hint + k + n) % n;
        const s = this.samples[i];
        const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const off = Math.abs(loopDelta(hint, best, n));
      if (off < R - 1) return best;
    }
    return this.nearestIndexGlobal(x, z);
  }

  nearestIndexGlobal(x: number, z: number): number {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = -1;
    let bestD = Infinity;
    for (let ring = 0; ring < 6 && best < 0; ring++) {
      for (let dx = -ring - 1; dx <= ring + 1; dx++)
        for (let dz = -ring - 1; dz <= ring + 1; dz++) {
          const list = this.grid.get(this.cellKey(cx + dx, cz + dz));
          if (!list) continue;
          for (const i of list) {
            const s = this.samples[i];
            const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
    }
    if (best >= 0) return best;
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** Full query: projected distance along the track, signed lateral offset, height, local frame. */
  query(x: number, z: number, hint: number, out: TrackQuery): TrackQuery {
    const n = this.samples.length;
    const i = this.nearestIndex(x, z, hint);
    // choose the segment (i-1,i) or (i,i+1) the point projects onto
    const s0 = this.samples[i];
    const sp = this.samples[(i - 1 + n) % n];
    const sn = this.samples[(i + 1) % n];
    const along = (x - s0.x) * s0.tx + (z - s0.z) * s0.tz;
    const a = along >= 0 ? s0 : sp;
    const b = along >= 0 ? sn : s0;
    const ai = along >= 0 ? i : (i - 1 + n) % n;
    const sx = b.x - a.x;
    const sz = b.z - a.z;
    const segLen2 = sx * sx + sz * sz || 1;
    const t = clamp(((x - a.x) * sx + (z - a.z) * sz) / segLen2, 0, 1);
    const px = a.x + sx * t;
    const pz = a.z + sz * t;
    let tx = a.tx + (b.tx - a.tx) * t;
    let tz = a.tz + (b.tz - a.tz) * t;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    const rx = -tz;
    const rz = tx;
    out.index = ai;
    out.t = t;
    out.dist = wrap(a.dist + t * this.spacing, this.length);
    out.lateral = (x - px) * rx + (z - pz) * rz;
    out.height = a.y + (b.y - a.y) * t;
    out.tx = tx;
    out.tz = tz;
    out.rx = rx;
    out.rz = rz;
    out.halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
    out.wallLeft = a.wallLeft + (b.wallLeft - a.wallLeft) * t;
    out.wallRight = a.wallRight + (b.wallRight - a.wallRight) * t;
    out.slope = a.slope + (b.slope - a.slope) * t;
    out.tunnel = a.tunnel || b.tunnel;
    return out;
  }

  /** Nearest centreline info within `maxDist` (used when generating terrain/decor). Returns null if farther. */
  nearestInfo(x: number, z: number, maxDist: number): NearestInfo | null {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const rings = Math.ceil(maxDist / CELL);
    let best = -1;
    let bestD = maxDist * maxDist;
    for (let dx = -rings; dx <= rings; dx++)
      for (let dz = -rings; dz <= rings; dz++) {
        const list = this.grid.get(this.cellKey(cx + dx, cz + dz));
        if (!list) continue;
        for (const i of list) {
          const s = this.samples[i];
          const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
    if (best < 0) return null;
    const s = this.samples[best];
    const lateral = (x - s.x) * s.rx + (z - s.z) * s.rz;
    const along = (x - s.x) * s.tx + (z - s.z) * s.tz;
    return { index: best, distance: Math.sqrt(bestD), lateral, height: s.y + s.slope * along, along };
  }

  /** Is the point inside the closed centreline polygon? */
  containsPoint(x: number, z: number): boolean {
    let inside = false;
    const s = this.samples;
    for (let i = 0, j = s.length - 1; i < s.length; j = i++) {
      const xi = s[i].x;
      const zi = s[i].z;
      const xj = s[j].x;
      const zj = s[j].z;
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  /** Max absolute curvature within [dist, dist + range]. */
  maxCurvatureAhead(dist: number, range: number): number {
    const start = Math.floor(wrap(dist, this.length) / this.spacing);
    const count = Math.ceil(range / this.spacing);
    let m = 0;
    for (let k = 0; k <= count; k++) m = Math.max(m, Math.abs(this.sample(start + k).curvature));
    return m;
  }

  /** Starting grid slot (0 = pole). Two staggered columns behind the start line. */
  gridSlot(slot: number): { dist: number; lateral: number } {
    const row = Math.floor(slot / 2);
    const col = slot % 2;
    const lateral = (col === 0 ? -1 : 1) * Math.min(3.2, this.def.halfWidth * 0.42);
    return { dist: wrap(-10 - row * 9 - col * 4.5, this.length), lateral };
  }
}
