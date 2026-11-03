import { banner, Decor } from '../decor';
import { defineZone, offset } from '../types';

/** Cliffside (north): cliffs, a floating ledge and a summit. */
export default defineZone({
  id: 'cliffside',
  name: 'Cliffside',
  order: 1,
  center: [0, 0, -34],
  island: { seed: 21, radius: 12, flatRadius: 11, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [0, 0, 7],
  setup(world, origin) {
    banner(world, offset(origin, [1.5, 0, 6]), 'stoneDark');
    // rocky scenery around the edges, clear of the cliff, the ledge, the summit and the arch
    const d = new Decor(origin);
    d.pine(9.5, 1, 3.5).pine(8.5, 6).pine(3.5, 9).pine(-9.5, 1.5, 3.5).pine(-2.5, 10.5, 2.5);
    d.rock(7, 9, 1.25).rock(10, -4.5, 1.5).rock(-3.5, 8.5, 1).rock(-3, -10.5, 1.25).rock(9.5, -6.5, 0.75).rock(-10.5, -1.5, 1);
    // a rock spire
    d.box(10.5, 1.5, 3.5, 1, 3, 1, 'stone', true).box(10.5, 3.25, 3.5, 0.5, 0.5, 0.5, 'stoneDark');
    d.flowers(4.5, 6.5, 'flowerYellow').flowers(-1.5, 6.5).flowers(8.5, -8, 'flowerYellow');
    d.reeds(6.5, -9).reeds(-6.5, 9.5).reeds(1, 4.5);
    d.build(world);
  },
});
