import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { heroIn } from '../predicates';
import { defineTask } from '../types';
import lake, { LAKE } from '../zones/40-lake';

// Local frame at the lake center; the islet (radius 1.5 m, 0.5 m high) sits in the middle of the
// water, 4.5 m from every shore. The hero starts on the east shore, facing it across the water.
const f = new Frame([lake.center[0] + LAKE.x, lake.center[1], lake.center[2] + LAKE.z]);
const R = LAKE.islet.r;

const solutions: LevelSolution[] = [
  { name: 'big bridge', steps: [{ walkTo: [6.5, 0] }, { cast: 'big bridge', at: [3.75, 0] }, { wait: 2 }, { walkTo: [0, 0], timeout: 8 }] },
  { name: 'giant plank', steps: [{ walkTo: [6.5, 0] }, { cast: 'giant plank', at: [3.75, 0] }, { wait: 2 }, { walkTo: [0, 0], jump: true, timeout: 8 }] },
  { name: 'giant log', steps: [{ walkTo: [6.5, 0] }, { cast: 'giant log', at: [3.75, 0] }, { wait: 2.5 }, { walkTo: [0, 0], jump: true, timeout: 8 }] },
  { name: 'giant ice', steps: [{ walkTo: [6.5, 0] }, { cast: 'giant ice', at: [3.75, 0] }, { wait: 3 }, { walkTo: [0, 0], jump: true, timeout: 8 }] },
];

export default defineTask({
  id: 'islet',
  zone: 'lake',
  order: 13,
  title: 'Reach the islet',
  hint: "You can't swim, and the water is too wide to jump. Make something to walk across, or something that floats to hop on.",
  check: heroIn(f.box([-R - 0.1, LAKE.islet.h - 0.2, -R - 0.1], [R + 0.1, LAKE.islet.h + 2, R + 0.1])),
  start: f.p(7.5, 0, 0),
  solutions: solutions.map((s) => f.solution(s)),
});
