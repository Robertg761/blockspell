import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

// Ten more words: the garden, the campsite and a few odd friends.
definePalette({
  lanternIron: '#3d3a44',
  lanternIronLight: '#5b5766',
  lanternGlow: { color: '#ffd27a', emissive: true },
  pumpkin: '#f08a1f',
  pumpkinDark: '#cf6c12',
  pumpkinStem: '#4f7a2a',
  pumpkinFace: { color: '#ffd24a', emissive: true },
  hay: '#e3c25a',
  hayDark: '#c29a36',
  burlap: '#cdb28a',
  scarecrowShirt: '#b8433a',
  scarecrowHat: '#6a4a2c',
  coal: '#2a2522',
  tentCloth: '#d85a4a',
  tentClothLight: '#f2efe6',
  tentDark: '#7e3028',
  bubbleSkin: '#bfeaff',
  bubbleShine: '#ffffff',
  seedBrown: '#8a5a2c',
  seedLight: '#b98652',
  pianoBlack: '#23212b',
  pianoShine: '#4a4658',
  pianoKey: '#f6f3ea',
  pianoKeyBlack: '#15131a',
});

/** A tiny deterministic hash for speckle. */
const speck = (x: number, y: number, z: number, n: number): boolean => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) % n === 0;

export default [
  defineObject({
    id: 'lantern',
    name: 'lantern',
    synonyms: ['lamp', 'lamplight', 'oil lamp', 'night light'],
    category: 'items',
    blurb: 'A warm little light for the dark. It never starts a fire.',
    tags: ['glows'],
    props: { glow: 4 },
    tintKeys: ['lanternIron', 'lanternIronLight'],
    burstColor: '#ffd27a',
    spawnSound: 'chime',
    voxelSize: 0.06,
    physics: { mass: 0.8, shape: 'box', friction: 0.7 },
    build(b) {
      b.box(1, 0, 1, 6, 1, 6, 'lanternIron');
      b.box(2, 2, 2, 5, 8, 5, 'lanternGlow');
      for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) b.box(x, 2, z, x, 8, z, 'lanternIronLight');
      b.box(1, 9, 1, 6, 9, 6, 'lanternIron');
      b.box(2, 10, 2, 5, 10, 5, 'lanternIronLight');
      b.box(2, 11, 3, 2, 12, 4, 'lanternIron');
      b.box(5, 11, 3, 5, 12, 4, 'lanternIron');
      b.box(2, 13, 3, 5, 13, 4, 'lanternIron');
    },
  }),

  defineObject({
    id: 'pumpkin',
    name: 'pumpkin',
    synonyms: ['jack-o-lantern', 'jack o lantern', 'gourd', 'squash'],
    category: 'food',
    blurb: 'A carved face with a glow inside. Tasty, and it burns.',
    tags: ['edible', 'flammable', 'glows'],
    props: { burnTime: 6, glow: 2.2 },
    tintKeys: ['pumpkin', 'pumpkinDark'],
    burstColor: '#ffb43c',
    spawnSound: 'pop',
    voxelSize: 0.08,
    physics: { mass: 5, shape: 'sphere', friction: 0.8, restitution: 0.15 },
    build(b) {
      b.ellipsoid(6, 5, 6, 6.2, 5, 6.2, 'pumpkin');
      b.paint((x, _y, z, c) => (c === 'pumpkin' && (Math.abs(x - 6) < 1 || Math.abs(z - 6) < 1 || Math.abs(x - z) < 1 || Math.abs(x + z - 12) < 1) ? 'pumpkinDark' : undefined));
      b.box(5, 10, 5, 6, 12, 6, 'pumpkinStem');
      b.set(7, 12, 6, 'pumpkinStem');
      // carved face looking toward +Z
      b.box(3, 6, 10, 4, 7, 11, 'pumpkinFace');
      b.box(8, 6, 10, 9, 7, 11, 'pumpkinFace');
      b.box(4, 2, 10, 8, 2, 11, 'pumpkinFace');
      b.box(3, 3, 10, 3, 3, 11, 'pumpkinFace');
      b.box(9, 3, 10, 9, 3, 11, 'pumpkinFace');
    },
  }),

  defineObject({
    id: 'haystack',
    name: 'haystack',
    synonyms: ['hay', 'hay bale', 'bale', 'straw', 'hayrick'],
    category: 'nature',
    blurb: 'A soft heap of hay. Burns like a dream.',
    tags: ['flammable'],
    props: { burnTime: 10 },
    tintKeys: ['hay', 'hayDark'],
    burstColor: '#e3c25a',
    spawnSound: 'pop',
    voxelSize: 0.1,
    physics: { mass: 8, shape: 'auto', maxBoxes: 4, friction: 1 },
    build(b) {
      for (let y = 0; y < 8; y++) {
        const i = Math.floor(y * 0.7);
        b.box(i, y, Math.floor(i * 0.7), 13 - i, y, 10 - Math.floor(i * 0.7), 'hay');
      }
      b.paint((x, y, z, c) => (c === 'hay' && speck(x, y, z, 4) ? 'hayDark' : undefined));
    },
  }),

  defineObject({
    id: 'scarecrow',
    name: 'scarecrow',
    synonyms: ['straw man', 'strawman', 'straw scarecrow'],
    category: 'structures',
    blurb: 'Stands guard in its field. Burns, of course.',
    tags: ['flammable'],
    props: { burnTime: 8 },
    tintKeys: ['scarecrowShirt', 'scarecrowHat'],
    burstColor: '#cdb28a',
    spawnSound: 'pop',
    voxelSize: 0.08,
    physics: { mass: 3, shape: 'auto', maxBoxes: 5, friction: 0.7 },
    build(b) {
      b.box(5, 0, 5, 6, 17, 6, 'woodDark'); // post
      b.box(0, 12, 5, 11, 13, 6, 'wood'); // arms
      b.box(3, 7, 4, 8, 13, 7, 'scarecrowShirt'); // shirt
      b.box(0, 11, 5, 1, 11, 6, 'hay');
      b.box(10, 11, 5, 11, 11, 6, 'hay');
      b.box(4, 6, 5, 7, 6, 6, 'hay');
      b.sphere(5.5, 17.5, 5.5, 3, 'burlap');
      b.set(4, 18, 8, 'coal');
      b.set(7, 18, 8, 'coal');
      b.box(4, 16, 8, 7, 16, 8, 'coal');
      b.box(2, 20, 2, 9, 20, 9, 'scarecrowHat');
      b.box(4, 21, 4, 7, 23, 7, 'scarecrowHat');
    },
  }),

  defineObject({
    id: 'tent',
    name: 'tent',
    synonyms: ['camp', 'campsite', 'pavilion', 'marquee'],
    category: 'structures',
    blurb: 'A striped tent. Cloth burns fast.',
    tags: ['flammable'],
    props: { burnTime: 6 },
    tintKeys: ['tentCloth', 'tentClothLight'],
    burstColor: '#d85a4a',
    spawnSound: 'pop',
    voxelSize: 0.1,
    physics: { mass: 12, shape: 'auto', maxBoxes: 6, friction: 0.8 },
    orient: 'face',
    build(b) {
      for (let y = 0; y < 8; y++) b.box(y, y, 0, 15 - y, y, 13, 'tentCloth');
      b.paint((x, y, z, c) => (c === 'tentCloth' && Math.floor(z / 2) % 2 === 0 ? 'tentClothLight' : undefined));
      b.box(6, 0, 13, 9, 4, 13, 'tentDark'); // the flap
      b.box(7, 0, 13, 8, 4, 13, null);
      b.box(7, 8, 0, 8, 9, 13, 'woodDark'); // ridge pole
    },
  }),

  defineObject({
    id: 'bench',
    name: 'bench',
    synonyms: ['park bench', 'pew', 'wooden bench'],
    category: 'structures',
    blurb: 'Press C to sit, and a rest does you good. Or climb it.',
    tags: ['flammable'],
    props: { burnTime: 8 },
    tintKeys: ['wood', 'woodDark', 'woodLight'],
    burstColor: '#b07a43',
    spawnSound: 'pop',
    voxelSize: 0.08,
    use: 'sit',
    physics: { mass: 8, shape: 'auto', maxBoxes: 6, friction: 0.6 },
    orient: 'face',
    build(b) {
      for (const x of [1, 18]) for (const z of [1, 5]) b.box(x, 0, z, x + 1, 6, z, 'woodDark');
      b.box(0, 7, 0, 19, 8, 6, 'wood');
      b.box(0, 8, 0, 19, 8, 6, 'woodLight');
      b.box(0, 9, 0, 19, 16, 0, 'wood'); // back
      for (const y of [11, 14]) b.box(0, y, 0, 19, y, 0, 'woodDark');
      for (const x of [0, 19]) b.box(x, 9, 0, x, 16, 1, 'woodDark');
    },
  }),

  defineObject({
    id: 'bubble',
    name: 'bubble',
    synonyms: ['soap bubble', 'bubbles', 'soap'],
    category: 'items',
    blurb: 'Drifts up and goes pop at the lightest touch.',
    tags: ['flies', 'poppable'],
    props: { lift: 0.9, ceiling: 6 },
    tintKeys: ['bubbleSkin'],
    burstColor: '#bfeaff',
    spawnSound: 'squeak',
    voxelSize: 0.1,
    physics: { mass: 0.03, shape: 'sphere', linearDamping: 0.7, angularDamping: 0.9, restitution: 0.5 },
    build(b) {
      b.sphere(3.5, 3.5, 3.5, 3.7, 'bubbleSkin');
      b.sphere(3.5, 3.5, 3.5, 2.5, null);
      b.set(2, 5, 3, 'bubbleShine');
      b.set(2, 6, 3, 'bubbleShine');
      b.set(3, 6, 2, 'bubbleShine');
    },
  }),

  defineObject({
    id: 'seed',
    name: 'seed',
    synonyms: ['acorn', 'seeds', 'nut', 'sprout'],
    category: 'nature',
    blurb: 'Give it water and it becomes a tree.',
    tags: ['seed'],
    props: { growTime: 2.4 },
    tintKeys: ['seedBrown', 'seedLight'],
    burstColor: '#8a5a2c',
    spawnSound: 'pop',
    voxelSize: 0.06,
    physics: { mass: 0.05, shape: 'sphere', friction: 0.8 },
    build(b) {
      b.ellipsoid(2.5, 3, 2.5, 2.4, 3.2, 2.4, 'seedBrown');
      b.box(2, 5, 2, 3, 6, 3, 'seedLight');
      b.set(2, 3, 4, 'seedLight');
    },
  }),

  defineObject({
    id: 'fence',
    name: 'fence',
    synonyms: ['picket fence', 'railing', 'gate'],
    category: 'structures',
    blurb: 'A row of pickets. Keeps things in, mostly.',
    tags: ['flammable'],
    props: { burnTime: 8 },
    tintKeys: ['wood', 'woodDark', 'woodLight'],
    burstColor: '#d1a066',
    spawnSound: 'pop',
    voxelSize: 0.1,
    physics: { mass: 6, shape: 'auto', maxBoxes: 4, friction: 0.7 },
    orient: 'span',
    build(b) {
      b.box(0, 3, 1, 21, 3, 1, 'woodDark');
      b.box(0, 8, 1, 21, 8, 1, 'woodDark');
      for (let x = 0; x < 22; x += 3) {
        b.box(x, 0, 0, x + 1, 10, 0, 'wood');
        b.set(x, 11, 0, 'woodLight');
        b.set(x + 1, 11, 0, 'woodLight');
      }
    },
  }),

  defineObject({
    id: 'piano',
    name: 'piano',
    synonyms: ['pianoforte', 'grand piano', 'keyboard', 'upright piano'],
    category: 'items',
    blurb: 'Hold C to play a tune. It also rings when things land on it.',
    tags: ['musical'],
    tintKeys: ['pianoBlack', 'pianoShine'],
    burstColor: '#f6f3ea',
    spawnSound: 'chime',
    voxelSize: 0.1,
    use: 'play',
    physics: { mass: 40, shape: 'auto', maxBoxes: 5, friction: 0.8 },
    orient: 'face',
    build(b) {
      b.box(0, 3, 0, 17, 14, 7, 'pianoBlack'); // body
      b.box(0, 14, 0, 17, 14, 7, 'pianoShine'); // lid
      for (const x of [1, 15]) b.box(x, 0, 1, x + 1, 2, 2, 'pianoBlack');
      b.box(1, 0, 5, 2, 2, 6, 'pianoBlack');
      b.box(15, 0, 5, 16, 2, 6, 'pianoBlack');
      b.box(1, 5, 8, 16, 6, 9, 'pianoKey'); // keyboard shelf
      for (let x = 2; x < 16; x += 2) b.box(x, 6, 9, x, 6, 9, 'pianoKeyBlack');
      b.box(2, 7, 8, 15, 11, 8, 'pianoShine'); // music stand
    },
  }),
];
