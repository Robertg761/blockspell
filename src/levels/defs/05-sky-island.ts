import { defineLevel } from '../types';
import { heroInside, heroStandingAbove, holdFor, place } from '../goals';
import { makeRng } from '../../core/rng';
import { buildBoulder, buildFlag, buildShrub, buildUnderside } from '../../engine/scenery';

export default defineLevel({
  id: 'sky-island',
  name: 'Sky Island',
  order: 5,
  // Kept out of the menu: the puzzle now lives in the open world. The level stays as a regression baseline for its solutions.
  hidden: true,
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
    world.addStaticBox({ position: [0, 2.3, -4.5], size: [3, 0.5, 3], style: 'hidden' });
    world.addStaticBox({ position: [0, 1.85, -4.5], size: [1.75, 0.5, 1.75], style: 'hidden' });
    world.addStaticBox({ position: [0, 1.5, -4.5], size: [0.75, 0.4, 0.75], style: 'hidden' });
    world.addScenery((b) => buildUnderside(b, 32, 32, 12, 8), { position: [0, 2.375, -4.5], voxelSize: 0.125 });
    // rocks and a flag on top
    world.addStaticBox({ position: [-1.4, 3.85, -5.6], size: [0.6, 0.5, 0.6], style: 'hidden' });
    world.addStaticBox({ position: [1.3, 4.5, -5.6], size: [0.15, 1.8, 0.15], style: 'hidden' });
    world.addStaticBox({ position: [1.65, 5.15, -5.6], size: [0.6, 0.4, 0.06], style: 'hidden' });
    const dress = makeRng(9);
    world.addScenery((b) => b.merge(buildBoulder(dress, 2.4)), { position: [-1.4, 3.625, -5.6], voxelSize: 0.125 });
    world.addScenery((b) => b.merge(buildShrub(dress, '#f0a6c0')), { position: [-1.3, 3.625, -3.2], voxelSize: 0.125 });
    world.addScenery((b) => buildFlag(b, 34, '#f4c93a', '#d9a92a', '#fff6d8'), { position: [1.3, 3.625, -5.6] });
    const star = place(world, 'star', [0, 3.6, -4.2], 'prize');
    if (star) world.removeTag(star, 'flies');
  },
  goal: {
    text: 'Reach the floating island',
    check: holdFor(1, (w) => heroInside(w, [-2, 3.4, -6.5], [2, 5, -2.5]) && heroStandingAbove(w, 3.4), 'island'),
  },
  solutions: [
    // Let the trampoline stop bouncing (it can skitter a meter or more), line up 1.9 m in front of
    // wherever it came to rest (twice, in case it was still sliding), hop onto the middle of the mat from
    // a standstill (walking into its side shoves it under the island), bounce straight up, and only steer
    // over once above the island top.
    { name: 'trampoline', steps: [{ cast: 'trampoline', at: [0, -0.9] }, { wait: 4 }, { walkTo: [0, 2.6], of: 'trampoline' }, { hold: {}, for: 1 }, { walkTo: [0, 1.9], of: 'trampoline' }, { hold: {}, for: 0.5 }, { hold: { dir: [0, -1], jump: true }, for: 0.12 }, { hold: {}, for: 1.45 }, { walkTo: [0, -4.4], timeout: 4 }] },
    { name: 'giant ramp', steps: [{ cast: 'giant ramp', at: [0, -0.1] }, { wait: 1.5 }, { walkTo: [0, -4.4], jump: true, timeout: 9 }] },
    { name: 'big ladder', steps: [{ cast: 'big ladder', at: [0, -2.3] }, { wait: 1.5 }, { walkTo: [0, -1.5] }, { hold: { dir: [0, -0.3] }, for: 0.4 }, { hold: { up: true }, for: 1.9 }, { hold: { dir: [0, -1], up: true }, for: 0.8 }, { walkTo: [0, -4.2], timeout: 3 }] },
    { name: 'giant stairs', steps: [{ cast: 'giant stairs', at: [0, 0.4] }, { wait: 1.5 }, { walkTo: [0, 0.2], up: true, timeout: 7 }, { wait: 0.7 }, { walkTo: [0, -0.5], jump: true, timeout: 3 }, { wait: 0.7 }, { walkTo: [0, -3.4], jump: true, timeout: 4 }] },
  ],
});
