import { defineObject } from '../types';

export default defineObject({
  id: 'ladder',
  name: 'ladder',
  synonyms: ['stepladder', 'step ladder', 'wooden ladder', 'rope ladder'],
  category: 'tools',
  blurb: 'Lean it on something and climb.',
  tags: ['climbable', 'flammable'],
  tintKeys: ['wood', 'woodDark'],
  burstColor: '#b07a43',
  physics: { mass: 4, shape: 'auto', maxBoxes: 10, friction: 0.8 },
  props: { burnTime: 8 },
  build(b) {
    const H = 25, W = 8;
    b.box(0, 0, 0, 0, H, 1, 'woodDark');
    b.box(W, 0, 0, W, H, 1, 'woodDark');
    for (let y = 2; y < H; y += 4) b.box(1, y, 0, W - 1, y, 1, 'wood');
  },
});
