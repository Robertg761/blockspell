import { banner, Decor } from '../decor';
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
    // light lakeside decor around the rim (the middle is kept free for the lake)
    const d = new Decor(origin);
    d.tree(-9, -4.5, 2.75, 'leafDark').tree(-8, 5.5).tree(3, -10, 2.25);
    d.reeds(6, -7).reeds(5, 8).reeds(-4, -9.5).reeds(-3, 9.5).reeds(-10, 0.5);
    d.rock(8.5, -4.5, 1).rock(-6.5, -8, 0.75).rock(1, 10.5, 1);
    d.flowers(8, 4, 'flowerYellow').flowers(-6, 8.5).flowers(2.5, -7.5, 'flowerRed');
    d.build(world);
  },
});
