import { Color, PointLight, type Scene } from 'three';
import { Audio, type SoundName } from './audio';
import { Particles, type BurstOptions } from './particles';
import { CameraShake } from './shake';
import { Tweens } from './tween';

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

  constructor(scene: Scene) {
    this.particles = new Particles(scene);
    this.glow = new GlowLights(scene);
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

  update(dt: number): void {
    this.particles.update(dt);
    this.tweens.update(dt);
    this.shake.update(dt);
    this.glow.update(dt);
  }
}

export const lerpColor = (a: string, b: string, t: number) => '#' + new Color(a).lerp(new Color(b), t).getHexString();
