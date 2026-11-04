import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { all, gone, heightOf, hold, restingIn } from '../predicates';
import { defineTask, offset } from '../types';
import cliffside from '../zones/10-cliffside';

// The old Star on the Cliff puzzle, west of the Cliffside center.
const f = new Frame(offset(cliffside.center, [-5.5, 0, 1]));

const solutions: LevelSolution[] = [
  {
    // cast a little out from the cliff face: a ladder spawned touching it gets shoved over
    name: 'ladder, climb, walk into star',
    steps: [
      { cast: 'ladder', at: [0, -1.2] },
      { wait: 1.5 },
      { walkTo: [0, -0.7] },
      { hold: { dir: [0, -1], up: true }, for: 3 },
      { walkTo: [0, -4.5], timeout: 5 },
    ],
  },
  {
    name: 'stairs walk up into star',
    steps: [
      { cast: 'stairs', at: [0, 0] },
      { wait: 1.5 },
      { walkTo: [0, -1.3], jump: true, timeout: 8 },
      { walkTo: [0, -4.5], jump: true, timeout: 6 },
    ],
  },
  // Off to the star's left, so the blast throws it right and down onto the grass (from the front it
  // flies back over the cliff, onto the rock shoulder or off the island).
  { name: 'bomb on the ledge', steps: [{ walkTo: [0, 1.5] }, { cast: 'bomb', at: [-1.6, 2.5, -3] }, { wait: 6 }] },
];

export default defineTask({
  id: 'star-on-cliff',
  zone: 'cliffside',
  order: 3,
  title: 'Star on the cliff',
  hint: 'The cliff is too high to jump. Try a "ladder" or "stairs" to climb up, or knock the star off some other way.',
  setup(world) {
    const rock = { color: 'stone', topColor: 'grass' } as const;
    // The cliff: front face at local z = -1.5, top at y = 2.5, plus a rocky shoulder.
    f.staticBox(world, { position: [0, 1.25, -3], size: [4, 2.5, 3], ...rock });
    f.staticBox(world, { position: [0, 1.75, -8.5], size: [6, 3.5, 2], ...rock });
    f.staticBox(world, { position: [-3.4, 0.5, -4], size: [2.4, 1, 3], ...rock });
    f.staticBox(world, { position: [-4.4, 1, -4.4], size: [1, 2, 1.6], ...rock });
    f.staticBox(world, { position: [3.2, 0.375, -3], size: [1.6, 0.75, 1.6], ...rock });
    // The star, kept on the ledge (no flying).
    const star = place(world, 'star', f.p(0, 2.5, -3.6), 'cliff-star');
    if (star) world.removeTag(star, 'flies');
  },
  // the star is down on the ground and has stopped, for a second
  check: hold(1, all(heightOf('cliff-star', '<=', 0.3), restingIn('cliff-star', cliffside.bounds))),
  fail: (w) => (gone('cliff-star')(w) ? 'The star is gone!' : null),
  start: f.p(0, 0, 3.5),
  solutions: solutions.map((s) => f.solution(s)),
});
