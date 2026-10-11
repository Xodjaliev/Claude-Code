import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { QUALITY, GraphicsQuality, QualityProfile } from './QualityPresets';

/** Radial motion blur + nitro chromatic aberration + vignette, applied in linear HDR. */
const SpeedShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAmount: { value: 0 },
    uNitro: { value: 0 },
    uVignette: { value: 0.35 },
    uCenter: { value: new THREE.Vector2(0.5, 0.48) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uNitro;
    uniform float uVignette;
    uniform vec2 uCenter;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - uCenter;
      float dist = length(dir);
      float strength = uAmount * smoothstep(0.12, 0.75, dist);
      vec3 col = vec3(0.0);
      float total = 0.0;
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        float w = 1.0 - t * 0.6;
        col += texture2D(tDiffuse, vUv - dir * strength * 0.045 * t).rgb * w;
        total += w;
      }
      col /= total;
      if (uNitro > 0.001) {
        vec2 off = dir * uNitro * 0.004;
        col.r = mix(col.r, texture2D(tDiffuse, vUv + off).r, 0.7 * uNitro);
        col.b = mix(col.b, texture2D(tDiffuse, vUv - off).b, 0.7 * uNitro);
        col += vec3(0.01, 0.03, 0.09) * uNitro * smoothstep(0.45, 1.0, dist);
      }
      col *= 1.0 - uVignette * smoothstep(0.38, 1.0, dist);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/** Owns the WebGL renderer and the post-processing chain, rebuilt when quality changes. */
export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  profile: QualityProfile;
  quality: GraphicsQuality;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private gtao: GTAOPass | null = null;
  private speed: ShaderPass | null = null;
  private fxaa: FXAAPass | null = null;
  private width = 1;
  private height = 1;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  bloomStrength = 0.5;
  bloomThreshold = 1;
  speedAmount = 0;
  nitroAmount = 0;
  motionBlurEnabled = true;

  constructor(container: HTMLElement, quality: GraphicsQuality) {
    this.quality = quality;
    this.profile = QUALITY[quality];
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'game-canvas';
    this.setQuality(quality);
  }

  get pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.profile.pixelRatioCap) * this.profile.renderScale;
  }

  setQuality(q: GraphicsQuality): void {
    this.quality = q;
    this.profile = QUALITY[q];
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.buildComposer();
    this.setSize(this.width, this.height);
  }

  private buildComposer(): void {
    this.composer?.dispose();
    this.composer = null;
    this.renderPass = null;
    this.bloom = null;
    this.gtao?.dispose();
    this.gtao = null;
    this.speed = null;
    this.fxaa = null;
    const p = this.profile;
    if (!p.postFx) return;
    const pr = this.pixelRatio;
    const target = new THREE.WebGLRenderTarget(Math.max(1, this.width * pr), Math.max(1, this.height * pr), {
      type: THREE.HalfFloatType,
      samples: p.msaa,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(pr);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    composer.addPass(this.renderPass);
    if (p.ao) {
      this.gtao = new GTAOPass(new THREE.Scene(), new THREE.PerspectiveCamera(), this.width, this.height);
      this.gtao.blendIntensity = 0.85;
      composer.addPass(this.gtao);
    }
    if (p.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), this.bloomStrength, 0.4, 0.88);
      composer.addPass(this.bloom);
    }
    if (p.motionBlur) {
      this.speed = new ShaderPass(SpeedShader);
      composer.addPass(this.speed);
    }
    composer.addPass(new OutputPass());
    if (p.fxaa) {
      this.fxaa = new FXAAPass();
      composer.addPass(this.fxaa);
    }
    this.composer = composer;
  }

  setSize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.domElement.style.width = `${this.width}px`;
    this.renderer.domElement.style.height = `${this.height}px`;
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(this.width, this.height);
    }
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /** Point size scale for particle shaders (pixels per world unit at distance 1). */
  pointScale(camera: THREE.PerspectiveCamera): number {
    return (this.height * this.pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.composer || !this.renderPass) {
      this.renderer.render(scene, camera);
      return;
    }
    if (this.scene !== scene || this.camera !== camera) {
      this.scene = scene;
      this.camera = camera;
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      if (this.gtao) {
        this.gtao.scene = scene;
        this.gtao.camera = camera;
      }
    }
    if (this.bloom) {
      this.bloom.strength = this.bloomStrength;
      this.bloom.threshold = this.bloomThreshold;
    }
    if (this.speed) {
      const u = this.speed.uniforms as typeof SpeedShader.uniforms;
      u.uAmount.value = this.motionBlurEnabled ? this.speedAmount : 0;
      u.uNitro.value = this.nitroAmount;
    }
    this.composer.render();
  }

  dispose(): void {
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
