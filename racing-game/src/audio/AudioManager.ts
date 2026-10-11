import type { EngineProfile } from '../car/CarCatalog';
import { AUDIO_ASSETS, SoundId } from './AudioAssets';
import { Ambience, AmbienceTheme } from './Ambience';
import { EngineSound } from './EngineSound';
import { MusicPlayer, MusicTrack } from './MusicPlayer';

export interface LoopHandle {
  setLevel(level: number): void;
  setPitch(p: number): void;
  stop(): void;
}

export interface PlayOptions {
  volume?: number;
  pitch?: number;
  /** -1 left .. 1 right */
  pan?: number;
}

export type LoopKind = 'skid' | 'scrape' | 'nitro' | 'wind' | 'rumble';

/**
 * Web Audio graph:  sources -> (sfx | music | ambience) buses -> master -> compressor -> out.
 * The AudioContext is created lazily on the first user gesture (browser autoplay policy).
 */
export class AudioManager {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  sfxBus!: GainNode;
  /** Separate bus for in-race sounds so they can be ducked while paused. */
  raceBus!: GainNode;
  musicBus!: GainNode;
  ambienceBus!: GainNode;
  private noise!: AudioBuffer;
  private buffers = new Map<SoundId, AudioBuffer>();
  readonly music = new MusicPlayer(this);
  readonly ambience = new Ambience(this);
  private volumes = { master: 0.8, sfx: 0.9, music: 0.6 };
  private pendingMusic: MusicTrack | null = null;

  get ready(): boolean {
    return !!this.ctx;
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.raceBus = ctx.createGain();
    this.raceBus.connect(this.sfxBus);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.ambienceBus = ctx.createGain();
    this.ambienceBus.connect(this.sfxBus);
    this.noise = this.makeNoise(3);
    this.applyVolumes();
    void this.loadAssets();
    if (this.pendingMusic) {
      this.music.play(this.pendingMusic);
      this.pendingMusic = null;
    }
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  get noiseBuffer(): AudioBuffer {
    return this.noise;
  }

  private async loadAssets(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const entries = Object.entries(AUDIO_ASSETS) as [SoundId, string][];
    await Promise.all(
      entries.map(async ([id, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const data = await res.arrayBuffer();
          this.buffers.set(id, await ctx.decodeAudioData(data));
        } catch {
          /* fall back to synthesis */
        }
      }),
    );
    // restart music if a file arrived for the current track
    const cur = this.music.current;
    if (cur && this.buffers.has(cur === 'menu' ? 'music_menu' : 'music_race')) this.music.play(cur, true);
  }

  buffer(id: SoundId): AudioBuffer | undefined {
    return this.buffers.get(id);
  }

  setVolumes(master: number, sfx: number, music: number): void {
    this.volumes = { master, sfx, music };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.55, t, 0.05);
  }

  /** Duck in-race audio (pause menu). */
  setRacePaused(paused: boolean): void {
    if (!this.ctx) return;
    this.raceBus.gain.setTargetAtTime(paused ? 0 : 1, this.ctx.currentTime, 0.08);
  }

  playMusic(track: MusicTrack): void {
    if (!this.ctx) {
      this.pendingMusic = track;
      return;
    }
    this.music.play(track);
  }

  createEngine(profile: EngineProfile, isPlayer: boolean): EngineSound | null {
    if (!this.ctx) return null;
    return new EngineSound(this, profile, isPlayer);
  }

  startAmbience(theme: AmbienceTheme): void {
    if (this.ctx) this.ambience.start(theme);
  }

  stopAmbience(): void {
    this.ambience.stop();
  }

  // ------------------------------------------------------------------ one-shots
  play(id: SoundId, opts: PlayOptions = {}, bus: 'ui' | 'race' = 'ui'): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const out = ctx.createGain();
    out.gain.value = opts.volume ?? 1;
    let dest: AudioNode = out;
    if (opts.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      out.connect(p);
      dest = p;
    }
    dest.connect(bus === 'race' ? this.raceBus : this.sfxBus);
    const file = this.buffers.get(id);
    if (file) {
      const src = ctx.createBufferSource();
      src.buffer = file;
      src.playbackRate.value = opts.pitch ?? 1;
      src.connect(out);
      src.start();
      return;
    }
    this.synth(id, out, opts.pitch ?? 1);
  }

  private tone(out: AudioNode, type: OscillatorType, freq: number, start: number, dur: number, vol: number, endFreq?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  private noiseBurst(out: AudioNode, start: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, endFreq?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const off = Math.random() * 2;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, start);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(out);
    src.start(start, off, dur + 0.05);
  }

  private synth(id: SoundId, out: GainNode, pitch: number): void {
    const t = this.ctx!.currentTime + 0.005;
    switch (id) {
      case 'sfx_click':
        this.tone(out, 'triangle', 1400 * pitch, t, 0.06, 0.25, 900);
        break;
      case 'sfx_hover':
        this.tone(out, 'sine', 2200 * pitch, t, 0.03, 0.06);
        break;
      case 'sfx_error':
        this.tone(out, 'square', 220, t, 0.12, 0.12);
        this.tone(out, 'square', 180, t + 0.12, 0.16, 0.12);
        break;
      case 'sfx_purchase':
        [660, 880, 1320].forEach((f, i) => this.tone(out, 'triangle', f, t + i * 0.07, 0.22, 0.25));
        this.noiseBurst(out, t, 0.3, 0.05, 'highpass', 6000);
        break;
      case 'sfx_levelup':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(out, 'triangle', f, t + i * 0.08, 0.35, 0.22));
        break;
      case 'sfx_countdown':
        this.tone(out, 'square', 660, t, 0.22, 0.18);
        this.tone(out, 'sine', 1320, t, 0.22, 0.08);
        break;
      case 'sfx_go':
        this.tone(out, 'square', 990, t, 0.7, 0.2);
        this.tone(out, 'sine', 1980, t, 0.7, 0.1);
        this.tone(out, 'sawtooth', 495, t, 0.5, 0.06);
        break;
      case 'sfx_checkpoint':
        this.tone(out, 'sine', 1046, t, 0.12, 0.2);
        this.tone(out, 'sine', 1568, t + 0.08, 0.25, 0.2);
        break;
      case 'sfx_lap':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(out, 'triangle', f, t + i * 0.06, 0.3, 0.2));
        break;
      case 'sfx_finish':
        [523, 659, 784].forEach((f) => this.tone(out, 'sawtooth', f, t, 1.4, 0.07));
        [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(out, 'triangle', f, t + 0.15 + i * 0.1, 0.9, 0.12));
        break;
      case 'sfx_shift':
        this.noiseBurst(out, t, 0.05, 0.35, 'bandpass', 1800 * pitch, 2);
        this.tone(out, 'sine', 140, t, 0.09, 0.4, 60);
        break;
      case 'sfx_backfire':
        this.noiseBurst(out, t, 0.09, 0.8, 'lowpass', 900 * pitch, 1);
        this.tone(out, 'sine', 95, t, 0.1, 0.6, 45);
        break;
      case 'sfx_crash':
        this.noiseBurst(out, t, 0.45, 0.9, 'lowpass', 1600 * pitch, 0.8, 300);
        this.noiseBurst(out, t, 0.25, 0.35, 'bandpass', 3200 * pitch, 6);
        this.tone(out, 'sine', 80, t, 0.3, 0.8, 40);
        this.tone(out, 'triangle', 1900 * pitch, t + 0.01, 0.35, 0.05, 1500);
        break;
      case 'sfx_nitro':
        this.noiseBurst(out, t, 0.7, 0.5, 'bandpass', 350, 1.2, 3500);
        this.tone(out, 'sine', 70, t, 0.4, 0.5, 45);
        break;
      case 'music_menu':
      case 'music_race':
        break;
    }
  }

  // ------------------------------------------------------------------ continuous loops
  loop(kind: LoopKind): LoopHandle {
    const ctx = this.ctx;
    if (!ctx) return { setLevel() {}, setPitch() {}, stop() {} };
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.raceBus);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const nodes: AudioScheduledSourceNode[] = [src];
    let pitchTarget: AudioParam[] = [];
    let baseFreqs: number[] = [];
    const t = ctx.currentTime;
    switch (kind) {
      case 'skid': {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1500;
        bp.Q.value = 2.5;
        src.connect(bp).connect(out);
        // tonal squeal
        const sq = ctx.createGain();
        sq.gain.value = 0.18;
        sq.connect(out);
        for (const f of [1180, 1235]) {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = f;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 7 + Math.random() * 3;
          const lfoG = ctx.createGain();
          lfoG.gain.value = 25;
          lfo.connect(lfoG).connect(o.frequency);
          o.connect(sq);
          o.start(t);
          lfo.start(t);
          nodes.push(o, lfo);
          pitchTarget.push(o.frequency);
          baseFreqs.push(f);
        }
        pitchTarget.push(bp.frequency);
        baseFreqs.push(1500);
        break;
      }
      case 'scrape': {
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.value = 3500;
        hp.Q.value = 1.5;
        const am = ctx.createGain();
        am.gain.value = 0.6;
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 31;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 0.4;
        lfo.connect(lfoG).connect(am.gain);
        src.connect(hp).connect(am).connect(out);
        lfo.start(t);
        nodes.push(lfo);
        pitchTarget = [hp.frequency];
        baseFreqs = [3500];
        break;
      }
      case 'nitro': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2400;
        bp.Q.value = 0.8;
        const g2 = ctx.createGain();
        g2.gain.value = 0.35;
        src.connect(lp).connect(out);
        src.connect(bp).connect(g2).connect(out);
        pitchTarget = [lp.frequency];
        baseFreqs = [1100];
        break;
      }
      case 'wind': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 500;
        lp.Q.value = 0.7;
        src.connect(lp).connect(out);
        pitchTarget = [lp.frequency];
        baseFreqs = [500];
        break;
      }
      case 'rumble': {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 38;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 160;
        o.connect(lp).connect(out);
        o.start(t);
        nodes.push(o);
        pitchTarget = [o.frequency];
        baseFreqs = [38];
        src.disconnect();
        break;
      }
    }
    src.start(t, Math.random() * 2);
    let stopped = false;
    return {
      setLevel(level: number) {
        if (stopped) return;
        out.gain.setTargetAtTime(Math.max(0, level), ctx.currentTime, 0.05);
      },
      setPitch(p: number) {
        if (stopped) return;
        pitchTarget.forEach((param, i) => param.setTargetAtTime(baseFreqs[i] * p, ctx.currentTime, 0.08));
      },
      stop() {
        if (stopped) return;
        stopped = true;
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
        const end = ctx.currentTime + 0.3;
        nodes.forEach((n) => {
          try {
            n.stop(end);
          } catch {
            /* already stopped */
          }
        });
        setTimeout(() => out.disconnect(), 400);
      },
    };
  }
}
