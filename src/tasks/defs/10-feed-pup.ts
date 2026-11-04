import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { latch } from '../predicates';
import { defineTask, offset } from '../types';
import farmstead from '../zones/30-farmstead';

// The old Feed the Pup puzzle. Pen interior local x -3..3, z -1.6..-6, walls
// 2.2 m high (the hero jumps about 1.25 m); front wall z -1.6..0. Spells aimed
// anywhere in the pen (walls included) only reach 1.8 m, so the hero has to get
// up there; the rest of the Farmstead uses the normal range.
const f = new Frame(offset(farmstead.center, [0, 0, 5]));
const WALL_H = 2.2;

const solutions: LevelSolution[] = [
  {
    name: 'ladder up, drop a bone in',
    steps: [
      { walkTo: [0, 1.5] }, { cast: 'ladder', at: [0, 0.4] }, { wait: 1.5 },
      { walkTo: [0, 0.95] }, { hold: { dir: [0, -1], up: true }, for: 1.85 },
      { wait: 1 },
      { cast: 'bone', at: [0, 0, -1.9] },
    ],
  },
  {
    name: 'stairs up and jump, then a bone',
    steps: [
      { walkTo: [0, 3.0] }, { cast: 'stairs', at: [0, 1.3] }, { wait: 1.5 },
      { walkTo: [0, -0.5], jump: true, timeout: 8 },
      { wait: 1 },
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
    name: 'climb a tree by the wall, then a bone',
    steps: [
      { walkTo: [0, 1.6] }, { cast: 'tree', at: [0, 0.6] }, { wait: 1.5 },
      { walkTo: [0, 1.1] }, { hold: { dir: [0, -1], up: true }, for: 3 },
      { walkTo: [0, -0.6], up: true, timeout: 6 }, // up: climb again if we slipped off
      { wait: 1 },
      { cast: 'bone', at: [0, 0, -1.9] },
    ],
  },
  {
    name: 'throw a bone over the wall',
    steps: [
      { walkTo: [0, 5] }, { cast: 'bone', at: [0, 4.6] }, { wait: 1.2 }, { walkTo: [0, 0.5], of: 'bone' },
      { press: 'grab' }, { wait: 0.4 }, { hold: { dir: [0, -1] }, for: 0.2 }, { wait: 0.5 }, { press: 'toss' },
    ],
  },
  {
    name: 'carry a bone up the ladder and over the wall',
    steps: [
      { walkTo: [0, 1.6] }, { cast: 'bone', at: [0, 1.2] }, { wait: 1.2 }, { press: 'grab' }, { wait: 0.4 },
      { cast: 'ladder', at: [0, 0.4] }, { wait: 1.5 },
      { walkTo: [0, 0.95] }, { hold: { dir: [0, -1], up: true }, for: 1.85 },
      { hold: { dir: [0, -1] }, for: 1.2 }, { wait: 0.6 }, { press: 'grab' },
    ],
  },
  // "big box" plus a "box" as a step also works for players, but the boxes land at random angles and the
  // hero shoves the big one aside about 1 time in 20, too often for a scripted check.
];

export default defineTask({
  id: 'feed-pup',
  zone: 'farmstead',
  order: 10,
  title: 'Feed the pup',
  hint: 'You can\'t cast over the pen wall from down here. Get up on top of it (a "ladder"?), or fling food over some other way.',
  castLimit: { box: f.box([-3.6, -1, -6.6], [3.6, 6, 0.1]), range: 1.8 },
  setup(world) {
    const wall = { color: 'wood', topColor: 'woodDark' } as const;
    // front wall (thick), side walls, back wall
    f.staticBox(world, { position: [0, WALL_H / 2, -0.8], size: [6.5, WALL_H, 1.6], ...wall });
    f.staticBox(world, { position: [-3.25, WALL_H / 2, -4.05], size: [0.5, WALL_H, 4.9], ...wall });
    f.staticBox(world, { position: [3.25, WALL_H / 2, -4.05], size: [0.5, WALL_H, 4.9], ...wall });
    f.staticBox(world, { position: [0, WALL_H / 2, -6.25], size: [7, WALL_H, 0.5], ...wall });
    // kennel and bowl inside the pen
    f.staticBox(world, { position: [-2.1, 0.55, -5.3], size: [1.4, 1.1, 1.2], color: 'woodDark', topColor: 'wood' });
    f.staticBox(world, { position: [-0.8, 0.1, -4.6], size: [0.5, 0.2, 0.5], color: 'stone' });
    place(world, 'dog', f.p(1.5, 0, -4), 'pup');
  },
  check: latch('ate', ({ eater }) => eater.state.role === 'pup'),
  start: f.p(0, 0, 2.6),
  solutions: solutions.map((s) => f.solution(s)),
});
