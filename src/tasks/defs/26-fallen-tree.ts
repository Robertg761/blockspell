import { adjectives } from '../../adjectives';
import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { countIn, hold, not } from '../predicates';
import { defineTask, offset } from '../types';
import camp from '../zones/70-camp';

// A great fallen trunk blocking the north path at the Harvest Camp. It's too heavy to move by hand:
// saw it, chop it or burn it. It counts once the path is clear.
const f = new Frame(offset(camp.center, [-0.5, 0, -7]));

/** Fetches a tool cast beside the hero and walks up to the trunk. */
const fetchTool = (spell: string): LevelSolution['steps'] => [{ cast: spell, at: [1.6, 3.2] }, { wait: 1.2 }, { walkTo: [-0.9, 0], of: spell, timeout: 3 }, { press: 'grab' }, { walkTo: [0, 1.5], timeout: 4 }, { hold: { dir: [0, -1] }, for: 0.2 }];

const solutions: LevelSolution[] = [
  { name: 'chainsaw', steps: [...fetchTool('chainsaw'), { hold: { use: true }, for: 3 }], timeout: 6 },
  { name: 'axe', steps: [...fetchTool('axe'), { hold: { use: true }, for: 4 }], timeout: 6 },
  { name: 'fire', steps: [{ cast: 'fire', at: [0, 1.5] }], timeout: 30 },
];

export default defineTask({
  id: 'fallen-tree',
  zone: 'camp',
  order: 24,
  title: 'Clear the fallen tree',
  hint: 'A huge trunk blocks the north path, and it\'s too heavy to move. Cut it up with a "chainsaw" or an "axe", or burn it.',
  setup(world) {
    const giant = adjectives.get('giant');
    const trunk = place(world, 'log', f.p(0, 0, 0), 'fallen-tree', { adjectives: giant ? [giant] : undefined, yaw: Math.PI / 2 });
    if (trunk) trunk.state.choppable = true;
  },
  check: hold(1, not(countIn({ role: 'fallen-tree' }, f.box([-4, -0.5, -2], [4, 3, 2])))),
  start: f.p(0, 0, 4),
  solutions: solutions.map((s) => f.solution(s)),
});
