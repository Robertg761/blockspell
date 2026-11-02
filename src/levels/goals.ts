import type { Entity } from '../core/entity';
import type { GameWorld, SpawnOptions } from '../core/world';
import type { V3 } from './types';

/**
 * Helpers for level setup and goal checks. Level entities get a `role`
 * (state.role) so goals can find them again, and are `pinned` so the
 * entity limit never poofs them away.
 */

/** Tags an entity with a role and pins it. Returns it for chaining. */
export function mark<T extends Entity | null>(e: T, role: string): T {
  if (e) {
    e.state.role = role;
    e.state.pinned = true;
  }
  return e;
}

/** Spawns a level object silently, sitting on the surface at `at`, and marks it with `role`. */
export function place(world: GameWorld, id: string, at: V3, role?: string, opts: Partial<SpawnOptions> = {}): Entity | null {
  const e = world.spawnById(id, { position: { x: at[0], y: at[1], z: at[2] }, grounded: true, silent: true, ...opts });
  if (e) mark(e, role ?? id);
  return e;
}

export const withRole = (world: GameWorld, role: string): Entity[] => world.living((e) => e.state.role === role);
export const firstWithRole = (world: GameWorld, role: string): Entity | null => withRole(world, role)[0] ?? null;

/** Hero is (nearly) touching any entity with this role. */
export const heroTouches = (world: GameWorld, role: string, slack = 0.25): boolean => {
  const h = world.hero;
  if (!h?.alive) return false;
  return withRole(world, role).some((e) => world.touching(h, e, slack));
};

/** Hero's feet are inside the axis-aligned box [min, max]. */
export const heroInside = (world: GameWorld, min: V3, max: V3): boolean => {
  const h = world.hero;
  if (!h?.alive) return false;
  const f = h.y - h.size.y / 2;
  return h.x >= min[0] && h.x <= max[0] && f >= min[1] && f <= max[1] && h.z >= min[2] && h.z <= max[2];
};

/** Hero is standing (not climbing, not falling) with feet above `y`. */
export const heroStandingAbove = (world: GameWorld, y: number): boolean => {
  const h = world.hero;
  if (!h?.alive || h.state.climbing) return false;
  return h.y - h.size.y / 2 >= y && Math.abs(h.body.velocity.y) < 0.6;
};

/** Some entity with `role` is resting (slow) with its bottom at or below `maxY`. */
export const restingBelow = (world: GameWorld, role: string, maxY: number): boolean =>
  withRole(world, role).some((e) => e.y - e.size.y / 2 <= maxY && e.body.velocity.length() < 1.5);

/** Every entity with `role` has stopped burning (and none are left burning anywhere near them). */
export const fireOut = (world: GameWorld, role: string): boolean => {
  const list = withRole(world, role);
  return list.length > 0 && list.every((e) => !e.state.burning);
};

/** Wires an `ate` listener so `world.flags['fed:' + role]` is set when an entity with `role` eats. Call from setup. */
export function watchFed(world: GameWorld, role: string): void {
  world.on('ate', ({ eater }) => {
    if (eater.state.role === role) world.flags['fed:' + role] = true;
  });
}
export const fed = (world: GameWorld, role: string): boolean => world.flags['fed:' + role] === true;

/**
 * Wraps a condition so it must hold continuously for `seconds` (avoids
 * counting a ball that merely bounces past the goal).
 */
export function holdFor(seconds: number, cond: (w: GameWorld) => boolean, key = 'hold'): (w: GameWorld) => boolean {
  return (w) => {
    const k = '__' + key;
    if (!cond(w)) {
      delete w.flags[k];
      return false;
    }
    const since = (w.flags[k] as number | undefined) ?? (w.flags[k] = w.time);
    return w.time - (since as number) >= seconds;
  };
}
