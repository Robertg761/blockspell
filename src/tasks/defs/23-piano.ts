import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { defineTask, offset } from '../types';
import camp from '../zones/70-camp';

// A piano on a low stage in the camp's south. It rings when something lands on it (src/behaviors/defs/musical.ts)
// and counts its notes: three make a tune.
const f = new Frame(offset(camp.center, [-2, 0, 5.5]));
const TOP = 2.5; // drop things from a little above the lid

const drop = (spell: string, x: number): LevelSolution['steps'] => [{ cast: spell, at: [x, TOP, 0] }, { wait: 0.7 }];

const solutions: LevelSolution[] = [
  { name: 'three balls', steps: [...drop('ball', -0.5), ...drop('ball', 0), ...drop('ball', 0.5)], timeout: 10 },
  { name: 'rock, box and apple', steps: [...drop('rock', -0.5), ...drop('box', 0), ...drop('apple', 0.5)], timeout: 10 },
  { name: 'a rain of coins', steps: [...drop('coin', -0.6), ...drop('coin', -0.2), ...drop('coin', 0.2), ...drop('coin', 0.6)], timeout: 10 },
];

export default defineTask({
  id: 'piano',
  zone: 'camp',
  order: 23,
  title: 'Play a tune',
  hint: 'The piano plays a note whenever something lands on it. Drop things onto it until it has rung three times.',
  setup(world) {
    f.staticBox(world, { position: [0, 0.1, 0], size: [3.4, 0.2, 2.4], color: 'woodDark', topColor: 'wood' });
    place(world, 'piano', f.p(0, 0.2, 0), 'piano', { yaw: 0 });
  },
  check: (w) => w.living().some((e) => e.state.role === 'piano' && ((e.state.plinks as number | undefined) ?? 0) >= 3),
  start: f.p(0, 0.2, 4),
  solutions: solutions.map((s) => f.solution(s)),
});
