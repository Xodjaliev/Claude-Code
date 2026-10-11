import { CarDefinition, CarStats } from '../car/CarCatalog';

/** Physical parameters derived from the 1..10 stat ratings. All SI units. */
export interface VehicleSpecs {
  massKg: number;
  inertia: number;
  length: number;
  width: number;
  wheelBase: number;
  wheelRadius: number;
  /** Target top speed (m/s) on tarmac without nitro. */
  topSpeed: number;
  /** Peak engine acceleration at low speed (m/s^2). */
  accel: number;
  /** Speed at which engine power fades to zero, solved so that top speed matches `topSpeed` with drag. */
  engineLimit: number;
  engineLimitNitro: number;
  nitroAccel: number;
  nitroDuration: number;
  nitroRegen: number;
  brakeDecel: number;
  reverseTopSpeed: number;
  reverseAccel: number;
  /** Lateral grip in m/s^2. */
  lateralGrip: number;
  yawResponse: number;
  maxSteer: number;
  steerFalloff: number;
  /** Lateral grip multiplier while the handbrake is held. */
  driftGrip: number;
  driftYawBoost: number;
  /** Speed lost per second while sliding, multiplied by slip. */
  driftDrag: number;
  dragCoef: number;
  rolling: number;
  /** Collision circles: radius and offset from center along the car axis. */
  collisionRadius: number;
  collisionOffset: number;
}

const DRAG = 0.00042;
const POWER_EXP = 2.2;

function solveEngineLimit(topSpeed: number, accel: number): number {
  // accel * (1 - (v/limit)^p) = drag*v^2 at v = topSpeed
  const ratio = 1 - (DRAG * topSpeed * topSpeed) / accel;
  return topSpeed / Math.pow(Math.max(0.05, ratio), 1 / POWER_EXP);
}

export function computeVehicleSpecs(def: CarDefinition, stats: CarStats, performanceScale = 1): VehicleSpecs {
  const b = def.body;
  const topSpeed = (55 + stats.speed * 3.3) * performanceScale;
  const accel = (6 + stats.acceleration * 0.75) * performanceScale;
  const nitroTopMul = 1.13 + stats.nitro * 0.008;
  const length = b.length;
  const width = b.width;
  return {
    massKg: def.massKg,
    inertia: (def.massKg * (length * length + width * width)) / 12,
    length,
    width,
    wheelBase: b.wheelBase,
    wheelRadius: b.wheelRadius,
    topSpeed,
    accel,
    engineLimit: solveEngineLimit(topSpeed, accel),
    engineLimitNitro: solveEngineLimit(topSpeed * nitroTopMul, accel + 5 + stats.nitro * 0.45),
    nitroAccel: 5 + stats.nitro * 0.45,
    nitroDuration: 3 + stats.nitro * 0.3,
    nitroRegen: 0.03 + stats.nitro * 0.003,
    brakeDecel: 13 + stats.braking * 1.4,
    reverseTopSpeed: 16,
    reverseAccel: 7,
    lateralGrip: (1.18 + stats.handling * 0.075) * 9.81,
    yawResponse: 5 + stats.handling * 0.6,
    maxSteer: 0.5 + stats.handling * 0.008,
    steerFalloff: 22 + stats.handling * 1.2,
    driftGrip: 0.24 + stats.drift * 0.022,
    driftYawBoost: 1.35 + stats.drift * 0.06,
    driftDrag: 7.5 - stats.drift * 0.45,
    dragCoef: DRAG,
    rolling: 0.35,
    collisionRadius: width * 0.5,
    collisionOffset: length * 0.5 - width * 0.5,
  };
}

/** Physics model constant shared with the specs solver. */
export const ENGINE_POWER_EXP = POWER_EXP;
