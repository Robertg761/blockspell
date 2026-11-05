import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { heroStandingIn, hold } from '../predicates';
import { defineTask, offset } from '../types';
import windmill from '../zones/60-windmill';

// A treehouse floor 3.6 m up on a thick trunk, in the zone's east. The frame is turned half a circle so the
// platform lies toward the island's middle and the hero starts on its outer side.
const f = new Frame(offset(windmill.center, [6, 0, -4]), Math.PI);

const solutions: LevelSolution[] = [
  { name: 'trampoline', steps: [{ cast: 'trampoline', at: [0, -0.9] }, { wait: 4 }, { walkTo: [0, 2.6], of: 'trampoline' }, { hold: {}, for: 1 }, { walkTo: [0, 1.9], of: 'trampoline' }, { hold: {}, for: 0.5 }, { hold: { dir: [0, -1], jump: true }, for: 0.12 }, { hold: {}, for: 1.45 }, { walkTo: [0, -4.4], timeout: 4 }] },
  { name: 'giant ramp', steps: [{ cast: 'giant ramp', at: [0, -0.1] }, { wait: 1.5 }, { walkTo: [0, -4.4], jump: true, timeout: 9 }] },
  { name: 'big ladder', steps: [{ cast: 'big ladder', at: [0, -2.3] }, { wait: 1.5 }, { walkTo: [0, -1.5] }, { hold: { dir: [0, -0.3] }, for: 0.4 }, { hold: { up: true }, for: 1.9 }, { hold: { dir: [0, -1], up: true }, for: 0.8 }, { walkTo: [0, -4.2], timeout: 3 }] },
  { name: 'giant stairs', steps: [{ cast: 'giant stairs', at: [0, 0.4] }, { wait: 1.5 }, { walkTo: [0, -4.4], up: true, timeout: 9 }] },
];

export default defineTask({
  id: 'treehouse',
  zone: 'windmill',
  order: 20,
  title: 'Reach the treehouse',
  hint: 'The floor is 3.6 m up. Get launched ("trampoline") or build your way up ("big ladder", "giant stairs", "giant ramp"), then stand in the treehouse for a moment.',
  setup(world) {
    // the platform: a wooden floor on a thick trunk
    f.staticBox(world, { position: [0, 3, -4.5], size: [4, 1.2, 4], color: 'woodDark', topColor: 'wood' });
    f.staticBox(world, { position: [0, 1.2, -4.5], size: [0.8, 2.4, 0.8], color: 'bark' });
    // a rail post, a pennant and a pot plant on top, kept to the back edge
    f.staticBox(world, { position: [-1.4, 3.85, -5.6], size: [0.6, 0.5, 0.6], color: 'woodDark' });
    f.staticBox(world, { position: [1.3, 4.5, -5.6], size: [0.15, 1.8, 0.15], color: 'woodDark' });
    f.staticBox(world, { position: [1.65, 5.15, -5.6], size: [0.6, 0.4, 0.06], color: 'red' });
    const star = place(world, 'star', f.p(0, 3.6, -4.2), 'treehouse-prize');
    if (star) world.removeTag(star, 'flies');
  },
  // 0.4 past the floor on every side: the hero can stand with their center over the rim
  check: hold(1, heroStandingIn(f.box([-2.4, 3.4, -6.9], [2.4, 5, -2.1]))),
  start: f.p(0, 0, 3.5),
  solutions: solutions.map((s) => f.solution(s)),
});
