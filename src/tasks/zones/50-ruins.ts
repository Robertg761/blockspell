import { banner } from '../decor';
import { defineZone, offset } from '../types';

/**
 * Sky Ruins (northwest, past the gap from the hub): a sealed vault, a cursed
 * crystal on an altar and an old pressure plate. The tasks build their own
 * props (src/tasks/defs/15 to 17); the zone adds the ruined scenery.
 */
export default defineZone({
  id: 'ruins',
  name: 'Sky Ruins',
  order: 5,
  center: [-31.1, 0, -31.1],
  island: { seed: 61, radius: 11, flatRadius: 10, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [5, 0, 5],
  setup(world, origin) {
    banner(world, offset(origin, [6.5, 0, 3.5]), 'grey');
  },
});
