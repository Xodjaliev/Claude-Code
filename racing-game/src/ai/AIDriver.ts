import type { Car, ControlSource } from '../car/Car';
import type { Track } from '../tracks/Track';
import { clamp, loopDelta, wrapAngle } from '../utils/math';
import { Random } from '../utils/Random';
import type { RacingLine } from './RacingLine';

export interface AIPersonality {
  /** 0.8 .. 1.0: fraction of the grip limit the driver dares to use */
  skill: number;
  /** 0..1 how often mistakes happen */
  mistakes: number;
  /** 0..1 how eagerly nitro is used / overtakes are attempted */
  aggression: number;
  /** preferred lateral offset from the racing line (m) */
  laneBias: number;
}

/** What the AI can see of the race. */
export interface AIRaceView {
  readonly track: Track;
  readonly line: RacingLine;
  readonly cars: readonly Car[];
  readonly started: boolean;
  /** progress (m) of this car minus progress of the player */
  gapToPlayer(car: Car): number;
}

type Mistake = 'none' | 'lateBrake' | 'wide' | 'lift' | 'wobble';

/**
 * AI racer: follows the racing line with a look-ahead pursuit controller, plans braking from
 * upcoming curvature, overtakes slower cars, uses nitro on straights and makes small mistakes.
 * It drives through exactly the same physics as the player — no rails.
 */
export class AIDriver implements ControlSource {
  readonly kind = 'ai' as const;
  readonly personality: AIPersonality;
  private readonly view: AIRaceView;
  private readonly rng: Random;
  private avoidOffset = 0;
  private avoidTarget = 0;
  private mistake: Mistake = 'none';
  private mistakeTimer = 0;
  private nextMistake: number;
  private wobblePhase = 0;
  private nitroHold = 0;
  private recoverTimer = 0;
  private recoverSteer = 0;
  private handbrakeTimer = 0;
  /** Set by the race for rubber-banding (0.93..1.07). */
  pace = 1;

  constructor(view: AIRaceView, personality: AIPersonality, seed: number) {
    this.view = view;
    this.personality = personality;
    this.rng = new Random(seed);
    this.nextMistake = this.rng.range(8, 20);
    this.wobblePhase = this.rng.range(0, 10);
  }

  update(car: Car, dt: number): void {
    const c = car.controls;
    const v = this.view;
    const p = car.physics;
    const q = car.query;
    const track = v.track;
    const pers = this.personality;
    if (!v.started) {
      // rev at the start
      c.throttle = this.rng.chance(0.03) ? 1 : c.throttle * 0.98;
      c.brake = 0;
      c.steer = 0;
      c.nitro = false;
      c.handbrake = true;
      return;
    }
    c.handbrake = false;

    // ---------------------------------------------------------------- stuck recovery
    if (this.recoverTimer > 0) {
      this.recoverTimer -= dt;
      c.throttle = 0;
      c.brake = 1;
      c.steer = this.recoverSteer;
      c.nitro = false;
      return;
    }
    const headingErr = wrapAngle(Math.atan2(q.tx, q.tz) - p.heading);
    if ((p.stuckTime > 1.6 && Math.abs(headingErr) > 0.5) || p.stuckTime > 3.5) {
      this.recoverTimer = 1.3;
      // reverse while steering so the nose swings back towards the track direction
      this.recoverSteer = headingErr > 0 ? 1 : -1;
      p.stuckTime = 0;
      return;
    }

    // ---------------------------------------------------------------- mistakes
    this.nextMistake -= dt * (0.4 + pers.mistakes);
    if (this.nextMistake <= 0 && this.mistake === 'none') {
      const roll = this.rng.next();
      this.mistake = roll < 0.3 ? 'lateBrake' : roll < 0.55 ? 'wide' : roll < 0.8 ? 'lift' : 'wobble';
      this.mistakeTimer = this.rng.range(0.5, 1.4);
      this.nextMistake = this.rng.range(10, 26);
    }
    if (this.mistake !== 'none') {
      this.mistakeTimer -= dt;
      if (this.mistakeTimer <= 0) this.mistake = 'none';
    }

    // ---------------------------------------------------------------- traffic: overtake / avoid
    const speed = p.speed;
    const cornerAhead = track.maxCurvatureAhead(q.dist, 40 + speed * 1.5);
    const inCorner = cornerAhead > 1 / 90;
    this.avoidTarget *= Math.exp(-dt * 0.8);
    let blocked = false;
    let closingFast = false;
    for (const other of v.cars) {
      if (other === car) continue;
      const ahead = loopDelta(q.dist, other.query.dist, track.length);
      if (ahead <= 0 || ahead > 26) continue;
      const latDiff = other.query.lateral - q.lateral;
      if (Math.abs(latDiff) > 3.2) continue;
      const closing = speed - other.physics.speed;
      if (closing < -1 && ahead > 8) continue;
      blocked = true;
      if (closing > 4 && ahead < 14) closingFast = true;
      if (inCorner) continue; // never dive for a gap in the middle of a corner
      // pass on the side with more room
      const hw = q.halfWidth - 1.6;
      const roomRight = hw - other.query.lateral;
      const roomLeft = other.query.lateral + hw;
      const side = roomRight > roomLeft ? 1 : -1;
      const want = other.query.lateral + side * 3.4 - v.line.offsetAt(q.dist + 10);
      if (Math.abs(want) > Math.abs(this.avoidTarget) || Math.sign(want) !== Math.sign(this.avoidTarget)) this.avoidTarget = want;
    }
    if (inCorner) this.avoidTarget = Math.max(-1.2, Math.min(1.2, this.avoidTarget));
    this.avoidOffset += (this.avoidTarget - this.avoidOffset) * (1 - Math.exp(-dt * 2.2));

    // ---------------------------------------------------------------- steering (pure pursuit)
    const look = 6 + speed * 0.5;
    const targetDist = q.dist + look;
    let lateral = v.line.offsetAt(targetDist) * (0.75 + pers.skill * 0.25) + pers.laneBias + this.avoidOffset;
    if (this.mistake === 'wide') {
      const k = track.sample(Math.round(targetDist / track.spacing)).curvature;
      lateral -= Math.sign(k) * 2.5;
    }
    const f = track.frameAt(targetDist, { x: 0, y: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0, halfWidth: 0 });
    const maxLat = f.halfWidth - 1.3;
    lateral = clamp(lateral, -maxLat, maxLat);
    const tx = f.x + f.rx * lateral;
    const tz = f.z + f.rz * lateral;
    const desired = Math.atan2(tx - p.x, tz - p.z);
    const err = wrapAngle(desired - p.heading);
    let steer = clamp(-err * 2.6 + p.angVel * 0.12, -1, 1);
    this.wobblePhase += dt;
    if (this.mistake === 'wobble') steer += Math.sin(this.wobblePhase * 9) * 0.35;
    steer += Math.sin(this.wobblePhase * 1.3) * 0.02 * pers.mistakes;
    c.steer = clamp(steer, -1, 1);

    // ---------------------------------------------------------------- speed planning
    const grip = car.specs.lateralGrip * pers.skill * (p.surface.onRoad ? 1 : 0.7);
    const decel = car.specs.brakeDecel * (this.mistake === 'lateBrake' ? 1.6 : 0.82);
    const horizon = (speed * speed) / (2 * decel) + 35;
    let allowed = 999;
    for (let d = 4; d < horizon; d += 4) {
      const k = Math.max(1e-4, v.line.curvatureAt(q.dist + d) * 0.97);
      const vmax = Math.sqrt(grip / k);
      allowed = Math.min(allowed, Math.sqrt(vmax * vmax + 2 * decel * d));
    }
    const kNow = Math.max(1e-4, v.line.curvatureAt(q.dist) * 0.97);
    allowed = Math.min(allowed, Math.sqrt(grip / kNow) * 1.05);
    allowed *= this.pace;

    let throttle = 1;
    let brake = 0;
    if (speed > allowed + 1.5) {
      throttle = 0;
      brake = clamp((speed - allowed) / 7, 0.25, 1);
    } else if (speed > allowed - 2.5) {
      throttle = 0.45;
    }
    if (this.mistake === 'lift') throttle = Math.min(throttle, 0.25);
    // running out of road: lift and tighten
    const edgeRoom = q.halfWidth - Math.abs(q.lateral);
    if (edgeRoom < 1.2 && Math.sign(q.lateral) === -Math.sign(track.sample(q.index).curvature || 1) && speed > 15) throttle = Math.min(throttle, 0.3);
    if (!p.surface.onRoad) throttle = Math.min(throttle, 0.7);
    if (blocked && this.avoidOffset * this.avoidTarget < 0) throttle *= 0.8;
    if (closingFast && (inCorner || Math.abs(this.avoidOffset) < 1)) {
      throttle = Math.min(throttle, 0.2);
      brake = Math.max(brake, inCorner ? 0.4 : 0.15);
    }
    // body twisted against another car: ease off so the tyres stop pushing into it
    if (Math.abs(headingErr) > 0.4 && car.contactTimer > 0) throttle = Math.min(throttle, 0.35);
    // badly misaligned (after a spin): slow down until pointing the right way
    if (Math.abs(headingErr) > 1.2 && speed > 6) {
      throttle = 0.3;
      c.steer = headingErr > 0 ? -1 : 1;
    }
    c.throttle = throttle;
    c.brake = brake;

    // hairpins: a quick handbrake flick
    if (this.handbrakeTimer > 0) {
      this.handbrakeTimer -= dt;
      c.handbrake = true;
    } else if (brake > 0.6 && speed > 18 && v.line.curvatureAt(q.dist + 15) > 1 / 26 && this.rng.chance(0.02 * pers.aggression)) {
      this.handbrakeTimer = 0.25;
    }

    // ---------------------------------------------------------------- nitro
    if (this.nitroHold > 0) {
      this.nitroHold -= dt;
      const corner = track.maxCurvatureAhead(q.dist, 60 + speed * 1.2);
      c.nitro = p.nitroAmount > 0.05 && corner < 1 / 180 && brake === 0;
      if (!c.nitro) this.nitroHold = 0;
    } else {
      c.nitro = false;
      const straight = track.maxCurvatureAhead(q.dist, 90 + speed * 1.8) < 1 / 260;
      const behind = v.gapToPlayer(car) < 0;
      const eager = pers.aggression * (behind ? 1.6 : 0.8);
      if (straight && p.nitroAmount > 0.4 && speed > 22 && this.rng.chance(dt * eager * 1.5)) this.nitroHold = this.rng.range(1.2, 3.5);
    }
  }
}
