import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { asphaltTexture, buildingTextures, BuildingStyle, sidewalkTexture, skylineTexture } from '../../utils/textures';
import { extrudeProfile } from '../extrude';
import {
  clearOfTrack,
  disposeObject,
  EnvContext,
  faceRoad,
  instanced,
  lightPools,
  matrixAt,
  placeBillboards,
  streetLampGeometries,
  TrackEnvironment,
} from './common';

/** Neo Harbor downtown: sidewalks, skyscrapers with lit windows, street lamps, billboards, skyline. */
export function buildCityEnvironment(ctx: EnvContext): TrackEnvironment {
  const { track, group, atmo, rng } = ctx;
  const night = atmo.lightsOn;
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  // ---- ground
  const groundTex = asphaltTexture().clone();
  groundTex.repeat.set(120, 120);
  groundTex.needsUpdate = true;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3200, 3200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: groundTex, color: 0x6c6c70, roughness: 0.9 }),
  );
  ground.position.set(cx, -0.08, cz);
  ground.receiveShadow = true;
  group.add(ground);

  // ---- raised sidewalks behind the barriers
  const walkTex = sidewalkTexture();
  const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.9 });
  const walkProfile = [
    { a: 'w' as const, d: 0.65, y: -0.1 },
    { a: 'w' as const, d: 0.7, y: 0.16 },
    { a: 'w' as const, d: 0.7, y: 0.16 },
    { a: 'w' as const, d: 7.5, y: 0.16 },
    { a: 'w' as const, d: 7.6, y: -0.1 },
  ];
  for (const side of ['left', 'right'] as const) {
    const g = extrudeProfile(track, walkProfile, { side, uScale: 0.25, vScale: 4, filter: (s) => !s.tunnel });
    if (g) {
      const m = new THREE.Mesh(g, walkMat);
      m.receiveShadow = true;
      group.add(m);
    }
  }

  // ---- buildings (merged per facade style)
  const styles: BuildingStyle[] = ['glass', 'office', 'brick'];
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  const placed: { x: number; z: number; r: number }[] = [];
  const antennaMats: THREE.Matrix4[] = [];
  const roofBoxes: THREE.Matrix4[] = [];
  const frame = { x: 0, y: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0, halfWidth: 0 };
  const rows = ctx.density >= 0.7 ? 2 : 1;
  for (let row = 0; row < rows; row++) {
    for (const side of [-1, 1]) {
      let d = rng.range(0, 20);
      while (d < track.length) {
        const w = rng.range(16, 34);
        const depth = rng.range(14, 28);
        const gap = rng.range(2, 7);
        track.frameAt(d + w / 2, frame);
        const s = track.sample(Math.round((d + w / 2) / track.spacing));
        d += w + gap;
        const wall = side > 0 ? s.wallRight : s.wallLeft;
        const lateral = side * (wall + 8.5 + depth / 2 + row * 34);
        const x = frame.x + frame.rx * lateral;
        const z = frame.z + frame.rz * lateral;
        const r = Math.hypot(w, depth) / 2;
        // keep clear of every part of the circuit and other buildings
        let ok = true;
        for (const [ox, oz] of [
          [0, 0],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          const px = x + frame.tx * (w / 2) * ox + frame.rx * (depth / 2) * oz;
          const pz = z + frame.tz * (w / 2) * ox + frame.rz * (depth / 2) * oz;
          if (!clearOfTrack(track, px, pz, 0, 7.5)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < (p.r + r) * 0.78)) continue;
        placed.push({ x, z, r });
        const tall = rng.next();
        let h = tall > 0.82 ? rng.range(70, 150) : tall > 0.2 ? rng.range(24, 65) : rng.range(12, 22);
        if (row === 1) h *= 1.3;
        const style = rng.pick(styles);
        const variant = rng.int(0, 1);
        const geo = new THREE.BoxGeometry(w, h, depth);
        scaleBoxUVs(geo, w, h, depth);
        geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(frame.tx, frame.tz)).setPosition(x, h / 2 - 0.1, z));
        const key = `${style}-${variant}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(geo);
        if (h > 60 && rng.chance(0.7)) antennaMats.push(matrixAt(x, h + 6, z, 0, 1, 12, 1));
        if (rng.chance(0.6)) roofBoxes.push(matrixAt(x + rng.range(-3, 3), h + 1.2, z + rng.range(-3, 3), rng.range(0, 3), rng.range(3, 6), 2.4, rng.range(3, 6)));
      }
    }
  }
  buckets.forEach((list, key) => {
    const [style, variant] = key.split('-');
    const tex = buildingTextures(style as BuildingStyle, Number(variant));
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map,
      emissiveMap: tex.emissive,
      emissive: 0xffffff,
      emissiveIntensity: night ? 1.4 : 0,
      roughness: style === 'glass' ? 0.25 : 0.8,
      metalness: style === 'glass' ? 0.6 : 0.05,
    });
    const merged = mergeGeometries(list)!;
    list.forEach((g) => g.dispose());
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = ctx.shadows;
    m.receiveShadow = ctx.shadows;
    group.add(m);
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.8 });
  const rb = instanced(new THREE.BoxGeometry(1, 1, 1), roofMat, roofBoxes, ctx.shadows);
  if (rb) group.add(rb);
  const antennaMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const ant = instanced(new THREE.CylinderGeometry(0.15, 0.25, 1, 6), antennaMat, antennaMats);
  if (ant) group.add(ant);
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2020).multiplyScalar(4) });
  const beacons = instanced(
    new THREE.SphereGeometry(0.5, 8, 6),
    beaconMat,
    antennaMats.map((m) => {
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      return matrixAt(p.x, p.y + 6.2, p.z);
    }),
  );
  if (beacons) group.add(beacons);

  // ---- street lamps
  const lamp = streetLampGeometries(9.5, 3.4);
  const lampMats: THREE.Matrix4[] = [];
  const bulbMats: THREE.Matrix4[] = [];
  const pools: THREE.Vector3[] = [];
  const lampSpacing = 32;
  for (let d = 5; d < track.length; d += lampSpacing) {
    const s = track.sample(Math.round(d / track.spacing));
    if (s.tunnel) continue;
    for (const side of [-1, 1]) {
      if ((Math.round(d / lampSpacing) + (side > 0 ? 0 : 1)) % 2 === 0) continue;
      const wall = side > 0 ? s.wallRight : s.wallLeft;
      const lat = side * (wall + 1.6);
      const x = s.x + s.rx * lat;
      const z = s.z + s.rz * lat;
      const heading = faceRoad(s.rx, s.rz, side);
      lampMats.push(matrixAt(x, s.y + 0.1, z, heading));
      const tip = lamp.bulbOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      bulbMats.push(matrixAt(x + tip.x, s.y + 0.1 + tip.y, z + tip.z, heading));
      pools.push(new THREE.Vector3(x + tip.x * 1.3, s.y, z + tip.z * 1.3));
    }
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.7, roughness: 0.4 });
  const poles = instanced(lamp.pole, poleMat, lampMats, ctx.shadows);
  if (poles) group.add(poles);
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2b0).multiplyScalar(night ? 6 : 1.2) });
  const bulbs = instanced(lamp.bulb, bulbMat, bulbMats);
  if (bulbs) group.add(bulbs);
  if (night) {
    const lp = lightPools(pools, new THREE.Color(0xffc985).multiplyScalar(0.28), 16);
    if (lp) group.add(lp);
  }

  // ---- billboards
  placeBillboards(ctx, Math.round(12 * ctx.density) + 4, { elevation: 5.5, width: 12, height: 6, offset: 4.2 });

  // ---- distant skyline ring
  const skyTex = skylineTexture();
  const skyMat = new THREE.MeshStandardMaterial({
    map: skyTex,
    emissiveMap: skyTex,
    emissive: 0xffffff,
    emissiveIntensity: night ? 1.2 : 0,
    color: night ? 0xffffff : 0x8a96a8,
    roughness: 0.6,
  });
  const skyMats: THREE.Matrix4[] = [];
  const ringCount = Math.round(90 * Math.max(0.5, ctx.density));
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + rng.range(-0.02, 0.02);
    const r = rng.range(720, 1050);
    const h = rng.range(60, 260);
    const w = rng.range(30, 70);
    skyMats.push(matrixAt(cx + Math.cos(a) * r, h / 2, cz + Math.sin(a) * r, -a, w, h, rng.range(30, 60)));
  }
  const skyline = instanced(new THREE.BoxGeometry(1, 1, 1), skyMat, skyMats, false, false);
  if (skyline) group.add(skyline);

  // ---- update: blinking aircraft beacons
  return {
    update(_dt, time) {
      const on = Math.sin(time * 3) > 0.6;
      beaconMat.color.setRGB(on ? 4 : 0.3, 0.1, 0.1);
    },
    dispose() {
      disposeObject(group);
      groundTex.dispose();
    },
  };
}

/** Scales BoxGeometry UVs so facade textures keep real-world proportions (8 windows x 16 floors per tile). */
function scaleBoxUVs(geo: THREE.BoxGeometry, w: number, h: number, d: number): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const faceW = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) uv.setXY(i, 0.01, 0.99);
      else uv.setXY(i, (uv.getX(i) * faceW[f]) / 24, (uv.getY(i) * h) / 56);
    }
  }
  uv.needsUpdate = true;
}
