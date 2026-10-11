import * as THREE from 'three';
import { Random } from './Random';

/**
 * Procedural canvas textures. Everything visual in the game is generated at runtime,
 * so no binary assets are needed. Results are cached by key.
 */

let maxAnisotropy = 4;
const cache = new Map<string, THREE.Texture>();

export function setMaxAnisotropy(value: number): void {
  maxAnisotropy = Math.max(1, value);
}

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

interface TexOptions {
  repeat?: boolean;
  srgb?: boolean;
  mipmaps?: boolean;
}

export function canvasTexture(key: string, w: number, h: number, draw: Draw, opts: TexOptions = {}): THREE.CanvasTexture {
  const cached = cache.get(key);
  if (cached) return cached as THREE.CanvasTexture;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.repeat !== false) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = opts.mipmaps !== false;
  tex.minFilter = opts.mipmaps === false ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Clears the texture cache (textures are disposed). */
export function disposeTextureCache(): void {
  cache.forEach((t) => t.dispose());
  cache.clear();
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Random, _base: [number, number, number], amount: number, density = 1): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (density < 1 && rng.next() > density) continue;
    const n = (rng.next() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Random, count: number, color: string, minR: number, maxR: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const r = rng.range(minR, maxR);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * rng.range(0.4, 1);
    ctx.fillStyle = g;
    // draw wrapped so the texture tiles seamlessly
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

export type RoadMarkingStyle = 'city' | 'desert' | 'mountain';

/** Asphalt with lane markings. U runs across the road (0 = left edge), V runs along it (one tile = 24 m). */
export function roadTexture(style: RoadMarkingStyle): THREE.CanvasTexture {
  return canvasTexture(`road-${style}`, 512, 1024, (ctx, w, h) => {
    const rng = new Random(style.length * 977 + 11);
    ctx.fillStyle = style === 'desert' ? '#4a4744' : '#3b3c3f';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 60, 'rgba(20,20,22,1)', 20, 90, 0.25);
    blotches(ctx, w, h, rng, 40, 'rgba(110,110,110,1)', 10, 60, 0.12);
    // tyre wear lines along the lanes
    const lanes = style === 'city' ? [0.125, 0.375, 0.625, 0.875] : [0.25, 0.75];
    for (const lane of lanes) {
      for (const off of [-0.06, 0.06]) {
        const g = ctx.createLinearGradient((lane + off) * w - 18, 0, (lane + off) * w + 18, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, 'rgba(15,15,15,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect((lane + off) * w - 18, 0, 36, h);
      }
    }
    speckle(ctx, w, h, rng, [128, 128, 128], 34);

    const white = '#e9e9e4';
    const yellow = '#f2b62b';
    const line = (u: number, width: number, color: string, dash: number[] | null) => {
      ctx.fillStyle = color;
      const x = u * w - width / 2;
      if (!dash) {
        ctx.fillRect(x, 0, width, h);
        return;
      }
      // dash pattern in pixels along V (1024 px = 24 m)
      const [on, off] = dash;
      for (let y = 0; y < h; y += on + off) ctx.fillRect(x, y, width, on);
    };
    line(0.025, 7, white, null);
    line(0.975, 7, white, null);
    if (style === 'city') {
      line(0.25, 5, white, [170, 170]);
      line(0.5, 5, yellow, null);
      line(0.75, 5, white, [170, 170]);
    } else if (style === 'desert') {
      line(0.49, 5, yellow, null);
      line(0.51, 5, yellow, null);
    } else {
      line(0.5, 6, white, [128, 128]);
    }
    // weathering on the paint
    ctx.globalCompositeOperation = 'multiply';
    blotches(ctx, w, h, rng, 30, 'rgba(90,90,90,1)', 8, 30, 0.35);
    ctx.globalCompositeOperation = 'source-over';
  });
}

export function asphaltTexture(): THREE.CanvasTexture {
  return canvasTexture('asphalt', 512, 512, (ctx, w, h) => {
    const rng = new Random(42);
    ctx.fillStyle = '#323336';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 50, 'rgba(15,15,18,1)', 20, 80, 0.3);
    speckle(ctx, w, h, rng, [128, 128, 128], 30);
  });
}

export function concreteTexture(tint = '#8d8b86'): THREE.CanvasTexture {
  return canvasTexture(`concrete-${tint}`, 256, 256, (ctx, w, h) => {
    const rng = new Random(7);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 30, 'rgba(60,60,60,1)', 10, 50, 0.18);
    blotches(ctx, w, h, rng, 20, 'rgba(200,200,200,1)', 10, 40, 0.1);
    speckle(ctx, w, h, rng, [128, 128, 128], 22);
  });
}

export function sidewalkTexture(): THREE.CanvasTexture {
  return canvasTexture('sidewalk', 256, 256, (ctx, w, h) => {
    const rng = new Random(9);
    ctx.fillStyle = '#7b7a76';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rng, [128, 128, 128], 26);
    ctx.strokeStyle = 'rgba(40,40,40,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((i * w) / 4, 0);
      ctx.lineTo((i * w) / 4, h);
      ctx.stroke();
    }
  });
}

export function sandTexture(): THREE.CanvasTexture {
  return canvasTexture('sand', 512, 512, (ctx, w, h) => {
    const rng = new Random(3);
    ctx.fillStyle = '#d2a56a';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 70, 'rgba(180,120,60,1)', 20, 90, 0.25);
    blotches(ctx, w, h, rng, 50, 'rgba(240,210,160,1)', 20, 70, 0.2);
    // wind ripples
    ctx.strokeStyle = 'rgba(150,100,50,0.18)';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 9) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const yy = y + Math.sin((x / w) * Math.PI * 4 + y * 0.31) * 3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    speckle(ctx, w, h, rng, [128, 128, 128], 26);
  });
}

export function grassTexture(): THREE.CanvasTexture {
  return canvasTexture('grass', 512, 512, (ctx, w, h) => {
    const rng = new Random(5);
    ctx.fillStyle = '#4c6b2f';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 80, 'rgba(40,70,25,1)', 20, 80, 0.4);
    blotches(ctx, w, h, rng, 60, 'rgba(120,130,60,1)', 15, 60, 0.25);
    for (let i = 0; i < 9000; i++) {
      const x = rng.range(0, w);
      const y = rng.range(0, h);
      ctx.strokeStyle = rng.chance(0.5) ? 'rgba(90,130,50,0.5)' : 'rgba(30,55,20,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng.range(-2, 2), y - rng.range(2, 6));
      ctx.stroke();
    }
  });
}

export function rockTexture(tint = '#7d736a'): THREE.CanvasTexture {
  return canvasTexture(`rock-${tint}`, 512, 512, (ctx, w, h) => {
    const rng = new Random(13);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 90, 'rgba(50,45,40,1)', 10, 70, 0.35);
    blotches(ctx, w, h, rng, 60, 'rgba(190,180,165,1)', 10, 60, 0.2);
    ctx.strokeStyle = 'rgba(35,30,28,0.45)';
    for (let i = 0; i < 60; i++) {
      ctx.lineWidth = rng.range(1, 3);
      ctx.beginPath();
      let x = rng.range(0, w);
      let y = rng.range(0, h);
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += rng.range(-30, 30);
        y += rng.range(-12, 12);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // horizontal strata
    for (let y = 0; y < h; y += rng.range(12, 40)) {
      ctx.fillStyle = `rgba(${rng.chance(0.5) ? '255,240,220' : '40,30,25'},0.08)`;
      ctx.fillRect(0, y, w, rng.range(3, 10));
    }
    speckle(ctx, w, h, rng, [128, 128, 128], 30);
  });
}

export function gravelTexture(): THREE.CanvasTexture {
  return canvasTexture('gravel', 256, 256, (ctx, w, h) => {
    const rng = new Random(17);
    ctx.fillStyle = '#7a756c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const v = rng.int(70, 170);
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      ctx.beginPath();
      ctx.arc(rng.range(0, w), rng.range(0, h), rng.range(0.8, 2.6), 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function curbTexture(): THREE.CanvasTexture {
  return canvasTexture('curb', 64, 256, (ctx, w, h) => {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d8261e' : '#f2f2f2';
      ctx.fillRect(0, (i * h) / 4, w, h / 4);
    }
    const rng = new Random(2);
    speckle(ctx, w, h, rng, [128, 128, 128], 18);
  });
}

export function checkerTexture(): THREE.CanvasTexture {
  return canvasTexture('checker', 256, 64, (ctx, w, h) => {
    const n = 16;
    const s = w / n;
    for (let y = 0; y < h / s; y++)
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#f4f4f4' : '#141414';
        ctx.fillRect(x * s, y * s, s, s);
      }
  });
}

export type BuildingStyle = 'glass' | 'office' | 'brick';

/** Building facade: 8 window columns x 16 floors per tile. Returns albedo + emissive (lit windows). */
export function buildingTextures(style: BuildingStyle, variant: number): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const cols = 8;
  const rows = 16;
  const W = 256;
  const H = 512;
  const rng = new Random(variant * 131 + style.length * 17);
  const lit: boolean[] = [];
  const litColor: string[] = [];
  const warm = ['#ffd58a', '#ffe2a8', '#fff1d0', '#bfe3ff', '#ffc27a'];
  for (let i = 0; i < cols * rows; i++) {
    lit.push(rng.chance(style === 'glass' ? 0.42 : 0.35));
    litColor.push(rng.pick(warm));
  }
  const cw = W / cols;
  const rh = H / rows;
  const map = canvasTexture(`bld-${style}-${variant}`, W, H, (ctx) => {
    const r2 = new Random(variant + 99);
    if (style === 'glass') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#30465e');
      g.addColorStop(1, '#1b2737');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const v = r2.range(-12, 12);
          ctx.fillStyle = `rgb(${50 + v},${78 + v},${105 + v})`;
          ctx.fillRect(c * cw + 1.5, r * rh + 2, cw - 3, rh - 4);
        }
      ctx.fillStyle = '#9aa6b3';
      for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * rh - 1, W, 2);
    } else {
      ctx.fillStyle = style === 'brick' ? '#6e3f32' : '#8c8a84';
      ctx.fillRect(0, 0, W, H);
      speckle(ctx, W, H, r2, [128, 128, 128], 24);
      if (style === 'brick') {
        ctx.fillStyle = 'rgba(30,15,10,0.25)';
        for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      }
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const mx = style === 'brick' ? 9 : 5;
          const my = style === 'brick' ? 8 : 6;
          ctx.fillStyle = '#20262d';
          ctx.fillRect(c * cw + mx, r * rh + my, cw - mx * 2, rh - my * 2);
          ctx.fillStyle = 'rgba(160,190,220,0.25)';
          ctx.fillRect(c * cw + mx, r * rh + my, cw - mx * 2, 3);
        }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let r = 0; r < rows; r++) ctx.fillRect(0, r * rh, W, 2);
    }
  });
  const emissive = canvasTexture(`bld-${style}-${variant}-e`, W, H, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!lit[i]) continue;
        const mx = style === 'glass' ? 2 : style === 'brick' ? 9 : 5;
        const my = style === 'glass' ? 3 : style === 'brick' ? 8 : 6;
        ctx.fillStyle = litColor[i];
        ctx.globalAlpha = 0.55 + rng.next() * 0.45;
        ctx.fillRect(c * cw + mx, r * rh + my, cw - mx * 2, rh - my * 2);
      }
    ctx.globalAlpha = 1;
  });
  return { map, emissive };
}

const BRANDS: { name: string; slogan: string; bg: [string, string]; fg: string }[] = [
  { name: 'NITRO COLA', slogan: 'TASTE THE BOOST', bg: ['#e0182d', '#7a0010'], fg: '#ffffff' },
  { name: 'APEX TIRES', slogan: 'GRIP EVERY CORNER', bg: ['#111111', '#2b2b2b'], fg: '#ffd400' },
  { name: 'VELOCITY', slogan: 'RUSH HOUR. EVERY HOUR.', bg: ['#00c2ff', '#3a1cff'], fg: '#ffffff' },
  { name: 'TURBO FUEL', slogan: '102 OCTANE POWER', bg: ['#ff8a00', '#ff2d55'], fg: '#1a0a00' },
  { name: 'HYPERDRIVE', slogan: 'ELECTRIFY THE NIGHT', bg: ['#14ff9c', '#0b6b58'], fg: '#04140f' },
  { name: 'NEON RADIO', slogan: '88.8 FM  NON-STOP BEATS', bg: ['#ff2bd6', '#4b0f8f'], fg: '#ffffff' },
  { name: 'QUANTUM', slogan: 'ENERGY DRINK', bg: ['#202a7a', '#05081f'], fg: '#7fe8ff' },
  { name: 'SKYLINE', slogan: 'LUXURY RESIDENCES', bg: ['#e8e2d4', '#b7a98c'], fg: '#2b2418' },
];

export const BILLBOARD_COUNT = BRANDS.length;

export function billboardTexture(index: number): THREE.CanvasTexture {
  const b = BRANDS[index % BRANDS.length];
  return canvasTexture(`bb-${index % BRANDS.length}`, 512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, b.bg[0]);
    g.addColorStop(1, b.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 110 - 60, h);
      ctx.lineTo(i * 110 + 40, 0);
      ctx.lineTo(i * 110 + 80, 0);
      ctx.lineTo(i * 110 - 20, h);
      ctx.fill();
    }
    ctx.fillStyle = b.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 900 86px Arial Black, Arial, sans-serif';
    ctx.fillText(b.name, w / 2, h * 0.43, w * 0.9);
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText(b.slogan, w / 2, h * 0.76, w * 0.9);
    ctx.strokeStyle = b.fg;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.globalAlpha = 1;
  });
}

/** Banner strip used on top of trackside walls: alternating sponsor panels. Tile = 32 m. */
export function wallBannerTexture(): THREE.CanvasTexture {
  return canvasTexture('wall-banner', 1024, 64, (ctx, w, h) => {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const b = BRANDS[(i * 3) % BRANDS.length];
      const g = ctx.createLinearGradient(i * (w / n), 0, (i + 1) * (w / n), 0);
      g.addColorStop(0, b.bg[0]);
      g.addColorStop(1, b.bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(i * (w / n), 0, w / n, h);
      ctx.fillStyle = b.fg;
      ctx.font = 'italic 900 40px Arial Black, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name, (i + 0.5) * (w / n), h / 2 + 2, w / n - 20);
    }
  });
}

export function startBannerTexture(text: string): THREE.CanvasTexture {
  return canvasTexture(`start-banner-${text}`, 1024, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#0b0f1a');
    g.addColorStop(0.5, '#1b2440');
    g.addColorStop(1, '#0b0f1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const s = 16;
    for (let x = 0; x < w; x += s)
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = (x / s + y) % 2 === 0 ? '#fff' : '#111';
        ctx.fillRect(x, y * s, s, s);
        ctx.fillRect(x, h - (y + 1) * s, s, s);
      }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 64px Arial Black, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

export function tunnelTexture(style: 'city' | 'rock'): THREE.CanvasTexture {
  return canvasTexture(`tunnel-${style}`, 256, 256, (ctx, w, h) => {
    const rng = new Random(21);
    if (style === 'city') {
      ctx.fillStyle = '#9a9890';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(60,60,60,0.6)';
      ctx.lineWidth = 2;
      for (let y = 0; y <= h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 0; x <= w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.fillStyle = '#d8b52a';
      ctx.fillRect(0, h - 26, w, 10);
      speckle(ctx, w, h, rng, [128, 128, 128], 20);
    } else {
      ctx.fillStyle = '#6e665e';
      ctx.fillRect(0, 0, w, h);
      blotches(ctx, w, h, rng, 50, 'rgba(40,35,30,1)', 10, 50, 0.4);
      speckle(ctx, w, h, rng, [128, 128, 128], 36);
    }
  });
}

export function radialGlowTexture(): THREE.CanvasTexture {
  return canvasTexture(
    'radial-glow',
    128,
    128,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { repeat: false },
  );
}

/** Soft dark blob used as a cheap contact shadow / ambient occlusion under cars. */
export function contactShadowTexture(): THREE.CanvasTexture {
  return canvasTexture(
    'contact-shadow',
    128,
    256,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.scale(1, 1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
    { repeat: false },
  );
}

export function numberDecalTexture(num: number, color: string): THREE.CanvasTexture {
  return canvasTexture(
    `num-${num}-${color}`,
    256,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.font = 'italic 900 150px Arial Black, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(num), w / 2, h / 2 + 8);
    },
    { repeat: false },
  );
}

export function headlightTexture(): THREE.CanvasTexture {
  return canvasTexture(
    'headlight-cone',
    128,
    256,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,250,235,0.9)');
      g.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(w * 0.4, 0);
      ctx.lineTo(w * 0.6, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    },
    { repeat: false },
  );
}

/** Neutral grey detail texture for vertex-coloured terrain. */
export function terrainDetailTexture(kind: 'grain' | 'rock'): THREE.CanvasTexture {
  return canvasTexture(`terrain-${kind}`, 512, 512, (ctx, w, h) => {
    const rng = new Random(kind === 'grain' ? 77 : 78);
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 80, 'rgba(120,120,120,1)', 15, 70, 0.3);
    blotches(ctx, w, h, rng, 60, 'rgba(240,240,240,1)', 10, 50, 0.25);
    if (kind === 'rock') {
      ctx.strokeStyle = 'rgba(70,70,70,0.4)';
      for (let i = 0; i < 80; i++) {
        ctx.lineWidth = rng.range(1, 2.5);
        ctx.beginPath();
        let x = rng.range(0, w);
        let y = rng.range(0, h);
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += rng.range(-25, 25);
          y += rng.range(-10, 10);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    speckle(ctx, w, h, rng, [128, 128, 128], 40);
  });
}

/** Skyline facade: vertical light columns that look fine when stretched. */
export function skylineTexture(): THREE.CanvasTexture {
  return canvasTexture('skyline', 128, 256, (ctx, w, h) => {
    const rng = new Random(99);
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, w, h);
    for (let x = 2; x < w; x += 6)
      for (let y = 2; y < h; y += 5) {
        if (rng.chance(0.3)) {
          ctx.fillStyle = rng.chance(0.7) ? '#ffcf86' : '#9fd8ff';
          ctx.globalAlpha = rng.range(0.4, 1);
          ctx.fillRect(x, y, 3, 2);
        }
      }
    ctx.globalAlpha = 1;
  });
}
