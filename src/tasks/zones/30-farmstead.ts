import { banner, Decor } from '../decor';
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
    // farm scenery: the farmhouse, a crop field, hay, trees and fences, clear of the pens and the yard
    const d = new Decor(origin);
    d.cottage(-6, 7, 'red').cottage(6.5, 7.5, 'redDark', 'woodLight');
    d.tree(9.5, 2.5).tree(-9.5, -4.5).tree(-3.5, 10, 2.25).tree(9, -7.5, 2);
    d.hay(3.5, 6.5).hay(3.8, 7.5).hay(-3, -6.5);
    d.well(-6, -7.5);
    // crop rows north of the sheep pen
    for (const z of [-9, -8.25, -7.5]) {
      d.box(4, 0.125, z, 3, 0.25, 0.5, 'dirt');
      for (const x of [2.75, 3.5, 4.25, 5, 5.25]) d.dot(x, 0.375, z, 'leaf');
    }
    d.fence(-9.5, 4.5, -4, 4.5).fence(9.5, 5, 9.5, 9);
    d.flowers(-2.5, -3.5, 'flowerYellow').flowers(2.5, -3).flowers(-9, 1.5, 'flowerRed').flowers(7, 4.5, 'flowerYellow');
    d.shrub(-10, -1.5).shrub(10.5, -2);
    d.build(world);
  },
});
