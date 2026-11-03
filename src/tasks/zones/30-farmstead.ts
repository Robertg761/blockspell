import { banner } from '../decor';
import { defineZone, offset } from '../types';

/** Farmstead (south): pens and hungry animals. Spells aimed into the pup's pen only reach 1.8 m (see the task's castLimit). */
export default defineZone({
  id: 'farmstead',
  name: 'Farmstead',
  order: 3,
  center: [0, 0, 34],
  island: { seed: 41, radius: 12, flatRadius: 11, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [0, 0, -7],
  setup(world, origin) {
    banner(world, offset(origin, [1.5, 0, -6]), 'flowerYellow');
  },
});
