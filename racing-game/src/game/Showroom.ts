import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CarDefinition } from '../car/CarCatalog';
import { applyFinish, buildCarModel, CarModel } from '../car/CarModelFactory';
import type { CarConfig } from '../car/Upgrades';
import { damp } from '../utils/math';
import { radialGlowTexture } from '../utils/textures';

export type ShowroomFraming = 'menu' | 'garage' | 'cars' | 'tracks' | 'play' | 'settings';

const FRAMING: Record<ShowroomFraming, { offsetX: number; dist: number; height: number; lookY: number }> = {
  menu: { offsetX: -2.3, dist: 11.5, height: 2.4, lookY: 0.6 },
  garage: { offsetX: 2.3, dist: 10.5, height: 2.6, lookY: 0.55 },
  cars: { offsetX: 2.0, dist: 11, height: 2.3, lookY: 0.2 },
  tracks: { offsetX: 0, dist: 13, height: 3.2, lookY: 0.8 },
  play: { offsetX: 3.0, dist: 12, height: 2.5, lookY: 0.6 },
  settings: { offsetX: 0, dist: 13, height: 2.8, lookY: 0.6 },
};

/** Neon studio with a slowly rotating car on a turntable — background of every menu. */
export class Showroom {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private car: CarModel | null = null;
  private readonly turntable = new THREE.Group();
  private framing: ShowroomFraming = 'menu';
  private cur = { ...FRAMING.menu };
  private angle = 0.6;
  private time = 0;
  private envRT: THREE.WebGLRenderTarget;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly strips: THREE.MeshBasicMaterial[] = [];
  /** User drag rotation (garage). */
  private dragVel = 0;
  private dragging = false;
  private lastX = 0;

  constructor(renderer: THREE.WebGLRenderer, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 400);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.45;
    this.scene.background = new THREE.Color(0x05060b);
    this.scene.fog = new THREE.Fog(0x05060b, 18, 60);

    // floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x07080c, roughness: 0.38, metalness: 0.5 }),
    );
    floor.receiveShadow = true;
    this.scene.add(floor);
    // turntable
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.08, 64), new THREE.MeshStandardMaterial({ color: 0x151822, roughness: 0.35, metalness: 0.8 }));
    disc.position.y = 0.04;
    disc.receiveShadow = true;
    this.scene.add(disc);
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(1.5) });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.68, 0.025, 8, 128).rotateX(Math.PI / 2), this.ringMat);
    ring.position.y = 0.08;
    this.scene.add(ring);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: radialGlowTexture(), color: new THREE.Color(0x04303e), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.position.y = 0.09;
    this.scene.add(glow);
    this.turntable.position.y = 0.08;
    this.scene.add(this.turntable);

    // neon strips in the background
    const colors = [0x00e5ff, 0xff2bd6, 0x7b5cff, 0x00e5ff, 0xff2bd6];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(colors[i]).multiplyScalar(1.4) });
      this.strips.push(m);
      const a = -0.9 + i * 0.45;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 9, 0.08), m);
      strip.position.set(Math.sin(a) * 16, 4.5, -Math.cos(a) * 16);
      this.scene.add(strip);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(30, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(1.1) }));
    bar.position.set(0, 7.5, -12);
    this.scene.add(bar);

    // lights
    this.scene.add(new THREE.HemisphereLight(0x8899cc, 0x0a0a10, 0.35));
    const key = new THREE.SpotLight(0xffffff, 150, 40, 0.55, 0.6, 1.5);
    key.position.set(4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const rimL = new THREE.SpotLight(0x00e5ff, 90, 30, 0.6, 0.8, 1.5);
    rimL.position.set(-7, 4, -5);
    this.scene.add(rimL);
    const rimR = new THREE.SpotLight(0xff2bd6, 90, 30, 0.6, 0.8, 1.5);
    rimR.position.set(7, 4, -5);
    this.scene.add(rimR);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setFraming(f: ShowroomFraming): void {
    this.framing = f;
  }

  /** Rebuild the displayed car (part changes). */
  showCar(def: CarDefinition, config: CarConfig): void {
    if (this.car) {
      this.turntable.remove(this.car.root);
      this.car.dispose();
    }
    this.car = buildCarModel(def, config, { lightsOn: true, shadows: true, interior: false });
    this.car.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.turntable.add(this.car.root);
  }

  /** Cheap live updates (paint / rim colour). */
  updatePaint(config: CarConfig): void {
    if (!this.car) return;
    applyFinish(this.car.paint, config);
    this.car.rimMaterial.color.set(config.rimColor);
  }

  setAccent(color: string): void {
    this.ringMat.color.set(color).multiplyScalar(1.5);
  }

  /** Enable click-drag rotation on an element (garage/cars). */
  attachDrag(el: HTMLElement): void {
    el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.panel, button, input, select')) return;
      this.dragging = true;
      this.lastX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      this.lastX = e.clientX;
      this.angle += dx * 0.008;
      this.dragVel = dx * 0.5;
    });
    window.addEventListener('pointerup', () => (this.dragging = false));
  }

  update(dt: number): void {
    this.time += dt;
    if (!this.dragging) {
      this.dragVel = damp(this.dragVel, 0, 3, dt);
      this.angle += dt * 0.22 + this.dragVel * dt * 0.02;
    }
    this.turntable.rotation.y = this.angle;
    const target = FRAMING[this.framing];
    const c = this.cur;
    c.offsetX = damp(c.offsetX, target.offsetX, 3, dt);
    c.dist = damp(c.dist, target.dist, 3, dt);
    c.height = damp(c.height, target.height, 3, dt);
    c.lookY = damp(c.lookY, target.lookY, 3, dt);
    const sway = Math.sin(this.time * 0.25) * 0.35;
    // camera looks at a point beside the car so the car sits in the free half of the screen
    const right = new THREE.Vector3(1, 0, 0);
    const camPos = new THREE.Vector3(sway, c.height, c.dist);
    this.camera.position.copy(camPos).addScaledVector(right, c.offsetX);
    this.camera.lookAt(right.multiplyScalar(c.offsetX).add(new THREE.Vector3(sway * 0.3, c.lookY, 0)));
    this.strips.forEach((m, i) => {
      const pulse = 1.1 + Math.sin(this.time * 1.5 + i) * 0.45;
      m.color.setScalar(0).add(new THREE.Color(i % 2 ? 0xff2bd6 : 0x00e5ff).multiplyScalar(pulse));
    });
    if (this.car) {
      for (const w of this.car.wheels) w.spin.rotation.x = 0;
    }
  }

  dispose(): void {
    this.car?.dispose();
    this.envRT.dispose();
  }
}
