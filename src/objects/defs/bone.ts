import { defineObject } from '../types';

export default defineObject({
  id: 'bone',
  name: 'bone',
  synonyms: ['dog bone', 'chew toy', 'dog treat', 'treat'],
  category: 'food',
  blurb: 'A tasty bone. Dogs go wild for it.',
  tags: ['edible'],
  tintKeys: ['bone', 'boneShade'],
  burstColor: '#f0e8d4',
  voxelSize: 0.06,
  physics: { mass: 0.4, shape: 'auto', maxBoxes: 3, friction: 0.7 },
  build(b) {
    b.box(2, 1, 1, 11, 2, 2, 'bone');
    for (const x of [0, 12]) {
      b.box(x, 0, 0, x + 1, 1, 1, 'bone');
      b.box(x, 2, 2, x + 1, 3, 3, 'bone');
      b.box(x, 0, 2, x + 1, 1, 3, 'boneShade');
      b.box(x, 2, 0, x + 1, 3, 1, 'boneShade');
      b.box(x, 1, 1, x + 1, 2, 2, 'bone');
    }
  },
});
