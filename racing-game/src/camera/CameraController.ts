import * as THREE from 'three';
import type { Car } from '../car/Car';
import { clamp, damp, lerp, smoothstep, wrapAngle } from '../utils/math';

export type CameraMode = 'chase' | 'hood' | 'cockpit';
export const CAMERA_MODES: CameraMode[] = ['chase', 'hood', 'cockpit'];
export const CAMERA_LABELS: Record<CameraMode, string> = { chase: 'Third Person', hood: 'Hood', cockpit: 'Cockpit' };

/**
 * Race camera: smooth chase cam with speed-based FOV/distance, nitro pull-back and tilt,
 * hood and cockpit cams, trauma-based shake and a cinematic orbit for intros/finish.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'chase';
  baseFov = 68;
  shakeEnabled = true;
  /** 0 = gameplay, 1 = full cinematic orbit */
  cinematic = 0;
  private orbitAngle = 0;
  private yaw = 0;
  private dist = 6.5;
  private height = 2.1;
  private fov = 68;
  private roll = 0;
  private trauma = 0;
  private time = 0;
  private yOffset = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.1, 12000);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setMode(mode: CameraMode, car: Car | null): void {
    this.mode = mode;
    if (car) car.model.driverHead.visible = mode !== 'cockpit';
  }

  cycle(car: Car | null): CameraMode {
    const i = CAMERA_MODES.indexOf(this.mode);
    this.setMode(CAMERA_MODES[(i + 1) % CAMERA_MODES.length], car);
    return this.mode;
  }

  addShake(amount: number): void {
    if (!this.shakeEnabled) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  reset(car: Car): void {
    this.yaw = car.physics.heading;
    this.initialized = true;
    this.orbitAngle = car.physics.heading + Math.PI * 0.8;
  }

  update(dt: number, car: Car): void {
    this.time += dt;
    if (!this.initialized) this.reset(car);
    const p = car.physics;
    const root = car.model.root;
    const speed = p.speed;
    const nitro = p.nitroActive ? 1 : 0;
    this.trauma = Math.max(0, this.trauma - dt * 1.5);

    // ---- gameplay camera target
    let targetFov = this.baseFov;
    if (this.mode === 'chase') {
      // follow the velocity direction a little so drifts show the car's flank
      const velYaw = speed > 6 ? Math.atan2(p.vx, p.vz) : p.heading;
      const blendYaw = p.heading + wrapAngle(velYaw - p.heading) * 0.45;
      this.yaw += wrapAngle(blendYaw - this.yaw) * (1 - Math.exp(-6 * dt));
      this.dist = damp(this.dist, 6.0 + speed * 0.018 + nitro * 1.6, 3, dt);
      this.height = damp(this.height, 1.95 + speed * 0.005, 3, dt);
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      this.yOffset = damp(this.yOffset, root.position.y, 10, dt);
      this.tmp.set(root.position.x - fx * this.dist, this.yOffset + this.height + Math.max(0, -p.longAccel) * 0.01, root.position.z - fz * this.dist);
      this.look.set(root.position.x + fx * 3.5, root.position.y + 1.05, root.position.z + fz * 3.5);
      targetFov += Math.min(16, speed * 0.14) + nitro * 9;
      this.roll = damp(this.roll, clamp(-p.angVel * 0.035 - car.controls.steer * 0.012, -0.08, 0.08), 5, dt);
    } else {
      const eye = this.mode === 'hood' ? car.model.hoodEye : car.model.driverEye;
      car.model.body.updateMatrixWorld(true);
      this.tmp.copy(eye);
      car.model.body.localToWorld(this.tmp);
      this.tmp2.set(eye.x, eye.y - 0.06, eye.z + 12);
      car.model.body.localToWorld(this.tmp2);
      this.look.copy(this.tmp2);
      targetFov += 6 + Math.min(10, speed * 0.1) + nitro * 7;
      this.roll = damp(this.roll, clamp(-p.angVel * 0.012, -0.03, 0.03), 6, dt);
    }

    // ---- cinematic orbit blend
    if (this.cinematic > 0.001) {
      this.orbitAngle += dt * 0.28;
      const r = 8.5;
      const ox = root.position.x + Math.sin(this.orbitAngle) * r;
      const oz = root.position.z + Math.cos(this.orbitAngle) * r;
      const k = smoothstep(0, 1, this.cinematic);
      this.tmp.set(lerp(this.tmp.x, ox, k), lerp(this.tmp.y, root.position.y + 2.2, k), lerp(this.tmp.z, oz, k));
      this.look.set(lerp(this.look.x, root.position.x, k), lerp(this.look.y, root.position.y + 0.7, k), lerp(this.look.z, root.position.z, k));
      targetFov = lerp(targetFov, 50, k);
    }

    this.fov = damp(this.fov, targetFov, 4, dt);
    this.camera.position.copy(this.tmp);

    // ---- shake
    const shake = this.trauma * this.trauma + (nitro ? 0.04 : 0) + (speed > 70 ? (speed - 70) * 0.0015 : 0);
    if (shake > 0.0005 && this.shakeEnabled) {
      const t = this.time * 32;
      const s = shake * (this.mode === 'chase' ? 0.32 : 0.12);
      this.camera.position.x += (Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5) * s;
      this.camera.position.y += (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.1) * 0.5) * s * 0.7;
      this.look.x += Math.sin(t * 0.9 + 2) * s * 0.5;
    }
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.look);
    this.camera.rotateZ(this.roll);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
