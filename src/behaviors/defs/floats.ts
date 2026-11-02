import { Vec3 } from 'cannon-es';
import { defineBehavior } from '../types';

const up = new Vec3();

/** Buoyancy when below `world.waterLevel` (no-op until a level adds water). */
export default defineBehavior({
  id: 'floats',
  tags: ['floats'],
  fixedUpdate(e, world) {
    if (world.waterLevel === null) return;
    const b = e.body;
    const bottom = b.position.y - e.size.y / 2;
    const depth = world.waterLevel - bottom;
    if (depth <= 0) return;
    const frac = Math.min(1, depth / e.size.y);
    up.set(0, 9.82 * b.mass * frac * 1.8, 0);
    b.applyForce(up);
    b.velocity.scale(0.97, b.velocity);
    b.angularVelocity.scale(0.95, b.angularVelocity);
  },
});
