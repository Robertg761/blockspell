import { ignite } from '../../behaviors/lib/fire';
import { firstWithRole, withRole } from '../../levels/goals';
import { banner, Decor } from '../decor';
import { defineZone, offset } from '../types';

/** Ember Village (east): huts, a barn, brush and a frozen cart. */
export default defineZone({
  id: 'ember',
  name: 'Ember Village',
  order: 2,
  center: [34, 0, 0],
  island: { seed: 31, radius: 12, flatRadius: 11, hilliness: 0.3, trees: 0, rocks: 3 },
  entry: [-7, 0, 0],
  setup(world, origin) {
    banner(world, offset(origin, [-6, 0, 1.5]), 'red');
    // a scorched village: stone cottages, dead trees, lamps and a well (all fireproof statics)
    const d = new Decor(origin);
    d.cottage(-6, -6, 'redDark', 'stone').cottage(6, -6.5, 'stoneDark', 'stone');
    d.well(-8.5, 4.5);
    d.deadTree(2, -9.5).deadTree(9.8, -2).deadTree(-9, -2.5, 3).deadTree(1, 10).deadTree(-2.5, 9.5, 2);
    d.rock(-2.5, -8.5, 1).rock(9, 6, 1.25).rock(-10.5, 1.5, 0.75).rock(4.5, 9.5, 0.75, 'stoneDark');
    d.lamp(-2, 2.5).lamp(2, 2.5).lamp(-6, -3).lamp(5.5, -3.5);
    // ash and charred ground patches
    d.box(-4, 0.125, -9, 1.5, 0.25, 1, 'charcoal').box(8.5, 0.125, -5, 1, 0.25, 1.5, 'ash').box(-8, 0.125, -7, 1, 0.25, 1, 'ash');
    d.build(world);
  },
  // The hut (task "Save the hut") and the brush ("Stop the brush fire") only catch fire once someone is here to see it.
  enter(world) {
    const hut = firstWithRole(world, 'hut');
    if (hut && !hut.state.burning) {
      ignite(hut, world);
      hut.state.burnLeft = hut.state.burnTotal = 50;
      world.flags['ember:hutLit'] = true;
    }
    const brush = withRole(world, 'brush');
    for (const b of brush) ignite(b, world);
    if (brush.length) world.flags['ember:brushLit'] = true;
  },
});
