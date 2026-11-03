import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { countIn, hold } from '../predicates';
import { defineTask, offset } from '../types';
import farmstead from '../zones/30-farmstead';

// The sheep pen, northeast of the Farmstead center and away from the pup's
// pen: interior local x -2..2, z -2..2, fence 1.6 m high (too high to jump),
// with a 2 m gate in the west side (z -1..1). Spells aimed into the pen only
// reach 1.8 m, so animals can't just be cast in from outside: walk in, or get
// them to walk in.
const f = new Frame(offset(farmstead.center, [6.5, 0, -3.5]));
const H = 1.6;

const solutions: LevelSolution[] = [
  { name: 'walk in and cast 3 sheep', steps: [{ walkTo: [-0.6, 0], timeout: 8 }, { cast: '3 sheep', at: [0.8, 0] }], timeout: 8 },
  {
    name: '5 carrots in the pen lure 3 rabbits',
    steps: [{ walkTo: [-0.9, 0], timeout: 8 }, { cast: '5 carrots', at: [0.4, 0] }, { walkTo: [-4.2, -2.4], timeout: 6 }, { cast: '3 rabbits', at: [-4.4, 0] }],
    timeout: 20,
  },
  {
    name: '5 bread in the pen lure 3 ducks',
    steps: [{ walkTo: [-0.9, 0], timeout: 8 }, { cast: '5 bread', at: [0.4, 0] }, { walkTo: [-4.2, -2.4], timeout: 6 }, { cast: '3 ducks', at: [-4.4, 0] }],
    timeout: 20,
  },
  // 5 flowers or 5 apples luring 3 sheep or 3 pigs also works now and then, but the big animals jam in the gate too often
];

export default defineTask({
  id: 'fill-pen',
  zone: 'farmstead',
  order: 11,
  title: 'Fill the pen',
  hint: 'Get three animals into the sheep pen and keep them there for a moment. Animals go where their favorite food is.',
  castLimit: { box: f.box([-2.4, -1, -2.4], [2.4, 6, 2.4]), range: 1.8 },
  setup(world) {
    const fence = { color: 'wood', topColor: 'woodLight' } as const;
    f.staticBox(world, { position: [0, H / 2, -2.2], size: [4.8, H, 0.4], ...fence });
    f.staticBox(world, { position: [0, H / 2, 2.2], size: [4.8, H, 0.4], ...fence });
    f.staticBox(world, { position: [2.2, H / 2, 0], size: [0.4, H, 4], ...fence });
    f.staticBox(world, { position: [-2.2, H / 2, -1.6], size: [0.4, H, 1.2], ...fence });
    f.staticBox(world, { position: [-2.2, H / 2, 1.6], size: [0.4, H, 1.2], ...fence });
    // gate posts and a hay bale inside
    for (const z of [-1.15, 1.15]) f.staticBox(world, { position: [-2.2, H / 2 + 0.15, z], size: [0.5, H + 0.3, 0.3], color: 'woodDark' });
    f.staticBox(world, { position: [1.4, 0.35, -1.4], size: [0.9, 0.7, 0.7], color: 'flowerYellow', topColor: 'sand' });
  },
  // three animals (cast or lured, never the hero) inside for 3 s
  check: hold(3, countIn({ tag: 'animal', notTag: 'controlled' }, f.box([-2, -0.5, -2], [2, 3, 2]), 3)),
  start: f.p(-4.5, 0, 0),
  solutions: solutions.map((s) => f.solution(s)),
});
