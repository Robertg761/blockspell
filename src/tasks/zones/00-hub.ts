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
  },
});
