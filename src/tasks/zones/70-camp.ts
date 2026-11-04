import { banner, Decor } from '../decor';
import { defineZone, offset } from '../types';

/**
 * Harvest Camp (southwest, a bridge from the hub): a clearing with a bare garden bed, an empty camp pad and a
 * piano on a little stage. The tasks build their own props (src/tasks/defs/21 to 23); the zone adds the
 * trees, hay and flowers around them.
 */
export default defineZone({
  id: 'camp',
  name: 'Harvest Camp',
  order: 7,
  center: [-31.1, 0, 31.1],
  island: { seed: 83, radius: 11, flatRadius: 10, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [6.5, 0, -6.5],
  setup(world, origin) {
    banner(world, offset(origin, [5.5, 0, -7.5]), 'flowerRed');
    const d = new Decor(origin);
    // trees around the rim, clear of the three task sites
    d.tree(-8.5, -6, 2.5, 'leafDark').tree(-9, 0, 2.25).tree(-6.5, 8.5, 2.5, 'leaf').tree(7.5, 8.5, 2.25, 'leafDark').tree(9.5, 3.5, 2.5).tree(2, -9.5, 2.5);
    d.hay(9, -2.5).hay(9, -1.6).hay(8.1, -2);
    d.fence(-9.5, 6, -9.5, 2.8);
    d.rock(0, 9, 0.9).rock(-9.5, -9, 0.75, 'stoneDark').rock(8, -8.5, 0.5);
    d.flowers(-1.5, -4.5, 'flowerRed').flowers(3, 5.5).flowers(-4.5, 4.5, 'flowerYellow').flowers(6, 0.8, 'flowerYellow');
    d.shrub(-7, 4.5).shrub(5.5, -6.5).shrub(-3, -9);
    d.build(world);
  },
});
