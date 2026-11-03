import { Decor } from '../decor';
import { defineZone, offset } from '../types';

/** Meadow Commons: the spawn hub at the origin, with bridges to every zone but the Ruins. */
export default defineZone({
  id: 'hub',
  name: 'Meadow Commons',
  order: 0,
  center: [0, 0, 0],
  island: { seed: 11, radius: 16, flatRadius: 15, hilliness: 0.3, trees: 0, rocks: 4 },
  entry: [0, 0, 5],
  setup(world, origin) {
    // signpost just off the middle (the paths between the bridges cross the center): one board per bridge, in that zone's color
    const at = (x: number, y: number, z: number) => offset(origin, [x + 2.6, y, z + 2.6]);
    world.addStaticBox({ position: at(0, 1, 0), size: [0.25, 2, 0.25], color: 'woodDark' });
    world.addStaticBox({ position: at(0, 1.7, -0.35), size: [0.12, 0.25, 0.5], color: 'stone' });
    world.addStaticBox({ position: at(0.35, 1.45, 0), size: [0.5, 0.25, 0.12], color: 'red' });
    world.addStaticBox({ position: at(0, 1.2, 0.35), size: [0.12, 0.25, 0.5], color: 'flowerYellow' });
    world.addStaticBox({ position: at(-0.35, 0.95, 0), size: [0.5, 0.25, 0.12], color: 'collar' });
    // home meadow scenery, kept off the paths between the bridges (the x and z axes and the northwest diagonal)
    const d = new Decor(origin);
    d.tree(10, -6).tree(5.5, -11).tree(-9, -3.5).tree(-8, -12.5).tree(-8, 10).tree(-11.5, 5).tree(5, 12, 2.25);
    d.pine(-5, 13).pine(12.5, -2.5, 3.5);
    d.cottage(9.5, 8, 'red').cottage(-4, -12.5, 'redDark', 'woodLight');
    d.well(6.5, 5.5);
    d.flowers(8, -3, 'flowerYellow').flowers(3.5, -8.5).flowers(-5, 4.5, 'flowerYellow').flowers(-9.5, 2.5).flowers(12, 4, 'flowerRed').flowers(-4, -4.5, 'flowerYellow').flowers(4.5, 9.5, 'flowerRed');
    d.shrub(7.5, 3.2).shrub(-6.5, 7.5).shrub(-12, -2.5).shrub(3, -13);
    d.rock(-7, 12.5, 1).rock(11, -9, 1.25).rock(-13, 2.5, 0.75);
    d.lamp(2, -2.5).lamp(-2, 2.5);
    d.build(world);
  },
});
