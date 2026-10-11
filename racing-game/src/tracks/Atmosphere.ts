import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { ThemeId } from './TrackCatalog';

/**
 * Lighting, sky, fog and environment reflections for a race.
 * Everything is parameterised by time of day, so day/night cycles or weather
 * can later be added by interpolating AtmosphereParams.
 */

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';
export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = { morning: 'Morning', day: 'Day', sunset: 'Sunset', night: 'Night' };

export interface AtmosphereParams {
  timeOfDay: TimeOfDay;
  night: boolean;
  sunElevation: number;
  sunAzimuth: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fogColor: number;
  fogDensity: number;
  exposure: number;
  envIntensity: number;
  skyIntensity: number;
  turbidity: number;
  rayleigh: number;
  mie: number;
  mieG: number;
  clouds: number;
  bloom: number;
  /** HDR luminance above which pixels bloom (daylight scenes need a high threshold). */
  bloomThreshold: number;
  /** Street lamps & building windows lit. */
  lightsOn: boolean;
  headlights: boolean;
}

const BASE: Record<TimeOfDay, AtmosphereParams> = {
  day: {
    timeOfDay: 'day', night: false, sunElevation: 58, sunAzimuth: 140, sunColor: 0xfff3e0, sunIntensity: 2.5,
    hemiSky: 0xbcd8ff, hemiGround: 0x8a7a66, hemiIntensity: 0.75, fogColor: 0xc9dcef, fogDensity: 0.0009, exposure: 0.85,
    envIntensity: 0.9, skyIntensity: 0.55, turbidity: 3.5, rayleigh: 1.1, mie: 0.004, mieG: 0.8, clouds: 0.3, bloom: 0.35, bloomThreshold: 2.8,
    lightsOn: false, headlights: false,
  },
  morning: {
    timeOfDay: 'morning', night: false, sunElevation: 16, sunAzimuth: 70, sunColor: 0xffd2a1, sunIntensity: 2.8,
    hemiSky: 0xa9c6ee, hemiGround: 0x5d5a4a, hemiIntensity: 0.9, fogColor: 0xc4cfd8, fogDensity: 0.0016, exposure: 1.0,
    envIntensity: 0.85, skyIntensity: 0.6, turbidity: 6, rayleigh: 1.8, mie: 0.006, mieG: 0.85, clouds: 0.4, bloom: 0.4, bloomThreshold: 2.4,
    lightsOn: false, headlights: false,
  },
  sunset: {
    timeOfDay: 'sunset', night: false, sunElevation: 4, sunAzimuth: 250, sunColor: 0xff9a5a, sunIntensity: 2.4,
    hemiSky: 0x8d7fb5, hemiGround: 0x4a3530, hemiIntensity: 0.8, fogColor: 0xd99a78, fogDensity: 0.0014, exposure: 1.05,
    envIntensity: 0.8, skyIntensity: 0.62, turbidity: 8, rayleigh: 2.8, mie: 0.008, mieG: 0.9, clouds: 0.45, bloom: 0.55, bloomThreshold: 1.6,
    lightsOn: true, headlights: true,
  },
  night: {
    timeOfDay: 'night', night: true, sunElevation: 38, sunAzimuth: 200, sunColor: 0x9db4ff, sunIntensity: 0.55,
    hemiSky: 0x2a3560, hemiGround: 0x171320, hemiIntensity: 0.55, fogColor: 0x0d1226, fogDensity: 0.0017, exposure: 1.15,
    envIntensity: 0.9, skyIntensity: 1, turbidity: 2, rayleigh: 0.5, mie: 0.003, mieG: 0.8, clouds: 0, bloom: 0.8, bloomThreshold: 0.95,
    lightsOn: true, headlights: true,
  },
};

export function atmosphereFor(theme: ThemeId, timeOfDay: TimeOfDay): AtmosphereParams {
  const p = { ...BASE[timeOfDay] };
  if (theme === 'desert') {
    if (timeOfDay === 'day') {
      p.fogColor = 0xe4d2b4;
      p.fogDensity = 0.0007;
      p.hemiGround = 0x9a7a52;
      p.turbidity = 5;
      p.sunIntensity = 2.4;
      p.hemiIntensity = 0.65;
      p.exposure = 0.78;
      p.clouds = 0.15;
    }
  } else if (theme === 'mountain') {
    p.fogDensity = timeOfDay === 'night' ? 0.0014 : 0.00105;
    if (timeOfDay === 'day') p.fogColor = 0xb9cde0;
  } else if (theme === 'city') {
    p.fogDensity = timeOfDay === 'night' ? 0.0011 : 0.0009;
    if (timeOfDay === 'night') p.fogColor = 0x161a33;
  }
  return p;
}

const NIGHT_SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const NIGHT_SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uMoonDir;
uniform float uStars;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(max(h, 0.0), 0.45));
  col += uGlow * pow(1.0 - max(h, 0.0), 6.0) * 0.9;
  // stars
  vec3 sp = d * 220.0;
  vec3 cell = floor(sp);
  float r = hash(cell);
  if (r > 0.9965 && d.y > 0.05) {
    vec3 f = fract(sp) - 0.5;
    float s = smoothstep(0.25, 0.0, length(f)) * (r - 0.9965) * 280.0 * uStars;
    col += vec3(s) * smoothstep(0.05, 0.3, d.y);
  }
  // moon
  float m = dot(d, normalize(uMoonDir));
  col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9993, 0.9996, m) * 4.0;
  col += vec3(0.25, 0.3, 0.45) * pow(max(m, 0.0), 64.0) * 0.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function createNightSky(params: AtmosphereParams, sunDir: THREE.Vector3, glow: THREE.Color): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: NIGHT_SKY_VERT,
    fragmentShader: NIGHT_SKY_FRAG,
    uniforms: {
      uTop: { value: new THREE.Color(0x02030a) },
      uHorizon: { value: new THREE.Color(params.fogColor).multiplyScalar(1.1) },
      uGlow: { value: glow },
      uMoonDir: { value: sunDir.clone() },
      uStars: { value: 1 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

function createDaySky(params: AtmosphereParams, sunDir: THREE.Vector3): Sky {
  const sky = new Sky();
  const mat = sky.material as THREE.ShaderMaterial;
  mat.uniforms.skyIntensity = { value: params.skyIntensity };
  mat.fragmentShader = mat.fragmentShader
    .replace('uniform float time;', 'uniform float time;\nuniform float skyIntensity;')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( min( texColor * skyIntensity, vec3( 3.5 ) ), 1.0 );');
  const u = mat.uniforms;
  u.turbidity.value = params.turbidity;
  u.rayleigh.value = params.rayleigh;
  u.mieCoefficient.value = params.mie;
  u.mieDirectionalG.value = params.mieG;
  u.sunPosition.value.copy(sunDir);
  if (u.cloudCoverage) u.cloudCoverage.value = params.clouds;
  if (u.cloudDensity) u.cloudDensity.value = 0.45;
  mat.fog = false;
  sky.frustumCulled = false;
  return sky;
}

export class Atmosphere {
  readonly params: AtmosphereParams;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky: THREE.Mesh;
  readonly sunDir = new THREE.Vector3();
  private envRT: THREE.WebGLRenderTarget | null = null;
  private shadowExtent = 60;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, params: AtmosphereParams, opts: { shadows: boolean; shadowMapSize: number; cityGlow?: boolean }) {
    this.params = params;
    const el = THREE.MathUtils.degToRad(params.sunElevation);
    const az = THREE.MathUtils.degToRad(params.sunAzimuth);
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();

    // ---- sky
    const glow = new THREE.Color(opts.cityGlow ? 0x3a2a55 : 0x1b2244);
    this.sky = params.night ? createNightSky(params, this.sunDir, glow) : createDaySky(params, this.sunDir);
    this.sky.scale.setScalar(params.night ? 5000 : 9000);
    scene.add(this.sky);

    // ---- fog
    scene.fog = new THREE.FogExp2(params.fogColor, params.fogDensity);
    scene.background = new THREE.Color(params.fogColor);

    // ---- lights
    this.sun = new THREE.DirectionalLight(params.sunColor, params.sunIntensity);
    this.sun.castShadow = opts.shadows;
    if (opts.shadows) {
      this.sun.shadow.mapSize.set(opts.shadowMapSize, opts.shadowMapSize);
      this.shadowExtent = opts.shadowMapSize >= 4096 ? 90 : opts.shadowMapSize >= 2048 ? 70 : 55;
      const cam = this.sun.shadow.camera;
      cam.left = -this.shadowExtent;
      cam.right = this.shadowExtent;
      cam.top = this.shadowExtent;
      cam.bottom = -this.shadowExtent;
      cam.near = 1;
      cam.far = 600;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.03;
    }
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(params.hemiSky, params.hemiGround, params.hemiIntensity);
    scene.add(this.hemi);

    renderer.toneMappingExposure = params.exposure;

    // ---- environment map for PBR reflections
    const envScene = new THREE.Scene();
    const envSky = params.night ? createNightSky(params, this.sunDir, glow) : createDaySky(params, this.sunDir);
    envSky.scale.setScalar(50);
    envScene.add(envSky);
    if (opts.cityGlow && (params.night || params.timeOfDay === 'sunset')) {
      // fake city lights / horizon glow so that car paint has something to reflect at night
      const colors = [0xffb35c, 0xfff1c9, 0x5cc8ff, 0xffd59a, 0xff4fd8, 0xfff1c9];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(6 + (i % 3) * 4, 2 + (i % 4)),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(colors[i % colors.length]).multiplyScalar(params.night ? 1.2 : 0.8), side: THREE.DoubleSide }),
        );
        m.position.set(Math.cos(a) * 40, 1 + (i % 5), Math.sin(a) * 40);
        m.lookAt(0, m.position.y, 0);
        envScene.add(m);
      }
      const top = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8899cc).multiplyScalar(0.25), side: THREE.DoubleSide }));
      top.position.y = 30;
      top.rotation.x = Math.PI / 2;
      envScene.add(top);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = pmrem.fromScene(envScene, 0.02, 0.1, 200);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = params.envIntensity;
    pmrem.dispose();
    envScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
  }

  /** Keeps the shadow frustum centred on the action. */
  update(focus: THREE.Vector3, time: number): void {
    const snap = 4;
    const fx = Math.round(focus.x / snap) * snap;
    const fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + this.sunDir.x * 250, focus.y + this.sunDir.y * 250, fz + this.sunDir.z * 250);
    this.sky.position.copy(focus);
    const mat = this.sky.material as THREE.ShaderMaterial;
    if (mat.uniforms.time) mat.uniforms.time.value = time;
  }

  dispose(): void {
    this.envRT?.dispose();
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
    this.sun.shadow.map?.dispose();
  }
}
