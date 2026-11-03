import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';

/**
 * Water surface height at (x, z) if `y` is below it, else null. Considers the
 * level's global `waterLevel` and every `liquid` entity's box (with `only`, just the matching ones).
 */
export function waterSurfaceAt(world: GameWorld, x: number, y: number, z: number, only?: (w: Entity) => boolean): number | null {
  let best: number | null = world.waterLevel !== null && y < world.waterLevel ? world.waterLevel : null;
  for (const w of world.entities) {
    if (!w.alive || !w.has('liquid') || (only && !only(w))) continue;
    const p = w.body.position;
    const top = p.y + w.size.y / 2;
    if (y > top + 0.05 || y < p.y - w.size.y / 2 - 0.6) continue;
    if (Math.abs(x - p.x) > w.size.x / 2 || Math.abs(z - p.z) > w.size.z / 2) continue;
    if (best === null || top > best) best = top;
  }
  return best;
}

/** True when the entity's lower half is in water. */
export function inWater(world: GameWorld, e: Entity): boolean {
  const p = e.body.position;
  return waterSurfaceAt(world, p.x, p.y - e.size.y / 2 + Math.min(0.2, e.size.y * 0.25), p.z) !== null;
}

export function splash(world: GameWorld, at: { x: number; y: number; z: number }, size = 1): void {
  world.fx.burst(at, { count: Math.round(20 * size), color: ['#7cc4ff', '#a8dcff', '#ffffff'], speed: 2.5 * Math.sqrt(size), up: 3.5, gravity: 9, size: 0.09 * Math.sqrt(size), life: 0.8, spread: 0.2 * size });
  world.fx.sound('splash', { pitch: 1 / Math.sqrt(size), volume: Math.min(1, 0.4 + size * 0.3) });
}

/** Soaks an entity for `seconds` (adds the `wet` tag; the wet behavior dries it off). */
export function soak(world: GameWorld, e: Entity, seconds = 8): void {
  if (e.has('liquid') || e.has('hot') && !e.state.burning) return;
  e.state.soakedUntil = world.time + seconds;
  if (!e.has('wet')) {
    e.state.soakedTag = true;
    world.addTag(e, 'wet');
  }
}
