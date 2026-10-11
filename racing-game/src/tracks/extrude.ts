import * as THREE from 'three';
import type { Track, TrackSample } from './Track';

/**
 * Cross-section extrusion along the track centreline.
 * Profile points are (lateral, height). Lateral is measured from an anchor:
 *  'c' = centreline, 'e' = road edge (halfWidth), 'w' = barrier line.
 * The profile must be ordered so that (profile direction) x (track tangent) is the
 * desired face normal — e.g. left-to-right for an upward facing road surface.
 */

export type Anchor = 'c' | 'e' | 'w';

export interface ProfilePoint {
  d: number;
  y: number;
  a?: Anchor;
  /** Explicit texture U; defaults to cumulative profile length. */
  u?: number;
}

export interface ExtrudeOptions {
  /** Which side the profile describes; 'left' mirrors it. */
  side?: 'right' | 'left' | 'center';
  /** Metres of track per texture V unit. */
  vScale?: number;
  /** U multiplier (texture repeats per metre of profile). */
  uScale?: number;
  /** Include a sample? Consecutive included samples form runs. */
  filter?: (s: TrackSample, i: number) => boolean;
  /** Restrict to a distance range [from, to] (wraps). */
  from?: number;
  to?: number;
  swapUV?: boolean;
  flipV?: boolean;
  yOffset?: number;
}

function anchorValue(s: TrackSample, a: Anchor, side: 'right' | 'left' | 'center'): number {
  if (a === 'c') return 0;
  if (a === 'e') return s.halfWidth;
  return side === 'left' ? s.wallLeft : s.wallRight;
}

function inRange(dist: number, from: number, to: number): boolean {
  if (from <= to) return dist >= from && dist <= to;
  return dist >= from || dist <= to;
}

/** Splits the loop into runs of consecutive sample indices that pass the filter. */
export function sampleRuns(track: Track, opts: ExtrudeOptions): { indices: number[]; closed: boolean }[] {
  const n = track.sampleCount;
  const pass: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const s = track.samples[i];
    let ok = true;
    if (opts.from !== undefined && opts.to !== undefined) ok = inRange(s.dist, opts.from, opts.to);
    if (ok && opts.filter) ok = opts.filter(s, i);
    pass.push(ok);
  }
  if (pass.every((p) => p)) return [{ indices: Array.from({ length: n }, (_, i) => i), closed: true }];
  // start scanning at a failing sample so runs don't get split at index 0
  const startFail = pass.indexOf(false);
  if (startFail < 0) return [];
  const runs: { indices: number[]; closed: boolean }[] = [];
  let cur: number[] = [];
  for (let k = 1; k <= n; k++) {
    const i = (startFail + k) % n;
    if (pass[i]) cur.push(i);
    else if (cur.length) {
      runs.push({ indices: cur, closed: false });
      cur = [];
    }
  }
  if (cur.length) runs.push({ indices: cur, closed: false });
  return runs.filter((r) => r.indices.length >= 2);
}

export function extrudeProfile(track: Track, profile: ProfilePoint[], opts: ExtrudeOptions = {}): THREE.BufferGeometry | null {
  const side = opts.side ?? 'center';
  const prof = side === 'left' ? [...profile].reverse() : profile;
  const vScale = opts.vScale ?? 10;
  const uScale = opts.uScale ?? 1;
  const yOff = opts.yOffset ?? 0;
  const runs = sampleRuns(track, opts);
  if (!runs.length) return null;

  // U coordinates along the profile
  const us: number[] = [];
  let acc = 0;
  for (let j = 0; j < prof.length; j++) {
    if (j > 0) acc += Math.hypot(prof[j].d - prof[j - 1].d, prof[j].y - prof[j - 1].y);
    us.push(prof[j].u ?? acc * uScale);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const m = prof.length;
  for (const run of runs) {
    const base = positions.length / 3;
    const ids = run.closed ? [...run.indices, run.indices[0]] : run.indices;
    let vDist = track.samples[ids[0]].dist;
    for (let k = 0; k < ids.length; k++) {
      const s = track.samples[ids[k]];
      if (k > 0) vDist += track.spacing;
      for (let j = 0; j < m; j++) {
        const p = prof[j];
        let lat = anchorValue(s, p.a ?? 'c', side) + p.d;
        if (side === 'left') lat = -lat;
        positions.push(s.x + s.rx * lat, s.y + p.y + yOff, s.z + s.rz * lat);
        const v = (opts.flipV ? -vDist : vDist) / vScale;
        if (opts.swapUV) uvs.push(v, us[j]);
        else uvs.push(us[j], v);
      }
    }
    for (let k = 0; k < ids.length - 1; k++) {
      for (let j = 0; j < m - 1; j++) {
        const a = base + k * m + j;
        const b = a + 1;
        const c = a + m;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Closed tube shell (inner + outer surfaces + end caps) — used for tunnels. Profiles go right-bottom -> over the top -> left-bottom. */
export function extrudeShell(
  track: Track,
  inner: { d: number; y: number }[],
  outer: { d: number; y: number }[],
  from: number,
  to: number,
  displace?: (dist: number, j: number, d: number, y: number) => [number, number],
): { inner: THREE.BufferGeometry; outer: THREE.BufferGeometry; caps: THREE.BufferGeometry } {
  const N = 28;
  const resampleProfile = (pts: { d: number; y: number }[]) => {
    const len: number[] = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].d - pts[i - 1].d, pts[i].y - pts[i - 1].y));
    const total = len[len.length - 1];
    const out: { d: number; y: number; u: number }[] = [];
    let seg = 0;
    for (let k = 0; k < N; k++) {
      const t = (k / (N - 1)) * total;
      while (seg < pts.length - 2 && len[seg + 1] < t) seg++;
      const f = (t - len[seg]) / (len[seg + 1] - len[seg] || 1);
      out.push({ d: pts[seg].d + (pts[seg + 1].d - pts[seg].d) * f, y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * f, u: t / 4 });
    }
    return out;
  };
  const inn = resampleProfile(inner);
  const out = resampleProfile(outer);
  const runs = sampleRuns(track, { from, to });
  const ids = runs.length ? runs[0].indices : [];

  const build = (prof: { d: number; y: number; u: number }[], reverse: boolean, disp: boolean) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let v = 0;
    for (let k = 0; k < ids.length; k++) {
      const s = track.samples[ids[k]];
      if (k > 0) v += track.spacing;
      for (let j = 0; j < N; j++) {
        let { d, y } = prof[j];
        if (disp && displace) [d, y] = displace(s.dist, j, d, y);
        positions.push(s.x + s.rx * d, s.y + y, s.z + s.rz * d);
        uvs.push(prof[j].u, v / 4);
      }
    }
    for (let k = 0; k < ids.length - 1; k++)
      for (let j = 0; j < N - 1; j++) {
        const a = k * N + j;
        const b = a + 1;
        const c = a + N;
        const d = c + 1;
        if (reverse) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  };
  const innerG = build(inn, false, false);
  // outer profile runs the same direction but must face outward -> reversed winding
  const outerG = build(out, true, true);

  // end caps: quad strip between inner and outer rings
  const capPos: number[] = [];
  const capIdx: number[] = [];
  const capUv: number[] = [];
  const ends = [ids[0], ids[ids.length - 1]];
  ends.forEach((idx, e) => {
    const s = track.samples[idx];
    const base = capPos.length / 3;
    for (let j = 0; j < N; j++) {
      const a = inn[j];
      let { d, y } = out[j];
      if (displace) [d, y] = displace(s.dist, j, d, y);
      capPos.push(s.x + s.rx * a.d, s.y + a.y, s.z + s.rz * a.d);
      capPos.push(s.x + s.rx * d, s.y + y, s.z + s.rz * d);
      capUv.push(a.u, 0, out[j].u, 1);
    }
    for (let j = 0; j < N - 1; j++) {
      const a = base + j * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (e === 0) capIdx.push(a, b, c, b, d, c);
      else capIdx.push(a, c, b, b, c, d);
    }
  });
  const caps = new THREE.BufferGeometry();
  caps.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
  caps.setAttribute('uv', new THREE.Float32BufferAttribute(capUv, 2));
  caps.setIndex(capIdx);
  caps.computeVertexNormals();
  return { inner: innerG, outer: outerG, caps };
}

/** Places an object on the track frame at (dist, lateral). Returns heading (rotation.y). */
export function placeOnTrack(track: Track, obj: THREE.Object3D, dist: number, lateral: number, yOffset = 0): number {
  const f = track.frameAt(dist, { x: 0, y: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0, halfWidth: 0 });
  obj.position.set(f.x + f.rx * lateral, f.y + yOffset, f.z + f.rz * lateral);
  const heading = Math.atan2(f.tx, f.tz);
  obj.rotation.set(0, heading, 0);
  return heading;
}
