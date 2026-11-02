import { defineObject } from '../types';

export default defineObject({
  id: 'plank',
  name: 'wood plank',
  synonyms: ['wood plank', 'wooden plank', 'board', 'wood', 'lumber', 'timber', 'plank of wood', 'wooden board'],
  category: 'stuff',
  blurb: 'A long board. Bridges gaps, floats, burns.',
  tags: ['flammable', 'floats'],
  tintKeys: ['wood', 'woodDark', 'woodLight'],
  burstColor: '#b07a43',
  physics: { mass: 2.5, shape: 'box', friction: 0.8 },
  props: { burnTime: 9 },
  build(b, rng) {
    const L = 21;
    b.box(0, 0, 0, L, 1, 4, 'wood');
    for (let x = 0; x <= L; x++) {
      if (rng() < 0.3) b.set(x, 1, Math.floor(rng() * 5), 'woodDark');
      if (rng() < 0.2) b.set(x, 1, Math.floor(rng() * 5), 'woodLight');
    }
    b.box(0, 0, 0, 0, 1, 4, 'woodDark');
    b.box(L, 0, 0, L, 1, 4, 'woodDark');
  },
});
