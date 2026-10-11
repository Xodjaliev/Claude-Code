import type { ControlState } from '../physics/VehiclePhysics';
import { clamp, moveTowards } from '../utils/math';

export type BindableAction = 'throttle' | 'brake' | 'left' | 'right' | 'handbrake' | 'nitro' | 'camera' | 'reset' | 'pause';
export const BINDABLE_ACTIONS: BindableAction[] = ['throttle', 'brake', 'left', 'right', 'handbrake', 'nitro', 'camera', 'reset', 'pause'];
export const ACTION_LABELS: Record<BindableAction, string> = {
  throttle: 'Accelerate',
  brake: 'Brake / Reverse',
  left: 'Steer Left',
  right: 'Steer Right',
  handbrake: 'Handbrake / Drift',
  nitro: 'Nitro',
  camera: 'Change Camera',
  reset: 'Reset Car',
  pause: 'Pause',
};

/** Primary (rebindable) key per action. Arrow keys always work as a secondary set. */
export type KeyBindings = Record<BindableAction, string>;

export const DEFAULT_BINDINGS: KeyBindings = {
  throttle: 'KeyW',
  brake: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  handbrake: 'Space',
  nitro: 'ShiftLeft',
  camera: 'KeyC',
  reset: 'KeyR',
  pause: 'Escape',
};

const SECONDARY: Partial<Record<BindableAction, string[]>> = {
  throttle: ['ArrowUp'],
  brake: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  nitro: ['ShiftRight'],
  pause: ['KeyP'],
};

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt', AltRight: 'R-Alt', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
  };
  return map[code] ?? code;
}

/** Analog state written by the on-screen touch controls. */
export interface TouchState {
  active: boolean;
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  nitro: boolean;
}

type ActionListener = (action: 'camera' | 'reset' | 'pause') => void;

/** Merges keyboard, gamepad and touch into a single ControlState. */
export class InputManager {
  private keys = new Set<string>();
  bindings: KeyBindings = { ...DEFAULT_BINDINGS };
  steeringSensitivity = 1;
  readonly touch: TouchState = { active: false, throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
  private keyboardSteer = 0;
  private listeners = new Set<ActionListener>();
  private gamepadPrev: boolean[] = [];
  /** When set, the next key press is captured for rebinding instead of driving. */
  private captureCb: ((code: string) => void) | null = null;
  enabled = true;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
  }

  onAction(fn: ActionListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  captureNextKey(cb: (code: string) => void): void {
    this.captureCb = cb;
  }

  private emit(a: 'camera' | 'reset' | 'pause'): void {
    this.listeners.forEach((fn) => fn(a));
  }

  private matches(action: BindableAction, code: string): boolean {
    return this.bindings[action] === code || (SECONDARY[action]?.includes(code) ?? false);
  }

  private isDown(action: BindableAction): boolean {
    if (this.keys.has(this.bindings[action])) return true;
    const sec = SECONDARY[action];
    return !!sec && sec.some((k) => this.keys.has(k));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.captureCb) {
      e.preventDefault();
      const cb = this.captureCb;
      this.captureCb = null;
      cb(e.code);
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (this.matches('pause', e.code)) this.emit('pause');
      else if (this.matches('camera', e.code)) this.emit('camera');
      else if (this.matches('reset', e.code)) this.emit('reset');
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  /** Fill `out` with the current merged controls. */
  read(dt: number, out: ControlState): void {
    if (!this.enabled) {
      out.throttle = out.brake = out.steer = 0;
      out.handbrake = out.nitro = false;
      return;
    }
    // keyboard
    const left = this.isDown('left');
    const right = this.isDown('right');
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    const rate = (target === 0 ? 7 : Math.sign(target) !== Math.sign(this.keyboardSteer) && this.keyboardSteer !== 0 ? 9 : 4.2) * this.steeringSensitivity;
    this.keyboardSteer = moveTowards(this.keyboardSteer, target, rate * dt);
    let throttle = this.isDown('throttle') ? 1 : 0;
    let brake = this.isDown('brake') ? 1 : 0;
    let steer = this.keyboardSteer;
    let handbrake = this.isDown('handbrake');
    let nitro = this.isDown('nitro');

    // gamepad
    let pads: (Gamepad | null)[] = [];
    try {
      pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    } catch {
      /* gamepad API blocked (e.g. permissions policy inside an iframe) */
    }
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const ax = pad.axes[0] ?? 0;
      if (Math.abs(ax) > 0.12) steer = clamp(Math.sign(ax) * Math.pow((Math.abs(ax) - 0.12) / 0.88, 1.3) * this.steeringSensitivity, -1, 1);
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      if (rt > 0.05) throttle = Math.max(throttle, rt);
      if (lt > 0.05) brake = Math.max(brake, lt);
      if (pad.buttons[0]?.pressed) nitro = true;
      if (pad.buttons[1]?.pressed || pad.buttons[2]?.pressed) handbrake = true;
      const edges: [number, 'camera' | 'reset' | 'pause'][] = [
        [3, 'camera'],
        [8, 'reset'],
        [9, 'pause'],
      ];
      for (const [b, a] of edges) {
        const pressed = !!pad.buttons[b]?.pressed;
        if (pressed && !this.gamepadPrev[b]) this.emit(a);
        this.gamepadPrev[b] = pressed;
      }
      break;
    }

    // touch
    if (this.touch.active) {
      throttle = Math.max(throttle, this.touch.throttle);
      brake = Math.max(brake, this.touch.brake);
      if (Math.abs(this.touch.steer) > Math.abs(steer)) steer = clamp(this.touch.steer * this.steeringSensitivity, -1, 1);
      handbrake = handbrake || this.touch.handbrake;
      nitro = nitro || this.touch.nitro;
    }

    out.throttle = throttle;
    out.brake = brake;
    out.steer = steer;
    out.handbrake = handbrake;
    out.nitro = nitro;
  }

  /** Trigger an edge action from UI buttons (touch pause/camera). */
  trigger(a: 'camera' | 'reset' | 'pause'): void {
    this.emit(a);
  }

  clear(): void {
    this.keys.clear();
    this.keyboardSteer = 0;
  }
}
