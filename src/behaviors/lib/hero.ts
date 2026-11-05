import { Ray, RaycastResult, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { GROUP } from '../../core/groups';
import type { GameWorld } from '../../core/world';

export const HERO = {
  speed: 2.5,
  /** With Shift down. */
  run: 5,
  /** Swift boots from the shop multiply the run by this. */
  bootSpeed: 1.2,
  /** Air control drifts toward this, which is what sets how far a jump carries. A running jump goes no further: the gaps are built around it. */
  airSpeed: 3.6,
  jump: 5.2,
  climb: 2.6,
  /** Upward speed while stepping onto something, and what's left of it on clearing the top. */
  stepRise: 2.6,
  stepSettle: 0.8,
  /** Per-substep velocity blend on the ground / in the air. */
  groundAccel: 0.16,
  airAccel: 0.07,
  coyote: 0.12,
  jumpBuffer: 0.14,
  /** What food does for a while: speed and jump multipliers. */
  fedSpeed: 1.25,
  fedJump: 1.15,
  /** A jetpack's climb (m/s). */
  jetClimb: 5,
  /** Flaps a pair of wings has before they need the ground, and the speed of one. */
  flaps: 5,
  flapSpeed: 4.4,
  /** Slowest fall with wings on, or a balloon or kite in hand (m/s). */
  wingFall: 1.8,
  balloonFall: 2.6,
};

const ray = new Ray();
const rayHit = new RaycastResult();
const rayFrom = new Vec3(), rayTo = new Vec3();

/** Horizontal probe from the hero's center at height `y`, `len` m along (dx, dz). */
export function blocked(e: Entity, world: GameWorld, y: number, dx: number, dz: number, len: number): boolean {
  rayFrom.set(e.x, y, e.z);
  rayTo.set(e.x + dx * len, y, e.z + dz * len);
  rayHit.reset();
  ray.from.copy(rayFrom);
  ray.to.copy(rayTo);
  ray.intersectWorld(world.physics, { mode: Ray.CLOSEST, result: rayHit, skipBackfaces: true, collisionFilterMask: GROUP.STATIC | GROUP.ENTITY });
  return rayHit.hasHit && rayHit.body !== e.body;
}
