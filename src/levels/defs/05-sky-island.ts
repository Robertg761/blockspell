import { defineLevel } from '../types';
import { heroInside, heroStandingAbove, holdFor, place } from '../goals';

export default defineLevel({
  id: 'sky-island',
  name: 'Sky Island',
  order: 5,
  description: 'A little island floats high above the meadow, far too high to jump to.',
  hint: 'Get launched ("trampoline", "spring") or build your way up ("big ladder", "giant stairs"). You can only cast about 6 m from where you stand.',
  terrain: { flatRadius: 12, trees: 4, rocks: 2 },
  hero: [0, 0, 3.5],
  killY: -6,
  castRange: 6,
  par: 2,
  camera: { position: [6, 5, 10], target: [0, 2.2, -2] },
  spawnPoint: [0, 0, 1.5],
  setup(world) {
    // Floating island: top at y = 3.6, x -2..2, z -6.5..-2.5. Rocky underside tapering downward.
    world.addStaticBox({ position: [0, 3, -4.5], size: [4, 1.2, 4], color: 'dirt', topColor: 'grass' });
    world.addStaticBox({ position: [0, 2.3, -4.5], size: [3, 0.5, 3], color: 'stone' });
    world.addStaticBox({ position: [0, 1.85, -4.5], size: [1.75, 0.5, 1.75], color: 'stone' });
    world.addStaticBox({ position: [0, 1.5, -4.5], size: [0.75, 0.4, 0.75], color: 'stone' });
    // rocks and a flag on top
    world.addStaticBox({ position: [-1.4, 3.85, -5.6], size: [0.6, 0.5, 0.6], color: 'stone' });
    world.addStaticBox({ position: [1.3, 4.5, -5.6], size: [0.15, 1.8, 0.15], color: 'woodDark' });
    world.addStaticBox({ position: [1.65, 5.15, -5.6], size: [0.6, 0.4, 0.06], color: 'yellow' });
    const star = place(world, 'star', [0, 3.6, -4.2], 'prize');
    if (star) world.removeTag(star, 'flies');
  },
  goal: {
    text: 'Reach the floating island',
    check: holdFor(1, (w) => heroInside(w, [-2, 3.4, -6.5], [2, 5, -2.5]) && heroStandingAbove(w, 3.4), 'island'),
  },
  solutions: [
    // Let the trampoline stop bouncing, hop onto the middle of the mat from a standstill (walking into its
    // side shoves it under the island), bounce straight up, and only steer over once above the island top.
    { name: 'trampoline', steps: [{ cast: 'trampoline', at: [0, -0.9] }, { wait: 4 }, { walkTo: [0, 1] }, { hold: {}, for: 0.5 }, { hold: { dir: [0, -1], jump: true }, for: 0.12 }, { hold: {}, for: 1.45 }, { walkTo: [0, -4.4], timeout: 4 }] },
    { name: 'giant ramp', steps: [{ cast: 'giant ramp', at: [0, -0.1] }, { wait: 1.5 }, { walkTo: [0, -4.4], jump: true, timeout: 9 }] },
    { name: 'big ladder', steps: [{ cast: 'big ladder', at: [0, -2.3] }, { wait: 1.5 }, { walkTo: [0, -1.5] }, { hold: { dir: [0, -0.3] }, for: 0.4 }, { hold: { up: true }, for: 1.9 }, { hold: { dir: [0, -1], up: true }, for: 0.8 }, { walkTo: [0, -4.2], timeout: 3 }] },
    { name: 'giant stairs', steps: [{ cast: 'giant stairs', at: [0, 0.4] }, { wait: 1.5 }, { walkTo: [0, 0.2], up: true, timeout: 7 }, { wait: 0.7 }, { walkTo: [0, -0.5], jump: true, timeout: 3 }, { wait: 0.7 }, { walkTo: [0, -3.4], jump: true, timeout: 4 }] },
  ],
});
