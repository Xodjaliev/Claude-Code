import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, lerp, smoothstep } from '../utils/math';
import { contactShadowTexture, headlightTexture, numberDecalTexture, radialGlowTexture } from '../utils/textures';
import type { CarBodyShape, CarDefinition } from './CarCatalog';
import type { CarConfig } from './Upgrades';
import { getWheelGeometry } from './WheelFactory';

/**
 * Builds a fully procedural car from a CarDefinition + CarConfig:
 * extruded side-profile body with wheel arches, glass greenhouse, roof, pillars,
 * lights, spoilers, body kits, decals, underglow, interior and wheels.
 * Static parts are merged per material to keep draw calls low (~17 per car).
 */

export interface WheelVisual {
  /** Steering pivot (rotation.y). */
  pivot: THREE.Group;
  /** Rolling (rotation.x). */
  spin: THREE.Group;
  front: boolean;
  side: 1 | -1;
}

export interface CarModel {
  root: THREE.Group;
  /** Sprung mass: pitch/roll is applied here. */
  body: THREE.Group;
  wheels: WheelVisual[];
  paint: THREE.MeshPhysicalMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  brakeLights: THREE.MeshStandardMaterial;
  headLights: THREE.MeshStandardMaterial;
  exhaustPoints: THREE.Vector3[];
  flames: THREE.Mesh[];
  steeringWheel: THREE.Group;
  driverHead: THREE.Mesh;
  /** Greenhouse glass (hidden in the cockpit view so reflections don't wash out the windscreen). */
  glass: THREE.Mesh | null;
  driverEye: THREE.Vector3;
  hoodEye: THREE.Vector3;
  headlightPool: THREE.Mesh | null;
  underglow: THREE.Mesh | null;
  length: number;
  width: number;
  height: number;
  setBraking(on: boolean, lightsOn: boolean): void;
  setNitro(intensity: number, time: number): void;
  dispose(): void;
}

export interface CarModelOptions {
  /** Night: emissive lights brighter + headlight pool on the road. */
  lightsOn?: boolean;
  shadows?: boolean;
  /** Show the instrument panel / steering wheel animation (player car). */
  interior?: boolean;
}

type Parts = {
  paint: THREE.BufferGeometry[];
  glass: THREE.BufferGeometry[];
  trim: THREE.BufferGeometry[];
  chrome: THREE.BufferGeometry[];
  head: THREE.BufferGeometry[];
  tail: THREE.BufferGeometry[];
  accent: THREE.BufferGeometry[];
  screen: THREE.BufferGeometry[];
};

// ------------------------------------------------------------------ geometry helpers
function prep(g: THREE.BufferGeometry, color?: THREE.Color | number): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  out.deleteAttribute('uv');
  out.clearGroups();
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  if (color !== undefined) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const n = out.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

/** Thin box spanning between two points. */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, h, len);
  const m = new THREE.Matrix4().lookAt(b, a, new THREE.Vector3(0, 1, 0));
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}

function cylZ(r: number, len: number, seg: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** Converts an extruded shape (shape X = car Z, extrude depth = car width) into car space. */
function extrudeToCar(shape: THREE.Shape, width: number, bevelThickness: number, bevelSize: number, bevelSegments: number, curveSegments = 10): THREE.BufferGeometry {
  const depth = Math.max(0.01, width - bevelThickness * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments,
    steps: 1,
  });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  return g;
}

function smoothShade(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const merged = mergeVertices(g, 1e-4);
  g.dispose();
  merged.computeVertexNormals();
  return merged;
}

interface Layout {
  b: CarBodyShape;
  hz: number;
  frontAxle: number;
  rearAxle: number;
  archR: number;
  flare: number;
  trackHalf: number;
}

/** Plan-view body taper, also used to place parts flush to the surface. */
function taper(L: Layout, y: number, z: number): number {
  const b = L.b;
  const top = smoothstep(b.beltHeight - 0.32, b.beltHeight + 0.02, y);
  let f = 1 - 0.13 * b.sideTaper * top;
  f *= 1 - 0.17 * Math.pow(smoothstep(0.5, 1.03, Math.abs(z) / L.hz), 1.7);
  f *= 1 - 0.05 * smoothstep(b.clearance + 0.28, b.clearance, y);
  if (y < b.beltHeight + 0.02) {
    for (const axle of [L.frontAxle, L.rearAxle]) {
      const dz = (z - axle) / 0.62;
      f += Math.exp(-dz * dz) * L.flare * (1 - top * 0.85) * smoothstep(b.clearance, b.clearance + 0.2, y);
    }
  }
  return f;
}

function halfWidthAt(L: Layout, y: number, z: number): number {
  return (L.b.width / 2) * taper(L, y, z);
}

function bodyShape(L: Layout): THREE.Shape {
  const b = L.b;
  const hz = L.hz - 0.04;
  const c = b.clearance + 0.05;
  const s = new THREE.Shape();
  s.moveTo(-hz + 0.14, c + 0.02);
  const arch = (za: number) => {
    const sn = clamp((c - b.wheelRadius) / L.archR, -0.95, 0.95);
    const a0 = Math.PI - Math.asin(sn);
    const a1 = Math.asin(sn);
    const steps = 16;
    for (let k = 0; k <= steps; k++) {
      const a = a0 + ((a1 - a0) * k) / steps;
      s.lineTo(za + Math.cos(a) * L.archR, b.wheelRadius + Math.sin(a) * L.archR);
    }
  };
  arch(L.rearAxle);
  arch(L.frontAxle);
  s.lineTo(hz - 0.22, c);
  s.lineTo(hz - 0.05, c + 0.1);
  s.quadraticCurveTo(hz + 0.02, b.noseHeight - 0.14, hz - 0.03, b.noseHeight - 0.03);
  s.quadraticCurveTo(hz - 0.12, b.noseHeight + 0.03, hz - 0.32, b.noseHeight + 0.045);
  s.quadraticCurveTo((hz - 0.32 + b.cowlZ) / 2, (b.noseHeight + b.beltHeight) / 2 + 0.05, b.cowlZ, b.beltHeight);
  const deckStart = Math.min(b.rearBaseZ, -hz + 0.5);
  s.quadraticCurveTo((b.cowlZ + deckStart) / 2, lerp(b.beltHeight, b.deckHeight, 0.5) + 0.02, deckStart, b.deckHeight);
  const deckEnd = Math.min(deckStart - 0.05, -hz + 0.22);
  s.lineTo(deckEnd, b.deckHeight + 0.005);
  s.quadraticCurveTo(-hz + 0.01, b.deckHeight, -hz, b.tailHeight - 0.1);
  s.lineTo(-hz + 0.03, c + 0.24);
  s.quadraticCurveTo(-hz + 0.05, c + 0.03, -hz + 0.14, c + 0.02);
  return s;
}

function cabinShape(b: CarBodyShape): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(b.cowlZ + 0.02, b.beltHeight - 0.05);
  s.quadraticCurveTo(lerp(b.cowlZ, b.windshieldTopZ, 0.6), lerp(b.beltHeight, b.roofHeight, 0.82), b.windshieldTopZ, b.roofHeight);
  s.quadraticCurveTo((b.windshieldTopZ + b.roofEndZ) / 2, b.roofHeight + 0.035, b.roofEndZ, b.roofHeight - 0.01);
  s.quadraticCurveTo(lerp(b.roofEndZ, b.rearBaseZ, 0.35), lerp(b.roofHeight, b.deckHeight, 0.25), b.rearBaseZ, b.deckHeight - 0.04);
  s.lineTo(b.cowlZ + 0.02, b.beltHeight - 0.05);
  return s;
}

function roofShape(b: CarBodyShape): THREE.Shape {
  const s = new THREE.Shape();
  const lift = 0.014;
  const z0 = b.windshieldTopZ + 0.015;
  const z1 = b.roofEndZ - 0.01;
  s.moveTo(z0 - 0.06, b.roofHeight - 0.05);
  s.lineTo(z0, b.roofHeight + lift - 0.003);
  s.quadraticCurveTo((b.windshieldTopZ + b.roofEndZ) / 2, b.roofHeight + 0.035 + lift, z1, b.roofHeight - 0.01 + lift);
  s.lineTo(z1 + 0.06, b.roofHeight - 0.06);
  s.lineTo(z0 - 0.06, b.roofHeight - 0.05);
  return s;
}

function applyTaper(g: THREE.BufferGeometry, L: Layout, extra = 0): void {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setX(i, x * (taper(L, y, z) + extra));
  }
  pos.needsUpdate = true;
}

// ------------------------------------------------------------------ main builder
export function buildCarModel(def: CarDefinition, config: CarConfig, opts: CarModelOptions = {}): CarModel {
  const b = def.body;
  const vis = config.visual;
  const wide = vis.bodyKit === 'wide';
  const L: Layout = {
    b,
    hz: b.length / 2,
    frontAxle: b.wheelBase / 2 + b.axleShift,
    rearAxle: -b.wheelBase / 2 + b.axleShift,
    archR: b.wheelRadius + 0.115,
    flare: b.flare + (wide ? 0.06 : 0),
    trackHalf: b.trackWidth / 2 + (wide ? 0.06 : 0),
  };
  const parts: Parts = { paint: [], glass: [], trim: [], chrome: [], head: [], tail: [], accent: [], screen: [] };
  const DARK = new THREE.Color(0x101113);
  const CARBON = new THREE.Color(0x18191c);
  const RUBBER = new THREE.Color(0x0c0c0d);
  const INTERIOR = new THREE.Color(0x1d1e22);

  // ---- body shell
  let body = extrudeToCar(bodyShape(L), b.width, 0.09, 0.05, 4);
  applyTaper(body, L);
  body = smoothShade(body);
  parts.paint.push(body);

  // ---- greenhouse
  const cabinW = b.width * b.cabinWidth;
  const cabinTaper = (g: THREE.BufferGeometry, scaleTop: number) => {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const t = smoothstep(b.beltHeight - 0.05, b.roofHeight, y);
      const endT = 1 - 0.08 * smoothstep(0.55, 1, Math.abs(z) / L.hz);
      pos.setX(i, pos.getX(i) * lerp(1, scaleTop, t) * endT);
    }
    pos.needsUpdate = true;
  };
  let cabin = extrudeToCar(cabinShape(b), cabinW, 0.035, 0.02, 3);
  cabinTaper(cabin, b.roofWidth);
  cabin = smoothShade(cabin);
  parts.glass.push(cabin);

  const roofW = cabinW * b.roofWidth + 0.035;
  let roof = extrudeToCar(roofShape(b), roofW, 0.02, 0.012, 2);
  cabinTaper(roof, 1.0);
  roof = smoothShade(roof);
  parts.paint.push(roof);

  const cabinHalf = (y: number) => (cabinW / 2) * lerp(1, b.roofWidth, smoothstep(b.beltHeight - 0.05, b.roofHeight, y));
  // pillars
  for (const sx of [-1, 1]) {
    const aBase = new THREE.Vector3(sx * (cabinHalf(b.beltHeight) - 0.01), b.beltHeight - 0.02, b.cowlZ + 0.0);
    const aTop = new THREE.Vector3(sx * (cabinHalf(b.roofHeight) + 0.0), b.roofHeight, b.windshieldTopZ + 0.02);
    parts.paint.push(beam(aBase, aTop, 0.07, 0.05));
    const cTop = new THREE.Vector3(sx * cabinHalf(b.roofHeight), b.roofHeight - 0.01, b.roofEndZ - 0.01);
    const cBase = new THREE.Vector3(sx * (cabinHalf(b.deckHeight) - 0.01), b.deckHeight - 0.02, b.rearBaseZ + 0.02);
    parts.paint.push(beam(cTop, cBase, 0.09, 0.05));
    const bz = lerp(b.windshieldTopZ, b.roofEndZ, 0.55);
    const bTop = new THREE.Vector3(sx * cabinHalf(b.roofHeight - 0.02) * 1.0, b.roofHeight - 0.02, bz);
    const bBase = new THREE.Vector3(sx * cabinHalf(b.beltHeight + 0.02), b.beltHeight, bz + 0.05);
    parts.trim.push(prep(beam(bTop, bBase, 0.05, 0.06), DARK));
  }

  // ---- wheel well liners (hide the arch tunnel)
  for (const axle of [L.frontAxle, L.rearAxle]) {
    const len = L.trackHalf * 2 - b.wheelWidth - 0.04;
    const g = new THREE.CylinderGeometry(L.archR - 0.02, L.archR - 0.02, len, 20, 1, true, 0, Math.PI);
    g.rotateZ(Math.PI / 2);
    g.translate(0, b.wheelRadius, axle);
    parts.trim.push(prep(g, DARK));
  }
  // underbody
  const underW = (L.trackHalf - b.wheelWidth / 2 - 0.05) * 2;
  parts.trim.push(prep(boxAt(underW, 0.05, (L.hz - 0.3) * 2, 0, b.clearance + 0.06, 0), DARK));

  // ---- front fascia
  const noseZ = L.hz + 0.0;
  const noseHalf = halfWidthAt(L, b.noseHeight - 0.1, noseZ - 0.1);
  parts.trim.push(prep(boxAt(noseHalf * 1.0, 0.14, 0.06, 0, b.clearance + 0.22, noseZ + 0.005), DARK));
  for (const sx of [-1, 1]) parts.trim.push(prep(boxAt(0.32, 0.1, 0.06, sx * (noseHalf - 0.25), b.clearance + 0.17, noseZ - 0.015), DARK));

  // headlights
  const headY = b.noseHeight - 0.06;
  const lampZ = L.hz - 0.06;
  const headHalf = halfWidthAt(L, headY, lampZ);
  for (const sx of [-1, 1]) {
    const x = sx * (headHalf - 0.24);
    switch (b.headlights) {
      case 'slim':
        parts.head.push(boxAt(0.4, 0.065, 0.2, x, headY, lampZ, -0.25, sx * 0.12, 0));
        break;
      case 'wide':
        parts.head.push(boxAt(0.36, 0.13, 0.18, x, headY - 0.02, lampZ, -0.15, sx * 0.1, 0));
        break;
      case 'round':
        parts.head.push(cylZ(0.085, 0.12, 18, x - sx * 0.04, headY - 0.06, lampZ + 0.02));
        parts.head.push(cylZ(0.075, 0.12, 18, x + sx * 0.14, headY - 0.07, lampZ + 0.0));
        break;
      case 'pop':
        parts.paint.push(boxAt(0.38, 0.06, 0.3, x, b.noseHeight + 0.01, L.hz - 0.3, 0, 0, 0));
        parts.head.push(boxAt(0.3, 0.035, 0.05, x, b.noseHeight - 0.07, L.hz - 0.01));
        break;
      case 'led':
        parts.head.push(boxAt(0.46, 0.035, 0.22, x, headY + 0.01, lampZ - 0.02, -0.3, sx * 0.25, sx * 0.08));
        parts.head.push(boxAt(0.04, 0.09, 0.05, sx * (headHalf - 0.06), headY - 0.06, lampZ + 0.0));
        break;
    }
  }

  // ---- rear
  const tailZ = -L.hz - 0.035;
  const tailY = b.tailHeight - 0.16;
  const tailHalf = halfWidthAt(L, tailY, -L.hz + 0.05);
  switch (b.taillights) {
    case 'bar':
      parts.tail.push(boxAt(tailHalf * 1.75, 0.055, 0.06, 0, tailY, tailZ + 0.02));
      break;
    case 'led':
      parts.tail.push(boxAt(tailHalf * 1.85, 0.03, 0.06, 0, tailY + 0.03, tailZ + 0.02));
      for (const sx of [-1, 1]) parts.tail.push(boxAt(0.05, 0.14, 0.06, sx * (tailHalf - 0.08), tailY - 0.04, tailZ + 0.02));
      break;
    case 'split':
      for (const sx of [-1, 1]) parts.tail.push(boxAt(0.42, 0.11, 0.06, sx * (tailHalf - 0.3), tailY, tailZ + 0.02));
      break;
    case 'round':
      for (const sx of [-1, 1]) {
        parts.tail.push(cylZ(0.075, 0.06, 18, sx * (tailHalf - 0.17), tailY, tailZ + 0.02));
        parts.tail.push(cylZ(0.075, 0.06, 18, sx * (tailHalf - 0.38), tailY, tailZ + 0.02));
      }
      break;
  }
  parts.trim.push(prep(boxAt(0.5, 0.12, 0.03, 0, b.clearance + 0.38, tailZ + 0.01), new THREE.Color(0x2a2c30)));
  parts.trim.push(prep(boxAt(b.width * 0.62, 0.12, 0.25, 0, b.clearance + 0.06, -L.hz + 0.12), DARK));

  // exhaust tips
  const exhaustPoints: THREE.Vector3[] = [];
  const exY = b.clearance + 0.12;
  const exZ = -L.hz - 0.03;
  let exX: number[];
  if (b.exhaustCount === 1) exX = b.exhaustCenter ? [0] : [-0.38];
  else if (b.exhaustCount === 2) exX = b.exhaustCenter ? [-0.13, 0.13] : [-0.5, 0.5];
  else exX = [-0.3, -0.1, 0.1, 0.3];
  for (const x of exX) {
    const r = b.exhaustCount === 1 ? 0.06 : 0.045;
    parts.chrome.push(cylZ(r, 0.18, 16, x, exY, exZ));
    parts.trim.push(prep(cylZ(r * 0.75, 0.02, 16, x, exY, exZ - 0.085), RUBBER));
    exhaustPoints.push(new THREE.Vector3(x, exY, exZ - 0.09));
  }

  // ---- mirrors
  for (const sx of [-1, 1]) {
    const mz = b.cowlZ - 0.08;
    const mx = sx * (cabinHalf(b.beltHeight) + 0.13);
    parts.paint.push(boxAt(0.15, 0.085, 0.17, mx, b.beltHeight + 0.09, mz, 0, sx * 0.15, 0));
    parts.trim.push(prep(boxAt(0.1, 0.03, 0.05, mx - sx * 0.08, b.beltHeight + 0.05, mz), DARK));
  }

  // ---- details per body style
  if (b.hoodScoop) {
    const z0 = (b.cowlZ + L.hz) / 2;
    const hy = lerp(b.beltHeight, b.noseHeight, 0.45) + 0.02;
    parts.paint.push(boxAt(0.5, 0.1, 0.7, 0, hy + 0.03, z0, -0.08, 0, 0));
    parts.trim.push(prep(boxAt(0.42, 0.06, 0.03, 0, hy + 0.05, z0 + 0.35), DARK));
  }
  if (b.sideIntakes) {
    for (const sx of [-1, 1]) {
      const z = L.rearAxle + L.archR + 0.32;
      const y = (b.clearance + b.beltHeight) / 2 + 0.05;
      parts.trim.push(prep(boxAt(0.04, 0.24, 0.5, sx * (halfWidthAt(L, y, z) - 0.005), y, z, 0, 0, 0), DARK));
    }
  }
  if (b.fins) {
    const z0 = b.roofEndZ - 0.1;
    const z1 = -L.hz + 0.25;
    const g = new THREE.Shape();
    g.moveTo(z0, b.roofHeight - 0.05);
    g.lineTo(z1, b.deckHeight + 0.32);
    g.lineTo(z1 - 0.05, b.deckHeight - 0.02);
    g.lineTo(z0 + 0.3, b.deckHeight - 0.02);
    g.lineTo(z0, b.roofHeight - 0.05);
    parts.paint.push(extrudeToCar(g, 0.05, 0.01, 0.01, 1, 2));
  }

  // ---- spoilers
  const deckY = b.deckHeight;
  const spZ = -L.hz + 0.22;
  switch (vis.spoiler) {
    case 'lip':
      parts.paint.push(boxAt(halfWidthAt(L, deckY, spZ) * 1.6, 0.04, 0.16, 0, deckY + 0.03, -L.hz + 0.1, 0.25, 0, 0));
      break;
    case 'ducktail':
      parts.paint.push(boxAt(halfWidthAt(L, deckY, spZ) * 1.7, 0.08, 0.28, 0, deckY + 0.05, -L.hz + 0.15, 0.3, 0, 0));
      break;
    case 'wing': {
      const wy = deckY + 0.26;
      for (const sx of [-1, 1]) parts.trim.push(prep(boxAt(0.04, 0.26, 0.1, sx * 0.48, deckY + 0.12, spZ + 0.02), CARBON));
      parts.trim.push(prep(boxAt(b.width * 0.86, 0.035, 0.3, 0, wy, spZ - 0.02, 0.12, 0, 0), CARBON));
      break;
    }
    case 'gt': {
      const wy = deckY + 0.42;
      for (const sx of [-1, 1]) {
        parts.trim.push(prep(boxAt(0.04, 0.44, 0.12, sx * 0.42, deckY + 0.2, spZ + 0.06, -0.2, 0, 0), CARBON));
        parts.trim.push(prep(boxAt(0.02, 0.2, 0.44, sx * b.width * 0.48, wy - 0.02, spZ - 0.04), CARBON));
      }
      parts.trim.push(prep(boxAt(b.width * 0.96, 0.04, 0.38, 0, wy, spZ - 0.04, 0.16, 0, 0), CARBON));
      parts.trim.push(prep(boxAt(b.width * 0.94, 0.02, 0.12, 0, wy + 0.06, spZ - 0.2, 0.5, 0, 0), CARBON));
      break;
    }
    case 'none':
      break;
  }

  // ---- body kits
  if (vis.bodyKit !== 'stock') {
    const splW = halfWidthAt(L, b.clearance + 0.05, L.hz - 0.2) * 2;
    parts.trim.push(prep(boxAt(splW * 0.95, 0.03, 0.22, 0, b.clearance - 0.01, L.hz - 0.05), CARBON));
    const skirtLen = L.frontAxle - L.rearAxle - L.archR * 2 - 0.05;
    const midZ = (L.frontAxle + L.rearAxle) / 2;
    for (const sx of [-1, 1]) {
      const hw = halfWidthAt(L, b.clearance + 0.08, midZ);
      parts.trim.push(prep(boxAt(0.07, 0.1, skirtLen, sx * (hw + 0.01), b.clearance + 0.03, midZ), CARBON));
    }
    for (let i = -2; i <= 2; i++) parts.trim.push(prep(boxAt(0.02, 0.12, 0.3, i * 0.18, b.clearance + 0.04, -L.hz + 0.05), CARBON));
  }

  // ---- decals
  const numberMeshes: THREE.Mesh[] = [];
  if (vis.decal === 'stripes' || vis.decal === 'racing') {
    for (const sx of [-1, 1]) {
      let st = extrudeToCar(bodyShape(L), 0.16, 0.004, 0.058, 2);
      st.translate(sx * 0.14, 0, 0);
      applyTaper(st, L);
      st = smoothShade(st);
      parts.accent.push(st);
      let rs = extrudeToCar(roofShape(b), 0.16, 0.004, 0.02, 1);
      rs.translate(sx * 0.14, 0.006, 0);
      rs = smoothShade(rs);
      parts.accent.push(rs);
    }
  }
  if (vis.decal === 'side') {
    const y = Math.min(b.beltHeight - 0.06, b.wheelRadius + L.archR + 0.03);
    const len = (L.hz - 0.45) * 2;
    for (const sx of [-1, 1]) {
      const hw = halfWidthAt(L, y, 0);
      parts.accent.push(boxAt(0.012, 0.06, len, sx * (hw + 0.004), y, 0));
      parts.accent.push(boxAt(0.012, 0.025, len * 0.9, sx * (hw + 0.004), y - 0.07, -0.05));
    }
  }
  if (vis.decal === 'racing') {
    const tex = numberDecalTexture(config.raceNumber, config.accentColor);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
    const y = (b.clearance + b.beltHeight) / 2 + 0.08;
    const z = (L.frontAxle + L.rearAxle) / 2;
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat);
      m.position.set(sx * (halfWidthAt(L, y, z) + 0.008), y, z);
      m.rotation.y = sx * Math.PI / 2;
      numberMeshes.push(m);
    }
  }

  // ---- interior
  const headZ = lerp(b.windshieldTopZ, b.roofEndZ, 0.42);
  const eyeY = Math.min(b.roofHeight - 0.17, b.beltHeight + 0.36);
  const driverX = Math.min(0.36, cabinW / 2 - 0.3);
  const wheelZ = Math.min(headZ + 0.5, b.cowlZ - 0.12);
  const dashZ0 = wheelZ + 0.12;
  const dashZ1 = b.cowlZ + 0.02;
  // dashboard spans the whole cabin and hides the body shell when seen from the driver's seat
  parts.trim.push(prep(boxAt(b.width * 0.86, 0.2, Math.max(0.15, dashZ1 - dashZ0 + 0.1), 0, b.beltHeight - 0.03, (dashZ0 + dashZ1) / 2 + 0.04), INTERIOR));
  parts.trim.push(prep(boxAt(cabinW * 0.9, 0.05, 0.12, 0, b.beltHeight + 0.075, dashZ0 + 0.06, -0.35, 0, 0), new THREE.Color(0x141519)));
  // dark cabin floor over the body shell (seen from the cockpit and through the glass)
  parts.trim.push(prep(boxAt(cabinW * 0.97, 0.02, Math.max(0.2, b.cowlZ - b.rearBaseZ), 0, b.beltHeight + 0.012, (b.cowlZ + b.rearBaseZ) / 2), INTERIOR));
  // door trims
  for (const sx of [-1, 1]) {
    const len = Math.max(0.3, dashZ0 - (headZ - 0.5));
    parts.trim.push(prep(boxAt(0.16, 0.12, len, sx * (cabinW / 2 - 0.02), b.beltHeight + 0.0, dashZ0 - len / 2), new THREE.Color(0x232429)));
  }
  parts.trim.push(prep(boxAt(0.36, 0.09, 0.14, driverX, b.beltHeight + 0.07, dashZ0 + 0.04), new THREE.Color(0x0d0d0f)));
  parts.screen.push(boxAt(0.3, 0.06, 0.01, driverX, b.beltHeight + 0.07, dashZ0 - 0.035, -0.3, 0, 0));
  parts.trim.push(prep(boxAt(0.22, 0.12, 0.6, 0, b.beltHeight - 0.18, headZ + 0.15), INTERIOR));
  for (const sx of [-1, 1]) {
    const x = sx * driverX;
    parts.trim.push(prep(boxAt(0.46, 0.62, 0.12, x, b.beltHeight + 0.0, headZ - 0.22, -0.18, 0, 0), new THREE.Color(0x26272c)));
    parts.trim.push(prep(boxAt(0.46, 0.12, 0.5, x, b.beltHeight - 0.32, headZ + 0.05), new THREE.Color(0x26272c)));
  }
  // headliner (visible from the cockpit)
  parts.trim.push(prep(boxAt(cabinHalf(b.roofHeight) * 1.9, 0.015, Math.max(0.2, b.windshieldTopZ - b.roofEndZ), 0, b.roofHeight - 0.04, (b.windshieldTopZ + b.roofEndZ) / 2), INTERIOR));

  // ------------------------------------------------------------------ materials
  const paint = createPaint(config);
  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x1a2633).lerp(new THREE.Color(0x020304), vis.tint),
    metalness: 0.1,
    roughness: 0.04,
    transparent: true,
    opacity: lerp(0.45, 0.88, vis.tint),
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.25 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 1, roughness: 0.14 });
  const lightsOn = !!opts.lightsOn;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: lightsOn ? 2.2 : 0.8, roughness: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1208, emissiveIntensity: lightsOn ? 1.0 : 0.45, roughness: 0.2 });
  const accent = new THREE.MeshPhysicalMaterial({
    color: config.accentColor,
    roughness: 0.3,
    metalness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const screen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x35d6ff).multiplyScalar(1.6) });

  // ------------------------------------------------------------------ assemble
  const root = new THREE.Group();
  root.name = `car-${def.id}`;
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const shadows = opts.shadows !== false;

  const addMerged = (list: THREE.BufferGeometry[], mat: THREE.Material, cast: boolean, colored = false) => {
    if (!list.length) return null;
    const ready = list.map((g) => (colored ? g : prep(g)));
    const merged = mergeGeometries(ready);
    ready.forEach((g) => g.dispose());
    if (!merged) return null;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = shadows && cast;
    m.receiveShadow = shadows;
    bodyGroup.add(m);
    return m;
  };
  addMerged(parts.paint, paint, true);
  addMerged(parts.trim, trim, true, true);
  addMerged(parts.chrome, chrome, false);
  addMerged(parts.head, headMat, false);
  addMerged(parts.tail, tailMat, false);
  addMerged(parts.accent, accent, false);
  addMerged(parts.screen, screen, false);
  const glassMesh = addMerged(parts.glass, glass, true);
  if (glassMesh) glassMesh.renderOrder = 2;
  numberMeshes.forEach((m) => bodyGroup.add(m));

  // driver helmet
  const helmetMat = new THREE.MeshStandardMaterial({ color: config.accentColor === '#111111' ? 0xdddddd : config.accentColor, roughness: 0.25, metalness: 0.3 });
  const driverHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), helmetMat);
  driverHead.position.set(driverX, eyeY + 0.02, headZ - 0.02);
  bodyGroup.add(driverHead);

  // steering wheel
  const steeringWheel = new THREE.Group();
  const swMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
  const swRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 10, 32), swMat);
  const swHub = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.03), swMat);
  const swHub2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.03), swMat);
  swHub2.position.y = -0.07;
  steeringWheel.add(swRing, swHub, swHub2);
  steeringWheel.position.set(driverX, eyeY - 0.3, wheelZ);
  steeringWheel.rotation.x = -0.35;
  bodyGroup.add(steeringWheel);

  // nitro flames
  const flames: THREE.Mesh[] = [];
  const flameOuter = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a7bff).multiplyScalar(3), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8ecff).multiplyScalar(4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameGeo = new THREE.ConeGeometry(0.075, 0.7, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.35);
  const flameGeoIn = new THREE.ConeGeometry(0.04, 0.42, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.21);
  for (const p of exhaustPoints) {
    const f = new THREE.Mesh(flameGeo, flameOuter);
    f.position.copy(p);
    const fi = new THREE.Mesh(flameGeoIn, flameInner);
    f.add(fi);
    f.visible = false;
    bodyGroup.add(f);
    flames.push(f);
  }

  // wheels
  const wheelGeo = getWheelGeometry(vis.rims, b.wheelRadius, b.wheelWidth);
  const rimMaterial = new THREE.MeshStandardMaterial({ color: config.rimColor, metalness: 0.85, roughness: 0.28 });
  const tyreMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 });
  const wheels: WheelVisual[] = [];
  for (const front of [true, false]) {
    for (const side of [1, -1] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (L.trackHalf), b.wheelRadius, front ? L.frontAxle : L.rearAxle);
      const spin = new THREE.Group();
      pivot.add(spin);
      const holder = new THREE.Group();
      if (side < 0) holder.rotation.y = Math.PI;
      const tyre = new THREE.Mesh(wheelGeo.tyre, tyreMat);
      const rim = new THREE.Mesh(wheelGeo.rim, rimMaterial);
      tyre.castShadow = shadows;
      tyre.receiveShadow = shadows;
      holder.add(tyre, rim);
      spin.add(holder);
      root.add(pivot);
      wheels.push({ pivot, spin, front, side });
    }
  }

  // contact shadow (cheap AO under the car)
  const shadowMat = new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(b.width * 1.25, b.length * 1.12).rotateX(-Math.PI / 2), shadowMat);
  blob.position.y = 0.02;
  blob.renderOrder = 1;
  root.add(blob);

  // underglow
  let underglow: THREE.Mesh | null = null;
  if (vis.underglow) {
    const c = new THREE.Color(vis.underglow);
    const glowMat = new THREE.MeshBasicMaterial({ map: radialGlowTexture(), color: c.clone().multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    underglow = new THREE.Mesh(new THREE.PlaneGeometry(b.width * 2.1, b.length * 1.5).rotateX(-Math.PI / 2), glowMat);
    underglow.position.y = 0.035;
    underglow.renderOrder = 2;
    root.add(underglow);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(b.width * 0.8, 0.02, b.length * 0.7), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(3) }));
    strip.position.y = b.clearance + 0.02;
    bodyGroup.add(strip);
  }

  // headlight pool for night races
  let headlightPool: THREE.Mesh | null = null;
  if (lightsOn) {
    const poolMat = new THREE.MeshBasicMaterial({
      map: headlightTexture(),
      color: new THREE.Color(0xfff1d6).multiplyScalar(0.2),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    headlightPool = new THREE.Mesh(new THREE.PlaneGeometry(7, 18).rotateX(-Math.PI / 2).translate(0, 0, L.hz + 8.8), poolMat);
    headlightPool.position.y = 0.04;
    headlightPool.renderOrder = 2;
    root.add(headlightPool);
  }

  const model: CarModel = {
    root,
    body: bodyGroup,
    wheels,
    paint,
    rimMaterial,
    brakeLights: tailMat,
    headLights: headMat,
    exhaustPoints,
    flames,
    steeringWheel,
    driverHead,
    glass: glassMesh,
    driverEye: new THREE.Vector3(driverX, eyeY, headZ + 0.06),
    hoodEye: new THREE.Vector3(0, b.beltHeight + 0.14, b.cowlZ + 0.12),
    headlightPool,
    underglow,
    length: b.length,
    width: b.width,
    height: b.roofHeight,
    setBraking(on: boolean, lights: boolean) {
      tailMat.emissiveIntensity = on ? 2.6 : lights ? 1.0 : 0.45;
    },
    setNitro(intensity: number, time: number) {
      const vis = intensity > 0.02;
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        f.visible = vis;
        if (vis) {
          const flick = 0.75 + 0.25 * Math.sin(time * 70 + i * 2.1) + 0.15 * Math.sin(time * 123 + i);
          f.scale.set(1, 1, intensity * flick * 1.3);
        }
      }
    },
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (m.geometry !== wheelGeo.tyre && m.geometry !== wheelGeo.rim) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mt) => mt.dispose());
      });
    },
  };
  return model;
}

export function createPaint(config: CarConfig): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color: config.color });
  applyFinish(m, config);
  return m;
}

export function applyFinish(m: THREE.MeshPhysicalMaterial, config: CarConfig): void {
  m.color.set(config.color);
  switch (config.finish) {
    case 'gloss':
      m.metalness = 0.15;
      m.roughness = 0.22;
      m.clearcoat = 1;
      m.clearcoatRoughness = 0.04;
      m.iridescence = 0;
      break;
    case 'metallic':
      m.metalness = 0.7;
      m.roughness = 0.32;
      m.clearcoat = 1;
      m.clearcoatRoughness = 0.05;
      m.iridescence = 0;
      break;
    case 'pearl':
      m.metalness = 0.45;
      m.roughness = 0.26;
      m.clearcoat = 1;
      m.clearcoatRoughness = 0.04;
      m.iridescence = 0.85;
      m.iridescenceIOR = 1.6;
      m.iridescenceThicknessRange = [200, 600];
      break;
    case 'matte':
      m.metalness = 0.25;
      m.roughness = 0.62;
      m.clearcoat = 0;
      m.iridescence = 0;
      break;
  }
  m.needsUpdate = true;
}
