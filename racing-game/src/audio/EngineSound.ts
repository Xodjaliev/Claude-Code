import type { EngineProfile } from '../car/CarCatalog';
import type { AudioManager } from './AudioManager';

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = amount * 60 + 1;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/**
 * Synthesised engine: detuned saw + sub square at the firing frequency, through a waveshaper
 * and an RPM/load-tracking low-pass, plus intake noise and an optional turbo whistle.
 * AI engines use the same voice with distance attenuation and stereo panning.
 */
export class EngineSound {
  private readonly am: AudioManager;
  private readonly profile: EngineProfile;
  private readonly oscs: OscillatorNode[] = [];
  private readonly ratios: number[] = [];
  private readonly filter: BiquadFilterNode;
  private readonly shaper: WaveShaperNode;
  private readonly out: GainNode;
  private readonly intakeGain: GainNode;
  private readonly intakeFilter: BiquadFilterNode;
  private readonly turboOsc: OscillatorNode | null = null;
  private readonly turboGain: GainNode | null = null;
  private readonly panner: StereoPannerNode;
  private readonly noiseSrc: AudioBufferSourceNode;
  private readonly isPlayer: boolean;
  private stopped = false;
  private lastThrottle = 0;

  constructor(am: AudioManager, profile: EngineProfile, isPlayer: boolean) {
    this.am = am;
    this.profile = profile;
    this.isPlayer = isPlayer;
    const ctx = am.ctx!;
    const t = ctx.currentTime;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.panner = ctx.createStereoPanner();
    this.out.connect(this.panner).connect(am.raceBus);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 2.2;
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = distortionCurve(profile.grit);
    this.shaper.oversample = isPlayer ? '2x' : 'none';
    const mix = ctx.createGain();
    mix.gain.value = 0.32;
    mix.connect(this.shaper).connect(this.filter).connect(this.out);

    const voices: [OscillatorType, number, number][] = isPlayer
      ? [
          ['sawtooth', 1, 0.5],
          ['sawtooth', 1.007, 0.4],
          ['square', 0.5, 0.35],
          ['triangle', 2, 0.18],
        ]
      : [
          ['sawtooth', 1, 0.6],
          ['square', 0.5, 0.35],
        ];
    for (const [type, ratio, vol] of voices) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 40;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(mix);
      o.start(t);
      this.oscs.push(o);
      this.ratios.push(ratio);
    }

    // intake / exhaust noise
    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = am.noiseBuffer;
    this.noiseSrc.loop = true;
    this.intakeFilter = ctx.createBiquadFilter();
    this.intakeFilter.type = 'bandpass';
    this.intakeFilter.Q.value = 1.2;
    this.intakeGain = ctx.createGain();
    this.intakeGain.gain.value = 0;
    this.noiseSrc.connect(this.intakeFilter).connect(this.intakeGain).connect(this.out);
    this.noiseSrc.start(t, Math.random() * 2);

    if (profile.turbo && isPlayer) {
      this.turboOsc = ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboGain = ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turboOsc.connect(this.turboGain).connect(this.out);
      this.turboOsc.start(t);
    }
  }

  /**
   * @param rpm engine rpm
   * @param throttle 0..1
   * @param volume overall level (distance attenuation for AI)
   * @param pan -1..1
   */
  update(rpm: number, throttle: number, nitro: boolean, volume: number, pan = 0): void {
    if (this.stopped) return;
    const ctx = this.am.ctx!;
    const t = ctx.currentTime;
    const p = this.profile;
    const ratio = Math.min(1.05, rpm / p.maxRpm);
    const fire = (rpm / 60) * (p.cylinders / 2);
    const tc = 0.03;
    for (let i = 0; i < this.oscs.length; i++) this.oscs[i].frequency.setTargetAtTime(fire * this.ratios[i], t, tc);
    const load = Math.max(throttle, nitro ? 1 : 0);
    const cutoff = 300 + ratio * 2600 + load * 2200 + (nitro ? 1500 : 0);
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.05);
    const level = (0.28 + load * 0.45 + ratio * 0.25 + (nitro ? 0.25 : 0)) * volume;
    this.out.gain.setTargetAtTime(level * (this.isPlayer ? 0.55 : 0.45), t, 0.05);
    this.intakeFilter.frequency.setTargetAtTime(fire * 3 + 400, t, 0.05);
    this.intakeGain.gain.setTargetAtTime((0.05 + load * 0.25) * (0.4 + ratio), t, 0.05);
    this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05);
    if (this.turboOsc && this.turboGain) {
      this.turboOsc.frequency.setTargetAtTime(1800 + ratio * 3200, t, 0.1);
      this.turboGain.gain.setTargetAtTime(load > 0.5 ? ratio * 0.025 : 0, t, 0.15);
      // blow-off valve on throttle lift at high boost
      if (this.lastThrottle > 0.7 && throttle < 0.2 && ratio > 0.55) this.blowOff();
    }
    this.lastThrottle = throttle;
  }

  private blowOff(): void {
    const ctx = this.am.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.am.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(3500, t);
    f.frequency.exponentialRampToValueAtTime(1200, t + 0.35);
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random(), 0.45);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const ctx = this.am.ctx!;
    const t = ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    const end = t + 0.3;
    this.oscs.forEach((o) => o.stop(end));
    this.noiseSrc.stop(end);
    this.turboOsc?.stop(end);
    setTimeout(() => this.panner.disconnect(), 500);
  }
}
