import { definePalette } from '../../voxel/palette';
import { animateHero } from '../../behaviors/lib/hero-rig';
import type { VoxelBuilder } from '../../voxel/builder';
import { defineObject } from '../types';

definePalette({
  catFur: '#9c9ca6',
  catFurDark: '#6f6f7a',
  catFurLight: '#e6e3dc',
  catEye: '#7bd65a',
  pinkNose: '#f08a9a',
  mouseFur: '#a9a29a',
  mouseFurDark: '#85807a',
  mouseEar: '#f2b2bd',
  dragonScale: '#3fae5a',
  dragonDark: '#2a7a3e',
  dragonBelly: '#f2d27a',
  dragonWing: '#e0584a',
  dragonHorn: '#f4ead2',
  birdBody: '#4a9be0',
  birdBodyDark: '#2f74b8',
  birdBelly: '#f3ecd8',
  beak: '#ffb02e',
  fishBody: '#ff8a3d',
  fishDark: '#e0601c',
  fishLight: '#ffd0a0',
  rabbitFur: '#d9cdbd',
  rabbitFurDark: '#b6a794',
  rabbitInner: '#f4b6c0',
  frogSkin: '#58b948',
  frogDark: '#3d9034',
  frogBelly: '#d6efa0',
  cowWhite: '#f4f1ea',
  cowSpot: '#2b2a2f',
  cowPink: '#f2a9b4',
  cowHorn: '#e8dcc0',
  pigSkin: '#f5a3b5',
  pigDark: '#d97b92',
  pigSnout: '#ee8aa2',
  chickWhite: '#f8f5ee',
  chickShade: '#ddd7c8',
  chickRed: '#e23a3a',
  duckBody: '#f6d84a',
  duckDark: '#d8b52e',
  duckBill: '#ff8f1f',
  bearFur: '#7a4e2e',
  bearFurDark: '#573820',
  bearMuzzle: '#d2a77a',
  sheepWool: '#f6f4ee',
  sheepWoolDark: '#dcd8cc',
  sheepFace: '#2e2b30',
  turtleShell: '#4f8f3a',
  turtleShellDark: '#3a6e2b',
  turtleShellLight: '#8ccf5a',
  turtleSkin: '#a7c46a',
  monkeyFur: '#8a5a34',
  monkeyFurDark: '#684122',
  monkeyFace: '#e6c39a',
  robotBody: '#b9c3cf',
  robotDark: '#7f8a98',
  robotAccent: '#e8553f',
  robotEye: { color: '#58f0ff', emissive: true },
  robotBulb: { color: '#ff5a5a', emissive: true },
  heroSkin: '#f0c39a',
  heroHair: '#6b3f1f',
  heroShirt: '#3b82d9',
  heroShirtDark: '#2c63a8',
  heroPants: '#5b4636',
  heroShoes: '#3a2a22',
  heroBelt: '#caa04a',
});

/** Draw a box and its mirror image in a model that is W voxels wide (x 0..W-1). */
function sym(b: VoxelBuilder, W: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string) {
  b.box(x0, y0, z0, x1, y1, z1, c);
  b.box(W - 1 - x1, y0, z0, W - 1 - x0, y1, z1, c);
}
function symSet(b: VoxelBuilder, W: number, x: number, y: number, z: number, c: string) {
  b.set(x, y, z, c).set(W - 1 - x, y, z, c);
}
/** One hero leg and shoe, its inner edge at `x`. */
function heroLeg(b: VoxelBuilder, x: number) {
  b.box(x, 3, 2, x + 2, 6, 4, 'heroPants');
  b.box(x, 0, 2, x + 2, 2, 5, 'heroShoes');
}
/** One hero arm and hand, its inner edge at `x`. */
function heroArm(b: VoxelBuilder, x: number) {
  b.box(x, 6, 2, x + 1, 10, 4, 'heroShirt');
  b.box(x, 5, 2, x + 1, 5, 4, 'heroSkin');
}

export default [
  // ------------------------------------------------------------------ cat
  defineObject({
    id: 'cat',
    name: 'cat',
    synonyms: ['kitty', 'kitten', 'feline', 'tomcat', 'kitty cat'],
    category: 'animals',
    blurb: 'Chases mice and fish. Always lands on its feet.',
    tags: ['animal', 'eats'],
    diet: ['mouse', 'fish'],
    voice: 'meow',
    spawnSound: 'meow',
    tintKeys: ['catFur', 'catFurDark', 'catFurLight'],
    burstColor: '#9c9ca6',
    voxelSize: 0.06,
    physics: { mass: 4, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.25, linearDamping: 0.1 },
    props: { speed: 2.8, sight: 12 },
    build(b, rng) {
      const W = 6;
      const stripes = rng() > 0.4;
      sym(b, W, 1, 0, 2, 2, 3, 3, 'catFur'); // front legs
      sym(b, W, 1, 0, 11, 2, 3, 12, 'catFur'); // rear legs? (z large = front)
      sym(b, W, 1, 0, 2, 2, 0, 3, 'catFurLight'); // paws
      sym(b, W, 1, 0, 11, 2, 0, 12, 'catFurLight');
      b.box(1, 3, 1, 4, 7, 13, 'catFur'); // body
      b.box(2, 3, 3, 3, 3, 11, 'catFurLight');
      if (stripes) for (let z = 3; z <= 11; z += 3) b.box(1, 7, z, 4, 7, z, 'catFurDark');
      // head
      b.box(0, 7, 12, 5, 12, 17, 'catFur');
      b.box(1, 7, 17, 4, 9, 17, 'catFurLight'); // muzzle
      b.box(2, 9, 18, 3, 9, 18, 'pinkNose');
      sym(b, W, 0, 12, 13, 0, 14, 14, 'catFur');
      sym(b, W, 0, 13, 13, 1, 14, 14, 'catFur'); // ears
      sym(b, W, 0, 15, 13, 0, 15, 14, 'catFur');
      sym(b, W, 1, 13, 13, 1, 13, 13, 'pinkNose');
      symSet(b, W, 1, 10, 17, 'catEye');
      symSet(b, W, 1, 11, 17, 'eye');
      symSet(b, W, 1, 11, 17, 'eyeShine');
      b.set(2, 10, 17, 'catFurLight').set(3, 10, 17, 'catFurLight');
      // whiskers
      sym(b, W, -1, 8, 16, -1, 8, 17, 'catFurLight');
      // tail curling up
      b.box(2, 5, -1, 3, 6, 0, 'catFur');
      b.box(2, 5, -3, 3, 6, -2, 'catFur');
      b.box(2, 7, -3, 3, 11, -3, 'catFurDark');
      b.box(2, 12, -3, 3, 12, -3, 'catFurLight');
    },
  }),

  // ---------------------------------------------------------------- mouse
  defineObject({
    id: 'mouse',
    name: 'mouse',
    synonyms: ['mice', 'rat', 'rodent', 'mousey'],
    category: 'animals',
    blurb: 'Squeaky and tiny. Adores cheese, fears cats.',
    tags: ['animal', 'eats', 'edible'],
    diet: ['cheese'],
    voice: 'squeak',
    spawnSound: 'squeak',
    tintKeys: ['mouseFur', 'mouseFurDark'],
    burstColor: '#a9a29a',
    voxelSize: 0.04,
    physics: { mass: 0.1, shape: 'auto', maxBoxes: 3, uprightOnly: true, friction: 0.25 },
    props: { speed: 3, sight: 10 },
    build(b) {
      const W = 7;
      sym(b, W, 1, 0, 3, 1, 1, 4, 'mouseFurDark');
      sym(b, W, 1, 0, 7, 1, 1, 8, 'mouseFurDark');
      b.ellipsoid(3, 3, 5, 2.6, 2.4, 5.5, 'mouseFur'); // body
      b.box(2, 1, 3, 4, 1, 8, 'mouseEar');
      // head
      b.ellipsoid(3, 3.5, 10, 2, 2, 2.6, 'mouseFur');
      b.set(3, 3, 13, 'pinkNose').set(3, 2, 12, 'mouseFurDark');
      // ears
      sym(b, W, 0, 5, 9, 1, 7, 9, 'mouseEar');
      sym(b, W, 0, 5, 8, 0, 7, 8, 'mouseFurDark');
      symSet(b, W, 2, 4, 12, 'eye');
      symSet(b, W, 2, 5, 12, 'eyeShine');
      // whiskers
      sym(b, W, 0, 3, 12, 0, 3, 12, 'white');
      // tail
      b.box(3, 2, -1, 3, 2, 0, 'mouseEar');
      b.box(3, 2, -4, 3, 3, -2, 'mouseEar');
      b.box(3, 4, -5, 3, 5, -5, 'mouseEar');
    },
  }),

  // ----------------------------------------------------------------- bird
  defineObject({
    id: 'bird',
    name: 'bird',
    synonyms: ['birdie', 'sparrow', 'songbird', 'bluebird', 'robin'],
    category: 'animals',
    blurb: 'Flaps up into the sky. Nibbles bread and cookies.',
    tags: ['animal', 'flies', 'eats'],
    diet: ['bread', 'cookie'],
    voice: 'tweet',
    spawnSound: 'tweet',
    tintKeys: ['birdBody', 'birdBodyDark'],
    burstColor: '#4a9be0',
    voxelSize: 0.045,
    physics: { mass: 0.3, shape: 'auto', maxBoxes: 3, uprightOnly: true, friction: 0.2 },
    props: { speed: 2.4, sight: 14, lift: 1.15, ceiling: 3 },
    parts: [
      {
        name: 'wingL',
        pivot: [8, 8, 6],
        build(b) {
          b.box(8, 7, 3, 13, 8, 9, 'birdBodyDark');
          b.box(11, 7, 3, 14, 7, 5, 'birdBody');
        },
      },
      {
        name: 'wingR',
        pivot: [3, 8, 6],
        build(b) {
          b.box(-2, 7, 3, 3, 8, 9, 'birdBodyDark');
          b.box(-3, 7, 3, 0, 7, 5, 'birdBody');
        },
      },
    ],
    update(e, _w, dt) {
      const t = performance.now() / 1000;
      const a = Math.sin(t * 16 + e.id) * 0.5;
      e.parts.get('wingL')!.rotation.z = a;
      e.parts.get('wingR')!.rotation.z = -a;
    },
    build(b) {
      sym(b, 11, 3, 0, 5, 3, 3, 5, 'beak'); // legs (feet)
      sym(b, 11, 3, 0, 4, 4, 0, 6, 'beak');
      b.ellipsoid(5.5, 5.5, 5.5, 3.6, 3.2, 4.8, 'birdBody'); // body
      b.ellipsoid(5.5, 4.2, 6.5, 2.6, 2, 3.2, 'birdBelly');
      // tail
      b.box(4, 5, -1, 6, 6, 1, 'birdBodyDark');
      b.box(4, 6, -3, 6, 7, -2, 'birdBodyDark');
      // head
      b.ellipsoid(5.5, 9, 8, 2.8, 2.6, 2.8, 'birdBody');
      b.box(5, 8, 11, 6, 9, 12, 'beak');
      b.box(5, 8, 13, 6, 8, 13, 'beak');
      b.set(4, 10, 10, 'eye').set(7, 10, 10, 'eye');
      b.set(4, 11, 10, 'eyeShine').set(7, 11, 10, 'eyeShine');
      b.box(5, 11, 7, 6, 12, 7, 'birdBodyDark'); // crest
    },
  }),

  // ----------------------------------------------------------------- fish
  defineObject({
    id: 'fish',
    name: 'fish',
    synonyms: ['trout', 'salmon', 'minnow', 'fishy', 'fishes'],
    category: 'animals',
    blurb: 'Floats around. A cat favorite.',
    tags: ['animal', 'edible', 'floats'],
    voice: 'splash',
    spawnSound: 'splash',
    tintKeys: ['fishBody', 'fishDark', 'fishLight'],
    burstColor: '#ff8a3d',
    voxelSize: 0.05,
    physics: { mass: 0.8, shape: 'auto', maxBoxes: 3, uprightOnly: true, friction: 0.2 },
    props: { speed: 1.5, sight: 8, swims: 1 },
    build(b) {
      b.ellipsoid(2, 5, 9, 2.6, 4.2, 6.5, 'fishBody'); // body
      b.ellipsoid(2, 3.2, 10, 1.8, 2, 5, 'fishLight'); // belly
      b.box(2, 2, 7, 2, 4, 9, 'fishLight');
      // dorsal fin
      b.box(2, 9, 5, 2, 11, 10, 'fishDark');
      b.box(2, 12, 6, 2, 12, 8, 'fishDark');
      // tail
      b.box(2, 4, 0, 2, 6, 2, 'fishBody');
      b.box(2, 2, -3, 2, 8, -2, 'fishDark');
      b.box(2, 3, -1, 2, 7, -1, 'fishDark');
      // pectoral fins
      b.box(0, 4, 8, 0, 5, 10, 'fishDark').box(4, 4, 8, 4, 5, 10, 'fishDark');
      // eyes
      b.box(0, 6, 13, 0, 7, 13, 'white').box(4, 6, 13, 4, 7, 13, 'white');
      b.set(0, 6, 14, 'eye').set(4, 6, 14, 'eye');
      b.set(0, 7, 14, 'eyeShine').set(4, 7, 14, 'eyeShine');
      b.set(2, 4, 15, 'fishDark'); // mouth
      // stripes
      b.paint((x, y, z, c) => (c === 'fishBody' && z % 4 === 0 && y > 5 ? 'fishDark' : undefined));
    },
  }),

  // --------------------------------------------------------------- rabbit
  defineObject({
    id: 'rabbit',
    name: 'rabbit',
    synonyms: ['bunny', 'hare', 'bunny rabbit', 'cottontail'],
    category: 'animals',
    blurb: 'Hops after carrots. Very long ears.',
    tags: ['animal', 'eats'],
    diet: ['carrot'],
    voice: 'squeak',
    spawnSound: 'squeak',
    tintKeys: ['rabbitFur', 'rabbitFurDark'],
    burstColor: '#d9cdbd',
    voxelSize: 0.06,
    physics: { mass: 2, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.2 },
    props: { speed: 3.2, sight: 12 },
    build(b) {
      const W = 7;
      // big haunches + feet
      sym(b, W, 0, 0, 0, 1, 5, 5, 'rabbitFur');
      sym(b, W, 0, 0, 5, 1, 0, 7, 'rabbitFurDark');
      sym(b, W, 1, 0, 9, 2, 3, 10, 'rabbitFur'); // front legs
      b.ellipsoid(3, 5, 5, 3.4, 3.8, 5.5, 'rabbitFur'); // body
      b.ellipsoid(3, 3.4, 7, 2, 2, 3.5, 'rabbitFurDark');
      // head
      b.ellipsoid(3, 8, 11, 3, 2.8, 2.8, 'rabbitFur');
      b.box(2, 6, 13, 4, 7, 14, 'rabbitFur');
      b.set(3, 7, 14, 'pinkNose');
      // long ears
      sym(b, W, 1, 10, 9, 2, 17, 10, 'rabbitFur');
      sym(b, W, 2, 11, 10, 2, 16, 10, 'rabbitInner');
      symSet(b, W, 1, 9, 13, 'eye');
      symSet(b, W, 1, 10, 13, 'eyeShine');
      // fluffy tail
      b.sphere(3, 4, -1, 1.6, 'white');
    },
  }),

  // ----------------------------------------------------------------- frog
  defineObject({
    id: 'frog',
    name: 'frog',
    synonyms: ['toad', 'froggy', 'tadpole', 'bullfrog'],
    category: 'animals',
    blurb: 'Ribbit! Bouncy and cheerful.',
    tags: ['animal', 'bouncy'],
    voice: 'ribbit',
    spawnSound: 'ribbit',
    tintKeys: ['frogSkin', 'frogDark', 'frogBelly'],
    burstColor: '#58b948',
    voxelSize: 0.05,
    physics: { mass: 0.5, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.3, restitution: 0.4 },
    props: { speed: 2, sight: 8 },
    build(b, rng) {
      const W = 11;
      // folded hind legs
      sym(b, W, 0, 0, 1, 2, 3, 6, 'frogDark');
      sym(b, W, 0, 0, 5, 2, 0, 9, 'frogSkin'); // webbed feet
      // front legs
      sym(b, W, 2, 0, 10, 3, 3, 11, 'frogSkin');
      sym(b, W, 1, 0, 11, 3, 0, 13, 'frogSkin');
      b.ellipsoid(5, 4, 6, 4.8, 3.2, 6, 'frogSkin'); // body
      b.ellipsoid(5, 2.5, 8, 3, 1.6, 4, 'frogBelly');
      // head & wide mouth
      b.ellipsoid(5, 5, 11, 4.2, 2.6, 3, 'frogSkin');
      b.box(2, 3, 13, 8, 3, 14, 'frogDark');
      // bulging eyes
      for (const x of [2, 8]) {
        b.sphere(x, 8, 10, 1.8, 'frogSkin');
        b.box(x - 1, 8, 11, x + 1, 9, 12, 'white');
        b.set(x, 8, 12, 'eye').set(x, 9, 12, 'eyeShine');
      }
      // spots
      for (let i = 0; i < 6; i++) {
        const x = 2 + Math.floor(rng() * 7), z = 2 + Math.floor(rng() * 7);
        b.paint((px, py, pz, c) => (c === 'frogSkin' && px === x && pz === z && py > 5 ? 'frogDark' : undefined));
      }
    },
  }),

  // ------------------------------------------------------------------ cow
  defineObject({
    id: 'cow',
    name: 'cow',
    synonyms: ['bull', 'cattle', 'calf', 'heifer', 'ox'],
    category: 'animals',
    blurb: 'Moo! Munches flowers, bushes and apples. Heavy.',
    tags: ['animal', 'eats', 'heavy'],
    diet: ['flower', 'bush', 'apple'],
    voice: 'moo',
    spawnSound: 'moo',
    tintKeys: ['cowWhite'],
    burstColor: '#f4f1ea',
    voxelSize: 0.1,
    physics: { mass: 60, shape: 'auto', maxBoxes: 5, uprightOnly: true, friction: 0.3, linearDamping: 0.2 },
    props: { speed: 1.4, sight: 10 },
    build(b, rng) {
      const W = 9;
      sym(b, W, 1, 0, 1, 2, 4, 2, 'cowWhite');
      sym(b, W, 1, 0, 11, 2, 4, 12, 'cowWhite');
      sym(b, W, 1, 0, 1, 2, 1, 2, 'cowSpot'); // hooves
      sym(b, W, 1, 0, 11, 2, 1, 12, 'cowSpot');
      b.box(0, 4, 0, 8, 10, 13, 'cowWhite'); // body
      // udder
      b.box(3, 3, 2, 5, 3, 4, 'cowPink');
      // spots
      const spots: [number, number, number][] = [];
      for (let i = 0; i < 5; i++) spots.push([Math.floor(rng() * 9), 5 + Math.floor(rng() * 6), Math.floor(rng() * 13)]);
      b.paint((x, y, z, c) => {
        if (c !== 'cowWhite' || y < 4) return undefined;
        for (const [sx, sy, sz] of spots) {
          const dx = x <= 0 || x >= 8 ? 0 : 99; // side faces
          if (dx === 0 && Math.abs(y - sy) + Math.abs(z - sz) < 4 && x === (sx < 5 ? 0 : 8)) return 'cowSpot';
          if (y === 10 && Math.abs(x - sx) < 2 && Math.abs(z - sz) < 2) return 'cowSpot';
        }
        return undefined;
      });
      // head
      b.box(1, 7, 13, 7, 12, 17, 'cowWhite');
      b.box(2, 7, 17, 6, 9, 19, 'cowPink'); // muzzle
      b.set(3, 8, 19, 'nose').set(5, 8, 19, 'nose');
      sym(b, W, 1, 11, 17, 2, 11, 17, 'eye');
      symSet(b, W, 1, 11, 17, 'eye');
      symSet(b, W, 1, 12, 17, 'eyeShine');
      b.box(1, 12, 13, 3, 12, 15, 'cowSpot').box(5, 12, 13, 7, 12, 15, 'cowSpot');
      // horns + ears
      sym(b, W, 1, 13, 14, 1, 14, 14, 'cowHorn');
      sym(b, W, -1, 10, 14, 0, 10, 15, 'cowWhite');
      // tail
      b.box(4, 5, -1, 4, 9, -1, 'cowWhite');
      b.box(4, 3, -1, 4, 4, -1, 'cowSpot');
    },
  }),

  // ------------------------------------------------------------------ pig
  defineObject({
    id: 'pig',
    name: 'pig',
    synonyms: ['piglet', 'hog', 'piggy', 'boar', 'swine'],
    category: 'animals',
    blurb: 'Oink! Eats just about any treat.',
    tags: ['animal', 'eats'],
    diet: ['apple', 'cake', 'pizza', 'donut', 'burger', 'cookie', 'watermelon'],
    voice: 'oink',
    spawnSound: 'oink',
    tintKeys: ['pigSkin', 'pigDark'],
    burstColor: '#f5a3b5',
    voxelSize: 0.08,
    physics: { mass: 25, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.3, linearDamping: 0.15 },
    props: { speed: 1.9, sight: 10 },
    build(b) {
      const W = 8;
      sym(b, W, 1, 0, 1, 2, 2, 2, 'pigDark');
      sym(b, W, 1, 0, 8, 2, 2, 9, 'pigDark');
      b.ellipsoid(3.5, 5, 5, 4, 3.4, 6.2, 'pigSkin'); // round body
      b.box(1, 3, 1, 6, 7, 10, 'pigSkin');
      b.box(2, 3, 2, 5, 3, 9, 'pigDark');
      // head
      b.box(0, 4, 10, 7, 9, 14, 'pigSkin');
      b.box(2, 4, 14, 5, 6, 15, 'pigSnout'); // snout
      b.set(3, 5, 16, 'nose').set(4, 5, 16, 'nose');
      b.box(2, 4, 16, 5, 4, 16, 'pigSnout');
      symSet(b, W, 1, 7, 14, 'eye');
      symSet(b, W, 1, 8, 14, 'eyeShine');
      // floppy ears
      sym(b, W, 0, 9, 11, 1, 10, 12, 'pigDark');
      sym(b, W, 0, 8, 13, 0, 9, 13, 'pigDark');
      // curly tail
      b.box(3, 7, -1, 4, 7, -1, 'pigDark');
      b.box(4, 8, -1, 4, 9, -1, 'pigDark');
      b.box(3, 9, -1, 3, 9, -1, 'pigDark');
      b.set(3, 8, -2, 'pigDark');
    },
  }),

  // -------------------------------------------------------------- chicken
  defineObject({
    id: 'chicken',
    name: 'chicken',
    synonyms: ['hen', 'rooster', 'chick', 'cockerel'],
    category: 'animals',
    blurb: 'Pecks at bread. Cluck cluck.',
    tags: ['animal', 'eats', 'edible'],
    diet: ['bread'],
    voice: 'tweet',
    spawnSound: 'tweet',
    tintKeys: ['chickWhite', 'chickShade'],
    burstColor: '#f8f5ee',
    voxelSize: 0.05,
    physics: { mass: 2, shape: 'auto', maxBoxes: 3, uprightOnly: true, friction: 0.25 },
    props: { speed: 2.2, sight: 10 },
    build(b) {
      const W = 8;
      sym(b, W, 2, 0, 5, 2, 4, 5, 'duckBill'); // yellow legs
      sym(b, W, 1, 0, 4, 3, 0, 7, 'duckBill');
      b.ellipsoid(3.5, 7, 5, 3.8, 3.4, 5, 'chickWhite'); // body
      sym(b, W, 0, 6, 2, 0, 8, 6, 'chickShade'); // wings
      // tail feathers
      b.box(3, 8, -1, 4, 12, 0, 'chickWhite');
      b.box(3, 11, -2, 4, 13, -1, 'chickShade');
      // neck + head
      b.box(2, 8, 7, 5, 11, 9, 'chickWhite');
      b.box(1, 11, 7, 6, 15, 11, 'chickWhite');
      // comb, beak, wattle
      b.box(3, 16, 7, 4, 17, 10, 'chickRed');
      b.box(3, 15, 8, 4, 15, 9, 'chickRed');
      b.box(3, 12, 12, 4, 13, 13, 'duckBill');
      b.box(3, 10, 12, 4, 11, 12, 'chickRed');
      symSet(b, W, 1, 13, 12, 'eye');
      symSet(b, W, 1, 14, 12, 'eyeShine');
    },
  }),

  // ----------------------------------------------------------------- duck
  defineObject({
    id: 'duck',
    name: 'duck',
    synonyms: ['duckling', 'mallard', 'drake'],
    category: 'animals',
    blurb: 'Quack! Paddles on water and loves bread.',
    tags: ['animal', 'eats', 'floats'],
    diet: ['bread'],
    voice: 'quack',
    spawnSound: 'quack',
    tintKeys: ['duckBody', 'duckDark'],
    burstColor: '#f6d84a',
    voxelSize: 0.05,
    physics: { mass: 1.5, shape: 'auto', maxBoxes: 3, uprightOnly: true, friction: 0.25 },
    props: { speed: 1.8, sight: 10 },
    build(b) {
      const W = 8;
      sym(b, W, 2, 0, 5, 2, 2, 6, 'duckBill');
      sym(b, W, 1, 0, 5, 3, 0, 8, 'duckBill');
      b.ellipsoid(3.5, 5.5, 5, 4, 3.4, 6, 'duckBody');
      sym(b, W, 0, 5, 3, 0, 7, 7, 'duckDark'); // wings
      b.box(3, 7, -2, 4, 8, -1, 'duckBody'); // tail up
      b.box(3, 6, 0, 4, 6, 0, 'duckBody');
      // neck & head
      b.box(2, 7, 8, 5, 10, 10, 'duckBody');
      b.box(1, 10, 8, 6, 14, 13, 'duckBody');
      // bill
      b.box(2, 11, 13, 5, 12, 16, 'duckBill');
      b.box(2, 10, 13, 5, 10, 15, 'duckBill');
      symSet(b, W, 1, 12, 13, 'eye');
      symSet(b, W, 1, 13, 13, 'eyeShine');
    },
  }),

  // ----------------------------------------------------------------- bear
  defineObject({
    id: 'bear',
    name: 'bear',
    synonyms: ['grizzly', 'teddy', 'teddy bear', 'brown bear'],
    category: 'animals',
    blurb: 'Big and strong. Loves fish and honey.',
    tags: ['animal', 'eats', 'heavy'],
    diet: ['fish', 'honey'],
    voice: 'moo',
    spawnSound: 'moo',
    tintKeys: ['bearFur', 'bearFurDark'],
    burstColor: '#7a4e2e',
    voxelSize: 0.1,
    physics: { mass: 70, shape: 'auto', maxBoxes: 5, uprightOnly: true, friction: 0.3, linearDamping: 0.2 },
    props: { speed: 2, sight: 12 },
    build(b) {
      const W = 10;
      sym(b, W, 0, 0, 1, 3, 4, 4, 'bearFur'); // thick legs
      sym(b, W, 0, 0, 10, 3, 4, 13, 'bearFur');
      sym(b, W, 0, 0, 4, 3, 0, 4, 'bearFurDark'); // soles/claws
      sym(b, W, 0, 0, 13, 3, 0, 13, 'bearFurDark');
      b.box(0, 4, 0, 9, 11, 14, 'bearFur'); // body
      b.box(1, 11, 3, 8, 12, 12, 'bearFur'); // hump
      b.box(2, 4, 2, 7, 4, 12, 'bearFurDark');
      // head
      b.box(1, 6, 14, 8, 13, 19, 'bearFur');
      b.box(3, 6, 19, 6, 9, 21, 'bearMuzzle');
      b.box(4, 9, 21, 5, 9, 21, 'nose');
      b.box(4, 6, 20, 5, 6, 21, 'tongue');
      sym(b, W, 1, 13, 15, 2, 14, 16, 'bearFur'); // round ears
      sym(b, W, 2, 13, 16, 2, 14, 16, 'bearFurDark');
      symSet(b, W, 2, 11, 19, 'eye');
      symSet(b, W, 2, 12, 19, 'eyeShine');
      b.box(4, 6, -1, 5, 7, -1, 'bearFurDark'); // tail
    },
  }),

  // ---------------------------------------------------------------- sheep
  defineObject({
    id: 'sheep',
    name: 'sheep',
    synonyms: ['lamb', 'ram', 'ewe', 'woolly'],
    category: 'animals',
    blurb: 'Fluffy and flammable. Grazes on flowers and bushes.',
    tags: ['animal', 'eats', 'flammable'],
    diet: ['flower', 'bush'],
    voice: 'squeak',
    spawnSound: 'squeak',
    tintKeys: ['sheepWool', 'sheepWoolDark'],
    burstColor: '#f6f4ee',
    voxelSize: 0.08,
    physics: { mass: 30, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.3, linearDamping: 0.15 },
    props: { speed: 1.8, sight: 10, burnTime: 5 },
    build(b, rng) {
      const W = 10;
      sym(b, W, 2, 0, 2, 3, 4, 3, 'sheepFace');
      sym(b, W, 2, 0, 10, 3, 4, 11, 'sheepFace');
      // wool
      b.ellipsoid(4.5, 7, 6.5, 5.2, 4, 7.4, 'sheepWool');
      b.box(1, 5, 1, 8, 9, 12, 'sheepWool');
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(rng() * 10), y = 3 + Math.floor(rng() * 9), z = Math.floor(rng() * 14);
        if (b.get(x, y, z)) b.set(x, y, z, 'sheepWoolDark');
      }
      b.sphere(4.5, 10, 2, 2.4, 'sheepWool'); // topknot bumps
      b.sphere(4.5, 10, 9, 2.4, 'sheepWool');
      // head
      b.box(2, 6, 12, 7, 11, 15, 'sheepFace');
      b.box(3, 5, 15, 6, 8, 15, 'sheepFace');
      b.box(2, 11, 12, 7, 12, 14, 'sheepWool'); // fringe
      sym(b, W, 0, 8, 12, 1, 9, 13, 'sheepFace'); // ears
      symSet(b, W, 3, 9, 15, 'white');
      symSet(b, W, 3, 9, 15, 'eye');
      symSet(b, W, 3, 10, 15, 'eyeShine');
      b.box(4, 7, 16, 5, 7, 16, 'pinkNose');
      b.box(3, 6, -1, 6, 8, -1, 'sheepWool'); // tail
    },
  }),

  // --------------------------------------------------------------- turtle
  defineObject({
    id: 'turtle',
    name: 'turtle',
    synonyms: ['tortoise', 'terrapin'],
    category: 'animals',
    blurb: 'Slow and steady. Floats on water.',
    tags: ['animal', 'floats'],
    voice: 'squeak',
    spawnSound: 'squeak',
    tintKeys: ['turtleShell', 'turtleShellDark', 'turtleShellLight'],
    burstColor: '#4f8f3a',
    voxelSize: 0.06,
    physics: { mass: 3, shape: 'auto', maxBoxes: 3, uprightOnly: true, friction: 0.4 },
    props: { speed: 0.6, sight: 8 },
    build(b) {
      const W = 11;
      sym(b, W, 1, 0, 2, 3, 2, 4, 'turtleSkin');
      sym(b, W, 1, 0, 9, 3, 2, 11, 'turtleSkin');
      // shell dome
      b.ellipsoid(5, 2, 7, 5.4, 5, 6.4, 'turtleShell');
      b.box(0, 0, 0, 10, 1, 14, null);
      b.box(1, 2, 2, 9, 2, 12, 'turtleSkin'); // under-body
      b.paint((x, y, z, c) => {
        if (c !== 'turtleShell') return undefined;
        if (y < 3) return 'turtleShellDark';
        // hex-ish pattern
        if ((x + z) % 4 === 0 || (x - z + 20) % 4 === 0) return 'turtleShellDark';
        return (x + z) % 2 === 0 ? 'turtleShell' : 'turtleShellLight';
      });
      b.box(4, 7, 5, 6, 7, 9, 'turtleShellLight');
      // head on neck
      b.box(4, 2, 12, 6, 5, 14, 'turtleSkin');
      b.box(3, 3, 14, 7, 6, 17, 'turtleSkin');
      symSet(b, W, 3, 5, 17, 'eye');
      symSet(b, W, 3, 6, 17, 'eyeShine');
      b.box(5, 3, 17, 5, 3, 17, 'tongue');
      b.box(5, 2, -1, 5, 3, -1, 'turtleSkin'); // tail
    },
  }),

  // --------------------------------------------------------------- monkey
  defineObject({
    id: 'monkey',
    name: 'monkey',
    synonyms: ['ape', 'chimp', 'chimpanzee', 'gorilla', 'primate'],
    category: 'animals',
    blurb: 'Cheeky climber. Goes bananas for bananas.',
    tags: ['animal', 'eats'],
    diet: ['banana'],
    voice: 'squeak',
    spawnSound: 'squeak',
    tintKeys: ['monkeyFur', 'monkeyFurDark'],
    burstColor: '#8a5a34',
    voxelSize: 0.07,
    physics: { mass: 12, shape: 'auto', maxBoxes: 5, uprightOnly: true, friction: 0.25 },
    props: { speed: 3, sight: 12 },
    build(b) {
      const W = 12;
      // legs
      sym(b, W, 3, 0, 3, 5, 5, 5, 'monkeyFurDark');
      sym(b, W, 3, 0, 3, 5, 0, 7, 'monkeyFurDark');
      // body
      b.box(3, 5, 2, 8, 11, 7, 'monkeyFur');
      b.box(4, 5, 7, 7, 10, 7, 'monkeyFace'); // tummy
      // long arms
      sym(b, W, 1, 3, 4, 2, 10, 5, 'monkeyFur');
      sym(b, W, 0, 0, 3, 2, 3, 6, 'monkeyFurDark'); // hands on ground
      // head
      b.box(3, 11, 3, 8, 16, 8, 'monkeyFur');
      b.box(4, 11, 8, 7, 14, 9, 'monkeyFace'); // face mask
      b.box(4, 15, 8, 7, 15, 8, 'monkeyFace');
      b.box(5, 12, 9, 6, 13, 10, 'monkeyFace'); // muzzle
      b.set(5, 13, 10, 'nose').set(6, 13, 10, 'nose');
      b.box(5, 11, 9, 6, 11, 9, 'nose');
      symSet(b, W, 4, 14, 9, 'eye');
      symSet(b, W, 4, 15, 9, 'eyeShine');
      // round ears
      sym(b, W, 1, 13, 4, 2, 15, 6, 'monkeyFace');
      sym(b, W, 2, 13, 4, 2, 14, 5, 'monkeyFurDark');
      // curly tail
      b.box(5, 5, -1, 6, 6, 1, 'monkeyFurDark');
      b.box(5, 5, -3, 6, 5, -2, 'monkeyFurDark');
      b.box(5, 6, -3, 6, 10, -3, 'monkeyFurDark');
      b.box(5, 11, -2, 6, 11, -1, 'monkeyFurDark');
    },
  }),

  // ---------------------------------------------------------------- robot
  defineObject({
    id: 'robot',
    name: 'robot',
    synonyms: ['android', 'droid', 'bot', 'cyborg', 'automaton'],
    category: 'animals',
    blurb: 'Beep boop. Magnets love it.',
    tags: ['animal', 'metal'],
    voice: 'beep',
    spawnSound: 'beep',
    tintKeys: ['robotBody', 'robotDark'],
    burstColor: '#b9c3cf',
    voxelSize: 0.08,
    physics: { mass: 15, shape: 'auto', maxBoxes: 5, uprightOnly: true, friction: 0.3 },
    props: { speed: 1.6, sight: 10 },
    parts: [
      {
        name: 'antenna',
        pivot: [5.5, 15, 4.5],
        build(b) {
          b.box(5, 15, 4, 5, 17, 4, 'robotDark');
          b.sphere(5, 18, 4, 1.2, 'robotBulb');
        },
      },
    ],
    update(e, _w, _dt) {
      const t = performance.now() / 1000;
      const a = e.parts.get('antenna')!;
      a.rotation.z = Math.sin(t * 4 + e.id) * 0.3;
      a.rotation.x = Math.cos(t * 3 + e.id) * 0.15;
    },
    build(b) {
      const W = 11;
      // feet & legs
      sym(b, W, 1, 0, 1, 3, 1, 7, 'robotDark');
      sym(b, W, 2, 2, 3, 3, 4, 5, 'robotDark');
      // torso
      b.box(1, 5, 1, 9, 10, 8, 'robotBody');
      b.box(1, 5, 1, 9, 5, 8, 'robotDark');
      b.box(3, 6, 8, 7, 9, 8, 'robotDark'); // chest panel
      b.set(4, 8, 9, 'robotAccent').set(6, 8, 9, 'robotAccent');
      b.box(4, 7, 9, 6, 7, 9, 'robotEye');
      // arms
      sym(b, W, -1, 4, 3, 0, 9, 5, 'robotDark');
      sym(b, W, -1, 3, 3, 0, 3, 5, 'robotAccent');
      // head
      b.box(1, 11, 1, 9, 15, 8, 'robotBody');
      b.box(1, 15, 1, 9, 15, 8, 'robotDark');
      b.box(2, 12, 8, 8, 14, 8, 'robotDark'); // visor
      b.box(2, 12, 9, 4, 14, 9, 'robotEye');
      b.box(6, 12, 9, 8, 14, 9, 'robotEye');
      b.set(3, 14, 9, 'eyeShine').set(7, 14, 9, 'eyeShine');
      sym(b, W, 0, 12, 4, 0, 14, 5, 'robotAccent'); // ear bolts
      b.box(5, 15, 4, 5, 15, 4, 'robotDark');
    },
  }),

  // --------------------------------------------------------------- dragon
  defineObject({
    id: 'dragon',
    name: 'dragon',
    synonyms: ['wyvern', 'dragonling'],
    category: 'animals',
    blurb: 'A little dragon. Flaps around and sniffs out steak.',
    tags: ['animal', 'flies', 'eats'],
    diet: ['steak'],
    voice: 'rumble',
    spawnSound: 'whoosh',
    tintKeys: ['dragonScale', 'dragonDark'],
    burstColor: '#3fae5a',
    voxelSize: 0.06,
    physics: { mass: 4, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.3 },
    props: { speed: 2.2, sight: 12, lift: 1.12, ceiling: 3.5 },
    parts: [
      {
        name: 'wingL',
        pivot: [8, 9, 8],
        build(b) {
          b.box(8, 9, 5, 15, 9, 11, 'dragonWing');
          b.box(8, 10, 10, 15, 10, 11, 'dragonDark');
          b.box(15, 9, 9, 16, 10, 11, 'dragonDark');
        },
      },
      {
        name: 'wingR',
        pivot: [1, 9, 8],
        build(b) {
          b.box(-6, 9, 5, 1, 9, 11, 'dragonWing');
          b.box(-6, 10, 10, 1, 10, 11, 'dragonDark');
          b.box(-7, 9, 9, -6, 10, 11, 'dragonDark');
        },
      },
    ],
    update(e) {
      const a = Math.sin(performance.now() / 1000 * 9 + e.id) * 0.55;
      e.parts.get('wingL')!.rotation.z = a;
      e.parts.get('wingR')!.rotation.z = -a;
    },
    build(b) {
      const W = 10;
      // legs
      sym(b, W, 2, 0, 4, 3, 3, 5, 'dragonDark');
      sym(b, W, 2, 0, 10, 3, 3, 11, 'dragonDark');
      // body and belly
      b.ellipsoid(4.5, 6, 8, 3.2, 2.8, 5, 'dragonScale');
      b.ellipsoid(4.5, 5, 8.5, 2.4, 2, 4, 'dragonBelly');
      // neck and head
      b.box(3, 7, 12, 6, 10, 13, 'dragonScale');
      b.box(3, 9, 13, 6, 12, 17, 'dragonScale');
      b.box(3, 9, 18, 6, 10, 19, 'dragonScale'); // snout
      b.box(3, 8, 14, 6, 8, 18, 'dragonBelly'); // jaw
      symSet(b, W, 3, 10, 19, 'dragonDark'); // nostrils
      symSet(b, W, 3, 11, 16, 'eye');
      symSet(b, W, 3, 12, 16, 'eyeShine');
      sym(b, W, 3, 13, 13, 3, 14, 13, 'dragonHorn');
      sym(b, W, 3, 15, 12, 3, 15, 12, 'dragonHorn');
      // spikes down the back
      for (let z = 2; z <= 12; z += 2) b.box(4, 9, z, 5, 9, z, 'dragonHorn');
      // tail
      b.box(4, 5, 0, 5, 6, 3, 'dragonScale');
      b.box(4, 4, -3, 5, 5, -1, 'dragonScale');
      b.box(4, 4, -6, 5, 4, -4, 'dragonDark');
      b.box(3, 4, -7, 6, 5, -7, 'dragonWing'); // tail tip
    },
  }),

  // ----------------------------------------------------------------- hero
  defineObject({
    id: 'hero',
    name: 'hero',
    synonyms: ['person', 'kid', 'explorer', 'adventurer', 'human', 'man', 'woman', 'guy', 'girl', 'boy'],
    category: 'animals',
    blurb: 'That is you! Click to walk and climb.',
    tags: ['animal', 'player'],
    voice: 'squeak',
    spawnSound: 'squeak',
    tintKeys: ['heroShirt', 'heroShirtDark'],
    burstColor: '#3b82d9',
    voxelSize: 0.065,
    physics: { mass: 30, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.2, linearDamping: 0.1 },
    props: { speed: 2.6, sight: 12 },
    build(b) {
      // torso
      b.box(0, 7, 1, 7, 11, 5, 'heroShirt');
      b.box(0, 7, 1, 7, 7, 5, 'heroBelt');
      b.box(3, 7, 5, 4, 7, 5, 'heroPants');
      b.box(0, 11, 1, 7, 11, 5, 'heroShirtDark');
      // hat-free adventurer scarf
      b.box(1, 11, 1, 6, 11, 5, 'heroBelt');
    },
    // jointed at the hips, shoulders and neck; animateHero poses them
    parts: [
      { name: 'legL', solid: true, pivot: [5.5, 7, 3.5], build: (b) => heroLeg(b, 4) },
      { name: 'legR', solid: true, pivot: [2.5, 7, 3.5], build: (b) => heroLeg(b, 1) },
      { name: 'armL', solid: true, pivot: [9, 10.5, 3.5], build: (b) => heroArm(b, 8) },
      { name: 'armR', solid: true, pivot: [-1, 10.5, 3.5], build: (b) => heroArm(b, -2) },
      {
        name: 'head',
        solid: true,
        pivot: [4, 12, 3.5],
        build(b, rng) {
          const W = 8;
          const hair = rng() > 0.5;
          b.box(1, 12, 0, 6, 17, 6, 'heroSkin');
          b.box(3, 12, 6, 4, 13, 6, 'heroSkin');
          // hair
          b.box(1, 17, 0, 6, 18, 6, 'heroHair');
          b.box(1, 12, 0, 6, 17, 0, 'heroHair');
          sym(b, W, 0, 14, 0, 0, 17, 6, 'heroHair');
          b.box(1, 16, 6, 6, 17, 6, 'heroHair');
          if (hair) b.box(1, 11, 0, 6, 13, 0, 'heroHair');
          // face
          symSet(b, W, 2, 15, 6, 'eye');
          symSet(b, W, 2, 16, 6, 'eyeShine');
          b.box(3, 13, 6, 4, 13, 6, 'tongue');
        },
      },
      { name: 'scarf', solid: true, pivot: [6, 11, 1], build: (b) => b.box(5, 8, 0, 6, 10, 0, 'heroBelt') },
    ],
    update: animateHero,
  }),
];
