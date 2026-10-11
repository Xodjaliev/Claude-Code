import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise2D } from '../../utils/Noise';
import { Random } from '../../utils/Random';
import { billboardTexture, BILLBOARD_COUNT, radialGlowTexture } from '../../utils/textures';
import type { AtmosphereParams } from '../Atmosphere';
import type { Track } from '../Track';

export interface EnvContext {
  group: THREE.Group;
  track: Track;
  atmo: AtmosphereParams;
  /** 0.3 .. 1 decoration density from graphics quality */
  density: number;
  shadows: boolean;
  rng: Random;
  noise: Noise2D;
}

export interface TrackEnvironment {
  update(dt: number, time: number): void;
  dispose(): void;
}

export type EnvironmentBuilder = (ctx: EnvContext) => TrackEnvironment;

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.Line).isLine && !(o as THREE.Points).isPoints) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mt) => mt?.dispose());
  });
}

export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], cast = false, receive = true, colors?: THREE.Color[]): THREE.InstancedMesh | null {
  if (!matrices.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
  if (colors) colors.forEach((c, i) => m.setColorAt(i, c));
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.computeBoundingSphere();
  return m;
}

const tmpObj = new THREE.Object3D();
export function matrixAt(x: number, y: number, z: number, rotY = 0, sx = 1, sy = sx, sz = sx, rotX = 0, rotZ = 0): THREE.Matrix4 {
  tmpObj.position.set(x, y, z);
  tmpObj.rotation.set(rotX, rotY, rotZ);
  tmpObj.scale.set(sx, sy, sz);
  tmpObj.updateMatrix();
  return tmpObj.matrix.clone();
}

/** True when a circle of `radius` at (x,z) stays `margin` metres clear of every road barrier. */
export function clearOfTrack(track: Track, x: number, z: number, radius: number, margin: number): boolean {
  const maxW = track.def.halfWidth + track.def.shoulder + margin + radius;
  return track.nearestInfo(x, z, maxW) === null;
}

/** Heading that makes an object's +Z face toward the road centre from the given side. */
export function faceRoad(rx: number, rz: number, side: number): number {
  return Math.atan2(-rx * side, -rz * side);
}

export function withColor(g: THREE.BufferGeometry, color: THREE.Color | number): THREE.BufferGeometry {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  const n = out.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return out;
}

export function rockGeometry(seed: number, detail = 1): THREE.BufferGeometry {
  const noise = new Noise2D(seed);
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = 1 + noise.fbm(x * 1.3 + seed, z * 1.3 + y, 3) * 0.35;
    pos.setXYZ(i, x * n, y * n * 0.75, z * n);
  }
  g.computeVertexNormals();
  return g;
}

/** Street lamp: pole + arm pointing to +Z (towards the road), bulb at the tip. */
export function streetLampGeometries(height = 9, reach = 3.2): { pole: THREE.BufferGeometry; bulb: THREE.BufferGeometry; bulbOffset: THREE.Vector3 } {
  const pole = new THREE.CylinderGeometry(0.09, 0.14, height, 8);
  pole.translate(0, height / 2, 0);
  const arm = new THREE.CylinderGeometry(0.06, 0.06, reach, 6).rotateX(Math.PI / 2);
  arm.translate(0, height - 0.1, reach / 2);
  const head = new THREE.BoxGeometry(0.45, 0.14, 0.9);
  head.translate(0, height - 0.15, reach);
  const base = new THREE.CylinderGeometry(0.22, 0.26, 0.6, 8);
  base.translate(0, 0.3, 0);
  const merged = mergeGeometries([pole, arm, head, base].map((g) => (g.deleteAttribute('uv'), g)))!;
  const bulb = new THREE.BoxGeometry(0.34, 0.05, 0.7);
  const bulbOffset = new THREE.Vector3(0, height - 0.24, reach);
  return { pole: merged, bulb, bulbOffset };
}

/** Roadside billboards facing the road; returns how many were placed. */
export function placeBillboards(ctx: EnvContext, count: number, opts: { elevation: number; width: number; height: number; offset: number; startIndex?: number }): void {
  const { track, group, atmo } = ctx;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b2e35, metalness: 0.7, roughness: 0.4 });
  const frames: THREE.BufferGeometry[] = [];
  const faces = new Map<number, THREE.BufferGeometry[]>();
  const spacing = track.length / count;
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const dist = spacing * (i + 0.5) + ctx.rng.range(-spacing * 0.2, spacing * 0.2);
    const s = track.sample(Math.round(dist / track.spacing));
    if (s.tunnel || Math.abs(s.curvature) > 1 / 90) continue;
    const side = i % 2 === 0 ? 1 : -1;
    const wall = side > 0 ? s.wallRight : s.wallLeft;
    const lat = side * (wall + opts.offset);
    const x = s.x + s.rx * lat;
    const z = s.z + s.rz * lat;
    if (!clearOfTrack(track, x, z, opts.width / 2 - 1, opts.offset - 1.5)) continue;
    // angle the board slightly towards oncoming traffic
    const heading = faceRoad(s.rx, s.rz, side) + side * 0.35;
    const m = new THREE.Matrix4().makeRotationY(heading);
    m.setPosition(x, s.y, z);
    for (const px of [-opts.width * 0.32, opts.width * 0.32]) {
      const p = new THREE.CylinderGeometry(0.18, 0.22, opts.elevation, 8);
      p.deleteAttribute('uv');
      p.translate(px, opts.elevation / 2, -0.25);
      p.applyMatrix4(m);
      frames.push(p);
    }
    const back = new THREE.BoxGeometry(opts.width + 0.5, opts.height + 0.5, 0.35);
    back.deleteAttribute('uv');
    back.translate(0, opts.elevation + opts.height / 2, -0.22);
    back.applyMatrix4(m);
    frames.push(back);
    const face = new THREE.PlaneGeometry(opts.width, opts.height);
    face.translate(0, opts.elevation + opts.height / 2, 0);
    face.applyMatrix4(m);
    const tex = ((opts.startIndex ?? 0) + placed) % BILLBOARD_COUNT;
    if (!faces.has(tex)) faces.set(tex, []);
    faces.get(tex)!.push(face);
    placed++;
  }
  if (frames.length) {
    const fm = new THREE.Mesh(mergeGeometries(frames)!, frameMat);
    fm.castShadow = ctx.shadows;
    group.add(fm);
    frames.forEach((g) => g.dispose());
  }
  faces.forEach((list, tex) => {
    const t = billboardTexture(tex);
    const mat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: atmo.lightsOn ? 1.5 : 0.12, roughness: 0.5 });
    group.add(new THREE.Mesh(mergeGeometries(list)!, mat));
    list.forEach((g) => g.dispose());
  });
}

/** Additive light pools on the ground (fake street-light illumination at night). */
export function lightPools(points: THREE.Vector3[], color: THREE.Color, size: number): THREE.InstancedMesh | null {
  if (!points.length) return null;
  const geo = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: radialGlowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
  const mats = points.map((p) => matrixAt(p.x, p.y + 0.06, p.z));
  const m = instanced(geo, mat, mats, false, false);
  if (m) m.renderOrder = 3;
  return m;
}
