import { pop } from '../lib/fire';
import { defineBehavior } from '../types';

/** Pointy things pop balloons. */
export default defineBehavior({
  id: 'sharp',
  tags: ['sharp'],
  contact(e, other, world) {
    if (other?.has('poppable')) pop(other, world);
  },
  update(e, world) {
    for (const o of world.nearby(e.body.position, e.radius + 1.5, (o) => o.has('poppable'))) if (world.touching(e, o, 0.05)) pop(o, world);
  },
});
