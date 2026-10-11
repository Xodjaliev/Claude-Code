import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothstep } from '../../utils/math';
import { rockTexture } from '../../utils/textures';
import { buildTerrain, gradedLines } from '../Terrain';
import { DistanceField } from '../Track';
import { clearOfTrack, disposeObject, EnvContext, instanced, matrixAt, placeBillboards, rockGeometry, TrackEnvironment, withColor } from './common';

/** Red Mesa Highway: sand dunes, mesas, boulders, cacti, telephone poles. */
export function buildDesertEnvironment(ctx: EnvContext): TrackEnvironment {
  const { track, group, rng, noise } = ctx;
  const b = track.bounds;
  const margin = 1600;
  const edge = track.def.halfWidth + track.def.shoulder + 1.5;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  const dunes = (x: number, z: number) => {
    const n1 = noise.fbm(x * 0.004, z * 0.004, 4);
    const ridge = noise.ridged(x * 0.0022 + 3, z * 0.0022 - 7, 4);
    return 4 + n1 * 7 + ridge * 10;
  };
  const field = new DistanceField(track, 220, 10);
  const height = (x: number, z: number) => {
    const info = field.nearest(x, z);
    const far = Math.hypot(x - cx, z - cz);
    const mountains = smoothstep(900, 1500, far) * (60 + noise.ridged(x * 0.0015, z * 0.0015, 5) * 220);
    if (!info) return dunes(x, z) + mountains;
    const t = smoothstep(edge + 13, edge + 70, info.distance);
    return info.height - 0.4 + t * (dunes(x, z) + 0.4) + mountains;
  };
  const sandA = new THREE.Color(0xd9ad72);
  const sandB = new THREE.Color(0xc38f55);
  const rock = new THREE.Color(0x9b5a3a);
  const terrain = buildTerrain({
    xs: gradedLines(b.minX - margin, b.maxX + margin, b.minX - 240, b.maxX + 240, ctx.density >= 0.7 ? 8 : 12, 70),
    zs: gradedLines(b.minZ - margin, b.maxZ + margin, b.minZ - 240, b.maxZ + 240, ctx.density >= 0.7 ? 8 : 12, 70),
    height,
    color: (x, z, y, slope) => {
      const c = sandA.clone().lerp(sandB, 0.5 + noise.noise(x * 0.01, z * 0.01) * 0.5);
      c.lerp(rock, smoothstep(0.45, 0.9, slope) * 0.85);
      if (y > 120) c.lerp(new THREE.Color(0xb0704a), 0.5);
      return c;
    },
    textureScale: 18,
  });
  group.add(terrain.mesh);

  // ---- mesas
  const mesaGeos: THREE.BufferGeometry[] = [];
  let attempts = 0;
  const mesaCount = Math.round(18 * Math.max(0.6, ctx.density));
  let mesas = 0;
  while (mesas < mesaCount && attempts < 400) {
    attempts++;
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(250, 900);
    const x = cx + Math.cos(a) * r * 1.2;
    const z = cz + Math.sin(a) * r * 1.4;
    const radius = rng.range(35, 110);
    if (!clearOfTrack(track, x, z, radius * 1.15, 40)) continue;
    const h = rng.range(35, 110);
    const g = new THREE.CylinderGeometry(radius * rng.range(0.7, 0.85), radius, h, 10, 6);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const seed = rng.range(0, 100);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const ang = Math.atan2(pz, px);
      const n = 1 + noise.fbm(Math.cos(ang) * 2 + seed, py * 0.03 + Math.sin(ang) * 2, 3) * 0.25;
      const top = py > h / 2 - 0.1 ? 1 : n;
      pos.setXYZ(i, px * top, py + (py > h / 2 - 0.1 ? noise.noise(px * 0.05, pz * 0.05) * 3 : 0), pz * top);
    }
    g.translate(x, h / 2 + terrain.heightAt(x, z) - 6, z);
    g.deleteAttribute('uv');
    // vertex colours: strata bands
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const band = 0.5 + 0.5 * Math.sin(y * 0.35 + seed);
      const c = new THREE.Color(0xa65a35).lerp(new THREE.Color(0xd7905a), band * 0.6);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    mesaGeos.push(g);
    mesas++;
  }
  if (mesaGeos.length) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: rockTexture('#d0a080'), roughness: 0.95, flatShading: true });
    const m = new THREE.Mesh(mergeGeometries(mesaGeos)!, mat);
    m.castShadow = ctx.shadows;
    m.receiveShadow = ctx.shadows;
    group.add(m);
    mesaGeos.forEach((g) => g.dispose());
  }

  // ---- scattered props along the road
  const boulderMats: THREE.Matrix4[] = [];
  const cactusMats: THREE.Matrix4[] = [];
  const bushMats: THREE.Matrix4[] = [];
  const scatter = Math.round(700 * ctx.density);
  for (let i = 0; i < scatter; i++) {
    const s = track.sample(rng.int(0, track.sampleCount - 1));
    const side = rng.sign();
    const lat = side * (edge + 4 + Math.pow(rng.next(), 1.6) * 160);
    const x = s.x + s.rx * lat + rng.range(-8, 8);
    const z = s.z + s.rz * lat + rng.range(-8, 8);
    if (!clearOfTrack(track, x, z, 2, 3)) continue;
    const y = terrain.heightAt(x, z);
    const kind = rng.next();
    if (kind < 0.3) boulderMats.push(matrixAt(x, y + 0.3, z, rng.range(0, 6), rng.range(1, 4.5), rng.range(0.8, 3), rng.range(1, 4.5)));
    else if (kind < 0.62) cactusMats.push(matrixAt(x, y - 0.1, z, rng.range(0, 6), rng.range(0.7, 1.3)));
    else bushMats.push(matrixAt(x, y + 0.2, z, rng.range(0, 6), rng.range(0.5, 1.3), rng.range(0.4, 0.8), rng.range(0.5, 1.3)));
  }
  const rockMat = new THREE.MeshStandardMaterial({ map: rockTexture('#a8714d'), roughness: 0.95, flatShading: true });
  const bo = instanced(rockGeometry(11, 1), rockMat, boulderMats, ctx.shadows);
  if (bo) group.add(bo);
  const cactus = cactusGeometry();
  const cactusMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const ca = instanced(cactus, cactusMat, cactusMats, ctx.shadows);
  if (ca) group.add(ca);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x8c7a4a, roughness: 1, flatShading: true });
  const bu = instanced(new THREE.IcosahedronGeometry(1, 0), bushMat, bushMats);
  if (bu) group.add(bu);

  // ---- telephone poles + wires along the right side
  const poleMats: THREE.Matrix4[] = [];
  const wirePts: number[] = [];
  let prev: THREE.Vector3[] | null = null;
  for (let d = 0; d < track.length; d += 45) {
    const s = track.sample(Math.round(d / track.spacing));
    const lat = s.wallRight + 9;
    const x = s.x + s.rx * lat;
    const z = s.z + s.rz * lat;
    if (!clearOfTrack(track, x, z, 0.5, 5)) {
      prev = null;
      continue;
    }
    const y = terrain.heightAt(x, z);
    const heading = Math.atan2(s.tx, s.tz);
    poleMats.push(matrixAt(x, y, z, heading));
    const tops = [-0.9, 0, 0.9].map((o) => new THREE.Vector3(x - Math.cos(heading) * o, y + 8.6, z + Math.sin(heading) * o));
    if (prev) {
      for (let w = 0; w < 3; w++) {
        const a = prev[w];
        const c = tops[w];
        const seg = 6;
        for (let k = 0; k < seg; k++) {
          const t0 = k / seg;
          const t1 = (k + 1) / seg;
          const p0 = a.clone().lerp(c, t0);
          const p1 = a.clone().lerp(c, t1);
          p0.y -= Math.sin(t0 * Math.PI) * 1.2;
          p1.y -= Math.sin(t1 * Math.PI) * 1.2;
          wirePts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        }
      }
    }
    prev = tops;
  }
  const poleGeo = mergeGeometries(
    [new THREE.CylinderGeometry(0.13, 0.17, 9, 6).translate(0, 4.5, 0), new THREE.BoxGeometry(2.2, 0.14, 0.14).translate(0, 8.6, 0)].map((g) => (g.deleteAttribute('uv'), g)),
  )!;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });
  const po = instanced(poleGeo, poleMat, poleMats, ctx.shadows);
  if (po) group.add(po);
  if (wirePts.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
    group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x222222 })));
  }

  placeBillboards(ctx, 6, { elevation: 4, width: 14, height: 7, offset: 9, startIndex: 3 });

  return {
    update() {},
    dispose() {
      disposeObject(group);
    },
  };
}

function cactusGeometry(): THREE.BufferGeometry {
  const green = new THREE.Color(0x4f7a3a);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.32, 0.38, 5, 8).translate(0, 2.5, 0);
  parts.push(withColor(trunk, green));
  parts.push(withColor(new THREE.SphereGeometry(0.32, 8, 6).translate(0, 5, 0), green));
  for (const [side, h, len] of [
    [1, 2.2, 1.6],
    [-1, 2.9, 1.3],
  ]) {
    const elbow = new THREE.CylinderGeometry(0.22, 0.22, 0.9, 7).rotateZ(Math.PI / 2).translate(side * 0.7, h, 0);
    const up = new THREE.CylinderGeometry(0.22, 0.24, len, 7).translate(side * 1.1, h + len / 2, 0);
    const cap = new THREE.SphereGeometry(0.22, 7, 5).translate(side * 1.1, h + len, 0);
    parts.push(withColor(elbow, green), withColor(up, green), withColor(cap, green));
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}
