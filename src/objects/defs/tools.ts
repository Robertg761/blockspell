import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

definePalette({
  sawBody: '#e8772e',
  sawBodyDark: '#b85a1f',
  sawBar: '#c3cdd8',
  sawChain: '#3b3e48',
  sawTooth: '#eef2f6',
  sawGrip: '#2a2a30',
  axeHead: '#b9c2cc',
  axeEdge: '#eef2f6',
  axeHandle: '#9a6a3a',
  axeHandleDark: '#7d532f',
  pickHead: '#7f8895',
  pickTip: '#dfe5ec',
  pickBand: '#e8c25a',
});

/** Things to do jobs with. Held out in front, and worked with C (see behaviors/lib/use.ts). */
export default [
  defineObject({
    id: 'chainsaw',
    name: 'chainsaw',
    synonyms: ['chain saw', 'saw', 'handsaw', 'buzzsaw', 'buzz saw'],
    category: 'items',
    blurb: 'Press E to pick it up, then hold C next to a tree. Timber!',
    tags: ['metal', 'sharp'],
    use: 'saw',
    grip: 0,
    tintKeys: ['sawBody', 'sawBodyDark'],
    burstColor: '#e8772e',
    spawnSound: 'engine',
    voxelSize: 0.035,
    physics: { mass: 5, shape: 'box', friction: 0.5 },
    build(b) {
      // the guide bar, pointing forward
      b.box(3, 2, 8, 4, 6, 28, 'sawBar');
      // the teeth, running round the bar
      for (let z = 8; z <= 28; z += 2) {
        b.set(3, 7, z, 'sawTooth').set(4, 7, z, 'sawChain');
        b.set(3, 1, z + 1, 'sawChain').set(4, 1, z + 1, 'sawTooth');
      }
      b.box(3, 2, 29, 4, 6, 29, 'sawChain');
      // the motor
      b.box(0, 0, -6, 7, 9, 7, 'sawBody');
      b.box(0, 0, -6, 7, 1, 7, 'sawBodyDark');
      b.box(1, 3, 7, 6, 5, 8, 'sawChain');
      b.box(0, 4, -3, 0, 6, 3, 'sawChain');
      b.box(7, 4, -3, 7, 6, 3, 'sawChain');
      // the top handle and rear grip
      b.box(3, 10, 2, 4, 13, 3, 'sawGrip');
      b.box(3, 13, -10, 4, 14, 3, 'sawGrip');
      b.box(3, 5, -11, 4, 13, -10, 'sawGrip');
      b.box(3, 4, -11, 4, 5, -6, 'sawGrip');
    },
  }),

  defineObject({
    id: 'axe',
    name: 'axe',
    synonyms: ['ax', 'hatchet', 'tomahawk', 'woodaxe'],
    category: 'items',
    blurb: 'Press E to pick it up, then hold C to chop trees and anything wooden.',
    tags: ['metal', 'sharp'],
    use: 'chop',
    grip: 1.05,
    tintKeys: ['axeHandle', 'axeHandleDark'],
    burstColor: '#b9c2cc',
    spawnSound: 'clank',
    voxelSize: 0.035,
    physics: { mass: 2.5, shape: 'box', friction: 0.6 },
    build(b) {
      b.box(5, 0, 2, 6, 24, 3, 'axeHandle');
      b.box(5, 0, 2, 6, 5, 3, 'axeHandleDark');
      // the head, with its edge on the +X side
      b.box(4, 20, 1, 8, 25, 4, 'axeHead');
      b.box(9, 19, 1, 10, 26, 4, 'axeHead');
      b.box(11, 18, 2, 12, 27, 3, 'axeEdge');
      b.box(2, 21, 2, 3, 24, 3, 'axeHead');
    },
  }),

  defineObject({
    id: 'pickaxe',
    name: 'pickaxe',
    synonyms: ['pick axe', 'pick', 'mattock'],
    category: 'items',
    blurb: 'Press E to pick it up, then hold C to break rock. There may be coins inside.',
    tags: ['metal', 'sharp'],
    use: 'mine',
    grip: 1.05,
    tintKeys: ['axeHandle', 'axeHandleDark'],
    burstColor: '#7f8895',
    spawnSound: 'clank',
    voxelSize: 0.035,
    physics: { mass: 3, shape: 'box', friction: 0.6 },
    build(b) {
      b.box(11, 0, 2, 12, 24, 3, 'axeHandle');
      b.box(11, 0, 2, 12, 5, 3, 'axeHandleDark');
      b.box(10, 22, 1, 13, 25, 4, 'pickBand');
      // the head arcs down at both ends
      b.box(4, 24, 2, 19, 25, 3, 'pickHead');
      b.box(2, 23, 2, 3, 24, 3, 'pickHead');
      b.box(20, 23, 2, 21, 24, 3, 'pickHead');
      b.box(0, 21, 2, 1, 23, 3, 'pickTip');
      b.box(22, 21, 2, 23, 23, 3, 'pickTip');
    },
  }),
];
