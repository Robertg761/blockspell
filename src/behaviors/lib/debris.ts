import type { BufferAttribute } from 'three';
import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { emptyModifiers } from '../../adjectives/types';
import { objects } from '../../objects';

/** A few representative colors sampled from the entity's own mesh (respects tints). */
export function sampleColors(e: Entity, n = 5): string[] {
  const attr = e.mesh.geometry.getAttribute('color') as BufferAttribute | undefined;
  if (!attr || attr.count === 0) return [e.def.burstColor ?? '#ffffff'];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const k = Math.floor(Math.random() * attr.count);
    const to8 = (v: number) => Math.round(Math.min(1, Math.pow(Math.max(0, v), 1 / 2.2)) * 255).toString(16).padStart(2, '0');
    out.push('#' + to8(attr.getX(k)) + to8(attr.getY(k)) + to8(attr.getZ(k)));
  }
  return out;
}

/** Breaks an entity apart into voxel shards and spawns its `debris` objects. */
export function shatter(e: Entity, world: GameWorld, reason = 'broken', loot?: string[]): void {
  if (!e.alive) return;
  const p = e.body.position;
  const colors = sampleColors(e, 6);
  const s = Math.max(0.6, e.radius);
  world.fx.burst(p, { count: Math.round(26 * s), color: colors, speed: 4 * Math.sqrt(s), up: 3, size: 0.09 * Math.sqrt(e.scale), life: 1.1, gravity: 12, spread: e.radius * 0.5 });
  world.fx.burst(p, { count: 8, color: ['#ffffff', '#fff6a8'], speed: 5, up: 1, size: 0.05, life: 0.35, glow: true });
  world.fx.sound(e.has('metal') ? 'clank' : e.has('flammable') ? 'thud' : 'shatter', { pitch: 1 / Math.sqrt(e.scale) });
  world.fx.addShake(0.15);
  spawnDebris(e, world, loot);
  world.events.emit('broken', { entity: e });
  world.remove(e, reason);
}

export function spawnDebris(e: Entity, world: GameWorld, list = e.def.debris ?? []): void {
  list.forEach((id, i) => {
    const def = objects.get(id);
    if (!def) return;
    const mods = emptyModifiers();
    mods.scale = e.scale * (id === 'plank' ? 0.6 : 0.8);
    const a = (i / Math.max(1, list.length)) * Math.PI * 2;
    const d = world.spawn(def, { position: { x: e.x + Math.cos(a) * 0.3, y: e.y + 0.2 + i * 0.15, z: e.z + Math.sin(a) * 0.3 }, mods, silent: true, yaw: a });
    d.body.velocity.set(Math.cos(a) * 2, 3, Math.sin(a) * 2);
  });
}
