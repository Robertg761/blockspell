import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { latch } from '../predicates';
import { defineTask, offset } from '../types';
import hub from '../zones/00-hub';

// The beacon stands in the hub's northeast corner, off every path between the bridges.
// Its bowl top is 1.3 m up; anything hot that reaches the bowl lights it.
const f = new Frame(offset(hub.center, [5.5, 0, -5.5]));
const BOWL = 1.35;

const solutions: LevelSolution[] = [
  { name: 'torch in the bowl', steps: [{ cast: 'torch', at: [0, BOWL, 0] }], timeout: 8 },
  { name: 'fire in the bowl', steps: [{ cast: 'fire', at: [0, BOWL, 0] }], timeout: 8 },
  { name: 'candle in the bowl', steps: [{ cast: 'candle', at: [0, BOWL, 0] }], timeout: 8 },
  { name: 'flaming box dropped in', steps: [{ cast: 'flaming box', at: [0, BOWL, 0] }], timeout: 8 },
  { name: 'lava beside it', steps: [{ cast: 'lava', at: [1.3, 0] }], timeout: 8 },
];

export default defineTask({
  id: 'light-beacon',
  zone: 'hub',
  order: 1,
  title: 'Light the beacon',
  hint: 'The stone brazier needs a flame. Drop something hot into the bowl, or put something very hot right beside it.',
  setup(world) {
    place(world, 'beacon', f.p(0, 0, 0), 'beacon');
  },
  check: latch('ignite', ({ entity }) => entity.state.role === 'beacon'),
  start: f.p(-2.5, 0, 2.5),
  solutions: solutions.map((s) => f.solution(s)),
});
