import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { hold, restingIn } from '../predicates';
import { defineTask } from '../types';
import lake, { LAKE } from '../zones/40-lake';

// Zone-local frame (+z is south). A barrel floats in the southeast of the lake, east of the islet; the
// dock is the pier and landing stage on the east shore, north of it. The barrel counts once it bobs
// (or rests) by the dock for 2 s: in the water along the landing stage, around the pier and in the
// nook north of it, or up on the dock itself. The scripted ways push it north from the south bank.
const f = new Frame(lake.center);
const BARREL: [number, number] = [1.5, 3];

const solutions: LevelSolution[] = [
  { name: 'fan blows it across', steps: [{ walkTo: [1.5, 8] }, { cast: 'fan', at: [1.5, 6.5] }], timeout: 20 },
  { name: 'big bomb on the bank', steps: [{ walkTo: [1.5, 8.5] }, { cast: 'big bomb', at: [1.5, 6.4] }, { walkTo: [1.5, 9.5] }], timeout: 20 },
  { name: 'flaming tnt on the bank', steps: [{ walkTo: [1.5, 8.5] }, { cast: 'flaming tnt', at: [1.5, 6.4] }, { walkTo: [1.5, 9.5] }], timeout: 20 },
  { name: 'boat pushes it', steps: [{ walkTo: [1.5, 8] }, { cast: 'boat', at: [1.5, 4.7] }], timeout: 20 },
];

export default defineTask({
  id: 'barrel-dock',
  zone: 'lake',
  order: 14,
  title: 'Bring the barrel to the dock',
  hint: 'The barrel floats, so it can be pushed across the water. Blow it, blast it or bump it over to the pier.',
  setup(world) {
    place(world, 'barrel', f.p(BARREL[0], LAKE.surface - 0.45, BARREL[1]), 'barrel');
  },
  check: hold(2, restingIn('barrel', f.box([0, LAKE.bed, -6.5], [4.5, 1.5, LAKE.dock.stage]))),
  start: f.p(1.5, 0, 8.5),
  solutions: solutions.map((s) => f.solution(s)),
});
