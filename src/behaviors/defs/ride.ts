import { crash, endRide, smoke, startRide, steer } from '../lib/ride';
import { defineBehavior } from '../types';

/** Being driven, and being the worse for wear: see lib/ride.ts. */
export default [
  defineBehavior({ id: 'rideable', tags: ['rideable'], update: smoke }),
  defineBehavior({
    id: 'ridden',
    tags: ['ridden'],
    // after every other behavior: whatever a ridden thing tries to do, the driver wins
    order: 100,
    attach: startRide,
    detach: endRide,
    fixedUpdate: steer,
    contact(e, _other, world, { speed }) {
      crash(e, world, speed);
    },
  }),
];
