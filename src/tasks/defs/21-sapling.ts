import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { countIn } from '../predicates';
import { defineTask, offset } from '../types';
import camp from '../zones/70-camp';

// A garden bed in the camp's west with one seed sitting on it. A seed that gets wet sprouts into a tree.
const f = new Frame(offset(camp.center, [-5, 0, -1]));

const solutions: LevelSolution[] = [
  { name: 'water on the seed', steps: [{ cast: 'water', at: [0, 0] }], timeout: 12 },
  { name: 'a cloud rains on it', steps: [{ cast: 'cloud', at: [0, 0] }], timeout: 25 },
  { name: 'a second, wet seed', steps: [{ cast: 'wet seed', at: [0.8, 0.8] }], timeout: 12 },
];

export default defineTask({
  id: 'sapling',
  zone: 'camp',
  order: 21,
  title: 'Grow the sapling',
  hint: 'A single seed sits on the garden bed, waiting. Seeds sprout into trees once they get wet.',
  setup(world) {
    f.staticBox(world, { position: [0, 0.1, 0], size: [3, 0.2, 3], color: 'dirt', topColor: 'dirt' });
    place(world, 'seed', f.p(0, 0.25, 0), 'seed');
  },
  check: countIn({ id: 'tree', noRole: true }, f.box([-1.6, -1, -1.6], [1.6, 8, 1.6])),
  start: f.p(0, 0, 4.5),
  solutions: solutions.map((s) => f.solution(s)),
});
