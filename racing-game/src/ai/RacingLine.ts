import type { Track } from '../tracks/Track';
import { clamp, wrap } from '../utils/math';

function boxSmooth(values: Float32Array, radius: number, passes: number): Float32Array {
  const n = values.length;
  let src = values;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(n);
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[(k + n) % n];
    for (let i = 0; i < n; i++) {
      out[i] = sum / (radius * 2 + 1);
      sum += src[(i + radius + 1) % n] - src[(i - radius + n) % n];
    }
    src = out;
  }
  return src;
}

/**
 * Pre-computed racing line: lateral offset per sample (out-in-out through corners)
 * and the smoothed curvature used for corner speed planning.
 */
export class RacingLine {
  readonly offset: Float32Array;
  readonly curvature: Float32Array;
  private readonly track: Track;

  constructor(track: Track) {
    this.track = track;
    const n = track.sampleCount;
    const k = new Float32Array(n);
    for (let i = 0; i < n; i++) k[i] = track.samples[i].curvature;
    const narrow = boxSmooth(k, 6, 2);
    const wide = boxSmooth(k, 30, 2);
    this.offset = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const avail = track.samples[i].halfWidth - 2.0;
      const v = (narrow[i] * 1.6 - wide[i] * 0.9) * 70;
      this.offset[i] = clamp(v, -1, 1) * avail;
    }
    this.offset = boxSmooth(this.offset, 5, 2);
    // corner speed planning: local maximum of |curvature| (slightly smoothed)
    const abs = k.map(Math.abs);
    const peak = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let d = -3; d <= 3; d++) m = Math.max(m, abs[(i + d + n) % n]);
      peak[i] = m;
    }
    this.curvature = boxSmooth(peak, 2, 1);
  }

  offsetAt(dist: number): number {
    const f = wrap(dist, this.track.length) / this.track.spacing;
    const i = Math.floor(f);
    const t = f - i;
    const n = this.offset.length;
    return this.offset[i % n] * (1 - t) + this.offset[(i + 1) % n] * t;
  }

  curvatureAt(dist: number): number {
    const i = Math.round(wrap(dist, this.track.length) / this.track.spacing) % this.curvature.length;
    return this.curvature[i];
  }
}
