import type { InputManager } from '../game/Input';
import { clamp } from '../utils/math';
import { h } from './dom';

/** On-screen controls for phones/tablets: steering buttons or wheel, gas, brake, nitro, drift. */
export class TouchControls {
  readonly root: HTMLElement;
  private readonly input: InputManager;
  private mode: 'buttons' | 'wheel' = 'buttons';
  private steerButtons: HTMLElement[] = [];
  private wheel: HTMLElement;
  private left = 0;
  private right = 0;

  constructor(input: InputManager) {
    this.input = input;
    this.root = h('div', { class: 'touch' });
    const t = input.touch;
    const hold = (cls: string, label: string, onDown: () => void, onUp: () => void) => {
      const el = h('div', { class: `tbtn ${cls}` }, label);
      const down = (e: PointerEvent) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.classList.add('pressed');
        onDown();
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        el.classList.remove('pressed');
        onUp();
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', () => {
        el.classList.remove('pressed');
        onUp();
      });
      this.root.appendChild(el);
      return el;
    };
    hold('gas', 'GAS', () => (t.throttle = 1), () => (t.throttle = 0));
    hold('brake', 'BRAKE', () => (t.brake = 1), () => (t.brake = 0));
    hold('nitro', 'NITRO', () => (t.nitro = true), () => (t.nitro = false));
    hold('drift', 'DRIFT', () => (t.handbrake = true), () => (t.handbrake = false));
    this.steerButtons.push(
      hold('left', '◀', () => ((this.left = 1), this.applySteer()), () => ((this.left = 0), this.applySteer())),
      hold('right', '▶', () => ((this.right = 1), this.applySteer()), () => ((this.right = 0), this.applySteer())),
    );
    hold('cam', 'CAM', () => input.trigger('camera'), () => {});
    hold('reset', 'RESET', () => input.trigger('reset'), () => {});

    // steering wheel
    const marker = h('div', { class: 'marker' });
    const inner = h('div', { style: 'position:absolute;inset:0' }, h('div', { class: 'spoke' }), h('div', { class: 'spoke v' }), marker);
    this.wheel = h('div', { class: 'wheel' }, inner);
    let startAngle = 0;
    let base = 0;
    let active: number | null = null;
    const angleOf = (e: PointerEvent) => {
      const r = this.wheel.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    this.wheel.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      active = e.pointerId;
      this.wheel.setPointerCapture(e.pointerId);
      startAngle = angleOf(e);
      base = t.steer * (Math.PI / 2);
    });
    this.wheel.addEventListener('pointermove', (e) => {
      if (active !== e.pointerId) return;
      let d = angleOf(e) - startAngle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      const ang = clamp(base + d, -Math.PI / 2, Math.PI / 2);
      t.steer = ang / (Math.PI / 2);
      inner.style.transform = `rotate(${ang}rad)`;
    });
    const release = () => {
      active = null;
      t.steer = 0;
      inner.style.transition = 'transform 0.15s';
      inner.style.transform = 'rotate(0rad)';
      setTimeout(() => (inner.style.transition = ''), 160);
    };
    this.wheel.addEventListener('pointerup', release);
    this.wheel.addEventListener('pointercancel', release);
    this.root.appendChild(this.wheel);
    this.setMode('buttons');
  }

  private applySteer(): void {
    this.input.touch.steer = this.right - this.left;
  }

  setMode(mode: 'buttons' | 'wheel'): void {
    this.mode = mode;
    this.steerButtons.forEach((b) => (b.style.display = mode === 'buttons' ? 'grid' : 'none'));
    this.wheel.style.display = mode === 'wheel' ? 'block' : 'none';
  }

  get currentMode(): 'buttons' | 'wheel' {
    return this.mode;
  }

  show(visible: boolean): void {
    this.root.classList.toggle('visible', visible);
    this.input.touch.active = visible;
    if (!visible) {
      const t = this.input.touch;
      t.throttle = t.brake = t.steer = 0;
      t.nitro = t.handbrake = false;
    }
  }
}
