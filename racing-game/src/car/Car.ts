import * as THREE from 'three';
import { computeVehicleSpecs, VehicleSpecs } from '../physics/VehicleSpecs';
import { ControlState, emptyControls, VehicleBody } from '../physics/VehiclePhysics';
import { emptyQuery, TrackQuery } from '../tracks/Track';
import { clamp, lerp } from '../utils/math';
import type { CarDefinition } from './CarCatalog';
import { buildCarModel, CarModel } from './CarModelFactory';
import { Gearbox } from './Gearbox';
import { CarConfig, effectiveStats } from './Upgrades';

/** Anything that can drive a car: the local player, an AI, or (later) a network peer. */
export interface ControlSource {
  readonly kind: 'player' | 'ai' | 'remote';
  update(car: Car, dt: number): void;
}

export interface CarOptions {
  name: string;
  isPlayer: boolean;
  lightsOn: boolean;
  shadows: boolean;
  /** Global performance multiplier (AI difficulty). */
  performanceScale?: number;
}

/** Runtime vehicle: physics body + gearbox + procedural model + current controls. */
export class Car {
  readonly def: CarDefinition;
  readonly config: CarConfig;
  readonly specs: VehicleSpecs;
  readonly physics: VehicleBody;
  readonly gearbox: Gearbox;
  readonly model: CarModel;
  readonly controls: ControlState = emptyControls();
  readonly name: string;
  readonly isPlayer: boolean;
  readonly lightsOn: boolean;
  controller: ControlSource | null = null;
  /** Latest track query, updated every physics step. */
  readonly query: TrackQuery = emptyQuery();

  // visual suspension springs
  private roll = 0;
  private rollVel = 0;
  private pitch = 0;
  private pitchVel = 0;
  private visualSlope = 0;
  private steerVisual = 0;
  /** Seconds left of hit flash / damage wobble. */
  hitTimer = 0;
  /** After a reset the car is a "ghost" (no car-car collisions) for a moment. */
  ghostTimer = 0;
  /** Race statistics (debugging / results). */
  readonly stats = { wallHits: 0, carHits: 0, offroadTime: 0 };

  constructor(def: CarDefinition, config: CarConfig, opts: CarOptions) {
    this.def = def;
    this.config = config;
    this.name = opts.name;
    this.isPlayer = opts.isPlayer;
    this.lightsOn = opts.lightsOn;
    this.specs = computeVehicleSpecs(def, effectiveStats(def, config.upgrades), opts.performanceScale ?? 1);
    this.physics = new VehicleBody(this.specs);
    this.gearbox = new Gearbox(def.engine);
    this.model = buildCarModel(def, config, { lightsOn: opts.lightsOn, shadows: opts.shadows, interior: opts.isPlayer });
  }

  get position(): THREE.Vector3 {
    return this.model.root.position;
  }

  /** km/h shown on the HUD */
  get speedKmh(): number {
    return Math.abs(this.physics.forwardSpeed) * 3.6;
  }

  /** Called once per fixed physics step, before VehicleBody.step(). */
  prePhysics(dt: number): void {
    const p = this.physics;
    p.powerFactor = this.gearbox.update(dt, p.forwardSpeed, this.controls.throttle, this.controls.brake, this.specs.topSpeed, p.frozen);
    p.contactGrip = this.contactTimer > 0 ? 0.55 : 1;
    if (this.contactTimer > 0) this.contactTimer -= dt;
  }

  /** Apply a sudden jolt to the visual suspension (collisions). */
  jolt(rollImpulse: number, pitchImpulse: number): void {
    this.rollVel += rollImpulse;
    this.pitchVel += pitchImpulse;
    this.hitTimer = 0.3;
    this.contactTimer = 0.25;
  }

  /** Seconds of reduced tyre grip left after a contact. */
  contactTimer = 0;

  /** Interpolated render update. `alpha` = physics accumulator fraction. */
  syncVisual(alpha: number, dt: number, time: number): void {
    const p = this.physics;
    const m = this.model;
    const x = lerp(p.px, p.x, alpha);
    const y = lerp(p.py, p.y, alpha);
    const z = lerp(p.pz, p.z, alpha);
    let dh = p.heading - p.pHeading;
    if (dh > Math.PI) dh -= Math.PI * 2;
    if (dh < -Math.PI) dh += Math.PI * 2;
    const h = p.pHeading + dh * alpha;
    m.root.position.set(x, y, z);

    // road slope along the car direction
    const slopeAlong = this.query.slope * (Math.sin(h) * this.query.tx + Math.cos(h) * this.query.tz);
    this.visualSlope += (slopeAlong - this.visualSlope) * (1 - Math.exp(-10 * dt));
    m.root.rotation.set(-Math.atan(this.visualSlope), h, 0, 'YXZ');

    // sprung body
    const rollTarget = clamp(p.latAccel * 0.0042, -0.08, 0.08);
    const pitchTarget = clamp(-p.longAccel * 0.0035, -0.06, 0.06);
    const k = 110;
    const c = 13;
    this.rollVel += (-(this.roll - rollTarget) * k - this.rollVel * c) * dt;
    this.roll += this.rollVel * dt;
    this.pitchVel += (-(this.pitch - pitchTarget) * k - this.pitchVel * c) * dt;
    this.pitch += this.pitchVel * dt;
    m.body.rotation.set(this.pitch, 0, this.roll);
    m.body.position.y = Math.abs(this.roll) * 0.25 + (this.hitTimer > 0 ? Math.sin(time * 60) * 0.01 * this.hitTimer : 0);
    if (this.hitTimer > 0) this.hitTimer -= dt;

    // wheels
    this.steerVisual += (this.controls.steer - this.steerVisual) * (1 - Math.exp(-12 * dt));
    const steerAngle = -this.steerVisual * 0.42;
    for (const w of m.wheels) {
      if (w.front) w.pivot.rotation.y = steerAngle;
      w.spin.rotation.x = p.wheelSpin;
    }
    m.steeringWheel.rotation.z = this.steerVisual * 1.8;

    // lights & nitro
    const braking = (this.controls.brake > 0.1 && p.forwardSpeed > 0.5) || this.controls.handbrake;
    m.setBraking(braking, this.lightsOn);
    m.setNitro(p.nitroActive ? 1 : 0, time);
  }

  dispose(): void {
    this.model.dispose();
  }
}
