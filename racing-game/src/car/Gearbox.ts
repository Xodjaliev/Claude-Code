import type { EngineProfile } from './CarCatalog';

/** Automatic gearbox: produces RPM for the HUD/audio and a torque cut while shifting. */
export class Gearbox {
  /** -1 = reverse, 0 = neutral, 1..n = forward gears */
  gear = 0;
  rpm: number;
  private shiftTimer = 0;
  private readonly engine: EngineProfile;
  onShift: ((up: boolean) => void) | null = null;

  constructor(engine: EngineProfile) {
    this.engine = engine;
    this.rpm = engine.idleRpm;
  }

  get gearLabel(): string {
    if (this.gear < 0) return 'R';
    if (this.gear === 0) return 'N';
    return String(this.gear);
  }

  get rpmRatio(): number {
    return this.rpm / this.engine.maxRpm;
  }

  get shifting(): boolean {
    return this.shiftTimer > 0;
  }

  reset(): void {
    this.gear = 0;
    this.rpm = this.engine.idleRpm;
    this.shiftTimer = 0;
  }

  /** Returns the torque multiplier for this step. */
  update(dt: number, forwardSpeed: number, throttle: number, brake: number, topSpeed: number, frozen: boolean): number {
    const e = this.engine;
    const gears = e.gears;
    let targetRpm: number;
    if (this.shiftTimer > 0) this.shiftTimer -= dt;

    if (frozen) {
      this.gear = 0;
      targetRpm = e.idleRpm + throttle * (e.maxRpm * 0.92 - e.idleRpm);
    } else if (forwardSpeed < -0.6) {
      this.gear = -1;
      targetRpm = e.idleRpm + Math.min(1, -forwardSpeed / 16) * (e.maxRpm * 0.7 - e.idleRpm);
    } else {
      if (this.gear <= 0) {
        if (throttle > 0.05 || forwardSpeed > 0.6) this.gear = 1;
        else if (brake > 0.05 && forwardSpeed < 0.3) this.gear = -1;
      }
      if (this.gear >= 1) {
        const ratio = forwardSpeed / (topSpeed * gears[this.gear - 1]);
        targetRpm = Math.max(e.idleRpm, ratio * e.maxRpm);
        // clutch slip in first gear
        if (this.gear === 1) targetRpm = Math.max(targetRpm, e.idleRpm + throttle * e.maxRpm * 0.55);
        if (this.shiftTimer <= 0) {
          if (ratio > 0.95 && this.gear < gears.length && throttle > 0.05) {
            this.gear++;
            this.shiftTimer = 0.18;
            this.onShift?.(true);
          } else if (this.gear > 1) {
            const lowerRatio = forwardSpeed / (topSpeed * gears[this.gear - 2]);
            if (lowerRatio < (throttle > 0.5 ? 0.82 : 0.62)) {
              this.gear--;
              this.shiftTimer = 0.12;
              this.onShift?.(false);
            }
          }
        }
      } else {
        targetRpm = e.idleRpm + throttle * e.maxRpm * 0.5;
      }
    }
    targetRpm = Math.min(targetRpm, e.maxRpm * 1.02);
    const rate = this.shiftTimer > 0 ? 25 : 14;
    this.rpm += (targetRpm - this.rpm) * (1 - Math.exp(-rate * dt));
    // rev limiter flutter
    if (this.rpm > e.maxRpm * 0.995 && throttle > 0.5) this.rpm -= Math.random() * e.maxRpm * 0.04;
    return this.shiftTimer > 0 ? 0.35 : 1;
  }
}
