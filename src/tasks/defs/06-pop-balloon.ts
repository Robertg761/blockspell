import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { latch } from '../predicates';
import { place } from '../../levels/goals';
import { defineTask, offset } from '../types';
import cliffside from '../zones/10-cliffside';

// A rock arch southwest of the Cliffside center: two pillars and a lintel 5.5 m
// up. A balloon floated up under the lintel and is stuck there, boxed in by
// the pillars and two lips hanging off the lintel's front and back edges.
const f = new Frame(offset(cliffside.center, [-6, 0, 5]));
const TOP = 5.5;

const solutions: LevelSolution[] = [
  { name: 'flying cactus', steps: [{ cast: 'flying cactus', at: [0, 0, 0] }], timeout: 10 },
  { name: 'the sun rises past it', steps: [{ cast: 'sun', at: [0, 0, 0] }], timeout: 10 },
  { name: 'flaming balloon', steps: [{ cast: 'flaming balloon', at: [0, 0, 0] }], timeout: 10 },
  { name: 'bomb underneath', steps: [{ cast: 'bomb', at: [0, 0, 0] }], timeout: 10 },
  { name: 'flying sword', steps: [{ cast: 'flying sword', at: [0, 0, 0] }], timeout: 10 },
];

export default defineTask({
  id: 'pop-balloon',
  zone: 'cliffside',
  order: 6,
  title: 'Pop the stuck balloon',
  hint: 'The balloon is stuck up under the arch, out of reach. Pop it with something sharp or hot that can get up there, or a blast.',
  setup(world) {
    const rock = { color: 'stone', topColor: 'grass' } as const;
    f.staticBox(world, { position: [-1.6, TOP / 2, 0], size: [0.8, TOP, 2], ...rock });
    f.staticBox(world, { position: [1.6, TOP / 2, 0], size: [0.8, TOP, 2], ...rock });
    f.staticBox(world, { position: [0, TOP + 0.25, 0], size: [4, 0.5, 2], ...rock });
    for (const z of [-0.875, 0.875]) f.staticBox(world, { position: [0, TOP - 0.3, z], size: [2.4, 0.6, 0.25], color: 'stoneDark' });
    const b = place(world, 'balloon', f.p(0, TOP - 1.75, 0), 'snag');
    b?.body.velocity.set(0, 0, 0);
  },
  check: latch('popped', ({ entity }) => entity.state.role === 'snag'),
  start: f.p(3.5, 0, 2.5),
  solutions: solutions.map((s) => f.solution(s)),
});
