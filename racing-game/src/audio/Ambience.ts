import type { AudioManager } from './AudioManager';

export type AmbienceTheme = 'city' | 'desert' | 'mountain';

/** Looping background soundscapes with random one-shot details (horns, birds, gusts). */
export class Ambience {
  private readonly am: AudioManager;
  private nodes: AudioScheduledSourceNode[] = [];
  private out: GainNode | null = null;
  private timer: number | null = null;
  private theme: AmbienceTheme | null = null;

  constructor(am: AudioManager) {
    this.am = am;
  }

  start(theme: AmbienceTheme): void {
    this.stop();
    const ctx = this.am.ctx;
    if (!ctx) return;
    this.theme = theme;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 1);
    out.connect(this.am.ambienceBus);
    this.out = out;
    const src = ctx.createBufferSource();
    src.buffer = this.am.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (theme === 'city') {
      f.type = 'lowpass';
      f.frequency.value = 260;
      g.gain.value = 0.22;
    } else {
      f.type = 'bandpass';
      f.frequency.value = theme === 'desert' ? 450 : 700;
      f.Q.value = 0.6;
      g.gain.value = 0.12;
      // slow gusts
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const lg = ctx.createGain();
      lg.gain.value = 0.07;
      lfo.connect(lg).connect(g.gain);
      const lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 0.05;
      const lg2 = ctx.createGain();
      lg2.gain.value = 250;
      lfo2.connect(lg2).connect(f.frequency);
      lfo.start();
      lfo2.start();
      this.nodes.push(lfo, lfo2);
    }
    src.connect(f).connect(g).connect(out);
    src.start(0, Math.random() * 2);
    this.nodes.push(src);
    this.timer = window.setInterval(() => this.detail(), 1500);
  }

  private detail(): void {
    const ctx = this.am.ctx;
    if (!ctx || !this.out || Math.random() > 0.35) return;
    const t = ctx.currentTime;
    const out = this.out;
    const tone = (freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine', end?: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, start);
      if (end) o.frequency.exponentialRampToValueAtTime(end, start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      o.connect(lp).connect(g).connect(out);
      o.start(start);
      o.stop(start + dur + 0.05);
    };
    if (this.theme === 'city') {
      // distant car horn or siren
      if (Math.random() < 0.7) {
        const f = 350 + Math.random() * 120;
        tone(f, t, 0.35, 0.015, 'square');
        tone(f * 1.26, t, 0.35, 0.01, 'square');
      } else {
        for (let i = 0; i < 4; i++) tone(700, t + i * 0.9, 0.45, 0.01, 'sine', 950);
      }
    } else if (this.theme === 'mountain') {
      // birds
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) tone(2600 + Math.random() * 1500, t + i * 0.13, 0.09, 0.02, 'sine', 3600 + Math.random() * 1200);
    } else {
      // hawk cry
      if (Math.random() < 0.4) tone(1900, t, 0.7, 0.012, 'sine', 1300);
    }
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.am.ctx;
    if (ctx && this.out) {
      const out = this.out;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      const nodes = this.nodes;
      setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* noop */
          }
        });
        out.disconnect();
      }, 900);
    }
    this.nodes = [];
    this.out = null;
    this.theme = null;
  }
}
