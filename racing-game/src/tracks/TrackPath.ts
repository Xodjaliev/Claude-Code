import { catmullRom, wrap } from '../utils/math';
import type { TrackDefinition } from './TrackCatalog';

export interface PathPoint {
  x: number;
  z: number;
  y: number;
  w: number;
}

export interface BuiltPath {
  points: PathPoint[];
  spacing: number;
  length: number;
  /** For each polygon edge: distances (from the start line) where its straight part begins/ends. */
  edgeStart: number[];
  edgeEnd: number[];
}

interface RawPoint {
  x: number;
  z: number;
}

/**
 * Builds a closed, evenly spaced centreline from a filleted polygon.
 * Distances in the result are measured from the start line.
 */
export function buildTrackPath(def: TrackDefinition, spacing = 2): BuiltPath {
  const s = def.scale;
  const verts = def.vertices.map((v) => ({ x: v.x * s, z: v.z * s, r: v.r * s, y: v.y ?? 0, w: v.w ?? def.halfWidth }));
  const n = verts.length;

  // ---- 1. fillet every corner
  const raw: RawPoint[] = [];
  const arcMidIndex: number[] = [];
  const t1Index: number[] = [];
  const t2Index: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = verts[(i - 1 + n) % n];
    const v = verts[i];
    const q = verts[(i + 1) % n];
    let d1x = v.x - p.x;
    let d1z = v.z - p.z;
    let d2x = q.x - v.x;
    let d2z = q.z - v.z;
    const l1 = Math.hypot(d1x, d1z);
    const l2 = Math.hypot(d2x, d2z);
    d1x /= l1;
    d1z /= l1;
    d2x /= l2;
    d2z /= l2;
    const dot = Math.max(-1, Math.min(1, d1x * d2x + d1z * d2z));
    const theta = Math.acos(dot);
    const cross = d1x * d2z - d1z * d2x;
    if (theta < 1e-3) {
      t1Index.push(raw.length);
      arcMidIndex.push(raw.length);
      raw.push({ x: v.x, z: v.z });
      t2Index.push(raw.length - 1);
      continue;
    }
    let t = v.r * Math.tan(theta / 2);
    const maxT = Math.min(l1, l2) * 0.48;
    let r = v.r;
    if (t > maxT) {
      t = maxT;
      r = t / Math.tan(theta / 2);
    }
    const t1x = v.x - d1x * t;
    const t1z = v.z - d1z * t;
    // centre lies on the inside of the turn
    const nx = cross > 0 ? -d1z : d1z;
    const nz = cross > 0 ? d1x : -d1x;
    const cx = t1x + nx * r;
    const cz = t1z + nz * r;
    const a1 = Math.atan2(t1z - cz, t1x - cx);
    const sweep = cross > 0 ? theta : -theta;
    const segs = Math.max(4, Math.ceil((r * theta) / 1.0));
    t1Index.push(raw.length);
    for (let k = 0; k <= segs; k++) {
      const a = a1 + (sweep * k) / segs;
      if (k === Math.floor(segs / 2)) arcMidIndex.push(raw.length);
      raw.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
    }
    t2Index.push(raw.length - 1);
  }

  // cumulative distances on the raw polyline (closed)
  const rawDist: number[] = [0];
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i % raw.length];
    rawDist.push(rawDist[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const rawLength = rawDist[raw.length];

  // ---- 2. resample evenly
  let pts = resample(raw, rawDist, spacing).points;

  // ---- 3. smooth curvature discontinuities (straight -> arc)
  for (let iter = 0; iter < 6; iter++) {
    const out: RawPoint[] = [];
    const m = pts.length;
    for (let i = 0; i < m; i++) {
      const a = pts[(i - 2 + m) % m];
      const b = pts[(i - 1 + m) % m];
      const c = pts[i];
      const d = pts[(i + 1) % m];
      const e = pts[(i + 2) % m];
      out.push({ x: (a.x + 4 * b.x + 6 * c.x + 4 * d.x + e.x) / 16, z: (a.z + 4 * b.z + 6 * c.z + 4 * d.z + e.z) / 16 });
    }
    pts = out;
  }
  const smDist: number[] = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    smDist.push(smDist[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const res = resample(pts, smDist, spacing);
  pts = res.points;
  const step = res.step;
  const total = pts.length * step;
  const k = total / rawLength;

  // raw anchors -> distances on the final path (proportional mapping)
  const anchor = (rawIdx: number) => rawDist[rawIdx] * k;

  // ---- 4. heights & widths: periodic Catmull-Rom over the corner apex distances
  const apex = arcMidIndex.map(anchor);
  const heightAt = periodicSpline(apex, verts.map((v) => v.y), total);
  const widthAt = periodicSpline(apex, verts.map((v) => v.w), total);

  // edge straight ranges (edge i: from end of fillet i to start of fillet i+1)
  const edgeStartRaw = t2Index.map(anchor);
  const edgeEndRaw = t1Index.map((_, i) => anchor(t1Index[(i + 1) % n]) + (i === n - 1 ? total : 0));

  // ---- 5. rotate so index 0 is the start line
  const e = def.start.edge;
  let startDist = edgeStartRaw[e] + (edgeEndRaw[e] - edgeStartRaw[e]) * def.start.at;
  startDist = wrap(startDist, total);
  const shift = Math.round(startDist / step);
  const points: PathPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    const src = pts[(i + shift) % pts.length];
    const d = wrap((i + shift) * step, total);
    points.push({ x: src.x, z: src.z, y: heightAt(d), w: widthAt(d) });
  }
  const off = shift * step;
  return {
    points,
    spacing: step,
    length: total,
    edgeStart: edgeStartRaw.map((d) => wrap(d - off, total)),
    edgeEnd: edgeEndRaw.map((d) => wrap(d - off, total)),
  };
}

function resample(pts: RawPoint[], dist: number[], spacing: number): { points: RawPoint[]; step: number } {
  const total = dist[pts.length];
  const count = Math.max(8, Math.round(total / spacing));
  const step = total / count;
  const out: RawPoint[] = [];
  let seg = 0;
  for (let i = 0; i < count; i++) {
    const d = i * step;
    while (seg < pts.length - 1 && dist[seg + 1] < d) seg++;
    const a = pts[seg];
    const b = pts[(seg + 1) % pts.length];
    const len = dist[seg + 1] - dist[seg];
    const t = len > 0 ? (d - dist[seg]) / len : 0;
    out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return { points: out, step };
}

/** Periodic Catmull-Rom interpolation of values defined at knot distances along a loop. */
function periodicSpline(knots: number[], values: number[], total: number): (d: number) => number {
  const n = knots.length;
  const order = knots.map((k, i) => ({ k: wrap(k, total), v: values[i] })).sort((a, b) => a.k - b.k);
  return (d: number) => {
    let i1 = n - 1;
    for (let i = 0; i < n; i++) {
      if (order[i].k > d) {
        i1 = (i - 1 + n) % n;
        break;
      }
    }
    const i0 = (i1 - 1 + n) % n;
    const i2 = (i1 + 1) % n;
    const i3 = (i1 + 2) % n;
    const k1 = order[i1].k;
    let k2 = order[i2].k;
    if (k2 <= k1) k2 += total;
    let dd = d;
    if (dd < k1) dd += total;
    const t = (dd - k1) / (k2 - k1);
    return catmullRom(order[i0].v, order[i1].v, order[i2].v, order[i3].v, Math.max(0, Math.min(1, t)));
  };
}
