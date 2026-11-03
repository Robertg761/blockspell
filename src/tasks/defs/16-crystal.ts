import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { latch } from '../predicates';
import { defineTask, offset } from '../types';
import ruins from '../zones/50-ruins';

// A cursed crystal on a low altar, west of the Ruins center. It is fragile:
// a hard hit, a blast or anything heavy landing on it shatters it.
const f = new Frame(offset(ruins.center, [-5, 0, 3.5]));
const ALTAR = 0.5;

const solutions: LevelSolution[] = [
  { name: 'anvil drop', steps: [{ cast: 'anvil', at: [0, 0] }], timeout: 8 },
  { name: 'rock drop', steps: [{ cast: 'rock', at: [0, 0] }], timeout: 8 },
  { name: 'bomb', steps: [{ cast: 'bomb', at: [1.6, 0] }], timeout: 10 },
  { name: 'hammer drop', steps: [{ cast: 'hammer', at: [0, 0] }], timeout: 8 },
  { name: 'angry bear rams it', steps: [{ cast: 'angry bear', at: [1.8, 0] }], timeout: 12 },
];

export default defineTask({
  id: 'crystal',
  zone: 'ruins',
  order: 16,
  title: 'Shatter the cursed crystal',
  hint: 'Crystal is fragile. Drop something heavy on it, blow it up, or let something angry run into it.',
  setup(world) {
    f.staticBox(world, { position: [0, ALTAR / 2, 0], size: [1.2, ALTAR, 1.2], color: 'stoneDark', topColor: 'stone' });
    f.staticBox(world, { position: [0, 0.06, 0], size: [2, 0.12, 2], color: 'stone' });
    place(world, 'crystal', f.p(0, ALTAR, 0), 'crystal');
  },
  check: latch('broken', ({ entity }) => entity.state.role === 'crystal'),
  start: f.p(4.5, 0, 0),
  solutions: solutions.map((s) => f.solution(s)),
});
