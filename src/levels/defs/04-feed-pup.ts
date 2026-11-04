import { defineLevel } from '../types';
import { fed, place, watchFed } from '../goals';
import { buildBowl, buildKennel, buildSign, SIGN_PAW } from '../../engine/scenery';

// Pen: interior x -3..3, z -1.6..-6, walls 2.2 m high (hero jumps ~1.25 m). Front wall z -1..0.
const WALL_H = 2.2;

export default defineLevel({
  id: 'feed-pup',
  name: 'Feed the Pup',
  order: 4,
  description: 'A hungry pup is shut in a tall pen. You can only cast so far, and the wall is in the way.',
  hint: 'You can\'t cast over the wall from down here. Get up on top of it (a "ladder"?), or fling a "bone" over some other way.',
  terrain: { flatRadius: 12, trees: 5, rocks: 3 },
  hero: [0, 0, 2.6],
  castRange: 1.8,
  par: 2,
  camera: { position: [3.5, 10.5, 8], target: [0, 0.3, -2.8] },
  spawnPoint: [0, 0, 1.5],
  setup(world) {
    const wall = { color: 'wood', topColor: 'woodDark' } as const;
    // Front wall (thick), side walls, back wall.
    world.addStaticBox({ position: [0, WALL_H / 2, -0.8], size: [6.5, WALL_H, 1.6], ...wall });
    world.addStaticBox({ position: [-3.25, WALL_H / 2, -4.05], size: [0.5, WALL_H, 4.9], ...wall });
    world.addStaticBox({ position: [3.25, WALL_H / 2, -4.05], size: [0.5, WALL_H, 4.9], ...wall });
    world.addStaticBox({ position: [0, WALL_H / 2, -6.25], size: [7, WALL_H, 0.5], ...wall });
    // Kennel and bowl inside the pen.
    world.addStaticBox({ position: [-2.1, 0.55, -5.3], size: [1.4, 1.1, 1.2], style: 'hidden' });
    world.addStaticBox({ position: [-0.8, 0.1, -4.6], size: [0.5, 0.2, 0.5], style: 'hidden' });
    world.addScenery((b) => buildKennel(b, 24, 16, 20), { position: [-2.1, 0, -5.3] });
    world.addScenery(buildBowl, { position: [-0.8, 0, -4.6] });
    // Decorative sign outside.
    world.addStaticBox({ position: [-2.6, 0.4, 1.2], size: [0.2, 0.8, 0.2], style: 'hidden' });
    world.addStaticBox({ position: [-2.6, 0.9, 1.2], size: [1.1, 0.5, 0.15], style: 'hidden' });
    world.addScenery((b) => buildSign(b, SIGN_PAW), { position: [-2.6, 0, 1.2], rotationY: 0.35 });
    watchFed(world, 'pup');
    place(world, 'dog', [1.5, 0, -4], 'pup');
  },
  goal: { text: 'Feed the hungry pup', check: (w) => fed(w, 'pup') },
  solutions: [
    {
      name: 'ladder up, drop a bone in',
      steps: [
        { walkTo: [0, 1.5] }, { cast: 'ladder', at: [0, 0.4] }, { wait: 1.5 },
        { walkTo: [0, 0.95] }, { hold: { dir: [0, -1], up: true }, for: 1.85 },
        { wait: 1 },
        { walkTo: [-1, -3], timeout: 3 }, // inside the pen, clear of the pup's path to the bone
        { cast: 'bone', at: [0, 0, -1.9] },
      ],
    },
    {
      name: 'stairs up and jump, then a bone',
      steps: [
        { walkTo: [0, 3.4] }, { cast: 'stairs', at: [0, 1.3] }, { wait: 1.5 },
        { walkTo: [0, 0.35], timeout: 5 },
        { walkTo: [0, -2.9], jump: true, timeout: 5 },
        { walkTo: [-1, -3], timeout: 3 },
        { cast: 'bone', at: [0, 0, -1.9] },
      ],
    },
    {
      name: 'trampoline bounce, then a bone',
      steps: [
        { cast: 'trampoline', at: [0, 1.0] }, { wait: 1.5 },
        { walkTo: [0, 1.0], jump: true }, { hold: { dir: [0, -1], jump: true }, for: 3 },
        { wait: 1 },
        { cast: 'bone', at: [0, 0, -5.2] },
      ],
    },
    {
      name: 'big box stepping stone',
      steps: [
        { walkTo: [0, 2.5] }, { cast: 'big box', at: [0, 0.85] }, { wait: 1.5 },
        { cast: 'box', at: [0, 1.85] }, { wait: 1 },
        { walkTo: [0, 3.1], timeout: 2 }, // a run-up: walking in from touching range shoves the box out sideways
        { walkTo: [0, -2.9], jump: true, timeout: 9 },
        { walkTo: [-1, -3], timeout: 3 },
        { cast: 'bone', at: [0, 0, -1.9] },
      ],
    },
  ],
});
