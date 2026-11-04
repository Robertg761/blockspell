import { Vector3, type Camera } from 'three';
import type { GameWorld } from '../core/world';
import type { Entity } from '../core/entity';
import { h } from './dom';
import './reactions.css';

interface Live { el: HTMLElement; pos: Vector3; age: number; life: number }

const PICK = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const MAX_LIVE = 8;

/**
 * Comic-book words that pop above whatever just happened ("Whoosh!", "Nom!", "BOOM!"),
 * so every chain reaction is readable at a glance. Purely visual.
 */
export class Reactions {
  private layer = h('div.reactions', { 'aria-hidden': 'true' });
  private live: Live[] = [];
  private lastAt = new Map<string, number>();
  private v = new Vector3();

  constructor(root: HTMLElement, private world: GameWorld) {
    root.append(this.layer);
    const ev = world.events;
    const at = (e: Entity) => ({ x: e.x, y: e.y + e.size.y / 2 + 0.3, z: e.z });
    ev.on('ignite', ({ entity }) => !entity.has('controlled') && this.say('ignite', PICK(['Whoosh!', 'Fire!', 'Hot!']), at(entity), '#ff8a2a'));
    ev.on('extinguish', ({ entity }) => this.say('extinguish', PICK(['Psssh!', 'Sizzle!']), at(entity), '#6ec8ff'));
    ev.on('exploded', ({ at: p }) => this.say('exploded', PICK(['BOOM!', 'KABOOM!', 'BLAM!']), { x: p.x, y: p.y + 1.4, z: p.z }, '#ffd23f', 1.6));
    ev.on('popped', ({ entity }) => this.say('popped', PICK(['Pop!', 'Pop!', 'Bip!']), at(entity), '#ff6c8a'));
    ev.on('ate', ({ eater }) => this.say('ate', PICK(['Nom!', 'Yum!', 'Chomp!']), at(eater), '#ffb340'));
    ev.on('broken', ({ entity }) => this.say('broken', PICK(['Crash!', 'Smash!', 'Crack!']), at(entity), '#c9b8ff'));
    ev.on('unlocked', ({ entity }) => this.say('unlocked', 'Click!', at(entity), '#9be15d'));
    ev.on('tagAdded', ({ entity, tag }) => tag === 'frozen' && this.say('frozen', PICK(['Brrr!', 'Freeze!']), at(entity), '#8fd8ff'));
  }

  private say(kind: string, text: string, p: { x: number; y: number; z: number }, color: string, size = 1): void {
    // not during a level's own setup, and not a flood: one per kind every 0.3 s, a handful on screen
    if (this.world.time < 0.8) return;
    const now = performance.now();
    if (now - (this.lastAt.get(kind) ?? 0) < 300 || this.live.length >= MAX_LIVE) return;
    this.lastAt.set(kind, now);
    const tilt = (Math.random() - 0.5) * 14;
    const word = h('span.reaction-word', { text, style: `--c:${color};--s:${size};--r:${tilt}deg` });
    const el = h('div.reaction', {}, [word]);
    this.layer.append(el);
    this.live.push({ el, pos: new Vector3(p.x, p.y, p.z), age: 0, life: 1.15 });
  }

  update(dt: number, camera: Camera, visible: boolean): void {
    this.layer.style.display = visible ? '' : 'none';
    const w = this.layer.clientWidth, hh = this.layer.clientHeight;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const r = this.live[i];
      r.age += dt;
      if (r.age >= r.life) {
        r.el.remove();
        this.live.splice(i, 1);
        continue;
      }
      r.pos.y += dt * 0.6;
      this.v.copy(r.pos).project(camera);
      const behind = this.v.z > 1;
      r.el.style.opacity = behind ? '0' : '';
      r.el.style.transform = `translate(${((this.v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-this.v.y * 0.5 + 0.5) * hh).toFixed(1)}px)`;
    }
  }

  clear(): void {
    for (const r of this.live) r.el.remove();
    this.live.length = 0;
  }
}
