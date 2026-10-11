import * as THREE from 'three';

export interface ParticleSpawn {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  size0: number;
  size1: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  /** velocity damping per second */
  drag?: number;
  /** m/s^2 (negative = falls) */
  gravity?: number;
}

const VERT = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
uniform float uScale;
varying vec4 vColor;
#include <fog_pars_vertex>
void main() {
  vColor = aColor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(aSize * uScale / max(0.1, -mvPosition.z), 512.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG_SOFT = /* glsl */ `
varying vec4 vColor;
#include <fog_pars_fragment>
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const FRAG_SPARK = /* glsl */ `
varying vec4 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vColor.rgb * (1.0 + a * 2.0), vColor.a * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * Pooled CPU-simulated point sprites (smoke, dust, sparks, nitro exhaust).
 * One draw call per system; dead particles are swap-removed so only the live range is drawn.
 */
export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly max: number;
  private count = 0;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly col: Float32Array;
  private readonly alpha0: Float32Array;
  private readonly drag: Float32Array;
  private readonly grav: Float32Array;
  private readonly aPos: THREE.BufferAttribute;
  private readonly aCol: THREE.BufferAttribute;
  private readonly aSize: THREE.BufferAttribute;
  private readonly material: THREE.ShaderMaterial;
  /** Spawn budget multiplier from the graphics quality. */
  budget = 1;

  constructor(max: number, kind: 'smoke' | 'additive' | 'spark') {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max * 2);
    this.col = new Float32Array(max * 3);
    this.alpha0 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.aCol.setUsage(THREE.DynamicDrawUsage);
    this.aSize.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize);
    g.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: kind === 'spark' ? FRAG_SPARK : FRAG_SOFT,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 500 } }]),
      transparent: true,
      depthWrite: false,
      blending: kind === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending,
      fog: kind === 'smoke',
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = kind === 'smoke' ? 5 : 6;
  }

  get alive(): number {
    return this.count;
  }

  setScale(scale: number): void {
    this.material.uniforms.uScale.value = scale;
  }

  spawn(p: ParticleSpawn): void {
    let i: number;
    if (this.count < this.max) i = this.count++;
    else i = Math.floor(Math.random() * this.max);
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx;
    this.vel[i * 3 + 1] = p.vy;
    this.vel[i * 3 + 2] = p.vz;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.size[i * 2] = p.size0;
    this.size[i * 2 + 1] = p.size1;
    this.col[i * 3] = p.r;
    this.col[i * 3 + 1] = p.g;
    this.col[i * 3 + 2] = p.b;
    this.alpha0[i] = p.alpha;
    this.drag[i] = p.drag ?? 1;
    this.grav[i] = p.gravity ?? 0;
  }

  private copy(from: number, to: number): void {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
      this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    this.size[to * 2] = this.size[from * 2];
    this.size[to * 2 + 1] = this.size[from * 2 + 1];
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.alpha0[to] = this.alpha0[from];
    this.drag[to] = this.drag[from];
    this.grav[to] = this.grav[from];
  }

  update(dt: number): void {
    const ap = this.aPos.array as Float32Array;
    const ac = this.aCol.array as Float32Array;
    const as = this.aSize.array as Float32Array;
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.count--;
        if (i !== this.count) this.copy(this.count, i);
        continue;
      }
      const damp = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= damp;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * damp + this.grav[i] * dt;
      this.vel[i * 3 + 2] *= damp;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      ap[i * 3] = this.pos[i * 3];
      ap[i * 3 + 1] = this.pos[i * 3 + 1];
      ap[i * 3 + 2] = this.pos[i * 3 + 2];
      ac[i * 4] = this.col[i * 3];
      ac[i * 4 + 1] = this.col[i * 3 + 1];
      ac[i * 4 + 2] = this.col[i * 3 + 2];
      // fade in quickly, fade out slowly
      ac[i * 4 + 3] = this.alpha0[i] * Math.min(1, t * 8) * (1 - t);
      as[i] = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * t;
      i++;
    }
    this.points.geometry.setDrawRange(0, this.count);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }

  clear(): void {
    this.count = 0;
    this.points.geometry.setDrawRange(0, 0);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
