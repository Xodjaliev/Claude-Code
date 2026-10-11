import type { Track } from '../tracks/Track';

export interface MinimapDot {
  x: number;
  z: number;
  color: string;
  player: boolean;
}

/** Track outline rendered once to an offscreen canvas; car dots drawn every frame. */
export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private track: Track | null = null;
  private scale = 1;
  private ox = 0;
  private oz = 0;
  private size: number;

  constructor(size = 220) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
  }

  setTrack(track: Track, accent = '#00e5ff'): void {
    this.track = track;
    this.bg = drawTrackOutline(track, this.size, accent, 18);
    const b = track.bounds;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    this.scale = (this.size - 36) / span;
    this.ox = (b.minX + b.maxX) / 2;
    this.oz = (b.minZ + b.maxZ) / 2;
  }

  draw(dots: MinimapDot[], nextCheckpoint: { x: number; z: number } | null): void {
    const ctx = this.ctx;
    const s = this.size;
    ctx.clearRect(0, 0, s, s);
    if (!this.track || !this.bg) return;
    ctx.drawImage(this.bg, 0, 0);
    const tx = (x: number) => s / 2 - (x - this.ox) * this.scale;
    const tz = (z: number) => s / 2 - (z - this.oz) * this.scale;
    if (nextCheckpoint) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx(nextCheckpoint.x), tz(nextCheckpoint.z), 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const d of dots) {
      if (d.player) continue;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(tx(d.x), tz(d.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = dots.find((d) => d.player);
    if (p) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(tx(p.x), tz(p.z), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

/**
 * Draws the circuit outline (used by the HUD minimap and the track selection cards).
 * X is mirrored so the map matches the driver's left/right (forward = +Z, left = +X).
 */
export function drawTrackOutline(track: Track, size: number, accent: string, pad = 12): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const b = track.bounds;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  const scale = (size - pad * 2) / span;
  const ox = (b.minX + b.maxX) / 2;
  const oz = (b.minZ + b.maxZ) / 2;
  const tx = (x: number) => size / 2 - (x - ox) * scale;
  const tz = (z: number) => size / 2 - (z - oz) * scale;
  const path = () => {
    ctx.beginPath();
    track.samples.forEach((s, i) => (i === 0 ? ctx.moveTo(tx(s.x), tz(s.z)) : ctx.lineTo(tx(s.x), tz(s.z))));
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  path();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 9;
  ctx.stroke();
  path();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4.5;
  ctx.stroke();
  // tunnels
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4.5;
  let inTunnel = false;
  track.samples.forEach((s) => {
    if (s.tunnel && !inTunnel) {
      ctx.beginPath();
      ctx.moveTo(tx(s.x), tz(s.z));
      inTunnel = true;
    } else if (s.tunnel) ctx.lineTo(tx(s.x), tz(s.z));
    else if (inTunnel) {
      ctx.stroke();
      inTunnel = false;
    }
  });
  if (inTunnel) ctx.stroke();
  // start line
  const s0 = track.samples[0];
  ctx.strokeStyle = '#ff2bd6';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tx(s0.x - s0.rx * 14), tz(s0.z - s0.rz * 14));
  ctx.lineTo(tx(s0.x + s0.rx * 14), tz(s0.z + s0.rz * 14));
  ctx.stroke();
  return c;
}
