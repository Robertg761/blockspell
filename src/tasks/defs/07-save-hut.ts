import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { all, alive, gone, noneBurning } from '../predicates';
import { defineTask, offset } from '../types';
import ember from '../zones/20-ember';

// The old Put Out the Fire puzzle. The hut stands at local (0, -3); its fire
// is lit when the hero first walks into Ember Village (see the zone's `enter`).
const f = new Frame(offset(ember.center, [0, 0, -1]));

const solutions: LevelSolution[] = [
  { name: 'water', steps: [{ walkTo: [0, 1] }, { cast: 'water', at: [0, -1.4] }], timeout: 8 },
  { name: 'rain cloud', steps: [{ walkTo: [0, 1] }, { cast: 'cloud', at: [0, -2.5] }], timeout: 15 },
  { name: 'bucket', steps: [{ walkTo: [0, 1] }, { cast: 'bucket', at: [0, -1.5] }], timeout: 8 },
  { name: 'snowball', steps: [{ walkTo: [0, 1] }, { cast: 'snowball', at: [0, -1.5] }], timeout: 8 },
  { name: 'ice', steps: [{ walkTo: [0, 1] }, { cast: 'ice', at: [0, -1.5] }], timeout: 8 },
  { name: 'giant snowman', steps: [{ walkTo: [0, 1] }, { cast: 'giant snowman', at: [0, 0] }], timeout: 10 },
];

export default defineTask({
  id: 'save-hut',
  zone: 'ember',
  order: 7,
  title: 'Save the hut',
  hint: 'Fire hates water. Try something wet, or something that makes rain, or something very cold.',
  setup(world) {
    // stone path to the hut
    f.staticBox(world, { position: [0, 0.03, 1.5], size: [1.2, 0.06, 5], color: 'stone', topColor: 'stone' });
    place(world, 'hut', f.p(0, 0, -3), 'hut');
  },
  // the fire was lit (so the task can't finish before the hero arrives) and is out, with the hut still standing
  check: all((w) => w.flags['ember:hutLit'] === true, alive('hut'), noneBurning({ role: 'hut' })),
  fail: (w) => (gone('hut')(w) ? 'The hut burned down!' : null),
  start: f.p(0, 0, 5.5),
  solutions: solutions.map((s) => f.solution(s)),
});
