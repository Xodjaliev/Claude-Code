import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  checkerTexture,
  concreteTexture,
  curbTexture,
  gravelTexture,
  radialGlowTexture,
  roadTexture,
  RoadMarkingStyle,
  sandTexture,
  startBannerTexture,
  tunnelTexture,
  wallBannerTexture,
} from '../utils/textures';
import { Noise2D } from '../utils/Noise';
import type { AtmosphereParams } from './Atmosphere';
import { extrudeProfile, extrudeShell, placeOnTrack, ProfilePoint, sampleRuns } from './extrude';

import type { Track } from './Track';
import type { ThemeId } from './TrackCatalog';

interface TrackStyle {
  road: RoadMarkingStyle;
  shoulder: 'concrete' | 'sand' | 'gravel';
  barrier: 'concrete' | 'guardrail';
  tunnel: 'city' | 'rock';
}

const STYLES: Record<ThemeId, TrackStyle> = {
  city: { road: 'city', shoulder: 'concrete', barrier: 'concrete', tunnel: 'city' },
  desert: { road: 'desert', shoulder: 'sand', barrier: 'guardrail', tunnel: 'rock' },
  mountain: { road: 'mountain', shoulder: 'gravel', barrier: 'guardrail', tunnel: 'rock' },
};

export class StartLights {
  private reds: { m: THREE.MeshStandardMaterial; column: number }[] = [];
  private greens: THREE.MeshStandardMaterial[] = [];

  addRed(m: THREE.MeshStandardMaterial, column: number): void {
    this.reds.push({ m, column });
  }
  addGreen(m: THREE.MeshStandardMaterial): void {
    this.greens.push(m);
  }

  /** count = 3,2,1 -> red lights on; 0 -> GO (green); -1 -> all off */
  set(count: number): void {
    const litRed = count > 0 ? 4 - count : 0;
    this.reds.forEach(({ m, column }) => (m.emissiveIntensity = column < litRed ? 6 : 0.05));
    this.greens.forEach((m) => (m.emissiveIntensity = count === 0 ? 6 : 0.05));
  }
}

export class CheckpointGate {
  constructor(
    readonly index: number,
    private readonly material: THREE.MeshBasicMaterial,
    private readonly beam: THREE.MeshBasicMaterial,
  ) {}
  setActive(active: boolean): void {
    this.material.opacity = active ? 1 : 0.25;
    this.beam.opacity = active ? 0.22 : 0.0;
  }
}

export interface TrackVisuals {
  group: THREE.Group;
  startLights: StartLights;
  gates: CheckpointGate[];
  /** Ground height lookup for things that sit on the road shoulders. */
  dispose(): void;
}

function mesh(geo: THREE.BufferGeometry | null, mat: THREE.Material, opts: { cast?: boolean; receive?: boolean } = {}): THREE.Mesh | null {
  if (!geo) return null;
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = !!opts.cast;
  m.receiveShadow = opts.receive !== false;
  return m;
}

export function buildTrackVisuals(track: Track, theme: ThemeId, atmo: AtmosphereParams, accent: string): TrackVisuals {
  const style = STYLES[theme];
  const group = new THREE.Group();
  group.name = 'track';
  const add = (m: THREE.Object3D | null) => m && group.add(m);
  const night = atmo.lightsOn;

  // ---------------------------------------------------------------- road surface
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(style.road), roughness: night ? 0.62 : 0.86, metalness: 0.0 });
  add(mesh(buildRoadSurface(track), roadMat));

  // ---------------------------------------------------------------- shoulders (run-off up to the barrier)
  const shoulderTex = style.shoulder === 'concrete' ? concreteTexture('#5d5c5a') : style.shoulder === 'sand' ? sandTexture() : gravelTexture();
  const shoulderMat = new THREE.MeshStandardMaterial({ map: shoulderTex, roughness: 0.95, metalness: 0 });
  const shoulderProfile: ProfilePoint[] = [
    { a: 'e', d: 0, y: -0.005 },
    { a: 'w', d: 0.6, y: -0.01 },
    { a: 'w', d: 1.4, y: -0.9 },
  ];
  for (const side of ['left', 'right'] as const) {
    add(mesh(extrudeProfile(track, shoulderProfile, { side, uScale: 0.25, vScale: 4 }), shoulderMat));
  }

  // ---------------------------------------------------------------- curbs on corners
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTexture(), roughness: 0.7 });
  const curbProfile: ProfilePoint[] = [
    { a: 'e', d: -1.0, y: 0.004, u: 0 },
    { a: 'e', d: -0.2, y: 0.05, u: 0.5 },
    { a: 'e', d: 0.35, y: 0.012, u: 1 },
  ];
  const curvy = (s: { curvature: number; tunnel: boolean }) => Math.abs(s.curvature) > 1 / 140 && !s.tunnel;
  const curbFilter = (_s: unknown, i: number) => {
    for (let k = -8; k <= 8; k += 2) if (curvy(track.sample(i + k))) return true;
    return false;
  };
  for (const side of ['left', 'right'] as const) {
    add(mesh(extrudeProfile(track, curbProfile, { side, vScale: 4, filter: curbFilter, yOffset: 0.01 }), curbMat));
  }

  // ---------------------------------------------------------------- barriers
  const notTunnel = (s: { tunnel: boolean }) => !s.tunnel;
  if (style.barrier === 'concrete') {
    const conc = new THREE.MeshStandardMaterial({ map: concreteTexture('#a3a19b'), roughness: 0.9 });
    const prof: ProfilePoint[] = [
      { a: 'w', d: 0, y: -0.2 },
      { a: 'w', d: 0, y: 0.3 },
      { a: 'w', d: 0.14, y: 0.55 },
      { a: 'w', d: 0.18, y: 1.05 },
      { a: 'w', d: 0.18, y: 1.05 },
      { a: 'w', d: 0.5, y: 1.05 },
      { a: 'w', d: 0.5, y: 1.05 },
      { a: 'w', d: 0.7, y: -0.2 },
    ];
    for (const side of ['left', 'right'] as const) add(mesh(extrudeProfile(track, prof, { side, uScale: 0.6, vScale: 3, filter: notTunnel }), conc, { cast: true }));
    // sponsor banners on top of the wall
    const bannerMat = new THREE.MeshStandardMaterial({
      map: wallBannerTexture(),
      emissiveMap: wallBannerTexture(),
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: night ? 0.6 : 0.05,
      roughness: 0.6,
    });
    const bprof: ProfilePoint[] = [
      { a: 'w', d: 0.25, y: 1.05, u: 0 },
      { a: 'w', d: 0.25, y: 1.95, u: 1 },
    ];
    add(mesh(extrudeProfile(track, bprof, { side: 'left', vScale: 32, swapUV: true, filter: notTunnel }), bannerMat));
    add(mesh(extrudeProfile(track, bprof, { side: 'right', vScale: 32, swapUV: true, flipV: true, filter: notTunnel }), bannerMat));
  } else {
    const steel = new THREE.MeshStandardMaterial({ color: 0xb7bcc2, metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide });
    const rail: ProfilePoint[] = [
      { a: 'w', d: 0.02, y: 0.42 },
      { a: 'w', d: -0.03, y: 0.55 },
      { a: 'w', d: 0.02, y: 0.68 },
      { a: 'w', d: -0.03, y: 0.8 },
    ];
    for (const side of ['left', 'right'] as const) add(mesh(extrudeProfile(track, rail, { side, filter: notTunnel }), steel, { cast: true }));
    // posts
    const postGeo = new THREE.BoxGeometry(0.12, 0.95, 0.12);
    postGeo.translate(0, 0.42, 0);
    const posts: THREE.Matrix4[] = [];
    const tmp = new THREE.Object3D();
    for (let i = 0; i < track.sampleCount; i += 2) {
      const s = track.samples[i];
      if (s.tunnel) continue;
      for (const sgn of [-1, 1]) {
        const lat = sgn * ((sgn < 0 ? s.wallLeft : s.wallRight) + 0.12);
        tmp.position.set(s.x + s.rx * lat, s.y, s.z + s.rz * lat);
        tmp.rotation.set(0, Math.atan2(s.tx, s.tz), 0);
        tmp.updateMatrix();
        posts.push(tmp.matrix.clone());
      }
    }
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8e9399, metalness: 0.7, roughness: 0.45 });
    const inst = new THREE.InstancedMesh(postGeo, postMat, posts.length);
    posts.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
    // reflective delineators on top of the rail (glow in headlights)
    const refl = new THREE.MeshStandardMaterial({ color: 0xff3b1f, emissive: 0xff2a10, emissiveIntensity: night ? 1.2 : 0.2 });
    const reflGeo = new THREE.BoxGeometry(0.06, 0.08, 0.16);
    const reflMats: THREE.Matrix4[] = [];
    for (let i = 0; i < track.sampleCount; i += 12) {
      const s = track.samples[i];
      if (s.tunnel) continue;
      for (const sgn of [-1, 1]) {
        const lat = sgn * ((sgn < 0 ? s.wallLeft : s.wallRight) - 0.02);
        tmp.position.set(s.x + s.rx * lat, s.y + 0.9, s.z + s.rz * lat);
        tmp.rotation.set(0, Math.atan2(s.tx, s.tz), 0);
        tmp.updateMatrix();
        reflMats.push(tmp.matrix.clone());
      }
    }
    const reflInst = new THREE.InstancedMesh(reflGeo, refl, reflMats.length);
    reflMats.forEach((m, i) => reflInst.setMatrixAt(i, m));
    group.add(reflInst);
  }

  // ---------------------------------------------------------------- tunnels
  buildTunnels(track, style, group, night, theme);

  // ---------------------------------------------------------------- start / finish
  const checker = new THREE.MeshStandardMaterial({
    map: checkerTexture(),
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const finish = new THREE.Mesh(new THREE.PlaneGeometry(track.samples[0].halfWidth * 2, 3).rotateX(-Math.PI / 2), checker);
  finish.receiveShadow = true;
  placeOnTrack(track, finish, 0, 0, 0.012);
  group.add(finish);
  const startLights = new StartLights();
  buildGantry(track, group, startLights, night);
  buildGridMarks(track, group);

  // ---------------------------------------------------------------- checkpoints
  const gates: CheckpointGate[] = [];
  const accentColor = new THREE.Color(accent);
  for (let i = 0; i < track.checkpoints.length - 1; i++) {
    const dist = track.checkpoints[i];
    const s = track.sample(Math.round(dist / track.spacing));
    const postMat = new THREE.MeshBasicMaterial({ color: accentColor.clone().multiplyScalar(3), transparent: true, opacity: 0.25, depthWrite: false });
    const beamMat = new THREE.MeshBasicMaterial({
      map: radialGlowTexture(),
      color: accentColor.clone().multiplyScalar(1.5),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const g = new THREE.Group();
    for (const sgn of [-1, 1]) {
      const lat = sgn * ((sgn < 0 ? s.wallLeft : s.wallRight) - 0.3);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.5, 0.25), postMat);
      // local +X is the driver's left once placed on the track (forward = +Z)
      post.position.set(-lat, 2.25, 0);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.PlaneGeometry((s.wallLeft + s.wallRight) * 1.0, 5), beamMat);
    beam.position.y = 2.5;
    g.add(beam);
    placeOnTrack(track, g, dist, 0);
    group.add(g);
    gates.push(new CheckpointGate(i, postMat, beamMat));
  }

  return {
    group,
    startLights,
    gates,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mt) => mt.dispose());
        }
      });
    },
  };
}

/** Road ribbon from the left edge to the right edge with U 0..1 across. */
function buildRoadSurface(track: Track): THREE.BufferGeometry {
  const n = track.sampleCount;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const uvs = new Float32Array((n + 1) * 2 * 2);
  const idx: number[] = [];
  for (let k = 0; k <= n; k++) {
    const s = track.samples[k % n];
    const w = s.halfWidth;
    const v = (k * track.spacing) / 24;
    positions.set([s.x - s.rx * w, s.y, s.z - s.rz * w, s.x + s.rx * w, s.y, s.z + s.rz * w], k * 6);
    uvs.set([0, v, 1, v], k * 4);
    if (k < n) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildTunnels(track: Track, style: TrackStyle, group: THREE.Group, _night: boolean, theme: ThemeId): void {
  const noise = new Noise2D(track.def.seed + 5);
  for (const t of track.def.tunnels) {
    const from = track.edgeDistance(t.edge, t.from);
    const to = track.edgeDistance(t.edge, t.to);
    const hw = track.def.halfWidth;
    const wall = hw + 1.0;
    let inner: { d: number; y: number }[];
    let outer: { d: number; y: number }[];
    let displace: ((dist: number, j: number, d: number, y: number) => [number, number]) | undefined;
    if (style.tunnel === 'city') {
      inner = [
        { d: wall, y: -0.1 },
        { d: wall, y: 5.2 },
        { d: wall - 1.2, y: 6.6 },
        { d: -(wall - 1.2), y: 6.6 },
        { d: -wall, y: 5.2 },
        { d: -wall, y: -0.1 },
      ];
      outer = [
        { d: wall + 2.5, y: -0.1 },
        { d: wall + 2.5, y: 8.2 },
        { d: wall + 2.5, y: 8.2 },
        { d: -(wall + 2.5), y: 8.2 },
        { d: -(wall + 2.5), y: 8.2 },
        { d: -(wall + 2.5), y: -0.1 },
      ];
    } else {
      inner = [{ d: wall, y: -0.1 }];
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI;
        inner.push({ d: Math.cos(a) * wall, y: 3.0 + Math.sin(a) * 4.4 });
      }
      inner.push({ d: -wall, y: -0.1 });
      outer = [];
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI;
        outer.push({ d: Math.cos(a) * (wall + 16), y: Math.max(-1, Math.sin(a) * 15 - 1) });
      }
      displace = (dist, j, d, y) => {
        const n = noise.fbm(dist * 0.05, j * 0.7, 3);
        const lift = j === 0 || j === 27 ? 0 : 1;
        return [d + n * 2.5 * lift, y + n * 2.2 * lift];
      };
    }
    const shell = extrudeShell(track, inner, outer, from, to, displace);
    const innerTex = tunnelTexture(style.tunnel === 'city' ? 'city' : 'rock');
    const innerMat = new THREE.MeshStandardMaterial({ map: innerTex, roughness: 0.85, metalness: 0 });
    const outerMat =
      style.tunnel === 'city'
        ? new THREE.MeshStandardMaterial({ map: concreteTexture('#6f6d68'), roughness: 0.9 })
        : new THREE.MeshStandardMaterial({ map: theme === 'desert' ? concreteTexture('#a0623a') : concreteTexture('#6b625a'), roughness: 0.95, flatShading: true });
    const im = new THREE.Mesh(shell.inner, innerMat);
    im.receiveShadow = true;
    const om = new THREE.Mesh(shell.outer, outerMat);
    om.castShadow = true;
    om.receiveShadow = true;
    const cm = new THREE.Mesh(shell.caps, outerMat);
    group.add(im, om, cm);

    // continuous light strips on the ceiling
    const lightColor = style.tunnel === 'city' ? new THREE.Color(0xdff3ff) : new THREE.Color(0xffb15a);
    const stripMat = new THREE.MeshBasicMaterial({ color: lightColor.multiplyScalar(4) });
    const stripY = style.tunnel === 'city' ? 6.55 : 6.95;
    for (const lat of [-2.4, 2.4]) {
      const strip = extrudeProfile(
        track,
        [
          { a: 'c', d: lat + 0.25, y: stripY },
          { a: 'c', d: lat - 0.25, y: stripY },
        ],
        { from: from + 3, to: to - 3 },
      );
      if (strip) group.add(new THREE.Mesh(strip, stripMat));
    }
    // warm glow on the walls (fake bounce light)
    const glowMat = new THREE.MeshBasicMaterial({
      map: radialGlowTexture(),
      color: (style.tunnel === 'city' ? new THREE.Color(0x6688aa) : new THREE.Color(0xaa6a2a)).multiplyScalar(0.6),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowGeo = new THREE.PlaneGeometry(10, 6);
    const runs = sampleRuns(track, { from, to });
    if (runs.length) {
      const ids = runs[0].indices;
      for (let k = 4; k < ids.length - 4; k += 6) {
        const s = track.samples[ids[k]];
        for (const sgn of [-1, 1]) {
          const g = new THREE.Mesh(glowGeo, glowMat);
          const lat = sgn * (wall - 0.05);
          g.position.set(s.x + s.rx * lat, s.y + 3, s.z + s.rz * lat);
          g.rotation.y = Math.atan2(s.tx, s.tz) + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2);
          group.add(g);
        }
      }
    }
  }
}

function buildGantry(track: Track, group: THREE.Group, lights: StartLights, night: boolean): void {
  const s = track.samples[0];
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.8, roughness: 0.35 });
  const span = s.wallLeft + s.wallRight + 1.4;
  const pillarGeo = new THREE.BoxGeometry(0.7, 8, 0.7);
  for (const sgn of [-1, 1]) {
    const p = new THREE.Mesh(pillarGeo, metal);
    p.position.set(sgn * (span / 2), 4, 0);
    p.castShadow = true;
    g.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.7, 1.6, 0.9), metal);
  beam.position.y = 7.6;
  beam.castShadow = true;
  g.add(beam);
  const bannerMat = new THREE.MeshStandardMaterial({
    map: startBannerTexture('VELOCITY RUSH'),
    emissiveMap: startBannerTexture('VELOCITY RUSH'),
    emissive: 0xffffff,
    emissiveIntensity: night ? 1.2 : 0.3,
  });
  for (const sgn of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.9, span * 0.9 * 0.125), bannerMat);
    b.position.set(0, 7.6, sgn * 0.46);
    if (sgn < 0) b.rotation.y = Math.PI;
    g.add(b);
  }
  // start lights hang below the beam, facing the grid (behind the line = -Z)
  const housing = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.5 });
  const lampGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 20);
  lampGeo.rotateX(Math.PI / 2);
  for (let c = 0; c < 3; c++) {
    for (const side of [-1, 1]) {
      const x = side * (1.2 + c * 0.9);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.3), housing);
      box.position.set(x, 6.2, -0.3);
      g.add(box);
      const red = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a1a, emissiveIntensity: 0.05 });
      const green = new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x1aff4a, emissiveIntensity: 0.05 });
      const r = new THREE.Mesh(lampGeo, red);
      r.position.set(x, 6.55, -0.48);
      const gr = new THREE.Mesh(lampGeo, green);
      gr.position.set(x, 5.85, -0.48);
      g.add(r, gr);
      lights.addRed(red, c);
      lights.addGreen(green);
    }
  }
  placeOnTrack(track, g, 0, (s.wallRight - s.wallLeft) / 2);
  group.add(g);
}

function buildGridMarks(track: Track, group: THREE.Group): void {
  const geos: THREE.BufferGeometry[] = [];
  const frame = { x: 0, y: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0, halfWidth: 0 };
  for (let slot = 0; slot < 8; slot++) {
    const g = track.gridSlot(slot);
    // front bar + two short side bars forming a bracket
    const parts: [number, number, number, number][] = [
      [0, 2.4, 0.18, 0.0],
      [-1.15, 0.18, 1.6, -0.8],
      [1.15, 0.18, 1.6, -0.8],
    ];
    for (const [dl, w, l, dd] of parts) {
      track.frameAt(g.dist + 2.6 + dd, frame);
      const lat = g.lateral + dl;
      const p = new THREE.PlaneGeometry(w, l);
      p.rotateX(-Math.PI / 2);
      const m = new THREE.Matrix4().makeRotationY(Math.atan2(frame.tx, frame.tz));
      m.setPosition(frame.x + frame.rx * lat, frame.y + 0.02, frame.z + frame.rz * lat);
      p.applyMatrix4(m);
      geos.push(p);
    }
  }
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(merged, mat);
  m.receiveShadow = true;
  group.add(m);
}
