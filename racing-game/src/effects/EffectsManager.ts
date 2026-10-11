import * as THREE from 'three';
import type { Car } from '../car/Car';
import type { ImpactEvent } from '../physics/CollisionSystem';
import type { ThemeId } from '../tracks/TrackCatalog';
import { ParticleSystem } from './ParticleSystem';
import type { QualityProfile } from './QualityPresets';
import { SkidMarks } from './SkidMarks';

const DUST: Record<ThemeId, [number, number, number]> = {
  city: [0.55, 0.55, 0.56],
  desert: [0.82, 0.64, 0.42],
  mountain: [0.55, 0.5, 0.42],
};

/** Spawns tyre smoke, dust, sparks, nitro exhaust and skid marks from car state. */
export class EffectsManager {
  readonly group = new THREE.Group();
  private readonly smoke: ParticleSystem;
  private readonly dust: ParticleSystem;
  private readonly sparks: ParticleSystem;
  private readonly flames: ParticleSystem;
  private readonly skids: SkidMarks;
  private readonly dustColor: [number, number, number];
  private readonly scale: number;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private acc = new Map<Car, number>();

  constructor(theme: ThemeId, profile: QualityProfile) {
    this.scale = profile.particleScale;
    this.smoke = new ParticleSystem(Math.round(1400 * this.scale) + 200, 'smoke');
    this.dust = new ParticleSystem(Math.round(1000 * this.scale) + 200, 'smoke');
    this.sparks = new ParticleSystem(Math.round(700 * this.scale) + 100, 'spark');
    this.flames = new ParticleSystem(Math.round(600 * this.scale) + 100, 'additive');
    this.skids = new SkidMarks(profile.maxSkidSegments);
    this.dustColor = DUST[theme];
    this.group.add(this.skids.mesh, this.dust.points, this.smoke.points, this.flames.points, this.sparks.points);
  }

  /** Per-frame car effects. `near` = distance to the camera (far cars spawn less). */
  updateCar(car: Car, dt: number, cameraDist: number): void {
    const p = car.physics;
    const m = car.model;
    if (cameraDist > 220) {
      for (let w = 0; w < 4; w++) this.skids.add(this.wheelId(car, w), 0, 0, 0, 0, 0, 0);
      return;
    }
    m.root.updateMatrixWorld();
    const lod = cameraDist > 90 ? 0.35 : 1;
    // accumulate fractional spawns
    let budget = (this.acc.get(car) ?? 0) + dt * 60 * this.scale * lod;
    const spawnCount = Math.floor(budget);
    budget -= spawnCount;
    this.acc.set(car, budget);
    const slip = p.tyreSlip;
    const offroad = !p.surface.onRoad && p.speed > 4;
    for (let w = 0; w < 4; w++) {
      const wheel = m.wheels[w];
      wheel.pivot.getWorldPosition(this.tmp);
      const groundY = p.y;
      const rear = !wheel.front;
      const marking = (rear ? slip : slip * 0.6) * (p.surface.onRoad ? 1 : 0);
      this.skids.add(this.wheelId(car, w), this.tmp.x, groundY, this.tmp.z, p.vx, p.vz, marking > 0.25 ? marking : 0);
      for (let k = 0; k < spawnCount; k++) {
        if (rear && slip > 0.3 && p.surface.onRoad && Math.random() < slip * 0.8) {
          const g = 0.82 + Math.random() * 0.1;
          this.smoke.spawn({
            x: this.tmp.x + (Math.random() - 0.5) * 0.3,
            y: groundY + 0.25,
            z: this.tmp.z + (Math.random() - 0.5) * 0.3,
            vx: p.vx * 0.15 + (Math.random() - 0.5) * 2,
            vy: 0.6 + Math.random() * 1.2,
            vz: p.vz * 0.15 + (Math.random() - 0.5) * 2,
            life: 1.6 + Math.random() * 1.6,
            size0: 0.8,
            size1: 3.5 + Math.random() * 2.5,
            r: g,
            g: g,
            b: g + 0.03,
            alpha: 0.22 * slip,
            drag: 1.4,
            gravity: 0.25,
          });
        }
        if (offroad && Math.random() < Math.min(1, p.speed / 25)) {
          const [r, gg, b] = this.dustColor;
          this.dust.spawn({
            x: this.tmp.x,
            y: groundY + 0.2,
            z: this.tmp.z,
            vx: -p.vx * 0.1 + (Math.random() - 0.5) * 3,
            vy: 0.8 + Math.random() * 1.8,
            vz: -p.vz * 0.1 + (Math.random() - 0.5) * 3,
            life: 1.2 + Math.random() * 1.4,
            size0: 1,
            size1: 5 + Math.random() * 3,
            r,
            g: gg,
            b,
            alpha: 0.45,
            drag: 1.1,
            gravity: -0.2,
          });
        }
      }
    }
    // nitro exhaust
    if (p.nitroActive) {
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      for (const e of m.exhaustPoints) {
        this.tmp2.copy(e);
        m.body.localToWorld(this.tmp2);
        for (let k = 0; k < 2; k++) {
          this.flames.spawn({
            x: this.tmp2.x,
            y: this.tmp2.y,
            z: this.tmp2.z,
            vx: p.vx * 0.85 - fx * (6 + Math.random() * 4) + (Math.random() - 0.5),
            vy: (Math.random() - 0.3) * 0.8,
            vz: p.vz * 0.85 - fz * (6 + Math.random() * 4) + (Math.random() - 0.5),
            life: 0.12 + Math.random() * 0.1,
            size0: 0.45,
            size1: 0.08,
            r: 0.35 * 3,
            g: 0.6 * 3,
            b: 1.0 * 3,
            alpha: 0.9,
            drag: 2,
          });
        }
      }
    }
  }

  /** Occasional exhaust backfire flame (throttle lift at high rpm). */
  backfire(car: Car): void {
    const m = car.model;
    const p = car.physics;
    for (const e of m.exhaustPoints) {
      this.tmp2.copy(e);
      m.body.localToWorld(this.tmp2);
      for (let k = 0; k < 6; k++)
        this.flames.spawn({
          x: this.tmp2.x,
          y: this.tmp2.y,
          z: this.tmp2.z,
          vx: p.vx - Math.sin(p.heading) * 3 + (Math.random() - 0.5) * 2,
          vy: Math.random(),
          vz: p.vz - Math.cos(p.heading) * 3 + (Math.random() - 0.5) * 2,
          life: 0.08 + Math.random() * 0.08,
          size0: 0.5,
          size1: 0.15,
          r: 3,
          g: 1.4,
          b: 0.3,
          alpha: 1,
          drag: 3,
        });
    }
  }

  impact(e: ImpactEvent): void {
    const n = e.scrape ? Math.min(4, Math.ceil(e.strength / 10)) : Math.min(60, Math.round(e.strength * 3));
    const count = Math.round(n * this.scale) + 1;
    const p = e.car.physics;
    for (let i = 0; i < count; i++) {
      const speed = 3 + Math.random() * (e.scrape ? 6 : 10);
      this.sparks.spawn({
        x: e.x,
        y: e.y - 0.2 + Math.random() * 0.3,
        z: e.z,
        vx: p.vx * 0.6 + e.nx * speed * 0.6 + (Math.random() - 0.5) * speed,
        vy: 1 + Math.random() * 4,
        vz: p.vz * 0.6 + e.nz * speed * 0.6 + (Math.random() - 0.5) * speed,
        life: 0.25 + Math.random() * 0.45,
        size0: 0.22,
        size1: 0.05,
        r: 3.2,
        g: 1.6 + Math.random() * 0.6,
        b: 0.4,
        alpha: 1,
        drag: 0.8,
        gravity: -14,
      });
    }
    if (!e.scrape && e.strength > 4) {
      for (let i = 0; i < Math.round(6 * this.scale); i++)
        this.smoke.spawn({
          x: e.x,
          y: e.y,
          z: e.z,
          vx: p.vx * 0.3 + (Math.random() - 0.5) * 3,
          vy: 1 + Math.random(),
          vz: p.vz * 0.3 + (Math.random() - 0.5) * 3,
          life: 1 + Math.random(),
          size0: 1,
          size1: 3.5,
          r: 0.6,
          g: 0.6,
          b: 0.62,
          alpha: 0.35,
          drag: 1.5,
        });
    }
  }

  private ids = new Map<Car, number>();
  private wheelId(car: Car, w: number): number {
    let id = this.ids.get(car);
    if (id === undefined) {
      id = this.ids.size;
      this.ids.set(car, id);
    }
    return id * 4 + w;
  }

  update(dt: number, pointScale: number): void {
    for (const s of [this.smoke, this.dust, this.sparks, this.flames]) {
      s.setScale(pointScale);
      s.update(dt);
    }
  }

  clear(): void {
    this.smoke.clear();
    this.dust.clear();
    this.sparks.clear();
    this.flames.clear();
    this.skids.clear();
  }

  dispose(): void {
    this.smoke.dispose();
    this.dust.dispose();
    this.sparks.dispose();
    this.flames.dispose();
    this.skids.dispose();
  }
}
