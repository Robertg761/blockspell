import { defineObject } from '../types';

export default defineObject({
  id: 'ball',
  name: 'ball',
  synonyms: ['beach ball', 'bouncy ball', 'sphere', 'orb', 'rubber ball'],
  category: 'toys',
  blurb: 'Boing! It bounces.',
  tags: ['bouncy'],
  tintKeys: ['red', 'redDark'],
  burstColor: '#e04848',
  spawnSound: 'boing',
  voxelSize: 0.09,
  physics: { mass: 0.5, shape: 'sphere', restitution: 0.82, friction: 0.4, angularDamping: 0.2, linearDamping: 0.02 },
  build(b) {
    b.sphere(4.5, 4.5, 4.5, 4.6, 'red');
    b.paint((_x, y) => (y === 4 || y === 5 ? 'white' : undefined));
    b.paint((x, y, z) => (y > 5 && (x + z) % 6 === 0 ? 'redDark' : undefined));
  },
});
