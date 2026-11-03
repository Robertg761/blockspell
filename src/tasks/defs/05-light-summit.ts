import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { countIn, hold } from '../predicates';
import { defineTask, offset } from '../types';
import cliffside from '../zones/10-cliffside';

// The summit: a sheer rock pillar 3.5 m high (2.4 m square), north of the
// Cliffside center between the star's cliff and the floating ledge. Anything
// that glows held up at summit height for 2 s lights it. Spells aimed at the
// top only reach 1.8 m, so a torch has to be brought up by the hero (or something that
// glows has to fly up by itself).
const f = new Frame(offset(cliffside.center, [0.5, 0, -6.5]));
const H = 3.5;

const solutions: LevelSolution[] = [
  { name: 'a star floats up', steps: [{ cast: 'star', at: [2.3, 0] }], timeout: 12 },
  { name: 'a ufo hovers over it', steps: [{ cast: 'ufo', at: [0, 2.6] }], timeout: 12 },
  { name: 'the sun rises over it', steps: [{ cast: 'sun', at: [0, 2.6] }], timeout: 12 },
  {
    name: 'giant stairs up, then a torch',
    steps: [
      { walkTo: [0, 7] }, { cast: 'giant stairs', at: [0, 4.1] }, { wait: 1.5 },
      { walkTo: [0, -0.2], up: true, timeout: 9 }, { wait: 0.5 },
      { cast: 'torch', at: [0, H, -0.4] },
    ],
    timeout: 8,
  },
];

export default defineTask({
  id: 'light-summit',
  zone: 'cliffside',
  order: 5,
  title: 'Light the summit',
  hint: 'Get something that glows up to the top of the rock pillar. Some glowing things fly by themselves.',
  castLimit: { box: f.box([-1.3, H - 0.3, -1.3], [1.3, 30, 1.3]), range: 1.8 },
  setup(world) {
    const rock = { color: 'stone', topColor: 'grass' } as const;
    f.staticBox(world, { position: [0, H / 2, 0], size: [2.4, H, 2.4], ...rock });
    f.staticBox(world, { position: [-1.2, 0.4, 0.9], size: [1, 0.8, 1], color: 'stoneDark' });
    // an empty stone bowl on top, waiting for a light
    f.staticBox(world, { position: [0.6, H + 0.15, -0.6], size: [0.5, 0.3, 0.5], color: 'stoneDark' });
  },
  check: hold(2, countIn({ tag: 'glows' }, f.box([-2.5, H - 0.2, -2.5], [2.5, H + 9, 2.5]))),
  start: f.p(0, 0, 4.5),
  solutions: solutions.map((s) => f.solution(s)),
});
