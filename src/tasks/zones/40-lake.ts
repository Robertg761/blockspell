import { banner } from '../decor';
import { defineZone, offset } from '../types';

/** Lily Lake (west): water pools to float, freeze and ferry on. Placeholder until its tasks land. */
export default defineZone({
  id: 'lake',
  name: 'Lily Lake',
  order: 4,
  center: [-34, 0, 0],
  island: { seed: 51, radius: 12, flatRadius: 11, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [7, 0, 0],
  setup(world, origin) {
    banner(world, offset(origin, [6, 0, 1.5]), 'collar');
  },
});
