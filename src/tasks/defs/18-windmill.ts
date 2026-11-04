import { place, withRole } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { defineTask, offset } from '../types';
import windmill from '../zones/60-windmill';

// The windmill stands in the zone's west, its front (and its sails) facing south, toward the hero's start.
const f = new Frame(offset(windmill.center, [-5, 0, -2]));

const solutions: LevelSolution[] = [
  // the hero stands 6.5 m south; a fan cast between aims away from them, at the sails
  { name: 'fan blows on the sails', steps: [{ cast: 'fan', at: [0, 3.3] }], timeout: 12 },
  { name: 'rocket whooshes past', steps: [{ cast: 'rocket', at: [1.3, 1.4] }], timeout: 12 },
  { name: 'bomb shakes it', steps: [{ cast: 'bomb', at: [1.6, 2.2] }], timeout: 14 },
  { name: 'flaming tnt blast', steps: [{ cast: 'flaming tnt', at: [-1.6, 2.2] }], timeout: 14 },
];

export default defineTask({
  id: 'windmill',
  zone: 'windmill',
  order: 18,
  title: 'Spin the windmill',
  hint: 'The sails need a breeze. Blow on them with something that makes wind, or give them a shove: something fast flying past, or a big bang nearby.',
  setup(world) {
    place(world, 'windmill', f.p(0, 0, 0), 'windmill', { yaw: 0 });
  },
  check: (w) => withRole(w, 'windmill').some((e) => !!e.state.spun),
  start: f.p(0, 0, 6.5),
  solutions: solutions.map((s) => f.solution(s)),
});
