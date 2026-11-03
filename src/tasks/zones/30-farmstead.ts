import { banner } from '../decor';
import { defineZone, offset } from '../types';

/** Farmstead (south): pens and hungry animals. Spells only reach 1.8 m here, so pen walls matter. */
export default defineZone({
  id: 'farmstead',
  name: 'Farmstead',
  order: 3,
  center: [0, 0, 34],
  island: { seed: 41, radius: 12, flatRadius: 11, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [0, 0, -7],
  castRange: 1.8,
  setup(world, origin) {
    banner(world, offset(origin, [1.5, 0, -6]), 'flowerYellow');
  },
});
