import { defineObject } from '../types';

export default defineObject({
  id: 'hut',
  name: 'hut',
  synonyms: ['cabin', 'shack', 'cottage', 'wooden hut'],
  category: 'structures',
  blurb: 'A snug little wooden hut. Very flammable!',
  tags: ['flammable'],
  tintKeys: ['redDark', 'red'],
  burstColor: '#b07a43',
  voxelSize: 0.1,
  physics: { anchored: true, mass: 0, shape: 'box', friction: 0.6 },
  props: { burnTime: 50 },
  build(b) {
    const W = 24, D = 20, WH = 14;
    // floor + walls (x 0..W-1, z 0..D-1)
    b.box(0, 0, 0, W - 1, 0, D - 1, 'woodDark');
    b.box(0, 1, 0, W - 1, WH - 1, D - 1, 'wood');
    // plank lines
    b.paint((x, y, z, c) => (c === 'wood' && y % 3 === 2 ? 'woodLight' : undefined));
    // corner posts
    for (const [px, pz] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) b.box(px, 0, pz, px, WH - 1, pz, 'woodDark');
    // door and windows on the front (+z)
    b.box(10, 1, D - 1, 13, 9, D - 1, 'woodDark');
    b.box(11, 1, D - 1, 12, 8, D - 1, 'black');
    b.box(3, 5, D - 1, 6, 9, D - 1, 'white');
    b.box(17, 5, D - 1, 20, 9, D - 1, 'white');
    // gabled roof along x, with overhang
    for (let i = 0; i <= 10; i++) {
      const z0 = -2 + i, z1 = D + 1 - i;
      if (z0 > z1) break;
      b.box(-2, WH + i, z0, W + 1, WH + i, z0 + 1, i % 2 ? 'red' : 'redDark');
      b.box(-2, WH + i, z1 - 1, W + 1, WH + i, z1, i % 2 ? 'red' : 'redDark');
      if (z1 - z0 < 3) b.box(-2, WH + i, z0, W + 1, WH + i, z1, 'redDark');
    }
    // chimney
    b.box(18, WH + 2, 8, 20, WH + 8, 10, 'stone');
  },
});
