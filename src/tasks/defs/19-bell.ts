import { place, withRole } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { defineTask, offset } from '../types';
import windmill from '../zones/60-windmill';

// A brass bell on a wooden gallows in the zone's south. Its rim is 3 m up: out of reach of a jump.
const f = new Frame(offset(windmill.center, [1.5, 0, 6.5]));
const BELL_Y = 3.45;

const solutions: LevelSolution[] = [
  { name: 'rocket flies up into it', steps: [{ hold: { dir: [0, -1], jump: true }, for: 0.4 }, { wait: 0.9 }, { walkTo: [0, 1.7], timeout: 4 }, { wait: 0.3 }, { cast: 'rocket', at: [0, 0.3] }, { wait: 0.8 }, { press: 'use' }], timeout: 12 },
  { name: 'balloon floats up to it', steps: [{ cast: 'balloon', at: [0, 0.3] }], timeout: 14 },
  { name: 'bomb rattles it', steps: [{ cast: 'bomb', at: [1.8, 0.8] }], timeout: 14 },
  { name: 'flaming tnt rattles it', steps: [{ cast: 'flaming tnt', at: [-1.8, 0.8] }], timeout: 14 },
];

export default defineTask({
  id: 'bell',
  zone: 'windmill',
  order: 19,
  title: 'Ring the bell',
  hint: 'The bell hangs too high to reach. Send something up to knock it (something that flies or floats), or set off a blast close by.',
  setup(world) {
    const wood = { color: 'woodDark', topColor: 'wood' } as const;
    for (const x of [-1.3, 1.3]) f.staticBox(world, { position: [x, 2.15, 0], size: [0.3, 4.3, 0.3], ...wood });
    f.staticBox(world, { position: [0, 4.15, 0], size: [3, 0.3, 0.3], ...wood });
    f.staticBox(world, { position: [-0.65, 3.55, 0], size: [0.12, 0.12, 0.12], color: 'woodDark' });
    place(world, 'bell', f.p(0, BELL_Y, 0), 'bell', { exact: true });
  },
  check: (w) => withRole(w, 'bell').some((e) => !!e.state.rung),
  start: f.p(0, 0, 3.8),
  solutions: solutions.map((s) => f.solution(s)),
});
