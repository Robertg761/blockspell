import { defineObject } from '../types';

export default defineObject({
  id: 'dog',
  name: 'dog',
  synonyms: ['puppy', 'pup', 'doggy', 'doggo', 'hound', 'pooch', 'canine'],
  category: 'animals',
  blurb: 'A good dog. Loves snacks, hates fire.',
  tags: ['animal', 'eats'],
  diet: ['bone', 'steak', 'burger', 'pizza', 'cookie'],
  voice: 'bark',
  tintKeys: ['fur', 'furDark', 'furLight'],
  burstColor: '#c98a4f',
  spawnSound: 'bark',
  voxelSize: 0.08,
  physics: { mass: 12, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.2, linearDamping: 0.1 },
  props: { speed: 2.4, sight: 12 },
  build(b, rng) {
    const patch = rng() > 0.5;
    // legs
    for (const [x, z] of [[0, 1], [4, 1], [0, 9], [4, 9]]) b.box(x, 0, z, x + 1, 3, z + 1, 'furDark');
    // body
    b.box(0, 3, 0, 5, 7, 11, 'fur');
    b.box(1, 3, 2, 4, 3, 9, 'furLight'); // belly
    if (patch) b.box(0, 6, 3, 2, 7, 6, 'furDark');
    // neck + collar
    b.box(1, 7, 9, 4, 8, 11, 'fur');
    b.box(0, 7, 10, 5, 7, 11, 'collar');
    // head
    b.box(0, 8, 9, 5, 13, 14, 'fur');
    b.box(1, 8, 15, 4, 10, 17, 'furLight'); // snout
    b.box(2, 10, 17, 3, 10, 17, 'nose');
    b.box(2, 8, 16, 3, 8, 17, 'tongue');
    // eyes
    b.box(1, 11, 14, 1, 12, 14, 'eye');
    b.box(4, 11, 14, 4, 12, 14, 'eye');
    b.set(1, 12, 14, 'eyeShine').set(4, 12, 14, 'eyeShine');
    // floppy ears
    b.box(-1, 9, 11, -1, 13, 12, 'furDark');
    b.box(6, 9, 11, 6, 13, 12, 'furDark');
    // tail
    b.box(2, 7, -1, 3, 8, -1, 'fur');
    b.box(2, 8, -2, 3, 10, -2, 'furDark');
  },
});
