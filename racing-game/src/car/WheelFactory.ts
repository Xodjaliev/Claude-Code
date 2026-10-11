import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RimStyle } from './CarCatalog';

/**
 * Procedural wheels. Geometry is cached per (style, radius, width) and shared between cars,
 * so it is never disposed together with a car.
 * Wheels are built with the outer face pointing +X and the rolling axis along X.
 */

const cache = new Map<string, { tyre: THREE.BufferGeometry; rim: THREE.BufferGeometry }>();

function colorize(g: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function nonIndexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  out.deleteAttribute('uv');
  return out;
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return nonIndexed(new THREE.BoxGeometry(w, h, d));
}

function cyl(rTop: number, rBot: number, h: number, seg: number, open = false): THREE.BufferGeometry {
  // axis along X
  return nonIndexed(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open).rotateZ(Math.PI / 2));
}

export function getWheelGeometry(style: RimStyle, radius: number, width: number): { tyre: THREE.BufferGeometry; rim: THREE.BufferGeometry } {
  const key = `${style}-${radius.toFixed(3)}-${width.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rimR = radius * 0.7;
  // ---- tyre (+ brake disc + caliper), vertex coloured
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rimR * 0.96, -width / 2),
    new THREE.Vector2(radius - 0.035, -width / 2),
    new THREE.Vector2(radius - 0.008, -width / 2 + 0.03),
    new THREE.Vector2(radius, -width / 2 + 0.06),
    new THREE.Vector2(radius, width / 2 - 0.06),
    new THREE.Vector2(radius - 0.008, width / 2 - 0.03),
    new THREE.Vector2(radius - 0.035, width / 2),
    new THREE.Vector2(rimR * 0.96, width / 2),
  ];
  const lathe = new THREE.LatheGeometry(pts, 36);
  // lathe axis is Y -> rotate to X
  lathe.rotateZ(Math.PI / 2);
  const tyre = colorize(nonIndexed(lathe), new THREE.Color(0x111214));
  const disc = colorize(cyl(rimR * 0.78, rimR * 0.78, 0.03, 28), new THREE.Color(0x6d6f73));
  disc.translate(-width * 0.12, 0, 0);
  const caliper = colorize(box(0.07, rimR * 0.55, rimR * 0.32), new THREE.Color(0xd21c1c));
  caliper.translate(-width * 0.04, rimR * 0.5, -rimR * 0.35);
  const barrel = colorize(cyl(rimR * 0.97, rimR * 0.97, width * 0.9, 28, true), new THREE.Color(0x1b1c1e));
  const tyreGeo = mergeGeometries([tyre, disc, caliper, barrel])!;

  // ---- rim
  const parts: THREE.BufferGeometry[] = [];
  const face = width / 2 - 0.02;
  // outer lip
  const lip = nonIndexed(new THREE.TorusGeometry(rimR * 0.95, 0.018, 8, 36).rotateY(Math.PI / 2));
  lip.translate(face, 0, 0);
  parts.push(lip);
  const hub = cyl(rimR * 0.2, rimR * 0.24, 0.06, 16);
  hub.translate(face - 0.01, 0, 0);
  parts.push(hub);
  const spoke = (angle: number, w: number, len: number, inner = rimR * 0.18, twist = 0, depth = 0.035) => {
    const g = box(depth, len, w);
    g.translate(0, inner + len / 2, 0);
    if (twist) g.rotateY(twist);
    g.rotateX(angle);
    g.translate(face - 0.015, 0, 0);
    parts.push(g);
  };
  const span = rimR * 0.78;
  switch (style) {
    case 'sport':
      for (let i = 0; i < 5; i++) spoke((i / 5) * Math.PI * 2, rimR * 0.26, span);
      break;
    case 'mesh':
      for (let i = 0; i < 10; i++) {
        spoke((i / 10) * Math.PI * 2 + 0.18, rimR * 0.07, span, rimR * 0.18, 0, 0.03);
        spoke((i / 10) * Math.PI * 2 - 0.18, rimR * 0.07, span, rimR * 0.18, 0, 0.03);
      }
      break;
    case 'turbine':
      for (let i = 0; i < 12; i++) spoke((i / 12) * Math.PI * 2, rimR * 0.16, span, rimR * 0.2, 0.5, 0.03);
      break;
    case 'classic': {
      const dish = cyl(rimR * 0.9, rimR * 0.9, 0.03, 32);
      dish.translate(face - 0.03, 0, 0);
      parts.push(dish);
      for (let i = 0; i < 6; i++) spoke((i / 6) * Math.PI * 2, rimR * 0.12, span * 0.85, rimR * 0.22, 0, 0.05);
      break;
    }
    case 'split':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        spoke(a + 0.09, rimR * 0.09, span);
        spoke(a - 0.09, rimR * 0.09, span);
      }
      break;
  }
  const rimGeo = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  [tyre, disc, caliper, barrel].forEach((p) => p.dispose());
  const out = { tyre: tyreGeo, rim: rimGeo };
  cache.set(key, out);
  return out;
}
