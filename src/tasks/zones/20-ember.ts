import { ignite } from '../../behaviors/lib/fire';
import { firstWithRole } from '../../levels/goals';
import { banner } from '../decor';
import { defineZone, offset } from '../types';

/** Ember Village (east): huts, brush and a frozen cart. */
export default defineZone({
  id: 'ember',
  name: 'Ember Village',
  order: 2,
  center: [34, 0, 0],
  island: { seed: 31, radius: 12, flatRadius: 11, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [-7, 0, 0],
  setup(world, origin) {
    banner(world, offset(origin, [-6, 0, 1.5]), 'red');
  },
  // The hut (task "Save the hut") only catches fire once someone is here to see it.
  enter(world) {
    const hut = firstWithRole(world, 'hut');
    if (!hut || hut.state.burning) return;
    ignite(hut, world);
    hut.state.burnLeft = hut.state.burnTotal = 50;
    world.flags['ember:hutLit'] = true;
  },
});
