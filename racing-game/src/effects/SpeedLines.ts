/** Screen-space speed streaks drawn on a 2D canvas overlay (works on every quality level). */
export class SpeedLines {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private lines: { a: number; r: number; speed: number; len: number; w: number }[] = [];
  intensity = 0;
  nitro = 0;
  private w = 1;
  private h = 1;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'speed-lines';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    for (let i = 0; i < 70; i++) this.lines.push(this.makeLine(true));
  }

  private makeLine(randomR: boolean) {
    return { a: Math.random() * Math.PI * 2, r: randomR ? Math.random() : 0.25 + Math.random() * 0.2, speed: 1.2 + Math.random() * 1.8, len: 0.05 + Math.random() * 0.12, w: 0.6 + Math.random() * 1.6 };
  }

  resize(w: number, h: number): void {
    const scale = 0.6;
    this.w = Math.max(1, Math.round(w * scale));
    this.h = Math.max(1, Math.round(h * scale));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  update(dt: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    const k = Math.min(1, this.intensity + this.nitro * 0.8);
    if (k < 0.02) return;
    const cx = this.w / 2;
    const cy = this.h * 0.47;
    const maxR = Math.hypot(this.w, this.h) * 0.55;
    ctx.lineCap = 'round';
    const count = Math.floor(this.lines.length * k);
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      l.r += l.speed * dt * (0.8 + k * 1.6);
      if (l.r > 1.1) Object.assign(l, this.makeLine(false));
      if (i >= count) continue;
      const r0 = Math.max(0.28, l.r) * maxR;
      const r1 = r0 + l.len * maxR * (0.6 + k);
      const ca = Math.cos(l.a);
      const sa = Math.sin(l.a);
      const alpha = Math.min(1, (l.r - 0.28) * 3) * 0.55 * k;
      if (alpha <= 0) continue;
      ctx.strokeStyle = this.nitro > 0.1 ? `rgba(150,210,255,${alpha})` : `rgba(255,255,255,${alpha * 0.8})`;
      ctx.lineWidth = l.w * (1 + this.nitro);
      ctx.beginPath();
      ctx.moveTo(cx + ca * r0, cy + sa * r0);
      ctx.lineTo(cx + ca * r1, cy + sa * r1);
      ctx.stroke();
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.intensity = 0;
    this.nitro = 0;
  }
}
