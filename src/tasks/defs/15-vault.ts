import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { heroIn } from '../predicates';
import { defineTask } from '../types';
import ruins from '../zones/50-ruins';

// The vault: a walled room, interior local x -6..-2, z -6..-2, walls 0.5 m
// thick and 2.2 m high (the hero jumps about 1.25 m). A locked wooden door
// fills the doorway in the front (+z) wall at x -4.9..-3.1.
const f = new Frame(ruins.center);
const WALL_H = 2.2;

const solutions: LevelSolution[] = [
  { name: 'key opens the door', steps: [{ cast: 'key', at: [-4, -1.1] }, { wait: 2 }, { walkTo: [-4, -4], timeout: 8 }] },
  { name: 'torch burns the door down', steps: [{ cast: 'torch', at: [-3.6, -1.2] }, { wait: 13 }, { walkTo: [-4, -4], timeout: 8 }], timeout: 10 },
  {
    name: 'stairs over the side wall',
    steps: [
      { walkTo: [1.7, -4] }, { cast: 'stairs', at: [-0.2, -4] }, { wait: 1.5 },
      { walkTo: [-3.5, -4], jump: true, timeout: 8 },
    ],
  },
  // like the floating ledge: hop onto the mat from a standstill, bounce straight up and only steer
  // over the wall near the top of the bounce (steering early carries the hero over the whole vault)
  {
    name: 'trampoline over the side wall',
    steps: [
      { walkTo: [1.6, -4] }, { cast: 'trampoline', at: [-0.5, -4] }, { wait: 3 },
      { walkTo: [1.4, 0], of: 'trampoline' }, { hold: {}, for: 0.5 },
      { hold: { dir: [-1, 0], jump: true }, for: 0.12 }, { hold: {}, for: 2 },
      { walkTo: [-4, -4], timeout: 4 },
    ],
  },
];

export default defineTask({
  id: 'vault',
  zone: 'ruins',
  order: 15,
  title: 'Get into the vault',
  hint: 'The vault door is locked. Find a way to open it, get rid of it, or go over the wall instead.',
  setup(world) {
    const wall = { color: 'stone', topColor: 'stoneDark' } as const;
    f.staticBox(world, { position: [-4, WALL_H / 2, -6.25], size: [5, WALL_H, 0.5], ...wall });
    f.staticBox(world, { position: [-6.25, WALL_H / 2, -4], size: [0.5, WALL_H, 4], ...wall });
    f.staticBox(world, { position: [-1.75, WALL_H / 2, -4], size: [0.5, WALL_H, 4], ...wall });
    // front wall on both sides of the doorway
    f.staticBox(world, { position: [-5.7, WALL_H / 2, -1.75], size: [1.6, WALL_H, 0.5], ...wall });
    f.staticBox(world, { position: [-2.3, WALL_H / 2, -1.75], size: [1.6, WALL_H, 0.5], ...wall });
    // treasure inside: a chest and a pile of gold
    f.staticBox(world, { position: [-4, 0.35, -5.4], size: [1.2, 0.7, 0.7], color: 'woodDark', topColor: 'wood' });
    f.staticBox(world, { position: [-4, 0.75, -5.4], size: [1.25, 0.1, 0.75], color: 'flowerYellow' });
    f.staticBox(world, { position: [-5.2, 0.15, -4.6], size: [0.7, 0.3, 0.6], color: 'flowerYellow' });
    place(world, 'door', f.p(-4, 0, -1.75), 'vault-door');
  },
  check: heroIn(f.box([-6, -0.3, -6], [-2, 1.5, -2])),
  start: f.p(-4, 0, 1.5),
  solutions: solutions.map((s) => f.solution(s)),
});
