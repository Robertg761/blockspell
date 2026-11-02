import { Vec3 } from 'cannon-es';
import { waterSurfaceAt } from '../lib/water';
import { defineBehavior } from '../types';

const up = new Vec3();

/** Buoyancy below any water surface (level water or `liquid` pools), with bobbing and drag. */
export default defineBehavior({
  id: 'floats',
  tags: ['floats'],
  fixedUpdate(e, world) {
    const b = e.body;
    if (b.mass === 0) return;
    const bottom = b.position.y - e.size.y / 2;
    const surface = waterSurfaceAt(world, b.position.x, bottom, b.position.z);
    if (surface === null) return;
    const depth = surface - bottom;
    if (depth <= 0) return;
    const frac = Math.min(1, depth / e.size.y);
    const bob = 1 + Math.sin(world.time * 2.2 + e.id) * 0.12;
    up.set(0, 9.82 * b.mass * frac * 1.9 * bob, 0);
    b.wakeUp();
    b.applyForce(up);
    b.velocity.scale(0.97, b.velocity);
    b.angularVelocity.scale(0.95, b.angularVelocity);
  },
});
