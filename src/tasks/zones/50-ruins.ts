import { banner, Decor } from '../decor';
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
    // broken columns, a fallen column and rubble, clear of the vault, the altar and the plate
    const d = new Decor(origin);
    d.pillar(0, -8.5, 3).pillar(3.5, -8.5, 1.5, true).pillar(7.5, -2, 2.5, true).pillar(8, 1.5, 3).pillar(-8.5, 0, 2, true).pillar(-1.5, 7.5, 3).pillar(-7.5, 6, 1.25, true);
    d.box(2, 0.375, 6.5, 2.5, 0.75, 0.75, 'stone', true).box(3.5, 0.375, 6.5, 0.5, 0.75, 1, 'stoneDark');
    d.rock(-1, -5.5, 0.5, 'stoneDark').rock(6, -6, 0.75).rock(-9, -4, 0.75, 'stoneDark').rock(5.5, 8, 0.5);
    d.reeds(0.5, 0.5, 'grassDark').reeds(-2.5, -9).reeds(9, -4.5);
    d.flowers(1.5, 3.5, 'flowerRed');
    d.build(world);
  },
});
