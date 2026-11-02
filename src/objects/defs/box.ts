import { defineObject } from '../types';

export default defineObject({
  id: 'box',
  name: 'box',
  synonyms: ['cardboard box', 'carton', 'package', 'parcel', 'cube'],
  category: 'stuff',
  blurb: 'A sturdy cardboard box. Stackable, flammable.',
  tags: ['flammable'],
  tintKeys: ['cardboard', 'cardboardDark'],
  burstColor: '#c9a26b',
  physics: { mass: 2, shape: 'box', friction: 0.6, restitution: 0.05 },
  props: { burnTime: 6 },
  build(b) {
    const S = 7;
    b.box(0, 0, 0, S, S, S, 'cardboard');
    // darker edges
    b.paint((x, y, z) => {
      const edges = [x === 0 || x === S, y === 0 || y === S, z === 0 || z === S].filter(Boolean).length;
      return edges >= 2 ? 'cardboardDark' : undefined;
    });
    // tape across the top and down the front/back
    b.box(3, S, 0, 4, S, S, 'tape');
    b.box(3, S - 2, 0, 4, S, 0, 'tape');
    b.box(3, S - 2, S, 4, S, S, 'tape');
  },
});
