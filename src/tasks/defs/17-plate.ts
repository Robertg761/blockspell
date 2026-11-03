import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { massIn } from '../predicates';
import { defineTask, offset } from '../types';
import ruins from '../zones/50-ruins';

// An old pressure plate (2 x 2 m) north of the Ruins center. It needs 40 kg on
// it: more than the hero (30 kg) alone.
const f = new Frame(offset(ruins.center, [3.5, 0, -4.5]));

const solutions: LevelSolution[] = [
  { name: 'anvil', steps: [{ cast: 'anvil', at: [0, 0] }], timeout: 6 },
  { name: 'rock', steps: [{ cast: 'rock', at: [0, 0] }], timeout: 6 },
  { name: 'cow', steps: [{ cast: 'cow', at: [0, 0] }], timeout: 6 },
  { name: 'car', steps: [{ cast: 'car', at: [0, 0] }], timeout: 6 },
];

export default defineTask({
  id: 'plate',
  zone: 'ruins',
  order: 17,
  title: 'Press the plate',
  hint: 'The plate needs more weight than you. Put something heavy on it.',
  setup(world) {
    f.staticBox(world, { position: [0, 0.04, 0], size: [2.5, 0.08, 2.5], color: 'stoneDark' });
    f.staticBox(world, { position: [0, 0.1, 0], size: [2, 0.08, 2], color: 'goal' });
  },
  check: massIn(f.box([-1.1, -0.2, -1.1], [1.1, 1.8, 1.1]), 40),
  start: f.p(0, 0, 3.5),
  solutions: solutions.map((s) => f.solution(s)),
});
