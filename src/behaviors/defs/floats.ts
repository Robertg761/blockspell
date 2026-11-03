import { Box, Sphere, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { waterSurfaceAt } from '../lib/water';
import { defineBehavior } from '../types';

const up = new Vec3();

/**
 * Vertical extent of the solid part (the collision shapes, relative to the body center). A boat
 * floats on its hull, not on its mast.
 */
function hullSpan(e: Entity): { lo: number; hi: number } {
  let span = e.state.hullSpan as { lo: number; hi: number } | undefined;
  if (span) return span;
  let lo = Infinity, hi = -Infinity;
  e.body.shapes.forEach((s, i) => {
    const off = e.body.shapeOffsets[i];
    const h = s instanceof Box ? s.halfExtents.y : s instanceof Sphere ? s.radius : e.size.y / 2;
    lo = Math.min(lo, off.y - h);
    hi = Math.max(hi, off.y + h);
  });
  span = Number.isFinite(lo) ? { lo, hi } : { lo: -e.size.y / 2, hi: e.size.y / 2 };
  e.state.hullSpan = span;
  return span;
}

/** Buoyancy below any water surface (level water or `liquid` pools), with bobbing and drag. */
export default defineBehavior({
  id: 'floats',
  tags: ['floats'],
  fixedUpdate(e, world) {
    const b = e.body;
    if (b.mass === 0) return;
    const span = hullSpan(e);
    const bottom = b.position.y + span.lo;
    const surface = waterSurfaceAt(world, b.position.x, bottom, b.position.z);
    if (surface === null) return;
    const depth = surface - bottom;
    if (depth <= 0) return;
    const frac = Math.min(1, depth / (span.hi - span.lo));
    // floats about half under; pressed deeper (a load on top, like the hero on a raft) it pushes back
    // harder, so it settles a little lower instead of going under
    const lift = frac * 1.9 * (1 + 1.5 * Math.max(0, frac - 0.5));
    const bob = 1 + Math.sin(world.time * 2.2 + e.id) * 0.1;
    up.set(0, 9.82 * b.mass * lift * bob, 0);
    b.wakeUp();
    b.applyForce(up);
    // water drag: bobbing settles fast, a push glides on for a while
    b.velocity.x *= 0.99;
    b.velocity.z *= 0.99;
    b.velocity.y *= 0.95;
    b.angularVelocity.scale(0.95, b.angularVelocity);
  },
});
