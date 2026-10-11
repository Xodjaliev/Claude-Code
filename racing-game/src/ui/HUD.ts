import type { RaceEvent, RaceSession } from '../game/RaceSession';
import type { GameSettings } from '../game/Settings';
import { formatDelta, formatTime, ordinal } from '../utils/format';
import { h } from './dom';
import { Minimap } from './Minimap';

const NITRO_SEGMENTS = 10;

/** In-race heads-up display: position, lap, times, speedometer, nitro, minimap, messages. */
export class HUD {
  readonly root: HTMLElement;
  private readonly posEl: HTMLElement;
  private readonly lapEl: HTMLElement;
  private readonly lapTimeEl: HTMLElement;
  private readonly totalEl: HTMLElement;
  private readonly bestEl: HTMLElement;
  private readonly lastEl: HTMLElement;
  private readonly spdEl: HTMLElement;
  private readonly unitEl: HTMLElement;
  private readonly gearEl: HTMLElement;
  private readonly nitroBar: HTMLElement;
  private readonly nitroCells: HTMLElement[] = [];
  private readonly center: HTMLElement;
  private readonly countdownEl: HTMLElement;
  private readonly wrongWay: HTMLElement;
  private readonly drift: HTMLElement;
  private readonly driftVal: HTMLElement;
  private readonly gauge: HTMLCanvasElement;
  private readonly gctx: CanvasRenderingContext2D;
  readonly pauseBtn: HTMLButtonElement;
  private readonly minimap = new Minimap(220);
  private session: RaceSession | null = null;
  private off: (() => void) | null = null;
  private lastLapTime: number | null = null;
  private lastSpeed = -1;

  constructor(onPause: () => void) {
    this.posEl = h('div', { class: 'hud-big' }, '1', h('small', null, ' / 8'));
    this.lapEl = h('div', { class: 'hud-big' }, '1', h('small', null, ' / 3'));
    this.lapTimeEl = h('b', null, '00:00.000');
    this.totalEl = h('b', null, '00:00.000');
    this.bestEl = h('b', null, '--:--.---');
    this.lastEl = h('b', null, '--:--.---');
    this.spdEl = h('div', { class: 'spd' }, '0');
    this.unitEl = h('div', { class: 'unit' }, 'KM/H');
    this.gearEl = h('div', { class: 'gear' }, 'N');
    this.nitroBar = h('div', { class: 'nitro-bar' });
    for (let i = 0; i < NITRO_SEGMENTS; i++) {
      const c = h('i');
      this.nitroCells.push(c);
      this.nitroBar.appendChild(c);
    }
    this.gauge = h('canvas', { width: 460, height: 460 });
    this.gctx = this.gauge.getContext('2d')!;
    this.countdownEl = h('div', { class: 'countdown' });
    this.center = h('div', { class: 'hud-center' }, this.countdownEl);
    this.wrongWay = h('div', { class: 'wrong-way' }, 'WRONG WAY');
    this.driftVal = h('span', null, '0');
    this.drift = h('div', { class: 'drift-meter' }, h('small', null, 'DRIFT'), this.driftVal);
    this.pauseBtn = h('button', { class: 'hud-pause-btn', onClick: () => onPause() }, 'II');

    this.root = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud-block hud-pos' }, h('div', null, h('div', { class: 'hud-label' }, 'POSITION'), this.posEl)),
      h('div', { class: 'hud-block hud-lap' }, h('div', null, h('div', { class: 'hud-label' }, 'LAP'), this.lapEl)),
      h(
        'div',
        { class: 'hud-block hud-times' },
        h(
          'div',
          null,
          h('div', { class: 'time-row' }, h('span', null, 'LAP'), this.lapTimeEl),
          h('div', { class: 'time-row' }, h('span', null, 'TOTAL'), this.totalEl),
          h('div', { class: 'time-row' }, h('span', null, 'LAST'), this.lastEl),
          h('div', { class: 'time-row best' }, h('span', null, 'BEST'), this.bestEl),
        ),
      ),
      h('div', { class: 'hud-minimap' }, this.minimap.canvas),
      h(
        'div',
        { class: 'hud-speedo' },
        h('div', { class: 'speedo-gauge' }, this.gauge, h('div', { class: 'speedo-read' }, this.spdEl, this.unitEl, this.gearEl)),
        h('div', { class: 'nitro-wrap' }, h('div', { class: 'hud-label' }, 'NITRO'), this.nitroBar),
      ),
      this.center,
      this.wrongWay,
      this.drift,
      this.pauseBtn,
    );
  }

  attach(session: RaceSession): void {
    this.detach();
    this.session = session;
    this.minimap.setTrack(session.track, session.track.def.accent);
    this.off = session.on('event', (e) => this.onEvent(e));
    this.lastLapTime = null;
    this.countdownEl.textContent = '';
    this.wrongWay.style.display = 'none';
    this.center.querySelectorAll('.hud-message').forEach((m) => m.remove());
  }

  detach(): void {
    this.off?.();
    this.off = null;
    this.session = null;
  }

  private message(text: string, sub?: string, subClass = ''): void {
    const el = h('div', { class: 'hud-message' }, text, sub ? h('small', { class: subClass }, sub) : null);
    this.center.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  private showCount(text: string, go = false): void {
    this.countdownEl.textContent = text;
    this.countdownEl.className = `countdown ${go ? 'go' : ''}`;
    // restart the animation
    void this.countdownEl.offsetWidth;
    this.countdownEl.classList.add('pop');
  }

  private onEvent(e: RaceEvent): void {
    switch (e.type) {
      case 'countdown':
        this.showCount(String(e.value));
        break;
      case 'go':
        this.showCount('GO!', true);
        break;
      case 'checkpoint':
        this.message('CHECKPOINT', e.delta === null ? formatTime(e.split) : formatDelta(e.delta), e.delta === null ? '' : e.delta <= 0 ? 'pos' : 'neg');
        break;
      case 'lap':
        this.lastLapTime = e.time;
        if (e.finalLap) this.message('FINAL LAP', e.best ? `NEW BEST ${formatTime(e.time)}` : formatTime(e.time), e.best ? 'pos' : '');
        else this.message(`LAP ${e.lap + 1}`, e.best ? `NEW BEST ${formatTime(e.time)}` : formatTime(e.time), e.best ? 'pos' : '');
        break;
      case 'finish':
        this.message('FINISH!', `${ordinal(e.position)} PLACE`, 'pos');
        break;
      case 'drift':
        this.message(`DRIFT +${e.score}`);
        break;
      case 'wrongWay':
        this.wrongWay.style.display = e.active ? 'block' : 'none';
        break;
      case 'reset':
        this.message('CAR RESET');
        break;
      case 'nitro':
        break;
    }
  }

  update(settings: Readonly<GameSettings>): void {
    const s = this.session;
    if (!s) return;
    const r = s.player;
    const car = r.car;
    this.posEl.firstChild!.textContent = String(r.position);
    (this.posEl.lastChild as HTMLElement).textContent = ` / ${s.racers.length}`;
    this.lapEl.firstChild!.textContent = String(s.displayLap);
    (this.lapEl.lastChild as HTMLElement).textContent = ` / ${s.laps}`;
    this.lapTimeEl.textContent = formatTime(r.finished ? r.lapTimes[r.lapTimes.length - 1] : s.currentLapTime);
    this.totalEl.textContent = formatTime(r.finished ? r.finishTime : s.time);
    this.bestEl.textContent = formatTime(r.bestLap);
    this.lastEl.textContent = formatTime(this.lastLapTime ?? (r.lapTimes.length ? r.lapTimes[r.lapTimes.length - 1] : null));

    const mph = settings.units === 'mph';
    const speed = Math.round(car.speedKmh * (mph ? 0.621371 : 1));
    if (speed !== this.lastSpeed) {
      this.spdEl.textContent = String(speed);
      this.lastSpeed = speed;
    }
    this.unitEl.textContent = mph ? 'MPH' : 'KM/H';
    this.gearEl.textContent = car.gearbox.gearLabel;
    const n = car.physics.nitroAmount;
    const lit = Math.round(n * NITRO_SEGMENTS);
    this.nitroCells.forEach((c, i) => c.classList.toggle('on', i < lit));
    this.nitroBar.classList.toggle('active', car.physics.nitroActive);
    this.drawGauge(car.gearbox.rpmRatio, car.physics.nitroActive);

    const drift = s.driftInProgress;
    this.drift.style.opacity = drift > 20 ? '1' : '0';
    if (drift > 20) this.driftVal.textContent = String(drift);

    const next = r.finished ? null : s.track.sample(Math.round(s.track.checkpoints[r.nextCheckpoint] / s.track.spacing));
    this.minimap.draw(
      s.cars.map((c) => ({ x: c.position.x, z: c.position.z, color: c.config.color, player: c.isPlayer })),
      next ? { x: next.x, z: next.z } : null,
    );
  }

  private drawGauge(rpm: number, nitro: boolean): void {
    const ctx = this.gctx;
    const w = this.gauge.width;
    const cx = w / 2;
    const cy = w / 2;
    const r = w * 0.43;
    ctx.clearRect(0, 0, w, w);
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
    // redline zone
    ctx.strokeStyle = 'rgba(255,60,80,0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0 + (a1 - a0) * 0.85, a1);
    ctx.stroke();
    const v = Math.max(0, Math.min(1, rpm));
    const grad = ctx.createLinearGradient(0, w, w, 0);
    grad.addColorStop(0, nitro ? '#7fe8ff' : '#2f6bff');
    grad.addColorStop(0.7, nitro ? '#ffffff' : '#00e5ff');
    grad.addColorStop(1, v > 0.85 ? '#ff3b52' : '#ff2bd6');
    ctx.strokeStyle = grad;
    ctx.shadowColor = nitro ? '#7fe8ff' : '#00e5ff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * v);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // ticks
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10;
      const r0 = r - 22;
      const r1 = r - (i % 2 === 0 ? 38 : 30);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  }
}
