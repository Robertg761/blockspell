import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { heroStandingIn, hold } from '../predicates';
import { defineTask, offset } from '../types';
import cliffside from '../zones/10-cliffside';

// The old Sky Island puzzle, east of the Cliffside center. The ledge top is at
// local y = 3.6 over x -2..2, z -6.5..-2.5.
const f = new Frame(offset(cliffside.center, [5.5, 0, 0]));

const solutions: LevelSolution[] = [
  // Let the trampoline stop bouncing (it can skitter a meter or more), line up 1.9 m in front of
  // wherever it came to rest (twice, in case it was still sliding), hop onto the middle of the mat from
  // a standstill (walking into its side shoves it under the ledge), bounce straight up, and only steer
  // over once above the ledge top.
  { name: 'trampoline', steps: [{ cast: 'trampoline', at: [0, -0.9] }, { wait: 4 }, { walkTo: [0, 2.6], of: 'trampoline' }, { hold: {}, for: 1 }, { walkTo: [0, 1.9], of: 'trampoline' }, { hold: {}, for: 0.5 }, { hold: { dir: [0, -1], jump: true }, for: 0.12 }, { hold: {}, for: 1.45 }, { walkTo: [0, -4.4], timeout: 4 }] },
  { name: 'giant ramp', steps: [{ cast: 'giant ramp', at: [0, -0.1] }, { wait: 1.5 }, { walkTo: [0, -4.4], jump: true, timeout: 9 }] },
  { name: 'big ladder', steps: [{ cast: 'big ladder', at: [0, -2.3] }, { wait: 1.5 }, { walkTo: [0, -1.5] }, { hold: { dir: [0, -0.3] }, for: 0.4 }, { hold: { up: true }, for: 1.9 }, { hold: { dir: [0, -1], up: true }, for: 0.8 }, { walkTo: [0, -4.2], timeout: 3 }] },
  { name: 'giant stairs', steps: [{ cast: 'giant stairs', at: [0, 0.4] }, { wait: 1.5 }, { walkTo: [0, -4.4], up: true, timeout: 9 }] },
];

export default defineTask({
  id: 'floating-ledge',
  zone: 'cliffside',
  order: 4,
  title: 'Reach the floating ledge',
  hint: 'Get launched ("trampoline", "spring") or build your way up ("big ladder", "giant stairs").',
  setup(world) {
    // floating ledge with a rocky underside tapering downward
    f.staticBox(world, { position: [0, 3, -4.5], size: [4, 1.2, 4], color: 'dirt', topColor: 'grass' });
    f.staticBox(world, { position: [0, 2.3, -4.5], size: [3, 0.5, 3], color: 'stone' });
    f.staticBox(world, { position: [0, 1.85, -4.5], size: [1.75, 0.5, 1.75], color: 'stone' });
    f.staticBox(world, { position: [0, 1.5, -4.5], size: [0.75, 0.4, 0.75], color: 'stone' });
    // a rock and a flag on top
    f.staticBox(world, { position: [-1.4, 3.85, -5.6], size: [0.6, 0.5, 0.6], color: 'stone' });
    f.staticBox(world, { position: [1.3, 4.5, -5.6], size: [0.15, 1.8, 0.15], color: 'woodDark' });
    f.staticBox(world, { position: [1.65, 5.15, -5.6], size: [0.6, 0.4, 0.06], color: 'yellow' });
    const star = place(world, 'star', f.p(0, 3.6, -4.2), 'ledge-prize');
    if (star) world.removeTag(star, 'flies');
  },
  check: hold(1, heroStandingIn(f.box([-2, 3.4, -6.5], [2, 5, -2.5]))),
  start: f.p(0, 0, 3.5),
  solutions: solutions.map((s) => f.solution(s)),
});
