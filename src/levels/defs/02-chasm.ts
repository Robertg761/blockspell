import { defineLevel } from '../types';
import { heroInside } from '../goals';

export default defineLevel({
  id: 'chasm',
  name: 'Cross the Chasm',
  order: 2,
  // Kept out of the menu: the puzzle now lives in the open world. The level stays as a regression baseline for its solutions.
  hidden: true,
  description: 'A gap too wide to jump lies between you and the flag.',
  hint: 'You can\'t jump that far. Try building a bridge, or launching yourself across.',
  terrain: null,
  hero: [-6.5, 0, 0],
  killY: -8,
  castRange: 7,
  par: 2,
  camera: { position: [0, 6.5, 19], target: [0, 0.2, 0] },
  spawnPoint: [-3, 0, 0],
  setup(world) {
    // near cliff: x -9..-3 ; far cliff: x 1..7 (gap 4 m)
    world.addStaticBox({ position: [-6, -2, 0], size: [6, 4, 4.5], color: 'stone', topColor: 'grass' });
    world.addStaticBox({ position: [4, -2, 0], size: [6, 4, 4.5], color: 'stone', topColor: 'grass' });
    // flagpole and goal marker on far side
    world.addStaticBox({ position: [5.5, 1.25, 0], size: [0.25, 2.5, 0.25], color: 'woodDark' });
    world.addStaticBox({ position: [5.9, 2.15, 0], size: [0.6, 0.5, 0.08], color: 'red' });
    world.addStaticBox({ position: [5.4, 2.4, 0], size: [0.4, 0.2, 0.08], color: 'redDark' });
    world.addStaticBox({ position: [5.5, 0.1, 0], size: [0.8, 0.2, 0.8], color: 'stone' });
  },
  goal: {
    text: 'Get to the flag on the other side',
    check: (w) => heroInside(w, [1.2, -0.3, -2.3], [7, 0.3, 2.3]),
  },
  solutions: [
    { name: 'big bridge', steps: [{ cast: 'big bridge', at: [-1, 0, 0] }, { wait: 1.5 }, { walkTo: [3, 0], timeout: 8 }] },
    { name: 'giant plank', steps: [{ cast: 'giant plank', at: [-1, 0, 0] }, { wait: 1.5 }, { walkTo: [3, 0], timeout: 8 }] },
    { name: 'trampoline', steps: [{ cast: 'trampoline', at: [-3.9, 0] }, { wait: 1.5 }, { hold: { dir: [1, 0], jump: true }, for: 4 }] },
    { name: 'spring', steps: [{ cast: 'spring', at: [-3.9, 0] }, { wait: 1.5 }, { hold: { dir: [1, 0], jump: true }, for: 4 }] },
  ],
});
