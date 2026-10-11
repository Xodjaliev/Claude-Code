import * as THREE from 'three';

/** Ring buffer of tyre-mark quads laid on the road surface. */
export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private readonly max: number;
  private next = 0;
  private readonly positions: Float32Array;
  private readonly alphas: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly alphaAttr: THREE.BufferAttribute;
  /** last point per wheel id */
  private last = new Map<number, { x: number; y: number; z: number; px: number; pz: number; a: number }>();

  constructor(maxSegments: number) {
    this.max = maxSegments;
    this.positions = new Float32Array(maxSegments * 4 * 3);
    this.alphas = new Float32Array(maxSegments * 4);
    const idx = new Uint32Array(maxSegments * 6);
    for (let i = 0; i < maxSegments; i++) {
      const a = i * 4;
      idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('alpha', this.alphaAttr);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float alpha;
        varying float vAlpha;
        #include <fog_pars_vertex>
        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = vec4(0.02, 0.02, 0.02, vAlpha);
          #include <fog_fragment>
        }`,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      transparent: true,
      depthWrite: false,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /** Add a point for a wheel. intensity 0 breaks the strip. */
  add(wheelId: number, x: number, y: number, z: number, dirX: number, dirZ: number, intensity: number, width = 0.26): void {
    if (intensity <= 0.02) {
      this.last.delete(wheelId);
      return;
    }
    // perpendicular to motion
    const len = Math.hypot(dirX, dirZ) || 1;
    const px = (-dirZ / len) * width * 0.5;
    const pz = (dirX / len) * width * 0.5;
    const prev = this.last.get(wheelId);
    const a = Math.min(0.75, intensity * 0.8);
    if (prev) {
      const d = Math.hypot(x - prev.x, z - prev.z);
      if (d < 0.35) return;
      if (d < 4) {
        const i = this.next;
        this.next = (this.next + 1) % this.max;
        const o = i * 12;
        const yy = y + 0.025;
        const py = prev.y + 0.025;
        this.positions.set(
          [prev.x - prev.px, py, prev.z - prev.pz, prev.x + prev.px, py, prev.z + prev.pz, x - px, yy, z - pz, x + px, yy, z + pz],
          o,
        );
        this.alphas.set([prev.a, prev.a, a, a], i * 4);
        this.posAttr.addUpdateRange(o, 12);
        this.alphaAttr.addUpdateRange(i * 4, 4);
        this.posAttr.needsUpdate = true;
        this.alphaAttr.needsUpdate = true;
      }
    }
    this.last.set(wheelId, { x, y, z, px, pz, a });
  }

  clear(): void {
    this.positions.fill(0);
    this.alphas.fill(0);
    this.posAttr.clearUpdateRanges();
    this.alphaAttr.clearUpdateRanges();
    this.posAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.last.clear();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
