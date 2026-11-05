import ruins from '../zones/50-ruins';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { heroIn } from '../predicates';
import { defineTask } from '../types';

// The old Cross the Chasm puzzle, laid along the hub-to-Ruins line. Local +x
// points at the Ruins; local x = 0 is the middle of the 4 m gap, 25 m out
// from the hub center. Near ledge x -9..-3, far ledge x 1..7, both 4.5 m wide.
const [rx, , rz] = ruins.center;
const len = Math.hypot(rx, rz);
const [dx, dz] = [rx / len, rz / len];
export const GAP_MID = 25;
export const gapFrame = new Frame([dx * GAP_MID, 0.06, dz * GAP_MID], Math.atan2(-dz, dx));
const f = gapFrame;

export default defineTask({
  id: 'cross-gap',
  zone: 'hub',
  order: 2,
  title: 'Cross the gap to the Ruins',
  hint: 'The gap is too wide to jump. Build a bridge across it, or get launched over.',
  setup(world) {
    const cliff = { color: 'stone', topColor: 'grass' } as const;
    f.staticBox(world, { position: [-6, -2, 0], size: [6, 4, 4.5], ...cliff });
    f.staticBox(world, { position: [4, -2, 0], size: [6, 4, 4.5], ...cliff });
    // flagpole on the far side
    f.staticBox(world, { position: [5.5, 1.25, 1.6], size: [0.25, 2.5, 0.25], color: 'woodDark' });
    f.staticBox(world, { position: [5.9, 2.15, 1.6], size: [0.6, 0.5, 0.08], color: 'red' });
    f.staticBox(world, { position: [5.4, 2.4, 1.6], size: [0.4, 0.2, 0.08], color: 'redDark' });
  },
  check: heroIn([[1.2, -0.3, -2.3], [7, 0.3, 2.3]], f),
  start: f.p(-6.5, 0, 0),
  solutions: ([
    { name: 'big bridge', steps: [{ cast: 'big bridge', at: [-1, 0, 0] }, { wait: 1.5 }, { walkTo: [3, 0], timeout: 8 }] },
    { name: 'giant plank', steps: [{ cast: 'giant plank', at: [-1, 0, 0] }, { wait: 1.5 }, { walkTo: [3, 0], timeout: 8 }] },
    { name: 'trampoline', steps: [{ cast: 'trampoline', at: [-3.9, 0] }, { wait: 1.5 }, { hold: { dir: [1, 0], jump: true }, for: 4 }] },
    { name: 'spring', steps: [{ cast: 'spring', at: [-3.9, 0] }, { wait: 1.5 }, { hold: { dir: [1, 0], jump: true }, for: 4 }] },
    { name: 'fly a helicopter over', steps: [{ cast: 'helicopter', at: [-4, 0] }, { wait: 1 }, { walkTo: [-5.6, 0] }, { press: 'grab' }, { hold: { drive: [0, 1] }, for: 1.6 }, { wait: 0.6 }, { press: 'grab' }] },
  ] as LevelSolution[]).map((s) => f.solution(s)),
});
