import { ignite, pop } from '../lib/fire';
import { defineBehavior } from '../types';

/** Heat sources warm up nearby flammables until they ignite, and pop poppables. */
export default defineBehavior({
  id: 'hot',
  tags: ['hot'],
  update(e, world, dt) {
    const reach = 0.5 * e.prop('heatRadius', 1);
    for (const o of world.nearby(e.body.position, e.radius + reach + 3)) {
      if (o === e) continue;
      const gap = e.distanceTo(o) - (e.radius + o.radius) * 0.75;
      if (gap > reach) continue;
      if (o.has('poppable')) {
        pop(o, world);
        continue;
      }
      if (o.has('flammable') && !o.state.burning && !o.has('wet')) {
        o.state.heat += dt * 1.1;
        if (o.state.heat >= 1) ignite(o, world);
      }
    }
  },
});
