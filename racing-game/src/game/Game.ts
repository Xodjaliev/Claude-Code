import { AudioManager } from '../audio/AudioManager';
import { getCarDefinition } from '../car/CarCatalog';
import { RenderPipeline } from '../effects/PostFX';
import { SpeedLines } from '../effects/SpeedLines';
import { getTrackDefinition } from '../tracks/TrackCatalog';
import { UIManager } from '../ui/UIManager';
import { setMaxAnisotropy } from '../utils/textures';
import { InputManager } from './Input';
import { LocalLeaderboard } from './Leaderboard';
import { computeRewards, levelInfo, Progression, Rewards } from './Progression';
import { RaceConfig, RaceResults, RaceSession } from './RaceSession';
import { SaveManager } from './SaveManager';
import { GameSettings, SettingsManager } from './Settings';
import { Showroom } from './Showroom';

export interface RaceOutcome {
  results: RaceResults;
  rewards: Rewards;
  levelUp: boolean;
  level: number;
  unlockedTracks: string[];
  unlockedCars: string[];
  newBestLap: boolean;
  newBestRace: boolean;
}

/**
 * Application root: owns the renderer, audio, persistence and UI, runs the main loop
 * and switches between the menu showroom and race sessions.
 */
export class Game {
  readonly root: HTMLElement;
  readonly settings = new SettingsManager();
  readonly save = new SaveManager();
  readonly progression = new Progression(this.save);
  readonly leaderboard = new LocalLeaderboard();
  readonly audio = new AudioManager();
  readonly input = new InputManager();
  readonly pipeline: RenderPipeline;
  readonly showroom: Showroom;
  readonly speedLines: SpeedLines;
  readonly ui: UIManager;
  race: RaceSession | null = null;
  state: 'menu' | 'loading' | 'race' = 'menu';
  private last = performance.now();
  private fpsFrames = 0;
  private fpsTime = 0;
  fps = 0;
  private loadToken = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const s = this.settings.value;
    this.pipeline = new RenderPipeline(root, s.graphics);
    setMaxAnisotropy(Math.min(8, this.pipeline.renderer.capabilities.getMaxAnisotropy()));
    this.speedLines = new SpeedLines(root);
    this.showroom = new Showroom(this.pipeline.renderer, 1);
    this.refreshShowroomCar();
    this.ui = new UIManager(this);
    this.showroom.attachDrag(root);

    this.input.onAction((a) => this.onAction(a));
    this.settings.on('change', (v) => this.applySettings(v));
    this.applySettings(s);
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.race && !this.race.paused && this.state === 'race') this.pauseRace();
    });
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.resize();
  }

  start(): void {
    const frame = (t: number) => {
      this.tick(t);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private tick(now: number): void {
    const raw = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.1, raw);
    this.last = now;
    this.fpsFrames++;
    this.fpsTime += raw;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    if (this.race && this.state === 'race') {
      this.race.update(dt);
      const p = this.race.player.car.physics;
      const lines = this.race.paused ? 0 : Math.max(0, (p.speed - 45) / 45) * 0.7;
      this.speedLines.intensity = lines;
      this.speedLines.nitro = this.race.paused ? 0 : p.nitroActive ? 1 : 0;
      this.pipeline.render(this.race.scene, this.race.cameraCtl.camera);
    } else {
      this.showroom.update(dt);
      this.pipeline.bloomStrength = 0.45;
      this.pipeline.bloomThreshold = 1.0;
      this.pipeline.speedAmount = 0;
      this.pipeline.nitroAmount = 0;
      this.speedLines.intensity = 0;
      this.speedLines.nitro = 0;
      this.pipeline.render(this.showroom.scene, this.showroom.camera);
    }
    this.speedLines.update(dt);
    this.ui.update(dt);
  }

  private resize(): void {
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
    this.pipeline.setSize(w, h);
    this.showroom.setAspect(w / h);
    this.race?.resize(w / h);
    this.speedLines.resize(w, h);
  }

  private applySettings(s: Readonly<GameSettings>): void {
    if (this.pipeline.quality !== s.graphics) {
      this.pipeline.setQuality(s.graphics);
      this.resize();
    }
    this.audio.setVolumes(s.masterVolume, s.sfxVolume, s.musicVolume);
    this.input.bindings = { ...s.bindings };
    this.input.steeringSensitivity = s.steeringSensitivity;
    if (this.race) {
      this.race.cameraCtl.shakeEnabled = s.cameraShake;
      this.race.cameraCtl.baseFov = s.fov;
    }
    this.ui?.applySettings(s);
  }

  private onAction(a: 'camera' | 'reset' | 'pause'): void {
    if (this.state === 'race' && this.race) {
      if (a === 'pause') {
        if (this.ui.current === 'results') return;
        if (this.race.paused) this.ui.back();
        else this.pauseRace();
      } else if (!this.race.paused) {
        if (a === 'camera') this.race.cycleCamera();
        if (a === 'reset') this.race.resetPlayerCar();
      }
    } else if (this.state === 'menu' && a === 'pause') {
      this.ui.back();
    }
  }

  refreshShowroomCar(): void {
    const id = this.save.profile.selectedCar;
    this.showroom.showCar(getCarDefinition(id), this.save.carConfig(id));
  }

  // ------------------------------------------------------------------ race flow
  async startRace(): Promise<void> {
    if (this.state === 'loading') return;
    this.audio.unlock();
    const setup = this.save.profile.setup;
    const trackDef = getTrackDefinition(setup.trackId);
    const carId = this.save.profile.selectedCar;
    const config: RaceConfig = {
      ...setup,
      trackId: this.progression.isTrackUnlocked(setup.trackId) ? setup.trackId : 'city-circuit',
      playerCarId: carId,
      playerConfig: structuredClone(this.save.carConfig(carId)),
      playerName: this.settings.value.playerName || 'PLAYER',
    };
    this.disposeRace();
    this.state = 'loading';
    const token = ++this.loadToken;
    this.ui.showLoading(trackDef.name, trackDef.location);
    this.audio.music.stop();
    try {
      const race = await RaceSession.create(
        { pipeline: this.pipeline, audio: this.audio, settings: this.settings, input: this.input },
        config,
        (p, label) => this.ui.setLoading(p, label),
      );
      if (token !== this.loadToken) {
        race.dispose();
        return;
      }
      this.race = race;
      race.resize((this.root.clientWidth || window.innerWidth) / (this.root.clientHeight || window.innerHeight));
      race.on('results', (r) => this.onResults(r));
      this.input.clear();
      this.state = 'race';
      this.ui.enterRace(race);
    } catch (err) {
      console.error(err);
      this.state = 'menu';
      this.ui.hideLoading();
      this.ui.toast('Failed to load the track', 'err');
      this.ui.show('menu');
    }
  }

  pauseRace(): void {
    if (!this.race || this.race.paused) return;
    this.race.setPaused(true);
    this.ui.show('pause');
  }

  resumeRace(): void {
    if (!this.race) return;
    this.race.setPaused(false);
    this.input.clear();
    this.ui.show('hud');
  }

  restartRace(): void {
    if (!this.race) return;
    this.race.restart();
    this.input.clear();
    this.ui.enterRace(this.race);
  }

  quitToMenu(): void {
    this.disposeRace();
    this.state = 'menu';
    this.refreshShowroomCar();
    this.ui.exitRace();
    this.audio.playMusic('menu');
  }

  private disposeRace(): void {
    if (this.race) {
      this.race.dispose();
      this.race = null;
    }
  }

  private async onResults(results: RaceResults): Promise<void> {
    const cfg = results.config;
    const pb = this.leaderboard.personalBest(cfg.trackId);
    const newBestLap = results.bestLap !== null && (pb.lap === null || results.bestLap < pb.lap);
    const newBestRace = pb.race === null || results.totalTime < pb.race;
    if (results.bestLap !== null) {
      await this.leaderboard.submit(cfg.trackId, {
        name: cfg.playerName,
        carId: cfg.playerCarId,
        raceTime: results.totalTime,
        bestLap: results.bestLap,
        laps: cfg.laps,
        date: Date.now(),
      });
    }
    const rewards = computeRewards({
      mode: cfg.mode,
      position: results.position,
      racers: results.racers,
      difficulty: cfg.difficulty,
      trackId: cfg.trackId,
      laps: cfg.laps,
      newBestLap: newBestLap && pb.lap !== null,
      newBestRace: newBestRace && pb.race !== null,
      driftScore: results.driftScore,
      wallHits: results.wallHits,
    });
    const applied = this.progression.applyRewards(rewards, {
      position: results.position,
      racers: results.racers,
      mode: cfg.mode,
      distanceKm: results.distanceKm,
      drift: results.driftScore,
    });
    if (applied.levelUp) this.audio.play('sfx_levelup', { volume: 0.7 });
    this.ui.showResults({
      results,
      rewards,
      levelUp: applied.levelUp,
      level: applied.level,
      unlockedTracks: applied.tracks,
      unlockedCars: applied.cars,
      newBestLap,
      newBestRace,
    });
  }

  get levelInfo() {
    return levelInfo(this.save.profile.xp);
  }
}
