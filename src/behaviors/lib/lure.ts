import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import type { ObjectDef } from '../../objects/types';

type P = { x: number; y: number; z: number };

/** How far (horizontally) from a hungry animal a treat can be aimed and still be brought to it. */
export const LURE_REACH = 4.5;

/** Would an eater of this kind go for a freshly cast object of this kind? Only still food counts, never other animals. */
function likes(eater: Entity, food: ObjectDef): boolean {
  const diet = eater.def.diet;
  if (!diet || food.tags.includes('animal')) return false;
  return diet.some((d) => food.id === d || food.tags.includes(d as never));
}

const feetOf = (e: Entity) => e.y - e.size.y / 2;

/** True when the ground between two points has a wall, a ledge or a gap: a walker could not cross it. */
function blockedBetween(world: GameWorld, a: P, b: P): boolean {
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
  let prev = world.groundAt(a.x, a.z);
  if (!Number.isFinite(prev)) return true;
  for (let i = 1; i <= n; i++) {
    const g = world.groundAt(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n);
    if (!Number.isFinite(g) || Math.abs(g - prev) > 0.6) return true;
    prev = g;
  }
  return false;
}

/** Is the animal shut in (a pen, a walled yard)? Nearly every way out of 5 m around it runs into a wall, ledge or gap. */
function enclosed(world: GameWorld, eater: P): boolean {
  let blocked = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    if (blockedBetween(world, eater, { x: eater.x + Math.cos(a) * 5, y: eater.y, z: eater.z + Math.sin(a) * 5 })) blocked++;
  }
  return blocked >= 7;
}

/**
 * Where a treat aimed at `at` should really land, so a hungry animal nearby can get to it. Placing
 * food by finger or mouse is imprecise, and a pen wall a few centimeters off means the pup watches
 * its bone sit out of reach. Returns null (leave the aim alone) unless a hungry eater is within
 * LURE_REACH, shut in, and a wall, ledge or gap is in its way: a clear path needs no help, the animal
 * just walks there, and bait set on purpose to coax a free animal through a gate stays where it was
 * put. Otherwise the treat lands a step from the animal, on its side of the obstacle.
 * `reach` says whether the caster may cast at a point at all (cast range), so this never
 * gets around a level's limits.
 */
export function lureTarget(world: GameWorld, food: ObjectDef, at: P, reach: (p: P) => boolean): P | null {
  if (food.tags.includes('animal')) return null;
  let best: Entity | null = null;
  let bd = Infinity;
  for (const e of world.living()) {
    if (!e.has('eats') || e.has('frozen') || e === world.hero || !likes(e, food)) continue;
    const d = Math.hypot(e.x - at.x, e.z - at.z);
    if (d < bd && d <= LURE_REACH * Math.sqrt(e.scale)) { bd = d; best = e; }
  }
  if (!best) return null;
  const feet = feetOf(best);
  const eater = { x: best.x, y: feet, z: best.z };
  if (!blockedBetween(world, eater, at) && Math.abs(at.y - feet) < 0.8) return null;
  if (!enclosed(world, eater)) return null;

  // a step from the animal, preferring the side the player aimed at, then fanning out around it
  const step = Math.max(0.9, best.radius + 0.6);
  const base = Math.atan2(at.z - best.z, at.x - best.x);
  for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
    const x = best.x + Math.cos(base + turn) * step, z = best.z + Math.sin(base + turn) * step;
    const g = world.groundAt(x, z);
    if (!Number.isFinite(g) || Math.abs(g - feet) > 0.45 || blockedBetween(world, eater, { x, y: g, z })) continue;
    const p = { x, y: g, z };
    if (reach(p)) return p;
  }
  // out of the caster's range (a pen the hero can only just reach): at least slide a treat that landed
  // on top of a wall off its edge, toward the animal
  if (at.y - feet > 0.7) {
    const n = Math.ceil(Math.hypot(best.x - at.x, best.z - at.z) / 0.2);
    for (let i = 1; i <= n; i++) {
      const x = at.x + ((best.x - at.x) * i) / n, z = at.z + ((best.z - at.z) * i) / n;
      const g = world.groundAt(x, z);
      if (Number.isFinite(g) && Math.abs(g - feet) <= 0.45) {
        const p = { x, y: g, z };
        return reach(p) && !blockedBetween(world, eater, p) ? p : null;
      }
    }
  }
  return null;
}
