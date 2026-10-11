import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise2D } from '../../utils/Noise';
import { lerp, smoothstep } from '../../utils/math';
import { canvasTexture, rockTexture } from '../../utils/textures';
import { buildTerrain, gradedLines } from '../Terrain';
import { DistanceField } from '../Track';
import { clearOfTrack, disposeObject, EnvContext, instanced, matrixAt, rockGeometry, TrackEnvironment, withColor } from './common';

const LAKE_LEVEL = -34;

/** Alpine Pass: mountainside terrain with cliffs, lake, pine forest and boulders. */
export function buildMountainEnvironment(ctx: EnvContext): TrackEnvironment {
  const { track, group, rng, noise } = ctx;
  const b = track.bounds;
  const margin = 1500;
  const cell = ctx.density >= 0.7 ? 7 : 10;
  const edge = track.def.halfWidth + track.def.shoulder + 0.8;
  const flat = edge + cell * 1.6;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  // coarse inside/outside lookup of the circuit loop
  const insideCell = 20;
  const insideW = Math.ceil((b.maxX - b.minX + 80) / insideCell);
  const insideH = Math.ceil((b.maxZ - b.minZ + 80) / insideCell);
  const insideGrid = new Uint8Array(insideW * insideH);
  for (let j = 0; j < insideH; j++)
    for (let i = 0; i < insideW; i++)
      insideGrid[j * insideW + i] = track.containsPoint(b.minX - 40 + (i + 0.5) * insideCell, b.minZ - 40 + (j + 0.5) * insideCell) ? 1 : 0;
  const isInside = (x: number, z: number) => {
    const i = Math.floor((x - (b.minX - 40)) / insideCell);
    const j = Math.floor((z - (b.minZ - 40)) / insideCell);
    if (i < 0 || j < 0 || i >= insideW || j >= insideH) return false;
    return insideGrid[j * insideW + i] === 1;
  };

  const natural = (x: number, z: number, inside: boolean) => {
    if (inside) return 105 + noise.ridged(x * 0.004, z * 0.004, 5) * 95;
    const dc = Math.hypot(x - cx, z - cz);
    return LAKE_LEVEL - 5 + noise.fbm(x * 0.006, z * 0.006, 3) * 7 + smoothstep(650, 1300, dc) * (150 + noise.ridged(x * 0.0018, z * 0.0018, 5) * 300);
  };

  const field = new DistanceField(track, 300, 10);
  const height = (x: number, z: number) => {
    const inside = isInside(x, z);
    const info = field.nearest(x, z);
    if (!info) return natural(x, z, inside);
    const roadY = info.height;
    if (info.distance < flat) return roadY - 0.45;
    const t = info.distance - flat;
    const s = track.samples[info.index];
    const side = info.lateral >= 0 ? 1 : -1;
    const drop = s.cliff !== 0 && side === s.cliff;
    let local: number;
    if (drop) local = roadY - 0.45 - Math.min(80, t * 2.4) + noise.noise(x * 0.05, z * 0.05) * 1.5;
    else if (inside) local = roadY - 0.45 + t * 0.7 + noise.ridged(x * 0.01, z * 0.01, 4) * Math.min(1, t / 60) * 40;
    else local = roadY - 0.45 - Math.min(30, t * 0.32) + noise.fbm(x * 0.02, z * 0.02, 3) * Math.min(1, t / 40) * 4;
    const w = smoothstep(170, 300, info.distance);
    return lerp(local, natural(x, z, inside), w);
  };

  const grassA = new THREE.Color(0x46652c);
  const grassB = new THREE.Color(0x6f7f3a);
  const rockC = new THREE.Color(0x77706a);
  const snow = new THREE.Color(0xf2f5fa);
  const shore = new THREE.Color(0x8a7d5a);
  const terrain = buildTerrain({
    xs: gradedLines(b.minX - margin, b.maxX + margin, b.minX - 320, b.maxX + 320, cell, 60),
    zs: gradedLines(b.minZ - margin, b.maxZ + margin, b.minZ - 320, b.maxZ + 320, cell, 60),
    height,
    color: (x, z, y, slope) => {
      const c = grassA.clone().lerp(grassB, 0.5 + noise.noise(x * 0.02, z * 0.02) * 0.5);
      c.lerp(rockC, smoothstep(0.55, 1.05, slope));
      if (y < LAKE_LEVEL + 2.5) c.lerp(shore, smoothstep(LAKE_LEVEL + 2.5, LAKE_LEVEL, y));
      c.lerp(snow, smoothstep(150, 210, y + noise.noise(x * 0.01, z * 0.01) * 25) * (1 - smoothstep(1.2, 1.8, slope) * 0.6));
      return c;
    },
    textureScale: 16,
    detail: 'rock',
  });
  group.add(terrain.mesh);

  // ---- lake
  const water = waterNormalTexture();
  water.repeat.set(220, 220);
  const lakeMat = new THREE.MeshStandardMaterial({ color: 0x1f3d48, roughness: 0.06, metalness: 0.15, normalMap: water, normalScale: new THREE.Vector2(0.35, 0.35) });
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), lakeMat);
  lake.position.set(cx, LAKE_LEVEL, cz);
  lake.receiveShadow = true;
  group.add(lake);

  // ---- pine forest
  const pine = pineGeometry();
  const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const pineMats: THREE.Matrix4[] = [];
  const pineCols: THREE.Color[] = [];
  const rockMats: THREE.Matrix4[] = [];
  const treeCount = Math.round(2400 * ctx.density);
  let tries = 0;
  while (pineMats.length < treeCount && tries < treeCount * 4) {
    tries++;
    const s = track.sample(rng.int(0, track.sampleCount - 1));
    const lat = rng.sign() * (flat + 3 + Math.pow(rng.next(), 1.4) * 230);
    const x = s.x + s.rx * lat + rng.range(-10, 10);
    const z = s.z + s.rz * lat + rng.range(-10, 10);
    if (!clearOfTrack(track, x, z, 1.5, flat - edge + 2)) continue;
    const y = terrain.heightAt(x, z);
    if (y < LAKE_LEVEL + 1.5 || y > 165) continue;
    const slope = Math.abs(terrain.heightAt(x + 3, z) - terrain.heightAt(x - 3, z)) / 6 + Math.abs(terrain.heightAt(x, z + 3) - terrain.heightAt(x, z - 3)) / 6;
    if (slope > 1.1) {
      if (rng.chance(0.3)) rockMats.push(matrixAt(x, y, z, rng.range(0, 6), rng.range(1.5, 5), rng.range(1, 3.5), rng.range(1.5, 5)));
      continue;
    }
    const sc = rng.range(0.7, 1.45);
    pineMats.push(matrixAt(x, y - 0.2, z, rng.range(0, 6), sc, sc * rng.range(0.9, 1.25), sc));
    pineCols.push(new THREE.Color().setHSL(0.27 + rng.range(-0.04, 0.04), 0.35, rng.range(0.7, 1.0)));
  }
  const forest = instanced(pine, pineMat, pineMats, ctx.shadows, true, pineCols);
  if (forest) group.add(forest);

  // boulders near the road
  for (let i = 0; i < 260 * ctx.density; i++) {
    const s = track.sample(rng.int(0, track.sampleCount - 1));
    const lat = rng.sign() * (flat + rng.range(1, 40));
    const x = s.x + s.rx * lat;
    const z = s.z + s.rz * lat;
    if (!clearOfTrack(track, x, z, 2, flat - edge + 1)) continue;
    const y = terrain.heightAt(x, z);
    if (y < LAKE_LEVEL) continue;
    rockMats.push(matrixAt(x, y, z, rng.range(0, 6), rng.range(0.8, 3), rng.range(0.6, 2.2), rng.range(0.8, 3)));
  }
  const rockMat = new THREE.MeshStandardMaterial({ map: rockTexture('#8a8178'), roughness: 0.95, flatShading: true });
  const rocks = instanced(rockGeometry(31, 1), rockMat, rockMats, ctx.shadows);
  if (rocks) group.add(rocks);

  return {
    update(dt) {
      water.offset.x += dt * 0.004;
      water.offset.y += dt * 0.0025;
    },
    dispose() {
      disposeObject(group);
    },
  };
}

function pineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(withColor(new THREE.CylinderGeometry(0.18, 0.28, 3, 6).translate(0, 1.5, 0), new THREE.Color(0x4a3524)));
  const tiers = [
    [3.4, 5.0, 2.2],
    [2.7, 4.2, 4.6],
    [1.9, 3.4, 6.8],
    [1.1, 2.4, 8.8],
  ];
  tiers.forEach(([r, h, y], i) => {
    const c = new THREE.Color(0x24452a).lerp(new THREE.Color(0x3a6b3a), i / 4);
    parts.push(withColor(new THREE.ConeGeometry(r, h, 8).translate(0, y + h / 2 - 0.6, 0), c));
  });
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

function waterNormalTexture(): THREE.CanvasTexture {
  // tileable normal map derived from periodic noise
  const tex = canvasTexture(
    'water-normal',
    256,
    256,
    (ctx2, w, h) => {
      const n = new Noise2D(5);
      const hgt = new Float32Array(w * h);
      const P = 8;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const a = (x / w) * Math.PI * 2;
          const bb = (y / h) * Math.PI * 2;
          // sample noise on a torus so the result tiles
          hgt[y * w + x] = n.fbm(Math.cos(a) * P * 0.3 + 10, Math.sin(a) * P * 0.3 + Math.cos(bb) * P * 0.3 + Math.sin(bb) * 0.7, 4);
        }
      const img = ctx2.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const l = hgt[y * w + ((x - 1 + w) % w)];
          const r = hgt[y * w + ((x + 1) % w)];
          const d = hgt[((y - 1 + h) % h) * w + x];
          const u = hgt[((y + 1) % h) * w + x];
          const nx = (l - r) * 3;
          const ny = (d - u) * 3;
          const len = Math.hypot(nx, ny, 1);
          const i = (y * w + x) * 4;
          img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
          img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
          img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
          img.data[i + 3] = 255;
        }
      ctx2.putImageData(img, 0, 0);
    },
    { srgb: false },
  );
  return tex;
}
