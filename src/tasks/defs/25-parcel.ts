import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { restingIn } from '../predicates';
import { defineTask } from '../types';
import lake, { LAKE } from '../zones/40-lake';

// A parcel on the east shore, addressed to the islet. Carry it aboard something, or throw it if your arm's
// good enough: it counts once it comes to rest on the islet. Same frame as the islet task, centered on it.
const f = new Frame([lake.center[0] + LAKE.x, lake.center[1], lake.center[2] + LAKE.z]);
const R = LAKE.islet.r;
const PARCEL: [number, number] = [9.3, 0];

/** Picks the parcel up behind the hero's start, on a straight line from the islet: vehicles cast from there head right for it. */
const pickUp = [{ walkTo: [8.6, 0] }, { press: 'grab' }, { wait: 0.3 }] satisfies LevelSolution['steps'];

const solutions: LevelSolution[] = [
  { name: 'sail it over', steps: [...pickUp, { walkTo: [6.6, 0] }, { cast: 'boat', at: [4.7, 0] }, { wait: 1.5 }, { press: 'grab' }, { hold: { drive: [0, 1] }, for: 1.6 }, { wait: 0.5 }, { press: 'grab' }], timeout: 8 },
  { name: 'helicopter', steps: [...pickUp, { cast: 'helicopter', at: [6.8, 0] }, { wait: 1 }, { press: 'grab' }, { hold: { jump: true }, for: 0.8 }, { hold: { drive: [0, 1] }, for: 0.95 }, { wait: 0.9 }, { press: 'toss' }], timeout: 8 },
  { name: 'ufo', steps: [...pickUp, { cast: 'ufo', at: [7.2, 0] }, { wait: 1 }, { press: 'grab' }, { hold: { jump: true }, for: 0.6 }, { hold: { drive: [0, 1] }, for: 1.05 }, { wait: 0.9 }, { press: 'toss' }], timeout: 8 },
];

export default defineTask({
  id: 'parcel',
  zone: 'lake',
  order: 15,
  title: 'Deliver the parcel to the islet',
  hint: 'Pick up the parcel and press E at a vehicle to take it along. Sail it over, or fly above the islet and press F to drop it.',
  setup(world) {
    place(world, 'box', f.p(PARCEL[0], 0, PARCEL[1]), 'parcel');
  },
  check: restingIn('parcel', f.box([-R - 0.2, LAKE.islet.h - 0.2, -R - 0.2], [R + 0.2, LAKE.islet.h + 1.5, R + 0.2]), 0.4),
  start: f.p(7.5, 0, 0),
  solutions: solutions.map((s) => f.solution(s)),
});
