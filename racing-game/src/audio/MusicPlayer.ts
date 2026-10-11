import type { AudioManager } from './AudioManager';

export type MusicTrack = 'menu' | 'race';

interface Song {
  bpm: number;
  /** chord roots (MIDI) per bar + chord quality */
  chords: { root: number; minor: boolean }[];
  kick: number[];
  snare: number[];
  hats: number[];
  openHats: number[];
  /** bass steps and octave offsets */
  bass: [number, number][];
  arp: boolean;
  arpFromBar: number;
  pad: number;
  swing: number;
}

const SONGS: Record<MusicTrack, Song> = {
  menu: {
    bpm: 96,
    chords: [
      { root: 57, minor: true },
      { root: 53, minor: false },
      { root: 48, minor: false },
      { root: 55, minor: false },
    ],
    kick: [0, 10],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    openHats: [],
    bass: [
      [0, 0],
      [6, 0],
      [10, 12],
    ],
    arp: true,
    arpFromBar: 0,
    pad: 0.11,
    swing: 0.04,
  },
  race: {
    bpm: 128,
    chords: [
      { root: 57, minor: true },
      { root: 53, minor: false },
      { root: 55, minor: false },
      { root: 52, minor: true },
    ],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [1, 3, 5, 7, 9, 11, 13, 15],
    openHats: [2, 6, 10, 14],
    bass: [
      [0, 0],
      [2, 12],
      [3, 0],
      [4, 0],
      [6, 12],
      [7, 0],
      [8, 0],
      [10, 12],
      [11, 0],
      [12, 0],
      [14, 12],
      [15, 7],
    ],
    arp: true,
    arpFromBar: 4,
    pad: 0.05,
    swing: 0,
  },
};

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Procedural step sequencer (synthwave-style) with reverb and delay.
 * If a music file is registered in AUDIO_ASSETS it is streamed instead.
 */
export class MusicPlayer {
  private readonly am: AudioManager;
  current: MusicTrack | null = null;
  private out: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private fileSrc: AudioBufferSourceNode | null = null;

  constructor(am: AudioManager) {
    this.am = am;
  }

  play(track: MusicTrack, force = false): void {
    if (this.current === track && !force) return;
    this.stop();
    const ctx = this.am.ctx;
    if (!ctx) return;
    this.current = track;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    out.connect(this.am.musicBus);
    this.out = out;

    const file = this.am.buffer(track === 'menu' ? 'music_menu' : 'music_race');
    if (file) {
      const src = ctx.createBufferSource();
      src.buffer = file;
      src.loop = true;
      src.connect(out);
      src.start();
      this.fileSrc = src;
      return;
    }

    // effects
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.35;
    this.reverb.connect(revGain).connect(out);
    this.delay = ctx.createDelay(1);
    const song = SONGS[track];
    this.delay.delayTime.value = (60 / song.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 2500;
    this.delay.connect(dl).connect(fb).connect(this.delay);
    const dGain = ctx.createGain();
    dGain.gain.value = 0.4;
    this.delay.connect(dGain).connect(out);

    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.am.ctx;
    if (ctx && this.out) {
      const out = this.out;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      const src = this.fileSrc;
      setTimeout(() => {
        try {
          src?.stop();
        } catch {
          /* noop */
        }
        out.disconnect();
      }, 1500);
    }
    this.out = null;
    this.fileSrc = null;
    this.reverb = null;
    this.delay = null;
    this.current = null;
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.am.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  private schedule(): void {
    const ctx = this.am.ctx;
    if (!ctx || !this.out || !this.current) return;
    const song = SONGS[this.current];
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const swing = this.step % 2 === 1 ? song.swing : 0;
      this.playStep(song, this.step, this.nextTime + swing, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % (16 * 16);
    }
  }

  private playStep(song: Song, step: number, t: number, stepDur: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = song.chords[bar % song.chords.length];
    const third = chord.minor ? 3 : 4;
    const isRace = this.current === 'race';
    const breakdown = isRace && bar % 16 >= 14; // drop drums for 2 bars every 16
    if (!breakdown) {
      if (song.kick.includes(s)) this.kick(t, isRace ? 0.9 : 0.55);
      if (song.snare.includes(s)) this.snare(t, isRace ? 0.35 : 0.18);
      if (song.hats.includes(s)) this.hat(t, isRace ? 0.07 : 0.04, false);
      if (song.openHats.includes(s)) this.hat(t, 0.06, true);
    }
    for (const [bs, oct] of song.bass) if (bs === s) this.bass(t, midiToFreq(chord.root - 24 + oct), stepDur * (isRace ? 1.6 : 5), isRace ? 0.32 : 0.25);
    if (s === 0) this.pad(t, chord.root, third, stepDur * 16, song.pad);
    if (song.arp && bar >= song.arpFromBar) {
      const notes = [0, third, 7, 12, 7, third];
      const every = isRace ? 1 : 2;
      if (s % every === 0) {
        const idx = Math.floor(s / every) % notes.length;
        const n = chord.root + 12 + notes[idx] + (isRace && bar % 8 >= 4 ? 12 : 0);
        this.pluck(t, midiToFreq(n), stepDur * (isRace ? 0.9 : 1.6), isRace ? 0.05 : 0.06);
      }
    }
    // simple lead hook in the race track
    if (isRace && bar % 8 >= 4 && !breakdown) {
      const hook: Record<number, number> = { 0: 12, 3: 10, 6: 7, 10: 12, 12: 15, 14: 14 };
      if (hook[s] !== undefined) this.lead(t, midiToFreq(chord.root + hook[s]), stepDur * 2.2, 0.05);
    }
  }

  private env(g: GainNode, t: number, attack: number, dur: number, vol: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private kick(t: number, vol: number): void {
    const ctx = this.am.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain();
    this.env(g, t, 0.003, 0.4, vol);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + 0.45);
  }

  private snare(t: number, vol: number): void {
    const ctx = this.am.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.am.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    this.env(g, t, 0.002, 0.22, vol);
    src.connect(f).connect(g);
    g.connect(this.out!);
    g.connect(this.reverb!);
    src.start(t, Math.random() * 2, 0.3);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    const og = ctx.createGain();
    this.env(og, t, 0.002, 0.12, vol * 0.6);
    o.connect(og).connect(this.out!);
    o.start(t);
    o.stop(t + 0.15);
  }

  private hat(t: number, vol: number, open: boolean): void {
    const ctx = this.am.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.am.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = ctx.createGain();
    this.env(g, t, 0.001, open ? 0.18 : 0.045, vol);
    src.connect(f).connect(g).connect(this.out!);
    src.start(t, Math.random() * 2, 0.25);
  }

  private bass(t: number, freq: number, dur: number, vol: number): void {
    const ctx = this.am.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = freq / 2;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.005, dur, vol);
    const g2 = ctx.createGain();
    g2.gain.value = 0.5;
    o.connect(f);
    o2.connect(g2).connect(f);
    f.connect(g).connect(this.out!);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private pad(t: number, root: number, third: number, dur: number, vol: number): void {
    const ctx = this.am.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.setValueAtTime(vol, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
    f.connect(g);
    g.connect(this.out!);
    g.connect(this.reverb!);
    for (const n of [0, third, 7, 12]) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToFreq(root + n);
        o.detune.value = det;
        const og = ctx.createGain();
        og.gain.value = 0.18;
        o.connect(og).connect(f);
        o.start(t);
        o.stop(t + dur * 1.1);
      }
    }
  }

  private pluck(t: number, freq: number, dur: number, vol: number): void {
    const ctx = this.am.ctx!;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3500, t);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.003, dur, vol);
    o.connect(f).connect(g);
    g.connect(this.out!);
    g.connect(this.delay!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private lead(t: number, freq: number, dur: number, vol: number): void {
    const ctx = this.am.ctx!;
    const g = ctx.createGain();
    this.env(g, t, 0.02, dur, vol);
    g.connect(this.out!);
    g.connect(this.reverb!);
    g.connect(this.delay!);
    for (const det of [-8, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.5;
      const vg = ctx.createGain();
      vg.gain.value = 4;
      vib.connect(vg).connect(o.frequency);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2800;
      o.connect(f).connect(g);
      o.start(t);
      vib.start(t);
      o.stop(t + dur + 0.05);
      vib.stop(t + dur + 0.05);
    }
  }
}
