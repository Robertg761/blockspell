import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { RING_NEXT, RINGS } from '../../objects/defs/level-rings';
import { Frame } from '../frame';
import { defineTask, offset } from '../types';
import hub from '../zones/00-hub';

// Three hoops in a line, 5.5 m up, heading north across the Commons from just south of the middle.
// Fly through them in order before the time runs out. The hero starts below, with room for a vehicle ahead.
const f = new Frame(offset(hub.center, [-1, 0, 8]));
const Y = 5.5;

const solutions: LevelSolution[] = [
  { name: 'helicopter', steps: [{ cast: 'helicopter', at: [0, -2.4] }, { wait: 1 }, { press: 'grab' }, { hold: { jump: true }, for: 2.2 }, { hold: { drive: [0, 1] }, for: 3.5 }], timeout: 6 },
  { name: 'ufo', steps: [{ cast: 'ufo', at: [0, -1.6] }, { wait: 1 }, { press: 'grab' }, { hold: { jump: true }, for: 1.5 }, { hold: { drive: [0, 1] }, for: 3 }], timeout: 6 },
  { name: 'hot air balloon', steps: [{ cast: 'hot air balloon', at: [0, -1.6] }, { wait: 1 }, { press: 'grab' }, { hold: { jump: true }, for: 5 }, { hold: { drive: [0, 1] }, for: 9 }], timeout: 6 },
];

export default defineTask({
  id: 'rings',
  zone: 'hub',
  order: 24,
  title: 'Fly through the rings',
  hint: `Three golden rings hang over the Commons. Fly through them in order, within ${RINGS.seconds} seconds of the first. Anything that flies will do: try "helicopter" or "ufo".`,
  setup(world) {
    world.flags[RING_NEXT] = 0;
    for (let i = 0; i < RINGS.count; i++) place(world, 'ring', f.p(0, Y, -6 - i * 8), `ring-${i}`, { exact: true, grounded: false, yaw: 0, props: { index: i, glow: 3 } });
  },
  check: (w) => ((w.flags[RING_NEXT] as number | undefined) ?? 0) >= RINGS.count,
  start: f.p(0, 0, 0),
  solutions: solutions.map((s) => f.solution(s)),
});
