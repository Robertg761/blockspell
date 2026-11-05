import { endRide, startRide, steer } from '../lib/ride';
import { defineBehavior } from '../types';

/** Being driven: see lib/ride.ts. */
export default defineBehavior({
  id: 'ridden',
  tags: ['ridden'],
  // after every other behavior: whatever a ridden thing tries to do, the driver wins
  order: 100,
  attach: startRide,
  detach: endRide,
  fixedUpdate: steer,
});
