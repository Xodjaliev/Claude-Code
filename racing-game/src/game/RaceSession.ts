import * as THREE from 'three';
import { AIDriver, AIPersonality, AIRaceView } from '../ai/AIDriver';
import { RacingLine } from '../ai/RacingLine';
import type { AudioManager, LoopHandle } from '../audio/AudioManager';
import type { EngineSound } from '../audio/EngineSound';
import { CameraController } from '../camera/CameraController';
import { Car, ControlSource } from '../car/Car';
import { CAR_CATALOG, getCarDefinition, PAINT_SWATCHES } from '../car/CarCatalog';
import { CarConfig, defaultCarConfig, effectiveStats, performanceIndex, RIM_OPTIONS, SPOILER_OPTIONS } from '../car/Upgrades';
import { EffectsManager } from '../effects/EffectsManager';
import type { RenderPipeline } from '../effects/PostFX';
import { CollisionSystem } from '../physics/CollisionSystem';
import { Atmosphere, atmosphereFor, TimeOfDay } from '../tracks/Atmosphere';
import { ENVIRONMENTS, TrackEnvironment } from '../tracks/environments';
import { Track } from '../tracks/Track';
import { getTrackDefinition, ThemeId } from '../tracks/TrackCatalog';
import { buildTrackVisuals, TrackVisuals } from '../tracks/TrackMeshBuilder';
import { nextFrame } from '../utils/device';
import { EventEmitter } from '../utils/EventEmitter';
import { clamp, loopDelta, smoothstep } from '../utils/math';
import { Noise2D } from '../utils/Noise';
import { Random } from '../utils/Random';
import type { InputManager } from './Input';
import type { Difficulty, RaceSetup } from './SaveManager';
import type { SettingsManager } from './Settings';

export interface RaceConfig extends RaceSetup {
  playerCarId: string;
  playerConfig: CarConfig;
  playerName: string;
}

export interface RacerState {
  car: Car;
  name: string;
  isPlayer: boolean;
  progress: number;
  lastDist: number;
  lap: number;
  nextCheckpoint: number;
  lapStart: number;
  lapTimes: number[];
  bestLap: number | null;
  finished: boolean;
  finishTime: number;
  position: number;
  /** split times of the current lap per checkpoint */
  splits: number[];
}

export interface StandingRow {
  position: number;
  name: string;
  carName: string;
  time: number | null;
  estimated: boolean;
  bestLap: number | null;
  isPlayer: boolean;
}

export interface RaceResults {
  config: RaceConfig;
  position: number;
  racers: number;
  totalTime: number;
  bestLap: number | null;
  lapTimes: number[];
  standings: StandingRow[];
  driftScore: number;
  wallHits: number;
  topSpeedKmh: number;
  distanceKm: number;
}

export type RaceEvent =
  | { type: 'countdown'; value: number }
  | { type: 'go' }
  | { type: 'checkpoint'; index: number; split: number; delta: number | null }
  | { type: 'lap'; lap: number; time: number; best: boolean; finalLap: boolean }
  | { type: 'finish'; position: number }
  | { type: 'drift'; score: number }
  | { type: 'wrongWay'; active: boolean }
  | { type: 'nitro' }
  | { type: 'reset' };

export interface RaceServices {
  pipeline: RenderPipeline;
  audio: AudioManager;
  settings: SettingsManager;
  input: InputManager;
}

const AI_NAMES = ['Rex Turbo', 'Mika Storm', 'Luna Vega', 'Kai Blaze', 'Nova Reyes', 'Axel Kross', 'Yuki Drift', 'Dante Volt', 'Sasha Nitro', 'Ivan Rush', 'Zara Flux', 'Leo Apex'];

const OFFROAD: Record<ThemeId, { grip: number; drag: number; power: number }> = {
  city: { grip: 0.85, drag: 1.5, power: 0.95 },
  desert: { grip: 0.62, drag: 5, power: 0.8 },
  mountain: { grip: 0.7, drag: 3.5, power: 0.85 },
};

const DIFFICULTY: Record<Difficulty, { skill: [number, number]; perf: number; upgrades: [number, number]; band: number; mistakes: number }> = {
  easy: { skill: [0.8, 0.88], perf: 0.93, upgrades: [0, 1], band: 1.3, mistakes: 0.9 },
  normal: { skill: [0.88, 0.95], perf: 0.98, upgrades: [1, 3], band: 0.8, mistakes: 0.5 },
  hard: { skill: [0.94, 1.0], perf: 1.02, upgrades: [3, 5], band: 0.45, mistakes: 0.25 },
};

const FIXED_DT = 1 / 120;

/** Player input -> car controls. */
class PlayerController implements ControlSource {
  readonly kind = 'player' as const;
  constructor(private readonly input: InputManager) {}
  update(car: Car, dt: number): void {
    this.input.read(dt, car.controls);
  }
}

/**
 * One race: builds the scene (track, environment, cars), runs fixed-step physics,
 * tracks laps/checkpoints/positions and drives camera, effects and audio.
 */
export class RaceSession extends EventEmitter<{ event: RaceEvent; results: RaceResults }> {
  readonly scene = new THREE.Scene();
  readonly config: RaceConfig;
  readonly track: Track;
  readonly line: RacingLine;
  readonly cameraCtl: CameraController;
  readonly cars: Car[] = [];
  readonly racers: RacerState[] = [];
  player!: RacerState;
  state: 'countdown' | 'racing' | 'finished' = 'countdown';
  /** race clock (s), starts at GO */
  time = 0;
  countdown = 3.6;
  paused = false;
  laps: number;
  theme: ThemeId;
  timeOfDay: TimeOfDay;

  private atmosphere!: Atmosphere;
  private visuals!: TrackVisuals;
  private environment!: TrackEnvironment;
  private effects!: EffectsManager;
  private readonly collisions = new CollisionSystem();
  private readonly services: RaceServices;
  private readonly playerController: PlayerController;
  private acc = 0;
  private elapsed = 0;
  private lastCountdownShown = 4;
  private finishTimer = -1;
  private resultsSent = false;
  private wrongWayTime = 0;
  private wrongWayShown = false;
  private driftScore = 0;
  private currentDrift = 0;
  private wallHits = 0;
  private topSpeed = 0;
  private bestLapSplits: number[] | null = null;
  private headlight: THREE.SpotLight | null = null;
  private playerEngine: EngineSound | null = null;
  private aiEngines = new Map<Car, EngineSound>();
  private loops: Partial<Record<'skid' | 'scrape' | 'nitro' | 'wind' | 'rumble', LoopHandle>> = {};
  private scrapeLevel = 0;
  private lastNitro = false;
  private lastThrottle = 0;
  private onCurb = false;
  private readonly tmpV = new THREE.Vector3();
  private readonly camRight = new THREE.Vector3();
  private readonly view: AIRaceView;
  private autopilot: AIDriver | null = null;
  /** Bloom settings of this race's atmosphere (re-applied every frame, the menu uses others). */
  private bloom = { strength: 0.5, threshold: 1 };

  private constructor(services: RaceServices, config: RaceConfig) {
    super();
    this.services = services;
    this.config = config;
    const def = getTrackDefinition(config.trackId);
    this.track = new Track(def);
    this.line = new RacingLine(this.track);
    this.theme = def.theme;
    this.timeOfDay = config.timeOfDay === 'auto' ? def.timeOfDay : config.timeOfDay;
    this.laps = config.laps;
    const size = services.pipeline.size;
    this.cameraCtl = new CameraController(size.width / size.height);
    this.playerController = new PlayerController(services.input);
    const self = this;
    this.view = {
      track: this.track,
      line: this.line,
      cars: this.cars,
      get started() {
        return self.state !== 'countdown';
      },
      gapToPlayer(car: Car) {
        const r = self.racers.find((x) => x.car === car);
        return r && self.player ? r.progress - self.player.progress : 0;
      },
    };
  }

  static async create(services: RaceServices, config: RaceConfig, onProgress: (p: number, label: string) => void): Promise<RaceSession> {
    const s = new RaceSession(services, config);
    await s.build(onProgress);
    return s;
  }

  private async build(onProgress: (p: number, label: string) => void): Promise<void> {
    const { pipeline } = this.services;
    const profile = pipeline.profile;
    const def = this.track.def;
    onProgress(0.1, 'Preparing atmosphere');
    await nextFrame();
    const atmo = atmosphereFor(def.theme, this.timeOfDay);
    this.atmosphere = new Atmosphere(this.scene, pipeline.renderer, atmo, {
      shadows: profile.shadows,
      shadowMapSize: profile.shadowMapSize,
      cityGlow: def.theme === 'city',
    });
    pipeline.bloomStrength = atmo.bloom;
    pipeline.bloomThreshold = atmo.bloomThreshold;
    this.bloom = { strength: atmo.bloom, threshold: atmo.bloomThreshold };

    onProgress(0.25, 'Building track');
    await nextFrame();
    this.visuals = buildTrackVisuals(this.track, def.theme, atmo, def.accent);
    this.scene.add(this.visuals.group);

    onProgress(0.4, 'Generating scenery');
    await nextFrame();
    const envGroup = new THREE.Group();
    envGroup.name = 'environment';
    this.environment = ENVIRONMENTS[def.theme]({
      group: envGroup,
      track: this.track,
      atmo,
      density: profile.decorDensity,
      shadows: profile.shadows,
      rng: new Random(def.seed),
      noise: new Noise2D(def.seed),
    });
    this.scene.add(envGroup);

    onProgress(0.75, 'Preparing cars');
    await nextFrame();
    this.createCars(atmo.headlights, profile.shadows);
    this.effects = new EffectsManager(def.theme, profile);
    this.scene.add(this.effects.group);

    if (atmo.headlights) {
      const light = new THREE.SpotLight(0xfff1dd, 320, 120, 0.5, 0.7, 1.6);
      light.position.set(0, 0.9, 2.2);
      light.target.position.set(0, 0, 25);
      this.player.car.model.root.add(light, light.target);
      this.headlight = light;
    }

    onProgress(0.9, 'Compiling shaders');
    await nextFrame();
    this.placeOnGrid();
    const cam = this.cameraCtl;
    cam.mode = this.services.settings.value.cameraMode;
    cam.baseFov = this.services.settings.value.fov;
    cam.shakeEnabled = this.services.settings.value.cameraShake;
    cam.setMode(cam.mode, this.player.car);
    cam.cinematic = 1;
    for (const c of this.cars) c.syncVisual(1, 1 / 60, 0);
    cam.reset(this.player.car);
    cam.update(1 / 60, this.player.car);
    this.atmosphere.update(this.player.car.position, 0);
    try {
      pipeline.renderer.compile(this.scene, cam.camera);
    } catch {
      /* compile is an optimisation only */
    }
    this.startAudio();
    onProgress(1, 'Ready');
  }

  private createCars(lightsOn: boolean, shadows: boolean): void {
    const cfg = this.config;
    const rng = new Random(Date.now() & 0xffff);
    const playerDef = getCarDefinition(cfg.playerCarId);
    const playerCar = new Car(playerDef, cfg.playerConfig, { name: cfg.playerName, isPlayer: true, lightsOn, shadows });
    playerCar.controller = this.playerController;
    playerCar.gearbox.onShift = (up) => {
      this.services.audio.play('sfx_shift', { volume: up ? 0.5 : 0.35, pitch: up ? 1 : 0.8 }, 'race');
      if (!up && playerCar.gearbox.rpmRatio > 0.6 && Math.random() < 0.5) this.backfire(playerCar);
    };

    const opponents = cfg.mode === 'timeTrial' ? 0 : clamp(cfg.opponents, 0, 7);
    const diff = DIFFICULTY[cfg.difficulty];
    const playerPI = performanceIndex(effectiveStats(playerDef, cfg.playerConfig.upgrades));
    // prefer opponents with a similar performance index
    const pool = [...CAR_CATALOG].sort(
      (a, b) => Math.abs(performanceIndex(a.stats) - playerPI) - Math.abs(performanceIndex(b.stats) - playerPI),
    );
    const names = rng.shuffle([...AI_NAMES]);
    const colors = rng.shuffle([...PAINT_SWATCHES]);
    const aiCars: Car[] = [];
    for (let i = 0; i < opponents; i++) {
      const def = pool[Math.min(pool.length - 1, Math.floor(rng.next() * Math.min(pool.length, 3)))];
      const conf = defaultCarConfig(def);
      conf.color = colors[i % colors.length];
      conf.finish = rng.pick(['gloss', 'metallic', 'pearl'] as const);
      conf.accentColor = rng.pick(['#111111', '#f2f2f2', '#ffcc00', '#00c8d7']);
      conf.visual.spoiler = rng.pick(SPOILER_OPTIONS).value;
      conf.visual.rims = rng.pick(RIM_OPTIONS).value;
      conf.visual.decal = rng.pick(['none', 'stripes', 'racing', 'side'] as const);
      conf.raceNumber = rng.int(2, 99);
      const lvl = rng.int(diff.upgrades[0], diff.upgrades[1]);
      for (const k of Object.keys(conf.upgrades) as (keyof typeof conf.upgrades)[]) conf.upgrades[k] = Math.min(5, Math.max(0, lvl + rng.int(-1, 1)));
      // compensate if the AI car is much slower than the player's
      const aiPI = performanceIndex(effectiveStats(def, conf.upgrades));
      const piComp = clamp(1 + ((playerPI - aiPI) / 600) * 0.6, 0.95, 1.08);
      const car = new Car(def, conf, { name: names[i % names.length], isPlayer: false, lightsOn, shadows, performanceScale: diff.perf * piComp });
      const personality: AIPersonality = {
        skill: rng.range(diff.skill[0], diff.skill[1]),
        mistakes: diff.mistakes * rng.range(0.6, 1.4),
        aggression: rng.range(0.3, 1),
        laneBias: rng.range(-1.2, 1.2),
      };
      car.controller = new AIDriver(this.view, personality, rng.int(1, 1e6));
      aiCars.push(car);
    }
    // player starts towards the back of the grid
    const playerSlot = opponents === 0 ? 0 : Math.min(opponents, Math.max(1, Math.round(opponents * 0.6)));
    const order: Car[] = [...aiCars];
    order.splice(playerSlot, 0, playerCar);
    for (const car of order) {
      this.cars.push(car);
      this.scene.add(car.model.root);
      const r: RacerState = {
        car,
        name: car.name,
        isPlayer: car.isPlayer,
        progress: 0,
        lastDist: 0,
        lap: 0,
        nextCheckpoint: 0,
        lapStart: 0,
        lapTimes: [],
        bestLap: null,
        finished: false,
        finishTime: 0,
        position: 1,
        splits: [],
      };
      this.racers.push(r);
      if (car.isPlayer) this.player = r;
    }
  }

  private placeOnGrid(): void {
    const frame = { x: 0, y: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0, halfWidth: 0 };
    this.racers.forEach((r, slot) => {
      const g = this.track.gridSlot(slot);
      this.track.frameAt(g.dist, frame);
      const x = frame.x + frame.rx * g.lateral;
      const z = frame.z + frame.rz * g.lateral;
      r.car.physics.place(x, frame.y, z, Math.atan2(frame.tx, frame.tz));
      r.car.physics.nitroAmount = 1;
      r.car.gearbox.reset();
      r.car.ghostTimer = 0;
      this.track.query(x, z, -1, r.car.query);
      r.car.physics.surface.height = r.car.query.height;
      r.car.physics.y = r.car.query.height;
      r.lastDist = r.car.query.dist;
      r.progress = loopDelta(0, r.car.query.dist, this.track.length);
      r.lap = 0;
      r.nextCheckpoint = 0;
      r.lapStart = 0;
      r.lapTimes = [];
      r.bestLap = null;
      r.finished = false;
      r.finishTime = 0;
      r.splits = [];
    });
    this.updatePositions();
  }

  // ------------------------------------------------------------------ audio
  private startAudio(): void {
    const audio = this.services.audio;
    if (!audio.ready) return;
    audio.setRacePaused(false);
    this.playerEngine = audio.createEngine(this.player.car.def.engine, true);
    this.loops.skid = audio.loop('skid');
    this.loops.scrape = audio.loop('scrape');
    this.loops.nitro = audio.loop('nitro');
    this.loops.wind = audio.loop('wind');
    this.loops.rumble = audio.loop('rumble');
    audio.startAmbience(this.theme);
    audio.playMusic('race');
  }

  private stopAudio(): void {
    this.playerEngine?.stop();
    this.playerEngine = null;
    this.aiEngines.forEach((e) => e.stop());
    this.aiEngines.clear();
    Object.values(this.loops).forEach((l) => l?.stop());
    this.loops = {};
    this.services.audio.stopAmbience();
  }

  private updateAudio(): void {
    const audio = this.services.audio;
    if (!audio.ready) return;
    if (!this.playerEngine) this.startAudio();
    const pc = this.player.car;
    const p = pc.physics;
    this.playerEngine?.update(pc.gearbox.rpm, pc.controls.throttle, p.nitroActive, 1, 0);
    const speedK = clamp(p.speed / 15, 0, 1);
    this.loops.skid?.setLevel(p.tyreSlip > 0.25 && p.surface.onRoad ? p.tyreSlip * speedK * 0.45 : 0);
    this.loops.skid?.setPitch(0.85 + clamp(p.speed / 60, 0, 0.4));
    this.loops.scrape?.setLevel(this.scrapeLevel * 0.5);
    this.loops.nitro?.setLevel(p.nitroActive ? 0.45 : 0);
    this.loops.wind?.setLevel(Math.pow(clamp(p.speed / 90, 0, 1.2), 2) * 0.32);
    this.loops.wind?.setPitch(1 + p.speed / 60);
    this.loops.rumble?.setLevel(this.onCurb && p.speed > 8 ? 0.35 : 0);
    this.loops.rumble?.setPitch(0.8 + p.speed / 50);

    // nearest AI engines (3 voices)
    const cam = this.cameraCtl.camera;
    this.camRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const near = this.cars
      .filter((c) => !c.isPlayer)
      .map((c) => ({ c, d: c.position.distanceTo(cam.position) }))
      .filter((x) => x.d < 140)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    const keep = new Set(near.map((n) => n.c));
    this.aiEngines.forEach((e, c) => {
      if (!keep.has(c)) {
        e.stop();
        this.aiEngines.delete(c);
      }
    });
    for (const { c, d } of near) {
      let e = this.aiEngines.get(c);
      if (!e) {
        const created = audio.createEngine(c.def.engine, false);
        if (!created) continue;
        e = created;
        this.aiEngines.set(c, e);
      }
      this.tmpV.copy(c.position).sub(cam.position).normalize();
      const pan = this.tmpV.dot(this.camRight);
      const vol = Math.pow(clamp(1 - d / 140, 0, 1), 1.6) * 0.9;
      e.update(c.gearbox.rpm, c.controls.throttle, c.physics.nitroActive, vol, pan);
    }
  }

  private backfire(car: Car): void {
    this.effects.backfire(car);
    if (car.isPlayer) this.services.audio.play('sfx_backfire', { volume: 0.55, pitch: 0.9 + Math.random() * 0.3 }, 'race');
  }

  // ------------------------------------------------------------------ simulation
  update(dt: number): void {
    if (this.paused) return;
    this.elapsed += dt;
    const frameDt = Math.min(dt, 0.1);

    // countdown
    if (this.state === 'countdown') {
      this.countdown -= frameDt;
      const shown = Math.ceil(this.countdown);
      if (shown !== this.lastCountdownShown && shown <= 3 && shown >= 1) {
        this.lastCountdownShown = shown;
        this.visuals.startLights.set(shown);
        this.emit('event', { type: 'countdown', value: shown });
        this.services.audio.play('sfx_countdown', { volume: 0.7 });
      }
      this.cameraCtl.cinematic = smoothstep(0.6, 3.2, this.countdown);
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.time = 0;
        this.visuals.startLights.set(0);
        this.emit('event', { type: 'go' });
        this.services.audio.play('sfx_go', { volume: 0.8 });
        for (const r of this.racers) r.lapStart = 0;
      }
    } else if (this.state === 'racing' || this.state === 'finished') {
      this.time += frameDt;
      if (this.time > 3 && this.time < 3.2) this.visuals.startLights.set(-1);
    }

    // fixed-step physics
    this.acc += frameDt;
    let steps = 0;
    this.collisions.clear();
    while (this.acc >= FIXED_DT && steps < 12) {
      this.fixedStep(FIXED_DT);
      this.acc -= FIXED_DT;
      steps++;
    }
    const alpha = this.acc / FIXED_DT;

    // visuals
    const pc = this.player.car;
    for (const c of this.cars) {
      c.syncVisual(alpha, frameDt, this.elapsed);
      if (c.ghostTimer > 0) c.model.root.visible = Math.floor(this.elapsed * 12) % 2 === 0 || c.ghostTimer < 0.05;
      else c.model.root.visible = true;
    }
    this.handleImpacts();
    this.updateDrift(frameDt);
    this.updateWrongWay(frameDt);

    // camera
    this.cameraCtl.update(frameDt, pc);
    const camPos = this.cameraCtl.camera.position;
    for (const c of this.cars) this.effects.updateCar(c, frameDt, c.position.distanceTo(camPos));
    this.effects.update(frameDt, this.services.pipeline.pointScale(this.cameraCtl.camera));
    this.atmosphere.update(pc.position, this.elapsed);
    this.environment.update(frameDt, this.elapsed);
    this.visuals.gates.forEach((g, i) => g.setActive(!this.player.finished && i === this.player.nextCheckpoint));

    // nitro start effects
    const p = pc.physics;
    if (p.nitroActive && !this.lastNitro) {
      this.cameraCtl.addShake(0.3);
      this.services.audio.play('sfx_nitro', { volume: 0.7 }, 'race');
      this.emit('event', { type: 'nitro' });
    }
    this.lastNitro = p.nitroActive;
    // throttle-lift backfires
    if (this.lastThrottle > 0.8 && pc.controls.throttle < 0.1 && pc.gearbox.rpmRatio > 0.7 && Math.random() < 0.6) this.backfire(pc);
    this.lastThrottle = pc.controls.throttle;
    this.topSpeed = Math.max(this.topSpeed, pc.speedKmh);

    // post fx
    const pipe = this.services.pipeline;
    const speedFx = smoothstep(45, 90, p.speed) * 0.5 + (p.nitroActive ? 0.35 : 0);
    pipe.speedAmount += (speedFx - pipe.speedAmount) * (1 - Math.exp(-4 * frameDt));
    pipe.nitroAmount += ((p.nitroActive ? 1 : 0) - pipe.nitroAmount) * (1 - Math.exp(-5 * frameDt));
    pipe.motionBlurEnabled = this.services.settings.value.motionBlur;
    pipe.bloomStrength = this.bloom.strength;
    pipe.bloomThreshold = this.bloom.threshold;

    this.updateAudio();
    this.updatePositions();

    // finish sequence
    if (this.finishTimer >= 0) {
      this.finishTimer += frameDt;
      this.cameraCtl.cinematic = smoothstep(0.5, 2.5, this.finishTimer);
      if (this.finishTimer > 3.2 && !this.resultsSent) {
        this.resultsSent = true;
        this.emit('results', this.buildResults());
      }
    }
  }

  private fixedStep(dt: number): void {
    const off = OFFROAD[this.theme];
    const frozen = this.state === 'countdown';
    for (const c of this.cars) {
      c.controller?.update(c, dt);
      c.physics.frozen = frozen;
      if (c.ghostTimer > 0) c.ghostTimer -= dt;
      const q = c.query;
      const surf = c.physics.surface;
      const onRoad = Math.abs(q.lateral) <= q.halfWidth + 0.35;
      surf.onRoad = onRoad;
      if (!onRoad && !frozen) c.stats.offroadTime += dt;
      surf.grip = onRoad ? 1 : off.grip;
      surf.drag = onRoad ? 0 : off.drag;
      surf.power = onRoad ? 1 : off.power;
      surf.height = q.height;
      surf.slope = q.slope * (Math.sin(c.physics.heading) * q.tx + Math.cos(c.physics.heading) * q.tz);
      c.prePhysics(dt);
      c.physics.step(c.controls, dt);
    }
    for (const c of this.cars) {
      this.track.query(c.physics.x, c.physics.z, c.query.index, c.query);
      c.physics.y = c.query.height;
      this.collisions.resolveTrack(c);
    }
    this.collisions.resolveCars(this.cars);
    if (!frozen) for (const r of this.racers) this.updateProgress(r);
    // curb detection for the player
    const q = this.player.car.query;
    const s = this.track.sample(q.index);
    const lat = Math.abs(q.lateral);
    this.onCurb = Math.abs(s.curvature) > 1 / 140 && lat > q.halfWidth - 1.1 && lat < q.halfWidth + 0.35;
    if (this.onCurb && this.player.car.physics.speed > 10) this.cameraCtl.addShake(0.004);
  }

  private updateProgress(r: RacerState): void {
    const L = this.track.length;
    const d = r.car.query.dist;
    r.progress += loopDelta(r.lastDist, d, L);
    r.lastDist = d;
    if (r.finished) return;
    const cps = this.track.checkpoints;
    for (let guard = 0; guard < 4; guard++) {
      const target = r.lap * L + cps[r.nextCheckpoint];
      if (r.progress < target) break;
      const split = this.time - r.lapStart;
      if (r.nextCheckpoint === cps.length - 1) {
        // lap complete
        r.lapTimes.push(split);
        const best = r.bestLap === null || split < r.bestLap;
        if (best) {
          r.bestLap = split;
          if (r.isPlayer) this.bestLapSplits = [...r.splits];
        }
        r.lap++;
        r.nextCheckpoint = 0;
        r.lapStart = this.time;
        r.splits = [];
        if (r.lap >= this.laps) {
          r.finished = true;
          r.finishTime = this.time;
          if (r.isPlayer) this.onPlayerFinished();
        } else if (r.isPlayer) {
          const finalLap = r.lap === this.laps - 1;
          this.emit('event', { type: 'lap', lap: r.lap, time: split, best: best && r.lap > 1, finalLap });
          this.services.audio.play('sfx_lap', { volume: 0.6 });
        }
      } else {
        r.splits[r.nextCheckpoint] = split;
        if (r.isPlayer) {
          const ref = this.bestLapSplits?.[r.nextCheckpoint];
          this.emit('event', { type: 'checkpoint', index: r.nextCheckpoint, split, delta: ref !== undefined ? split - ref : null });
          this.services.audio.play('sfx_checkpoint', { volume: 0.45 });
        }
        r.nextCheckpoint++;
      }
    }
  }

  private onPlayerFinished(): void {
    this.state = 'finished';
    this.finishTimer = 0;
    const pos = this.player.position;
    this.updatePositions();
    this.emit('event', { type: 'finish', position: this.player.position || pos });
    this.services.audio.play('sfx_finish', { volume: 0.8 });
    // the car drives itself into the cool-down lap
    this.autopilot = new AIDriver(this.view, { skill: 0.85, mistakes: 0, aggression: 0, laneBias: 0 }, 7);
    this.player.car.controller = this.autopilot;
  }

  private updatePositions(): void {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((r, i) => (r.position = i + 1));
  }

  private handleImpacts(): void {
    const pc = this.player.car;
    let scrape = 0;
    const audio = this.services.audio;
    const cam = this.cameraCtl.camera;
    for (const e of this.collisions.impacts) {
      const involvesPlayer = e.car === pc || e.other === pc;
      const dist = Math.hypot(e.x - cam.position.x, e.z - cam.position.z);
      if (dist < 200) this.effects.impact(e);
      if (e.scrape) {
        if (e.car === pc) scrape = Math.max(scrape, clamp(e.strength / 40, 0.2, 1));
        continue;
      }
      if (e.other) {
        e.car.stats.carHits++;
        e.other.stats.carHits++;
      } else e.car.stats.wallHits++;
      if (involvesPlayer) {
        this.cameraCtl.addShake(clamp(e.strength * 0.045, 0.1, 0.8));
        if (!e.other && e.strength > 3) this.wallHits++;
      }
      if (dist < 120 && e.strength > 2) {
        const vol = clamp(e.strength / 18, 0.15, 1) * clamp(1 - dist / 120, 0, 1);
        audio.play('sfx_crash', { volume: vol, pitch: 0.8 + Math.random() * 0.4 }, 'race');
      }
    }
    this.scrapeLevel += (scrape - this.scrapeLevel) * 0.3;
  }

  private updateDrift(dt: number): void {
    const p = this.player.car.physics;
    if (this.state !== 'racing') return;
    if (p.drifting && p.speed > 12 && p.surface.onRoad) {
      this.currentDrift += p.speed * Math.min(1, Math.abs(p.slipAngle)) * dt * 12;
    } else if (this.currentDrift > 0) {
      if (this.currentDrift > 60) {
        const score = Math.round(this.currentDrift);
        this.driftScore += score;
        this.emit('event', { type: 'drift', score });
      }
      this.currentDrift = 0;
    }
  }

  get driftInProgress(): number {
    return Math.round(this.currentDrift);
  }

  get totalDrift(): number {
    return this.driftScore;
  }

  private updateWrongWay(dt: number): void {
    if (this.state !== 'racing') return;
    const pc = this.player.car;
    const q = pc.query;
    const along = pc.physics.vx * q.tx + pc.physics.vz * q.tz;
    if (along < -4) this.wrongWayTime += dt;
    else this.wrongWayTime = Math.max(0, this.wrongWayTime - dt * 2);
    const show = this.wrongWayTime > 1.2;
    if (show !== this.wrongWayShown) {
      this.wrongWayShown = show;
      this.emit('event', { type: 'wrongWay', active: show });
    }
  }

  /** Puts the player's car back on the road centre (R key / stuck). */
  resetPlayerCar(): void {
    if (this.state === 'countdown') return;
    const car = this.player.car;
    const f = this.track.frameAt(car.query.dist, { x: 0, y: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0, halfWidth: 0 });
    car.physics.place(f.x, f.y, f.z, Math.atan2(f.tx, f.tz));
    car.gearbox.reset();
    car.ghostTimer = 2;
    this.track.query(f.x, f.z, car.query.index, car.query);
    this.emit('event', { type: 'reset' });
  }

  /** Lets the AI drive the player's car (demo / automated tests). */
  setAutopilot(on: boolean): void {
    if (on) {
      this.autopilot = new AIDriver(this.view, { skill: 0.93, mistakes: 0.2, aggression: 0.6, laneBias: 0 }, 11);
      this.player.car.controller = this.autopilot;
    } else {
      this.autopilot = null;
      this.player.car.controller = this.playerController;
    }
  }

  cycleCamera(): void {
    const mode = this.cameraCtl.cycle(this.player.car);
    this.services.settings.set({ cameraMode: mode });
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.services.audio.setRacePaused(paused);
  }

  /** Restart on the same track without rebuilding the scene. */
  restart(): void {
    this.state = 'countdown';
    this.countdown = 3.6;
    this.lastCountdownShown = 4;
    this.time = 0;
    this.finishTimer = -1;
    this.resultsSent = false;
    this.driftScore = 0;
    this.currentDrift = 0;
    this.wallHits = 0;
    this.topSpeed = 0;
    this.wrongWayTime = 0;
    this.bestLapSplits = null;
    if (this.wrongWayShown) {
      this.wrongWayShown = false;
      this.emit('event', { type: 'wrongWay', active: false });
    }
    this.player.car.controller = this.playerController;
    this.autopilot = null;
    this.effects.clear();
    this.placeOnGrid();
    for (const c of this.cars) {
      c.controls.throttle = c.controls.brake = c.controls.steer = 0;
      c.controls.handbrake = c.controls.nitro = false;
    }
    this.visuals.startLights.set(-1);
    this.cameraCtl.cinematic = 1;
    this.cameraCtl.reset(this.player.car);
    this.setPaused(false);
  }

  private buildResults(): RaceResults {
    const L = this.track.length;
    const totalDist = L * this.laps;
    const rows: StandingRow[] = [...this.racers]
      .map((r) => {
        let time: number | null = r.finished ? r.finishTime : null;
        let estimated = false;
        if (!r.finished) {
          const avg = Math.max(5, r.progress / Math.max(1, this.time));
          time = this.time + Math.max(0, totalDist - r.progress) / avg;
          estimated = true;
        }
        return { name: r.name, carName: r.car.def.name, time, estimated, bestLap: r.bestLap, isPlayer: r.isPlayer, position: 0 };
      })
      .sort((a, b) => (a.time ?? 1e9) - (b.time ?? 1e9));
    rows.forEach((r, i) => (r.position = i + 1));
    const playerRow = rows.find((r) => r.isPlayer)!;
    return {
      config: this.config,
      position: playerRow.position,
      racers: this.racers.length,
      totalTime: this.player.finishTime,
      bestLap: this.player.bestLap,
      lapTimes: this.player.lapTimes,
      standings: rows,
      driftScore: this.driftScore,
      wallHits: this.wallHits,
      topSpeedKmh: this.topSpeed,
      distanceKm: (L * this.laps) / 1000,
    };
  }

  /** HUD helpers */
  get currentLapTime(): number {
    return this.state === 'countdown' ? 0 : this.time - this.player.lapStart;
  }

  get displayLap(): number {
    return Math.min(this.laps, this.player.lap + 1);
  }

  resize(aspect: number): void {
    this.cameraCtl.setAspect(aspect);
  }

  dispose(): void {
    this.stopAudio();
    this.removeAll();
    for (const c of this.cars) c.dispose();
    this.visuals.dispose();
    this.environment.dispose();
    this.effects.dispose();
    this.atmosphere.dispose();
    if (this.headlight) this.headlight.dispose();
    this.scene.clear();
    this.services.pipeline.speedAmount = 0;
    this.services.pipeline.nitroAmount = 0;
  }
}
