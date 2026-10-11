import type { Car } from '../car/Car';
import type { VehicleBody } from './VehiclePhysics';

/**
 * Car-vs-barrier and car-vs-car collisions.
 * Each car is approximated by two circles along its axis; impulses are applied at the
 * contact point so hits produce believable yaw (spins, nudges) — but cars never flip.
 */

export interface ImpactEvent {
  car: Car;
  other: Car | null;
  x: number;
  y: number;
  z: number;
  nx: number;
  nz: number;
  /** relative normal speed (m/s) */
  strength: number;
  /** true for continuous grinding along a wall */
  scrape: boolean;
}

const WALL_RESTITUTION = 0.22;
const WALL_FRICTION = 0.32;
const CAR_RESTITUTION = 0.3;
const CAR_FRICTION = 0.22;
const MAX_ANG_VEL = 4.5;

function cross2(rx: number, rz: number, fx: number, fz: number): number {
  return rz * fx - rx * fz;
}

/** Velocity of a point offset (rx, rz) from the body centre. */
function pointVelocity(b: VehicleBody, rx: number, rz: number): [number, number] {
  return [b.vx + b.angVel * rz, b.vz - b.angVel * rx];
}

function applyImpulse(b: VehicleBody, mass: number, inertia: number, rx: number, rz: number, jx: number, jz: number, angScale = 1): void {
  b.vx += jx / mass;
  b.vz += jz / mass;
  b.angVel += (cross2(rx, rz, jx, jz) / inertia) * angScale;
  if (b.angVel > MAX_ANG_VEL) b.angVel = MAX_ANG_VEL;
  if (b.angVel < -MAX_ANG_VEL) b.angVel = -MAX_ANG_VEL;
}

export class CollisionSystem {
  readonly impacts: ImpactEvent[] = [];

  clear(): void {
    this.impacts.length = 0;
  }

  /** Keeps the car between the barriers using the car's latest track query. */
  resolveTrack(car: Car): void {
    const b = car.physics;
    const q = car.query;
    const s = car.specs;
    const R = s.collisionRadius;
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    let contact = false;
    for (const sign of [1, -1]) {
      const ox = fx * s.collisionOffset * sign;
      const oz = fz * s.collisionOffset * sign;
      const lat = q.lateral + ox * q.rx + oz * q.rz;
      let pen = 0;
      let nx = 0;
      let nz = 0;
      if (lat + R > q.wallRight) {
        pen = lat + R - q.wallRight;
        nx = -q.rx;
        nz = -q.rz;
      } else if (lat - R < -q.wallLeft) {
        pen = -q.wallLeft - (lat - R);
        nx = q.rx;
        nz = q.rz;
      }
      if (pen <= 0) continue;
      contact = true;
      // positional correction
      b.x += nx * pen;
      b.z += nz * pen;
      q.lateral += (nx * q.rx + nz * q.rz) * pen;
      // contact point relative to centre
      const rx = ox - nx * R;
      const rz = oz - nz * R;
      const [vpx, vpz] = pointVelocity(b, rx, rz);
      const vn = vpx * nx + vpz * nz;
      if (vn >= 0) continue;
      const rn = cross2(rx, rz, nx, nz);
      const j = (-(1 + WALL_RESTITUTION) * vn) / (1 / s.massKg + (rn * rn) / s.inertia);
      applyImpulse(b, s.massKg, s.inertia, rx, rz, nx * j, nz * j, 0.7);
      // friction along the wall
      const tx = -nz;
      const tz = nx;
      const [vqx, vqz] = pointVelocity(b, rx, rz);
      const vt = vqx * tx + vqz * tz;
      const rt = cross2(rx, rz, tx, tz);
      let jt = -vt / (1 / s.massKg + (rt * rt) / s.inertia);
      const maxF = WALL_FRICTION * j;
      jt = Math.max(-maxF, Math.min(maxF, jt));
      applyImpulse(b, s.massKg, s.inertia, rx, rz, tx * jt, tz * jt, 0.12);
      const strength = -vn;
      if (strength > 1.2) {
        this.impacts.push({ car, other: null, x: b.x + rx, y: b.y + 0.5, z: b.z + rz, nx, nz, strength, scrape: false });
        car.jolt((nx * q.rx + nz * q.rz) * strength * 0.012 * -1, 0);
      }
    }
    if (contact) {
      // Arcade wall assist: swing the nose away from the barrier so cars never get pinned.
      let he = Math.atan2(q.tx, q.tz) - b.heading;
      he = Math.atan2(Math.sin(he), Math.cos(he));
      const intoWall = Math.sign(he) === Math.sign(q.lateral) && Math.abs(he) > 0.08 && Math.abs(he) < 2.2;
      if (intoWall) b.angVel += Math.max(-0.7, Math.min(0.7, he)) * 0.12;
    }
    if (contact && b.speed > 6) {
      const sideSign = q.lateral > 0 ? 1 : -1;
      const wall = sideSign > 0 ? q.wallRight : -q.wallLeft;
      this.impacts.push({
        car,
        other: null,
        x: b.x + q.rx * (wall - q.lateral),
        y: b.y + 0.45,
        z: b.z + q.rz * (wall - q.lateral),
        nx: -q.rx * sideSign,
        nz: -q.rz * sideSign,
        strength: b.speed,
        scrape: true,
      });
    }
  }

  resolveCars(cars: Car[]): void {
    const n = cars.length;
    for (let i = 0; i < n; i++) {
      const A = cars[i];
      if (A.ghostTimer > 0) continue;
      const a = A.physics;
      for (let k = i + 1; k < n; k++) {
        const B = cars[k];
        if (B.ghostTimer > 0) continue;
        const b = B.physics;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const reach = (A.specs.length + B.specs.length) * 0.5 + 0.5;
        if (dx * dx + dz * dz > reach * reach) continue;
        if (Math.abs(a.y - b.y) > 3) continue;
        this.resolvePair(A, B);
      }
    }
  }

  private resolvePair(A: Car, B: Car): void {
    const a = A.physics;
    const b = B.physics;
    const sa = A.specs;
    const sb = B.specs;
    const afx = Math.sin(a.heading);
    const afz = Math.cos(a.heading);
    const bfx = Math.sin(b.heading);
    const bfz = Math.cos(b.heading);
    let bestPen = 0;
    let bnx = 0;
    let bnz = 0;
    let cax = 0;
    let caz = 0;
    for (const sa1 of [1, -1]) {
      const ax = a.x + afx * sa.collisionOffset * sa1;
      const az = a.z + afz * sa.collisionOffset * sa1;
      for (const sb1 of [1, -1]) {
        const bx = b.x + bfx * sb.collisionOffset * sb1;
        const bz = b.z + bfz * sb.collisionOffset * sb1;
        const dx = bx - ax;
        const dz = bz - az;
        const d2 = dx * dx + dz * dz;
        const rr = sa.collisionRadius + sb.collisionRadius;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001;
        const pen = rr - d;
        if (pen > bestPen) {
          bestPen = pen;
          bnx = dx / d;
          bnz = dz / d;
          cax = ax + bnx * sa.collisionRadius;
          caz = az + bnz * sa.collisionRadius;
        }
      }
    }
    if (bestPen <= 0) return;
    const ima = 1 / sa.massKg;
    const imb = 1 / sb.massKg;
    const share = bestPen / (ima + imb);
    a.x -= bnx * share * ima;
    a.z -= bnz * share * ima;
    b.x += bnx * share * imb;
    b.z += bnz * share * imb;

    const rax = cax - a.x;
    const raz = caz - a.z;
    const rbx = cax - b.x;
    const rbz = caz - b.z;
    const [vax, vaz] = pointVelocity(a, rax, raz);
    const [vbx, vbz] = pointVelocity(b, rbx, rbz);
    const rvx = vbx - vax;
    const rvz = vbz - vaz;
    const vn = rvx * bnx + rvz * bnz;
    if (vn >= 0) return;
    const ra = cross2(rax, raz, bnx, bnz);
    const rb = cross2(rbx, rbz, bnx, bnz);
    const j = (-(1 + CAR_RESTITUTION) * vn) / (ima + imb + (ra * ra) / sa.inertia + (rb * rb) / sb.inertia);
    applyImpulse(a, sa.massKg, sa.inertia, rax, raz, -bnx * j, -bnz * j, 0.35);
    applyImpulse(b, sb.massKg, sb.inertia, rbx, rbz, bnx * j, bnz * j, 0.35);
    // tangential friction
    const tx = -bnz;
    const tz = bnx;
    const vt = rvx * tx + rvz * tz;
    const rta = cross2(rax, raz, tx, tz);
    const rtb = cross2(rbx, rbz, tx, tz);
    let jt = -vt / (ima + imb + (rta * rta) / sa.inertia + (rtb * rtb) / sb.inertia);
    const maxF = CAR_FRICTION * j;
    jt = Math.max(-maxF, Math.min(maxF, jt));
    applyImpulse(a, sa.massKg, sa.inertia, rax, raz, -tx * jt, -tz * jt, 0.15);
    applyImpulse(b, sb.massKg, sb.inertia, rbx, rbz, tx * jt, tz * jt, 0.15);

    const strength = -vn;
    if (strength > 0.8) {
      this.impacts.push({ car: A, other: B, x: cax, y: (a.y + b.y) / 2 + 0.55, z: caz, nx: bnx, nz: bnz, strength, scrape: false });
      const rollA = (bnx * Math.cos(a.heading) - bnz * Math.sin(a.heading)) * strength * 0.01;
      A.jolt(rollA, 0);
      B.jolt(-rollA, 0);
    }
  }
}
