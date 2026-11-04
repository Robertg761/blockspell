import { AdditiveBlending, BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, type Scene, type Vector3 } from 'three';
import { random } from '../core/rng';
import type { SkyName } from './skies';
import type { WeatherName } from './weather';

const dummy = new Object3D();
const FIREFLIES = 34;
const BUTTERFLIES = 12;
const BIRDS = 5;
const W = 13;

interface Mood {
  fireflies: number;
  butterflies: number;
  birds: number;
}

/** How much of each kind of little life is out in each part of the day (and none in rain or snow). */
function moodFor(sky: SkyName, weather: WeatherName): Mood {
  if (weather !== 'clear') return { fireflies: 0, butterflies: 0, birds: 0 };
  switch (sky) {
    case 'day':
      return { fireflies: 0, butterflies: 1, birds: 1 };
    case 'dawn':
      return { fireflies: 0.35, butterflies: 0.5, birds: 0.8 };
    case 'sunset':
      return { fireflies: 0.6, butterflies: 0.25, birds: 0.5 };
    default:
      return { fireflies: 1, butterflies: 0, birds: 0 };
  }
}

/**
 * Small living things that make the world feel lived in, all visual and each a single instanced draw:
 * fireflies blink around at night, butterflies flutter by day, and a few birds circle high overhead.
 * They follow the camera target, so they cost the same wherever you are.
 */
export class Life {
  enabled = true;
  private fireflies: InstancedMesh;
  private butterflies: InstancedMesh;
  private birds: InstancedMesh;
  private fp = new Float32Array(FIREFLIES * 4); // x, y, z, phase
  private bp = new Float32Array(BUTTERFLIES * 5); // x, y, z, heading, phase
  private birdPhase = new Float32Array(BIRDS * 3); // angle, radius, speed
  private mood: Mood = { fireflies: 0, butterflies: 0, birds: 0 };
  private shown: Mood = { fireflies: 0, butterflies: 0, birds: 0 };
  private t = 0;

  constructor(scene: Scene) {
    const fm = new MeshBasicMaterial({ color: '#e4ff8a', transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false });
    this.fireflies = new InstancedMesh(new BoxGeometry(1, 1, 1), fm, FIREFLIES);
    const bm = new MeshBasicMaterial({ color: '#ffffff' });
    this.butterflies = new InstancedMesh(new BoxGeometry(1, 1, 1), bm, BUTTERFLIES);
    const palette = ['#ff8fb1', '#ffd84a', '#8fd3ff', '#ffffff', '#c79bff', '#ff9a3c'];
    for (let i = 0; i < BUTTERFLIES; i++) this.butterflies.setColorAt(i, new Color(palette[i % palette.length]));
    const rm = new MeshBasicMaterial({ color: '#2b303b' });
    this.birds = new InstancedMesh(new BoxGeometry(1, 1, 1), rm, BIRDS);
    for (const m of [this.fireflies, this.butterflies, this.birds]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.frustumCulled = false;
      m.visible = false;
      m.count = 0;
      m.renderOrder = 5;
      scene.add(m);
    }
    for (let i = 0; i < FIREFLIES; i++) this.fp.set([(random() * 2 - 1) * W, random() * 3 - 0.4, (random() * 2 - 1) * W, random() * 6.28], i * 4);
    for (let i = 0; i < BUTTERFLIES; i++) this.bp.set([(random() * 2 - 1) * W, random() * 2 + 0.3, (random() * 2 - 1) * W, random() * 6.28, random() * 6.28], i * 5);
    for (let i = 0; i < BIRDS; i++) this.birdPhase.set([random() * 6.28, 12 + random() * 10, (0.12 + random() * 0.1) * (i % 2 ? 1 : -1)], i * 3);
  }

  setMood(sky: SkyName, weather: WeatherName): void {
    this.mood = moodFor(sky, weather);
  }

  update(dt: number, c: Vector3): void {
    this.t += dt;
    const k = Math.min(1, dt * 1.2);
    const target = this.enabled ? this.mood : { fireflies: 0, butterflies: 0, birds: 0 };
    this.shown.fireflies += (target.fireflies - this.shown.fireflies) * k;
    this.shown.butterflies += (target.butterflies - this.shown.butterflies) * k;
    this.shown.birds += (target.birds - this.shown.birds) * k;
    this.stepFireflies(dt, c);
    this.stepButterflies(dt, c);
    this.stepBirds(c);
  }

  private stepFireflies(dt: number, c: Vector3): void {
    const n = Math.max(0, Math.floor(FIREFLIES * this.shown.fireflies));
    this.fireflies.visible = n > 0;
    this.fireflies.count = n;
    for (let i = 0; i < n; i++) {
      const p = this.fp, o = i * 4, ph = p[o + 3];
      p[o] += Math.sin(this.t * 0.5 + ph) * 0.5 * dt;
      p[o + 1] += Math.sin(this.t * 0.8 + ph * 2) * 0.3 * dt;
      p[o + 2] += Math.cos(this.t * 0.45 + ph * 1.3) * 0.5 * dt;
      if (p[o + 1] < -0.4) p[o + 1] = -0.4;
      if (p[o + 1] > 2.8) p[o + 1] = 2.8;
      if (Math.abs(p[o]) > W) p[o] *= -0.96;
      if (Math.abs(p[o + 2]) > W) p[o + 2] *= -0.96;
      const blink = Math.max(0, Math.sin(this.t * 1.7 + ph * 3));
      dummy.position.set(c.x + p[o], c.y + p[o + 1], c.z + p[o + 2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.08 + 0.1 * blink * blink);
      dummy.updateMatrix();
      this.fireflies.setMatrixAt(i, dummy.matrix);
    }
    this.fireflies.instanceMatrix.needsUpdate = true;
  }

  private stepButterflies(dt: number, c: Vector3): void {
    const n = Math.max(0, Math.floor(BUTTERFLIES * this.shown.butterflies));
    this.butterflies.visible = n > 0;
    this.butterflies.count = n;
    if (this.butterflies.instanceColor) this.butterflies.instanceColor.needsUpdate = true;
    for (let i = 0; i < n; i++) {
      const p = this.bp, o = i * 5, ph = p[o + 4];
      p[o + 3] += Math.sin(this.t * 0.9 + ph * 5) * 1.8 * dt; // wander: the heading keeps turning
      p[o] += Math.cos(p[o + 3]) * 0.9 * dt;
      p[o + 2] += Math.sin(p[o + 3]) * 0.9 * dt;
      p[o + 1] = 0.7 + Math.sin(this.t * 1.1 + ph) * 0.5 + Math.sin(this.t * 2.3 + ph * 3) * 0.15;
      if (Math.abs(p[o]) > W) p[o] *= -0.96;
      if (Math.abs(p[o + 2]) > W) p[o + 2] *= -0.96;
      const flap = 0.35 + 0.65 * Math.abs(Math.sin(this.t * 14 + ph * 7));
      dummy.position.set(c.x + p[o], c.y + p[o + 1], c.z + p[o + 2]);
      dummy.rotation.set(0, -p[o + 3], 0);
      dummy.scale.set(0.14, 0.025, 0.38 * flap);
      dummy.updateMatrix();
      this.butterflies.setMatrixAt(i, dummy.matrix);
    }
    this.butterflies.instanceMatrix.needsUpdate = true;
  }

  private stepBirds(c: Vector3): void {
    const n = Math.max(0, Math.floor(BIRDS * this.shown.birds + 0.5));
    this.birds.visible = n > 0;
    this.birds.count = n;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const a = this.birdPhase[o] + this.t * this.birdPhase[o + 2];
      const r = this.birdPhase[o + 1];
      const flap = 0.55 + 0.45 * Math.sin(this.t * 7 + i * 2);
      dummy.position.set(c.x + Math.cos(a) * r, c.y + 9 + (i % 3) * 1.4 + Math.sin(this.t * 0.4 + i) * 0.5, c.z + Math.sin(a) * r);
      dummy.rotation.set(0, -a + (this.birdPhase[o + 2] > 0 ? 0 : Math.PI), flap * 0.35 - 0.1);
      dummy.scale.set(0.12, 0.05, 0.7 * (0.65 + 0.35 * flap));
      dummy.updateMatrix();
      this.birds.setMatrixAt(i, dummy.matrix);
    }
    this.birds.instanceMatrix.needsUpdate = true;
  }
}
