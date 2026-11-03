import { Color, PointLight, type Scene } from 'three';
import { Audio, type SoundName } from './audio';
import { FlameFx } from './flames';
import { Particles, type BurstOptions } from './particles';
import { CameraShake } from './shake';
import { Tweens } from './tween';
import { VoxelAnims } from './voxanim';

type P3 = { x: number; y: number; z: number };

/**
 * A fixed pool of point lights handed to the brightest glow sources each
 * frame. Keeping the light count constant avoids shader recompiles.
 */
class GlowLights {
  private lights: PointLight[] = [];
  private requests: { p: P3; color: string; intensity: number }[] = [];
  private t = 0;

  constructor(scene: Scene, count = 4) {
    for (let i = 0; i < count; i++) {
      const l = new PointLight(0xff8a3a, 0, 7, 1.6);
      this.lights.push(l);
      scene.add(l);
    }
  }

  request(p: P3, color = '#ff8a3a', intensity = 6): void {
    this.requests.push({ p, color, intensity });
  }

  update(dt: number): void {
    this.t += dt;
    this.requests.sort((a, b) => b.intensity - a.intensity);
    this.lights.forEach((l, i) => {
      const r = this.requests[i];
      if (!r) {
        l.intensity = 0;
        return;
      }
      l.position.set(r.p.x, r.p.y, r.p.z);
      l.color.set(r.color);
      const flicker = 0.8 + 0.2 * Math.sin(this.t * 23 + i * 7) * Math.sin(this.t * 13 + i);
      l.intensity = r.intensity * flicker;
    });
    this.requests.length = 0;
  }
}

/** One-stop juice API handed to behaviors via `world.fx`. */
export class Effects {
  readonly particles: Particles;
  readonly shake = new CameraShake();
  readonly audio = new Audio();
  readonly tweens = new Tweens();
  readonly glow: GlowLights;
  readonly flames: FlameFx;
  /** Voxel spawn / change / despawn animations. */
  readonly anims: VoxelAnims;

  constructor(scene: Scene) {
    this.particles = new Particles(scene);
    this.glow = new GlowLights(scene);
    this.flames = new FlameFx(scene);
    this.anims = new VoxelAnims(scene, this);
  }

  burst(at: P3, o?: BurstOptions): void {
    this.particles.burst(at, o);
  }

  sound(name: SoundName, opts?: { pitch?: number; volume?: number }): void {
    this.audio.play(name, opts);
  }

  addShake(amount: number): void {
    this.shake.add(amount);
  }

  /** Grey smoke puff + poof sound. */
  poof(at: P3, color: string | string[] = ['#d8d8d8', '#bdbdbd', '#ffffff'], size = 1): void {
    this.burst(at, { count: Math.round(18 * size), color, speed: 2.2 * size, up: 1.5, gravity: -1, drag: 3, life: 0.9, size: 0.22 * size, grow: true, spread: 0.3 * size });
    this.sound('poof', { pitch: 1 / Math.sqrt(size) });
  }

  /** Glowing star sparkle (spawn magic). */
  sparkle(at: P3, color: string | string[] = ['#fff6a8', '#ffd84a', '#ffffff'], count = 20): void {
    this.burst(at, { count, color, speed: 5, up: 2, gravity: 4, drag: 2.5, life: 0.7, size: 0.08, glow: true, spread: 0.3 });
  }

  /** Level-complete celebration: confetti, firework bursts, shake and fanfare. */
  celebrate(at: P3): void {
    this.sound('fanfare');
    this.sound('confetti', { volume: 0.8 });
    this.addShake(0.35);
    const colors = ['#ff5d6c', '#ffd84a', '#52b848', '#3d7fe0', '#9256d6', '#ff9a3c', '#ffffff'];
    // paper confetti: two pops from either side of the hero, then a lingering shower
    for (const side of [-1, 1])
      this.burst({ x: at.x + side * 0.8, y: at.y + 1.2, z: at.z }, { count: 70, color: colors, confetti: true, speed: 4.5, up: 7, spread: 0.3, size: 0.13, life: 4.5, gravity: 7, drag: 1.4 });
    const later = (delay: number, fn: () => void) => this.tweens.add({ delay, duration: 0.01, update: () => {}, done: fn });
    for (let i = 0; i < 3; i++)
      later(0.3 + i * 0.35, () =>
        this.burst({ x: at.x + (Math.random() - 0.5) * 5, y: at.y + 5 + Math.random(), z: at.z + (Math.random() - 0.5) * 5 }, { count: 40, color: colors, confetti: true, speed: 2.5, up: 0, spread: 1.5, size: 0.13, life: 4, gravity: 3, drag: 1.5 }));
    // fireworks: radial bursts of glowing sparks with a white glitter core
    const palettes = [['#ff5d6c', '#ffb0b8'], ['#ffd84a', '#fff6a8'], ['#6ec8ff', '#ffffff'], ['#b98cff', '#ffd0ff'], ['#7dff9a', '#eaffd0']];
    for (let i = 0; i < 5; i++) {
      const pal = palettes[(i + Math.floor(Math.random() * palettes.length)) % palettes.length];
      later(0.15 + i * 0.32 + Math.random() * 0.15, () => {
        const p = { x: at.x + (Math.random() - 0.5) * 8, y: at.y + 4 + Math.random() * 3.5, z: at.z + (Math.random() - 0.5) * 8 };
        this.burst(p, { count: 60, color: pal, glow: true, speed: 5.5, up: 0, spread: 0.1, size: 0.1, life: 1.3, gravity: 3.5, drag: 2.2 });
        this.burst(p, { count: 18, color: '#ffffff', glow: true, speed: 2, up: 0, spread: 0.1, size: 0.07, life: 0.9, gravity: 2, drag: 1.5 });
        this.sound(i % 2 ? 'pop' : 'chime', { pitch: 0.8 + Math.random() * 0.6, volume: 0.45 });
        this.addShake(0.06);
      });
    }
  }

  update(dt: number): void {
    this.particles.update(dt);
    this.tweens.update(dt);
    // after the tweens: casts spawn from them, and their first frame needs the animation set up
    this.anims.update(dt);
    this.shake.update(dt);
    this.glow.update(dt);
    this.flames.update(dt);
  }
}

export const lerpColor = (a: string, b: string, t: number) => '#' + new Color(a).lerp(new Color(b), t).getHexString();
