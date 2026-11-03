import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { distinctEaters } from '../predicates';
import { defineTask, offset } from '../types';
import farmstead from '../zones/30-farmstead';

// The breakfast yard, west of the Farmstead center: a low fence around a
// rabbit, a duck, a monkey, a mouse and a pig, each with its own favorite
// food. Feeding three different kinds of animal there completes the round.
const f = new Frame(offset(farmstead.center, [-7, 0, -0.5]));
const H = 0.9;
export const DINERS: [string, number, number][] = [['rabbit', -1, -1.5], ['duck', 1, -1.5], ['monkey', -1, 1.5], ['mouse', 1, 1.5], ['pig', 0, 0]];

const solutions: LevelSolution[] = [
  { name: 'carrot, bread and banana', steps: [{ cast: 'carrot', at: [0, -1] }, { wait: 1 }, { cast: 'bread', at: [0.5, -1] }, { wait: 1 }, { cast: 'banana', at: [-0.5, 1] }], timeout: 15 },
  { name: 'cheese, apple and carrot', steps: [{ cast: 'cheese', at: [0.5, 1] }, { wait: 1 }, { cast: 'apple', at: [0, 0.5] }, { wait: 1 }, { cast: 'carrot', at: [-0.5, -1] }], timeout: 15 },
  { name: 'banana, cheese and bread', steps: [{ cast: 'banana', at: [-0.5, 1] }, { wait: 1 }, { cast: 'cheese', at: [0.5, 1] }, { wait: 1 }, { cast: 'bread', at: [0.5, -1] }], timeout: 15 },
];

export default defineTask({
  id: 'breakfast',
  zone: 'farmstead',
  order: 12,
  title: 'Breakfast round',
  hint: 'Everyone in the breakfast yard is hungry, and each animal likes something different. Feed three different animals.',
  setup(world) {
    const fence = { color: 'wood', topColor: 'woodLight' } as const;
    f.staticBox(world, { position: [0, H / 2, -2.7], size: [4.8, H, 0.3], ...fence });
    f.staticBox(world, { position: [0, H / 2, 2.7], size: [4.8, H, 0.3], ...fence });
    f.staticBox(world, { position: [-2.25, H / 2, 0], size: [0.3, H, 5.1], ...fence });
    f.staticBox(world, { position: [2.25, H / 2, 0], size: [0.3, H, 5.1], ...fence });
    // feeding trough
    f.staticBox(world, { position: [-1.6, 0.2, 0], size: [0.5, 0.4, 1.6], color: 'woodDark', topColor: 'dirt' });
    for (const [id, x, z] of DINERS) place(world, id, f.p(x, 0, z), 'diner');
  },
  check: distinctEaters(f.box([-2.4, -1, -2.9], [2.4, 4, 2.9]), 3, 'kind'),
  start: f.p(4.5, 0, 0),
  solutions: solutions.map((s) => f.solution(s)),
});
