import { Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { random } from '../../core/rng';
import type { GameWorld } from '../../core/world';
import { shatter } from './debris';
import { ignite, pop } from './fire';

type P3 = { x: number; y: number; z: number };
const imp = new Vec3();

/** Lights an explosive's fuse (short by default, so chain reactions ripple). */
export function lightFuse(e: Entity, world: GameWorld, seconds = 1.2): void {
  if (!e.alive || e.has('frozen')) return;
  const cur = e.state.fuseLeft as number | undefined;
  if (cur !== undefined && cur <= seconds) return;
  e.state.fuseLeft = seconds;
  world.fx.sound('ignite', { pitch: 1.6, volume: 0.5 });
}

/** Boom: impulse + ignition + shattering within `radius`, with lots of juice. */
export function explode(world: GameWorld, at: P3, radius: number, force: number, source: Entity | null = null): void {
  const fx = world.fx;
  const k = Math.sqrt(radius / 4);
  fx.burst(at, { count: Math.round(70 * k), color: ['#fff4b8', '#ffd84a', '#ffb43c', '#ff6c1e', '#e5401b'], speed: 9 * k, up: 2, gravity: 2, drag: 3, size: 0.24 * k, life: 0.75, glow: true, spread: 0.4 });
  fx.burst(at, { count: Math.round(40 * k), color: ['#3a3532', '#55504b', '#6f6a64', '#8d8780'], speed: 5 * k, up: 2.5, gravity: -1.5, drag: 1.8, size: 0.38 * k, life: 2.2, grow: true, spread: 0.6 });
  fx.burst(at, { count: Math.round(30 * k), color: ['#2d2723', '#5a3d2a', '#7d532f'], speed: 10 * k, up: 5, gravity: 14, size: 0.1, life: 1.4 });
  fx.sound('boom', { pitch: 1 / k });
  fx.addShake(Math.min(1, 0.5 + radius * 0.08));
  fx.bigBang(Math.min(1.4, radius / 4));
  world.events.emit('exploded', { at: { x: at.x, y: at.y, z: at.z }, source });
  let flash = 0;
  fx.tweens.add({ duration: 0.45, update: (t) => { flash = 1 - t; fx.glow.request({ x: at.x, y: at.y + 0.5, z: at.z }, '#ffb050', 40 * flash * k); } });

  for (const o of world.nearby(at, radius + 2)) {
    if (o === source) continue;
    const dx = o.x - at.x, dy = o.y - at.y, dz = o.z - at.z;
    const d = Math.max(0.2, Math.hypot(dx, dy, dz) - o.radius * 0.5);
    if (d > radius) continue;
    const fall = 1 - d / radius;
    if (o.has('explosive')) lightFuse(o, world, 0.15 + random() * 0.3);
    if (o.has('poppable')) { pop(o, world); continue; }
    if (o.has('fragile') && fall > 0.25) { shatter(o, world, 'exploded'); continue; }
    if (o.has('flammable') && fall > 0.35) ignite(o, world);
    if (o.has('frozen')) world.removeTag(o, 'frozen');
    if (o.body.mass === 0) continue;
    const len = Math.hypot(dx, dy + 0.6, dz) || 1;
    const dv = (force * fall) / Math.max(1, Math.sqrt(o.body.mass) * 0.6);
    imp.set((dx / len) * dv * o.body.mass, ((dy + 0.6) / len + 0.5) * dv * o.body.mass, (dz / len) * dv * o.body.mass);
    o.body.wakeUp();
    o.body.applyImpulse(imp);
    o.body.angularVelocity.set(random() * 10 - 5, random() * 10 - 5, random() * 10 - 5);
  }
}
