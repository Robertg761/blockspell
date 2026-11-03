import { defineLevel } from '../types';
import { holdFor, place, restingBelow, withRole } from '../goals';

export default defineLevel({
  id: 'star-cliff',
  name: 'Star on the Cliff',
  order: 1,
  // Kept out of the menu: the puzzle now lives in the open world. The level stays as a regression baseline for its solutions.
  hidden: true,
  description: 'A star has gotten stuck on top of a tall cliff.',
  hint: 'The cliff is too high to jump. Try a "ladder" or "stairs" to climb up, or knock the star off some other way.',
  terrain: { flatRadius: 11, trees: 6, rocks: 3 },
  camera: { position: [7, 5, 10], target: [0, 1.6, -2] },
  spawnPoint: [0, 0, 1],
  hero: [0, 0, 3.5],
  castRange: 7,
  par: 1,
  setup(world) {
    // The cliff: a stone block with a grassy top, front face at z = -1.5, top at y = 2.5.
    world.addStaticBox({ position: [0, 1.25, -3], size: [4, 2.5, 3], color: 'stone', topColor: 'grass' });
    // Rocky shoulder behind and beside it for a bit of scenery.
    world.addStaticBox({ position: [0, 1.75, -8.5], size: [6, 3.5, 2], color: 'stone', topColor: 'grass' });
    world.addStaticBox({ position: [-3.4, 0.5, -4], size: [2.4, 1, 3], color: 'stone', topColor: 'grass' });
    world.addStaticBox({ position: [-4.4, 1, -4.4], size: [1, 2, 1.6], color: 'stone', topColor: 'grass' });
    world.addStaticBox({ position: [3.2, 0.375, -3], size: [1.6, 0.75, 1.6], color: 'stone', topColor: 'grass' });
    // A little wooden signpost near the start.
    world.addStaticBox({ position: [-2.2, 0.4, 0.5], size: [0.25, 0.8, 0.25], color: 'woodDark' });
    world.addStaticBox({ position: [-2.2, 0.9, 0.5], size: [1, 0.5, 0.2], color: 'wood' });
    // The star, kept on the ledge (no flying).
    const star = place(world, 'star', [0, 2.5, -3.6], 'star');
    if (star) world.removeTag(star, 'flies');
  },
  goal: {
    text: 'Bring the star down to the ground',
    check: holdFor(1, (w) => restingBelow(w, 'star', 0.3), 'star-down'),
  },
  fail: (w) => (withRole(w, 'star').length === 0 ? 'The star is gone! Try again.' : null),
  solutions: [
    {
      name: 'ladder, climb, walk into star',
      steps: [
        { cast: 'ladder', at: [0, -1.4] },
        { wait: 1.5 },
        { walkTo: [0, -0.9] },
        { hold: { dir: [0, -1], up: true }, for: 3 },
        { walkTo: [0, -4.5], timeout: 5 },
      ],
    },
    {
      name: 'stairs walk up into star',
      steps: [
        { cast: 'stairs', at: [0, 0] },
        { wait: 1.5 },
        { walkTo: [0, -1.3], jump: true, timeout: 8 },
        { walkTo: [0, -4.5], timeout: 6 },
      ],
    },
    // Off to the star's left, so the blast throws it right and down onto the grass (from the front it
    // flies back over the cliff, onto the rock shoulder or off the island).
    { name: 'bomb on the ledge', steps: [{ walkTo: [0, 1.5] }, { cast: 'bomb', at: [-1.6, 2.5, -3] }, { wait: 6 }] },
  ],
});
