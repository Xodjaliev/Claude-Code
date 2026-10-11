import * as THREE from 'three';
import { terrainDetailTexture } from '../utils/textures';

export interface TerrainOptions {
  /** Grid line coordinates (may be non-uniform, see gradedLines). */
  xs: number[];
  zs: number[];
  height: (x: number, z: number) => number;
  color: (x: number, z: number, y: number, slope: number) => THREE.Color;
  textureScale?: number;
  detail?: 'grain' | 'rock';
}

/** Heightfield terrain with vertex colours (slope/height based) over a tiling detail texture. */
/** Grid lines: `fine` spacing inside [coreMin, coreMax], growing to `coarse` outside. */
export function gradedLines(min: number, max: number, coreMin: number, coreMax: number, fine: number, coarse: number): number[] {
  const out: number[] = [];
  // outer band before the core, from coreMin down to min with growing steps
  const before: number[] = [];
  let x = coreMin;
  let step = fine;
  while (x > min) {
    step = Math.min(coarse, step * 1.12);
    x -= step;
    before.push(Math.max(min, x));
  }
  out.push(...before.reverse());
  const n = Math.max(2, Math.ceil((coreMax - coreMin) / fine));
  for (let i = 0; i <= n; i++) out.push(coreMin + ((coreMax - coreMin) * i) / n);
  x = coreMax;
  step = fine;
  while (x < max) {
    step = Math.min(coarse, step * 1.12);
    x += step;
    out.push(Math.min(max, x));
  }
  return out;
}

function findCell(lines: number[], v: number): number {
  let lo = 0;
  let hi = lines.length - 2;
  if (v <= lines[0]) return 0;
  if (v >= lines[hi + 1]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid] <= v) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function buildTerrain(opts: TerrainOptions): { mesh: THREE.Mesh; heightAt: (x: number, z: number) => number } {
  const xs = opts.xs;
  const zs = opts.zs;
  const nx = xs.length - 1;
  const nz = zs.length - 1;
  const heights = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) heights[j * (nx + 1) + i] = opts.height(xs[i], zs[j]);

  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const colors = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uvs = new Float32Array((nx + 1) * (nz + 1) * 2);
  const ts = opts.textureScale ?? 24;
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i;
      const x = xs[i];
      const z = zs[j];
      const y = heights[k];
      positions.set([x, y, z], k * 3);
      uvs.set([x / ts, z / ts], k * 2);
      const hl = heights[j * (nx + 1) + Math.max(0, i - 1)];
      const hr = heights[j * (nx + 1) + Math.min(nx, i + 1)];
      const hd = heights[Math.max(0, j - 1) * (nx + 1) + i];
      const hu = heights[Math.min(nz, j + 1) * (nx + 1) + i];
      const dx = xs[Math.min(nx, i + 1)] - xs[Math.max(0, i - 1)];
      const dz = zs[Math.min(nz, j + 1)] - zs[Math.max(0, j - 1)];
      const slope = Math.hypot((hr - hl) / dx, (hu - hd) / dz);
      const c = opts.color(x, z, y, slope);
      colors.set([c.r, c.g, c.b], k * 3);
    }
  const idx = new Uint32Array(nx * nz * 6);
  let p = 0;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      idx[p++] = a;
      idx[p++] = c;
      idx[p++] = b;
      idx[p++] = b;
      idx[p++] = c;
      idx[p++] = d;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: terrainDetailTexture(opts.detail ?? 'grain'), roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  const heightAt = (x: number, z: number) => {
    const i = findCell(xs, x);
    const j = findCell(zs, z);
    const tx = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i])));
    const tz = Math.max(0, Math.min(1, (z - zs[j]) / (zs[j + 1] - zs[j])));
    const h00 = heights[j * (nx + 1) + i];
    const h10 = heights[j * (nx + 1) + i + 1];
    const h01 = heights[(j + 1) * (nx + 1) + i];
    const h11 = heights[(j + 1) * (nx + 1) + i + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  };
  return { mesh, heightAt };
}
