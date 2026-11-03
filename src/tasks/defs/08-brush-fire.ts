import { adjectives } from '../../adjectives';
import { place, withRole } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { alive, all, gone, hold, noneBurning } from '../predicates';
import { defineTask, offset } from '../types';
import ember from '../zones/20-ember';

// A patch of dry brush (5 bushes, two rows) south of the Ember Village
// center, with a barn beside it. The brush is lit when the hero first walks
// into the village (see the zone's `enter`) and each bush burns for about a
// minute, so it has to be put out all at once before it burns away.
const f = new Frame(offset(ember.center, [1.5, 0, 4.5]));
export const BRUSH: [number, number][] = [[-1.7, -0.6], [0, -0.6], [1.7, -0.6], [-0.85, 0.6], [0.85, 0.6]];
export const BRUSH_BURN = 60;

const solutions: LevelSolution[] = [
  { name: 'giant water', steps: [{ cast: 'giant water', at: [0, 0] }], timeout: 8 },
  { name: 'giant rain cloud', steps: [{ cast: 'giant cloud', at: [0, 0] }], timeout: 15 },
  { name: 'two rain clouds', steps: [{ cast: '2 clouds', at: [0, 0] }], timeout: 15 },
  { name: 'giant wet bridge laid over it', steps: [{ cast: 'giant wet bridge', at: [0, 0] }], timeout: 8 },
];

export default defineTask({
  id: 'brush-fire',
  zone: 'ember',
  order: 8,
  title: 'Stop the brush fire',
  hint: 'The whole patch of brush is burning. Put it all out at once, with something big and wet laid over it, or make it rain.',
  setup(world) {
    for (const [x, z] of BRUSH) {
      const b = place(world, 'bush', f.p(x, 0, z), 'brush');
      if (b) b.state.burnTime = BRUSH_BURN;
    }
    const brown = adjectives.get('brown');
    place(world, 'hut', f.p(5.5, 0, -0.5), 'barn', brown ? { adjectives: [brown] } : {});
  },
  // the brush was lit, none of it is burning now and some is left, and the barn stands, for 2 s
  check: hold(2, all((w) => w.flags['ember:brushLit'] === true, alive('brush'), noneBurning({ role: 'brush' }), alive('barn'), noneBurning({ role: 'barn' }))),
  fail: (w) => (gone('barn')(w) ? 'The barn burned down!' : w.flags['ember:brushLit'] && !withRole(w, 'brush').length ? 'The brush burned away!' : null),
  start: f.p(-3, 0, 3),
  solutions: solutions.map((s) => f.solution(s)),
});
