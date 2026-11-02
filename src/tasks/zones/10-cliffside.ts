import { banner } from '../decor';
import { defineZone, offset } from '../types';

/** Cliffside (north): cliffs, a floating ledge and a summit. Placeholder until its tasks land. */
export default defineZone({
  id: 'cliffside',
  name: 'Cliffside',
  order: 1,
  center: [0, 0, -34],
  island: { seed: 21, radius: 12, flatRadius: 11, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [0, 0, 7],
  setup(world, origin) {
    banner(world, offset(origin, [1.5, 0, 6]), 'stoneDark');
  },
});
