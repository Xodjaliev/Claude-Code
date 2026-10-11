import type { CameraMode } from '../camera/CameraController';
import type { GraphicsQuality } from '../effects/QualityPresets';
import { device } from '../utils/device';
import { EventEmitter } from '../utils/EventEmitter';
import { storage } from '../utils/storage';
import { DEFAULT_BINDINGS, KeyBindings } from './Input';

export interface GameSettings {
  graphics: GraphicsQuality;
  showFps: boolean;
  motionBlur: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  cameraMode: CameraMode;
  cameraShake: boolean;
  fov: number;
  steeringSensitivity: number;
  touchControls: 'auto' | 'on' | 'off';
  touchSteering: 'buttons' | 'wheel';
  units: 'kmh' | 'mph';
  bindings: KeyBindings;
  playerName: string;
}

const KEY = 'velocity-rush-settings-v1';

function defaults(): GameSettings {
  const mobile = device.isMobile();
  return {
    graphics: mobile ? 'low' : 'high',
    showFps: false,
    motionBlur: true,
    masterVolume: 0.8,
    sfxVolume: 0.9,
    musicVolume: 0.55,
    cameraMode: 'chase',
    cameraShake: true,
    fov: 68,
    steeringSensitivity: 1,
    touchControls: 'auto',
    touchSteering: 'buttons',
    units: 'kmh',
    bindings: { ...DEFAULT_BINDINGS },
    playerName: 'PLAYER',
  };
}

export class SettingsManager extends EventEmitter<{ change: GameSettings }> {
  private data: GameSettings;

  constructor() {
    super();
    const saved = storage.load<Partial<GameSettings>>(KEY);
    const d = defaults();
    this.data = { ...d, ...(saved ?? {}), bindings: { ...d.bindings, ...(saved?.bindings ?? {}) } };
  }

  get value(): Readonly<GameSettings> {
    return this.data;
  }

  set(patch: Partial<GameSettings>): void {
    this.data = { ...this.data, ...patch };
    storage.save(KEY, this.data);
    this.emit('change', this.data);
  }

  reset(): void {
    this.data = defaults();
    storage.save(KEY, this.data);
    this.emit('change', this.data);
  }

  /** Should touch controls be shown? */
  get touchEnabled(): boolean {
    const t = this.data.touchControls;
    return t === 'on' || (t === 'auto' && device.isTouch());
  }
}
