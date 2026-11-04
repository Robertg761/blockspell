import { banner, Decor } from '../decor';
import { defineZone, offset } from '../types';

/**
 * Windmill Hill (southeast, a bridge from the hub): a small farm island with a windmill whose sails won't
 * turn, a bell hung too high to reach and a treehouse in the air. The tasks build their own props
 * (src/tasks/defs/18 to 20); the zone adds the orchard around them.
 */
export default defineZone({
  id: 'windmill',
  name: 'Windmill Hill',
  order: 6,
  center: [31.1, 0, 31.1],
  island: { seed: 71, radius: 11, flatRadius: 10, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [-6.5, 0, -6.5],
  setup(world, origin) {
    banner(world, offset(origin, [-5.5, 0, -7.5]), 'flowerYellow');
    const d = new Decor(origin);
    // an orchard along the edges, clear of the three task sites
    d.tree(-8.5, 3.5, 2.5, 'leaf').tree(-8, 7, 2.25, 'leafDark').tree(7.5, 7.5, 2.5).tree(3.5, -9, 2.75, 'leafDark').tree(-2, -8.5, 2.25).tree(9.5, -3, 2.5);
    d.hay(-8.8, -2).hay(-8.8, -1).hay(-7.9, -1.4);
    d.fence(-3, 9.2, 4.5, 9.2);
    d.rock(8.5, 3.5, 1).rock(-9.5, -5.5, 0.75, 'stoneDark').rock(-4, 8.5, 0.5);
    d.flowers(-2.5, 3.2, 'flowerYellow').flowers(3.5, 3.5).flowers(-1.5, -5.5, 'flowerYellow').flowers(4, 8.2, 'flowerRed').flowers(1, -3, 'flowerRed');
    d.shrub(9, 0.5).shrub(-6, 9).shrub(5, -6.5);
    d.build(world);
  },
});
