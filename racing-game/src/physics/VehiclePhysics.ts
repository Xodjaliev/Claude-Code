import { clamp, lerp } from '../utils/math';
import { ENGINE_POWER_EXP, VehicleSpecs } from './VehicleSpecs';

/**
 * Arcade vehicle dynamics in the XZ plane.
 *
 * Conventions:
 *  - heading `h`: forward = (sin h, cos h), right = (-cos h, sin h)  (matches Object3D.rotation.y)
 *  - `angVel` = dh/dt (positive = turning left)
 *  - The car never leaves the ground and cannot roll over: pitch/roll are purely visual springs.
 */

export interface ControlState {
  throttle: number;
  brake: number;
  /** -1 = full left, +1 = full right */
  steer: number;
  handbrake: boolean;
  nitro: boolean;
}

export function emptyControls(): ControlState {
  return { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
}

export interface SurfaceInfo {
  /** Lateral/longitudinal grip multiplier. */
  grip: number;
  /** Extra resistive deceleration (m/s^2) e.g. sand. */
  drag: number;
  /** Engine power multiplier. */
  power: number;
  height: number;
  /** Road slope along the car direction (rise/run). */
  slope: number;
  onRoad: boolean;
}

const GRAVITY = 9.81;

export class VehicleBody {
  specs: VehicleSpecs;

  x = 0;
  y = 0;
  z = 0;
  heading = 0;
  vx = 0;
  vz = 0;
  angVel = 0;

  // previous state (render interpolation)
  px = 0;
  py = 0;
  pz = 0;
  pHeading = 0;

  forwardSpeed = 0;
  lateralSpeed = 0;
  speed = 0;
  slipAngle = 0;
  steerAngle = 0;

  drifting = false;
  driftTime = 0;
  /** 0 = just started drifting, 1 = grip fully recovered */
  private driftRecover = 1;
  handbrakeOn = false;

  nitroAmount = 1;
  nitroActive = false;
  /** Set by the gearbox: torque multiplier (shift cut). */
  powerFactor = 1;
  /** External top speed multiplier (AI difficulty / rubber banding). */
  speedScale = 1;
  /** Tyres are overloaded while in contact with another car / wall (lets cars slide apart). */
  contactGrip = 1;

  /** Filtered accelerations (visual suspension, camera, audio). */
  longAccel = 0;
  latAccel = 0;
  wheelSpin = 0;
  /** 0..1 how hard the tyres are working (smoke / skid sound). */
  tyreSlip = 0;
  /** Seconds the car has been nearly stationary. */
  stuckTime = 0;

  frozen = false;

  surface: SurfaceInfo = { grip: 1, drag: 0, power: 1, height: 0, slope: 0, onRoad: true };

  constructor(specs: VehicleSpecs) {
    this.specs = specs;
  }

  setSpecs(specs: VehicleSpecs): void {
    this.specs = specs;
  }

  place(x: number, y: number, z: number, heading: number): void {
    this.x = this.px = x;
    this.y = this.py = y;
    this.z = this.pz = z;
    this.heading = this.pHeading = heading;
    this.vx = this.vz = this.angVel = 0;
    this.forwardSpeed = this.lateralSpeed = this.speed = 0;
    this.drifting = false;
    this.driftRecover = 1;
    this.stuckTime = 0;
    this.longAccel = this.latAccel = 0;
  }

  savePrevious(): void {
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.pHeading = this.heading;
  }

  step(c: ControlState, dt: number): void {
    const s = this.specs;
    const surf = this.surface;
    this.savePrevious();

    if (this.frozen) {
      this.vx = this.vz = this.angVel = 0;
      this.forwardSpeed = this.lateralSpeed = this.speed = 0;
      this.nitroActive = false;
      this.y = surf.height;
      return;
    }

    let fx = Math.sin(this.heading);
    let fz = Math.cos(this.heading);
    let rx = -fz;
    let rz = fx;
    let vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;
    const vF0 = vF;
    const grip = surf.grip;

    // ---------------------------------------------------------------- nitro
    const wantsNitro = c.nitro && this.nitroAmount > 0.005 && vF > 3;
    this.nitroActive = wantsNitro;
    if (wantsNitro) {
      this.nitroAmount = Math.max(0, this.nitroAmount - dt / s.nitroDuration);
    } else {
      let regen = s.nitroRegen;
      if (this.drifting && this.speed > 14) regen += 0.1 + (s.driftYawBoost - 1.35) * 0.18;
      this.nitroAmount = Math.min(1, this.nitroAmount + regen * dt);
    }
    const throttle = wantsNitro ? Math.max(c.throttle, 1) : c.throttle;

    // ---------------------------------------------------------------- longitudinal
    let propulsive = 0;
    let resistive = 0;
    const movingBack = vF < -0.5;

    if (throttle > 0) {
      if (!movingBack) {
        const limit = (wantsNitro ? s.engineLimitNitro : s.engineLimit) * this.speedScale;
        const accel = (s.accel + (wantsNitro ? s.nitroAccel : 0)) * (0.85 + 0.15 * this.speedScale);
        const ratio = clamp(vF / limit, 0, 1);
        let a = accel * (1 - Math.pow(ratio, ENGINE_POWER_EXP)) * throttle * surf.power * this.powerFactor;
        // traction limited launch
        a = Math.min(a, s.lateralGrip * grip * 1.25 + (wantsNitro ? 6 : 0));
        propulsive += a;
      } else {
        resistive += s.brakeDecel * throttle;
      }
    }
    if (c.brake > 0) {
      if (vF > 0.5) {
        resistive += s.brakeDecel * c.brake * Math.min(1, grip * 1.15);
      } else {
        const ratio = clamp(-vF / s.reverseTopSpeed, 0, 1);
        propulsive -= s.reverseAccel * c.brake * (1 - ratio * ratio);
      }
    }
    this.handbrakeOn = c.handbrake;
    if (c.handbrake) resistive += Math.abs(vF) > 3 ? 3.2 : 8;

    // slope (arcade-scaled gravity)
    propulsive -= GRAVITY * 0.55 * surf.slope;

    const absVF = Math.abs(vF);
    resistive += s.dragCoef * vF * vF;
    resistive += (s.rolling + surf.drag * Math.min(1, absVF / 6)) * Math.min(1, absVF);
    if (surf.drag > 0) resistive += absVF * absVF * 0.0012 * (surf.drag / 4);

    vF += propulsive * dt;
    const res = resistive * dt;
    if (Math.abs(vF) <= res) vF = 0;
    else vF -= Math.sign(vF) * res;

    // ---------------------------------------------------------------- yaw
    const speedAbs = Math.abs(vF);
    this.steerAngle = (c.steer * s.maxSteer) / (1 + speedAbs / s.steerFalloff);
    let yawRight = (vF / s.wheelBase) * Math.tan(this.steerAngle);
    const latLimit = s.lateralGrip * grip;
    const capBase = latLimit / Math.max(speedAbs, 4);
    const hb = c.handbrake && speedAbs > 7;
    let cap = capBase * 1.03;
    let response = s.yawResponse;
    if (hb) {
      yawRight *= s.driftYawBoost;
      cap = capBase * 2.3 + 0.7;
      response *= 0.6;
    } else if (this.drifting) {
      const boost = lerp(s.driftYawBoost, 1.05, this.driftRecover);
      yawRight *= boost;
      cap = capBase * lerp(2.0, 1.1, this.driftRecover) + 0.35 * (1 - this.driftRecover);
      response *= 0.65;
    }
    yawRight = clamp(yawRight, -cap, cap);
    const targetAngVel = -yawRight;
    this.angVel += (targetAngVel - this.angVel) * (1 - Math.exp(-response * dt));
    this.heading += this.angVel * dt;

    // rebuild world velocity from the old frame, then re-project on the new heading
    let wx = fx * vF + rx * vR;
    let wz = fz * vF + rz * vR;
    fx = Math.sin(this.heading);
    fz = Math.cos(this.heading);
    rx = -fz;
    rz = fx;
    vF = wx * fx + wz * fz;
    vR = wx * rx + wz * rz;

    // ---------------------------------------------------------------- lateral grip
    let latGrip = latLimit * this.contactGrip;
    let stiffness = 16 * this.contactGrip;
    if (hb) {
      latGrip *= s.driftGrip;
      stiffness = 2.4;
    } else if (this.drifting) {
      latGrip *= lerp(s.driftGrip * 1.25, 1, this.driftRecover);
      stiffness = lerp(3, 12, this.driftRecover);
    }
    const dv = clamp(-vR * (1 - Math.exp(-stiffness * dt)), -latGrip * dt, latGrip * dt);
    vR += dv;
    // Arcade: part of the scrubbed sideways momentum is redirected forward while drifting.
    if ((hb || this.drifting) && vF > 5) {
      const redirect = clamp((s.driftYawBoost - 1.2) * 0.9, 0.25, 0.75);
      vF += Math.abs(dv) * redirect;
      vF -= s.driftDrag * Math.min(1, Math.abs(vR) / 10) * dt * 0.5;
    }

    wx = fx * vF + rx * vR;
    wz = fz * vF + rz * vR;
    this.vx = wx;
    this.vz = wz;

    // ---------------------------------------------------------------- integrate
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y = surf.height;

    // ---------------------------------------------------------------- derived values
    this.forwardSpeed = vF;
    this.lateralSpeed = vR;
    this.speed = Math.hypot(vF, vR);
    this.slipAngle = this.speed > 2 ? Math.atan2(vR, Math.abs(vF)) : 0;

    const absSlip = Math.abs(this.slipAngle);
    if (!this.drifting) {
      if (absSlip > 0.16 && this.speed > 11) {
        this.drifting = true;
        this.driftRecover = 0;
        this.driftTime = 0;
      }
    } else {
      this.driftTime += dt;
      if (!hb) this.driftRecover = Math.min(1, this.driftRecover + dt * (1.6 - (s.driftYawBoost - 1.35) * 1.4));
      else this.driftRecover = Math.max(0, this.driftRecover - dt * 2);
      if ((absSlip < 0.07 && !hb) || this.speed < 7 || absSlip > 1.6) this.drifting = false;
    }

    const instLong = (vF - vF0) / dt;
    this.longAccel += (instLong - this.longAccel) * (1 - Math.exp(-8 * dt));
    const instLat = vF * this.angVel;
    this.latAccel += (instLat - this.latAccel) * (1 - Math.exp(-8 * dt));
    this.wheelSpin += (vF / s.wheelRadius) * dt;

    const lateralSlip = clamp((Math.abs(vR) - 1.2) / 6, 0, 1);
    const brakeSlip = c.brake > 0.6 && vF > 18 ? 0.35 : 0;
    const launchSlip = throttle > 0.8 && vF < 7 && vF > -1 ? 0.32 : 0;
    this.tyreSlip = Math.max(lateralSlip, brakeSlip, launchSlip, hb && this.speed > 8 ? 0.6 : 0);

    if (this.speed < 1.2) this.stuckTime += dt;
    else this.stuckTime = 0;
  }

  /** Forward unit vector. */
  get forwardX(): number {
    return Math.sin(this.heading);
  }
  get forwardZ(): number {
    return Math.cos(this.heading);
  }
}
