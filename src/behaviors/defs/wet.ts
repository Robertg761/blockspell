import { extinguish } from '../lib/fire';
import { defineBehavior } from '../types';

/** Wet things drip, can't burn, and put out fires they touch. */
export default defineBehavior({
  id: 'wet',
  tags: ['wet'],
  attach(e, world) {
    if (e.state.burning) extinguish(e, world);
  },
  update(e, world, dt) {
    for (const o of world.nearby(e.body.position, e.radius + 3)) {
      if (o === e) continue;
      if ((o.state.burning || (o.has('hot') && o.prop('extinguishable', 0) > 0)) && world.touching(e, o, 0.25)) extinguish(o, world);
    }
    if (Math.random() < dt * 6) {
      const p = e.body.position;
      world.fx.burst(
        { x: p.x + (Math.random() - 0.5) * e.size.x * 0.8, y: p.y - e.size.y * 0.3, z: p.z + (Math.random() - 0.5) * e.size.z * 0.8 },
        { count: 1, color: ['#7cc4ff', '#a8dcff'], speed: 0.2, up: 0, gravity: 9, size: 0.05, life: 0.5 },
      );
    }
  },
});
