import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { emitFlames } from '../../behaviors/lib/fire';
import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';
import type { VoxelBuilder } from '../../voxel/builder';

definePalette({
  keyGold: '#f2c230',
  keyDark: '#c4901a',
  keyLight: '#ffe27a',
  bucketMetal: '#9aa6b2',
  bucketDark: '#6f7b87',
  bucketWater: '#7cc8f2',
  bucketWaterLight: '#b4e4fb',
  umbrellaA: '#e04848',
  umbrellaB: '#f6f2ea',
  umbrellaPole: '#4a3a30',
  torchWood: '#9a6a3a',
  torchWrap: '#5e4a3a',
  torchWrapDark: '#3f3228',
  bookCover: '#a8362f',
  bookCoverDark: '#7c2420',
  bookPage: '#f3ead2',
  bookPageShade: '#d9cca8',
  bookGold: '#e8c25a',
  mugBlue: '#4a86d8',
  mugBlueDark: '#3868b0',
  mugCoffee: '#4a2a18',
  mugFoam: '#a77a52',
  bottleGlass: '#3f9b5a',
  bottleGlassDark: '#2d7a45',
  bottleShine: '#a6e8b8',
  bottleLabel: '#efe3c2',
  bottleCork: '#c99a5b',
  vaseBlue: '#3c6fc4',
  vaseBlueDark: '#2c549a',
  vaseWhite: '#f2f0ea',
  vaseStem: '#4fa341',
  vaseFlowerA: '#ff6f9c',
  vaseFlowerB: '#ffd84a',
  vaseFlowerC: '#ff8f3a',
  pillowWhite: '#f4f1f0',
  pillowShade: '#d6d2e0',
  coinGold: '#f5c542',
  coinRim: '#d79a1c',
  coinShine: '#fff0a0',
  giftWrap: '#3fa7e0',
  giftWrapDark: '#2d84b8',
  giftRibbon: '#e8435a',
  giftRibbonDark: '#b92f45',
  candleWax: '#f7f1e1',
  candleWaxShade: '#ddd2b8',
  candleWick: '#2a2220',
  candleBrass: '#d9a63c',
  candleBrassDark: '#a67a22',
  mirrorFrame: '#8a5a30',
  mirrorFrameDark: '#5f3d20',
  mirrorGlass: '#bfe8fb',
  mirrorShine: '#ffffff',
  hammerHandle: '#b07a43',
  hammerGrip: '#7d532f',
  hammerHead: '#8a939e',
  hammerFace: '#c1c9d2',
  swordBlade: '#c3cdd8',
  swordEdge: '#eef3f8',
  swordGuard: '#e0b13a',
  swordGuardDark: '#b48820',
  swordGrip: '#6b3b2a',
  swordGripDark: '#4a281c',
  swordGem: '#e0384a',
});

/** Shared flame flicker for torch/candle: squash/stretch the 'flame' part around its base. */
function flicker(e: Entity, world: GameWorld, amount = 1): void {
  const f = e.parts.get('flame');
  if (!f) return;
  const t = world.time * 11 + e.id * 1.7;
  const s = 1 + Math.sin(t * 1.3) * 0.06 * amount;
  f.scale.set(s, 1 + (Math.sin(t) * 0.14 + Math.sin(t * 2.9) * 0.08) * amount, s);
  f.rotation.z = Math.sin(t * 0.7) * 0.08 * amount;
}

function flameShape(b: VoxelBuilder, cx: number, base: number, cz: number, s: number): void {
  b.ellipsoid(cx, base + 3.4 * s, cz, 2.3 * s, 3.4 * s, 2.3 * s, 'flameOuter');
  b.box(Math.floor(cx), Math.round(base + 6.2 * s), Math.floor(cz), Math.floor(cx), Math.round(base + 7 * s), Math.floor(cz), 'flameTip');
  b.ellipsoid(cx, base + 2.8 * s, cz, 1.5 * s, 2.5 * s, 1.5 * s, 'flameMid');
  b.ellipsoid(cx, base + 2 * s, cz, 0.9 * s, 1.5 * s, 0.9 * s, 'flameCore');
}

function inPoly(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export default [
  defineObject({
    id: 'key',
    name: 'key',
    synonyms: ['skeleton key', 'house key', 'keys', 'door key'],
    category: 'items',
    blurb: 'Unlocks locked things. Press C next to a door.',
    tags: ['key', 'metal'],
    tintKeys: ['keyGold', 'keyDark', 'keyLight'],
    burstColor: '#f2c230',
    spawnSound: 'chime',
    voxelSize: 0.02,
    physics: { mass: 0.3, shape: 'box', friction: 0.6 },
    build(b) {
      // ring bow (flat in the x-z plane)
      for (let x = 0; x < 8; x++)
        for (let z = 0; z < 8; z++) {
          const d = Math.hypot(x + 0.5 - 4, z + 0.5 - 4);
          if (d <= 4 && d >= 2) {
            b.set(x, 0, z, 'keyDark');
            b.set(x, 1, z, d > 3.3 ? 'keyLight' : 'keyGold');
          }
        }
      // shaft
      b.box(8, 0, 3, 17, 0, 4, 'keyDark');
      b.box(8, 1, 3, 17, 1, 4, 'keyGold');
      b.box(9, 2, 3, 9, 2, 4, 'keyLight'); // collar bump
      b.box(9, 0, 2, 9, 1, 5, 'keyGold');
      // teeth
      b.box(14, 0, 5, 15, 1, 6, 'keyGold');
      b.box(17, 0, 5, 17, 1, 7, 'keyGold');
      b.box(12, 0, 5, 12, 1, 5, 'keyGold');
    },
  }),

  defineObject({
    id: 'bucket',
    name: 'bucket',
    synonyms: ['pail', 'water bucket', 'bucket of water'],
    category: 'items',
    blurb: 'A bucket of water. Press C to splash out fires.',
    tags: ['wet', 'metal'],
    tintKeys: ['bucketMetal', 'bucketDark'],
    burstColor: '#7cc8f2',
    spawnSound: 'splash',
    voxelSize: 0.04,
    use: 'douse',
    physics: { mass: 1.5, shape: 'auto', maxBoxes: 6, friction: 0.5 },
    build(b) {
      const C = 7;
      for (let y = 0; y <= 11; y++) {
        const r = 5 + (1.6 * y) / 11;
        b.cylinderY(C, C, y, y, r, y === 0 || y === 11 || y === 6 ? 'bucketDark' : 'bucketMetal');
      }
      // hollow + water
      for (let y = 1; y <= 11; y++) b.cylinderY(C, C, y, y, 5 + (1.6 * y) / 11 - 1.3, null);
      b.cylinderY(C, C, 1, 9, 4.5, 'bucketDark');
      b.cylinderY(C, C, 10, 10, 5.2, 'bucketWater');
      b.cylinderY(C, C, 10, 10, 3, 'bucketWaterLight');
      // arched handle in the x-y plane
      for (let a = 0; a <= 180; a += 4) {
        const x = Math.round(C - 0.5 + Math.cos((a * Math.PI) / 180) * 7);
        const y = Math.round(11 + Math.sin((a * Math.PI) / 180) * 6.5);
        b.box(x, y, C - 1, x, y, C, 'bucketDark');
      }
    },
  }),

  defineObject({
    id: 'umbrella',
    name: 'umbrella',
    synonyms: ['parasol', 'brolly'],
    category: 'items',
    blurb: 'Grab it, jump off something high and float down gently.',
    tags: ['glider'],
    props: { fallSpeed: 1.3 },
    tintKeys: ['umbrellaA'],
    burstColor: '#e04848',
    voxelSize: 0.045,
    physics: { mass: 0.6, shape: 'auto', maxBoxes: 6, friction: 0.5 },
    build(b) {
      const cx = 10.5, cy = 18;
      b.ellipsoid(cx, cy, cx, 10.5, 8, 10.5, 'umbrellaA');
      b.ellipsoid(cx, cy, cx, 9.3, 6.8, 9.3, null);
      b.box(-2, 0, -2, 24, cy - 1, 24, null);
      b.paint((x, _y, z, c) => {
        if (c !== 'umbrellaA') return undefined;
        const seg = Math.floor(((Math.atan2(z + 0.5 - cx, x + 0.5 - cx) + Math.PI) / (2 * Math.PI)) * 8);
        return seg % 2 ? 'umbrellaB' : undefined;
      });
      // pole, tip, J-hook handle
      b.box(10, 1, 10, 10, 24, 10, 'umbrellaPole');
      b.box(10, 26, 10, 10, 27, 10, 'umbrellaPole');
      b.box(10, 0, 10, 13, 0, 10, 'umbrellaPole');
      b.box(13, 1, 10, 13, 2, 10, 'umbrellaPole');
    },
  }),

  defineObject({
    id: 'torch',
    name: 'torch',
    synonyms: ['tiki torch', 'firebrand', 'lit torch'],
    category: 'items',
    blurb: 'Press C to light flammable things. Glows in the dark.',
    tags: ['hot', 'glows'],
    props: { heatRadius: 0.6, glow: 4, extinguishable: 0 },
    tintKeys: ['torchWood'],
    burstColor: '#ff8a3a',
    spawnSound: 'ignite',
    voxelSize: 0.05,
    grip: 0.55,
    physics: { mass: 0.8, shape: 'box', uprightOnly: true, friction: 0.7 },
    parts: [
      {
        name: 'flame',
        pivot: [4, 21, 4],
        build(b) {
          flameShape(b, 4, 21, 4, 1.15);
        },
      },
    ],
    build(b) {
      b.box(3, 0, 3, 4, 17, 4, 'torchWood');
      b.box(3, 0, 3, 3, 17, 3, 'woodLight');
      b.box(2, 15, 2, 5, 20, 5, 'torchWrap');
      for (const y of [16, 18]) b.box(2, y, 2, 5, y, 5, 'torchWrapDark');
      b.box(3, 20, 3, 4, 20, 4, 'ember');
    },
    update(e, world, dt) {
      flicker(e, world);
      emitFlames(world, e, dt, 0.5);
    },
  }),

  defineObject({
    id: 'book',
    name: 'book',
    synonyms: ['novel', 'textbook', 'notebook', 'tome'],
    category: 'items',
    blurb: 'Press C to read it for a hint. Pages burn quickly.',
    tags: ['flammable'],
    props: { burnTime: 4 },
    tintKeys: ['bookCover', 'bookCoverDark'],
    burstColor: '#a8362f',
    voxelSize: 0.03,
    use: 'read',
    physics: { mass: 0.6, shape: 'box', friction: 0.6 },
    build(b) {
      // covers + spine
      b.box(0, 0, 0, 11, 0, 15, 'bookCover');
      b.box(0, 4, 0, 11, 4, 15, 'bookCover');
      b.box(0, 1, 0, 0, 3, 15, 'bookCoverDark');
      // pages (visible on three sides)
      b.box(1, 1, 0, 11, 3, 15, 'bookPage');
      for (let z = 0; z < 16; z += 2) {
        b.box(11, 2, z, 11, 2, z, 'bookPageShade');
      }
      b.box(1, 2, 0, 11, 2, 0, 'bookPageShade');
      b.box(1, 2, 15, 11, 2, 15, 'bookPageShade');
      // cover decoration
      b.box(3, 4, 9, 8, 4, 12, 'bookGold');
      b.box(4, 4, 10, 7, 4, 11, 'bookCoverDark');
      b.box(3, 4, 4, 8, 4, 4, 'bookGold');
      b.box(3, 4, 2, 8, 4, 2, 'bookGold');
    },
  }),

  defineObject({
    id: 'mug',
    name: 'mug',
    synonyms: ['cup', 'coffee cup', 'teacup', 'coffee mug'],
    category: 'items',
    blurb: 'Fresh coffee: press C for a burst of speed. Smashes if dropped.',
    tags: ['fragile'],
    props: { breakSpeed: 5 },
    tintKeys: ['mugBlue', 'mugBlueDark'],
    burstColor: '#4a86d8',
    spawnSound: 'pop',
    voxelSize: 0.03,
    use: 'drink',
    physics: { mass: 0.4, shape: 'auto', maxBoxes: 4, friction: 0.5 },
    build(b) {
      b.cylinderY(4.5, 4.5, 0, 9, 4.6, 'mugBlue');
      b.cylinderY(4.5, 4.5, 0, 0, 4.6, 'mugBlueDark');
      b.cylinderY(4.5, 4.5, 4, 4, 4.6, 'mugBlueDark');
      b.cylinderY(4.5, 4.5, 8, 9, 3.6, null);
      b.cylinderY(4.5, 4.5, 8, 8, 3.6, 'mugCoffee');
      b.cylinderY(4.5, 4.5, 8, 8, 1.5, 'mugFoam');
      // handle
      b.box(9, 7, 3, 11, 8, 5, 'mugBlue');
      b.box(9, 2, 3, 11, 3, 5, 'mugBlue');
      b.box(11, 2, 3, 11, 8, 5, 'mugBlue');
    },
  }),

  defineObject({
    id: 'bottle',
    name: 'bottle',
    synonyms: ['glass bottle', 'flask', 'jar'],
    category: 'items',
    blurb: 'Bobs on water. Shatters if dropped.',
    tags: ['fragile', 'floats'],
    props: { breakSpeed: 5 },
    tintKeys: ['bottleGlass', 'bottleGlassDark'],
    burstColor: '#3f9b5a',
    spawnSound: 'pop',
    voxelSize: 0.04,
    use: 'drink',
    physics: { mass: 0.5, shape: 'auto', maxBoxes: 4, friction: 0.4 },
    build(b) {
      const radii = [3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3.5, 3, 2.4, 1.9, 1.9, 1.9, 1.9, 2.2];
      radii.forEach((r, y) => b.cylinderY(4, 4, y, y, r, y === 0 ? 'bottleGlassDark' : 'bottleGlass'));
      b.cylinderY(4, 4, 18, 19, 1.7, 'bottleCork');
      b.paint((x, y, z, c) => {
        if (c.startsWith('bottleGlass') === false) return undefined;
        if (z >= 6 && y >= 3 && y <= 7 && x >= 2 && x <= 5) return 'bottleLabel';
        if (x === 1 && y >= 2 && y <= 9 && z >= 2 && z <= 5) return 'bottleShine';
        return undefined;
      });
    },
  }),

  defineObject({
    id: 'vase',
    name: 'vase',
    synonyms: ['urn', 'flower vase', 'pottery'],
    category: 'items',
    blurb: 'Pretty, but delicate.',
    tags: ['fragile'],
    props: { breakSpeed: 4 },
    tintKeys: ['vaseBlue', 'vaseBlueDark'],
    burstColor: '#3c6fc4',
    voxelSize: 0.035,
    physics: { mass: 1.2, shape: 'auto', maxBoxes: 6, friction: 0.5 },
    build(b) {
      const radii = [3, 4, 5, 5.5, 6, 6, 5.5, 5, 4.2, 3.5, 3, 3, 3.5, 4.3, 4.8];
      radii.forEach((r, y) => {
        const c = y === 14 || y === 0 ? 'vaseWhite' : y === 4 || y === 5 || y === 10 ? 'vaseWhite' : 'vaseBlue';
        b.cylinderY(6, 6, y, y, r, c);
      });
      b.paint((x, y, z, c) => (c === 'vaseBlue' && y >= 6 && y <= 8 && (x + z + y) % 3 === 0 ? 'vaseBlueDark' : undefined));
      b.cylinderY(6, 6, 14, 14, 3.4, null);
      b.cylinderY(6, 6, 13, 13, 2.6, 'vaseStem');
      // flower stems
      for (let i = 0; i <= 11; i++) b.set(6 - Math.floor(i / 4), 13 + i, 6, 'vaseStem');
      for (let i = 0; i <= 8; i++) b.set(7 + Math.floor(i / 3), 13 + i, 5, 'vaseStem');
      b.box(5, 18, 6, 6, 18, 6, 'vaseStem');
      b.box(7, 17, 5, 8, 17, 5, 'vaseStem');
      // blossoms
      b.sphere(4.5, 26.5, 6.5, 2.4, 'vaseFlowerA');
      b.box(4, 26, 8, 4, 27, 8, 'vaseFlowerB');
      b.box(3, 26, 8, 5, 27, 8, 'vaseFlowerB');
      b.sphere(9.5, 23.5, 5.5, 2, 'vaseFlowerC');
      b.box(9, 23, 7, 10, 24, 7, 'vaseFlowerB');
    },
  }),

  defineObject({
    id: 'pillow',
    name: 'pillow',
    synonyms: ['cushion', 'pillows'],
    category: 'items',
    blurb: 'Press C for a nap. Soft and bouncy, and burns easily.',
    tags: ['flammable', 'floats'],
    props: { burnTime: 4 },
    tintKeys: ['pillowWhite', 'pillowShade'],
    burstColor: '#f4f1f0',
    spawnSound: 'poof',
    voxelSize: 0.035,
    use: 'nap',
    physics: { mass: 0.5, shape: 'box', restitution: 0.5, friction: 0.8 },
    build(b) {
      for (let x = 0; x < 20; x++)
        for (let z = 0; z < 14; z++) {
          const nx = (x + 0.5 - 10) / 10, nz = (z + 0.5 - 7) / 7;
          const d = (Math.abs(nx) ** 2.6 + Math.abs(nz) ** 2.6) ** (1 / 2.6);
          if (d > 1) continue;
          let h = 5.2 * Math.sqrt(Math.max(0, 1 - d ** 2)) + 0.8;
          h *= 1 - 0.35 * Math.abs(nx * nz);
          const dim = 1.3 * Math.max(0, 1 - d / 0.35);
          const y0 = Math.round(6 - h), y1 = Math.max(y0, Math.round(6 + h - dim) - 1);
          for (let y = y0; y <= y1; y++) {
            b.set(x, y, z, y <= y0 + 1 && d > 0.5 ? 'pillowShade' : 'pillowWhite');
          }
          if (d < 0.12) b.set(x, y1, z, 'pillowShade');
        }
    },
  }),

  defineObject({
    id: 'coin',
    name: 'coin',
    synonyms: ['money', 'penny', 'token', 'doubloon'],
    category: 'items',
    blurb: 'Shiny and magnetic.',
    tags: ['metal'],
    tintKeys: ['coinGold', 'coinRim', 'coinShine'],
    burstColor: '#f5c542',
    spawnSound: 'chime',
    voxelSize: 0.0125,
    use: 'flip',
    physics: { mass: 0.3, shape: 'box', friction: 0.5 },
    build(b) {
      const star: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 6.6 : 2.8;
        const a = Math.PI / 2 + (i * Math.PI) / 5;
        star.push([10 + Math.cos(a) * r, 10 + Math.sin(a) * r]);
      }
      for (let x = 0; x < 20; x++)
        for (let y = 0; y < 20; y++) {
          const d = Math.hypot(x + 0.5 - 10, y + 0.5 - 10);
          if (d > 10) continue;
          if (d > 8.2) b.box(x, y, 0, x, y, 3, 'coinRim');
          else {
            b.box(x, y, 0, x, y, 2, 'coinGold');
            if (inPoly(x + 0.5, y + 0.5, star)) b.set(x, y, 3, 'coinShine');
          }
        }
    },
  }),

  defineObject({
    id: 'gift',
    name: 'gift',
    synonyms: ['present', 'gift box', 'giftbox'],
    category: 'items',
    blurb: 'What could be inside? Press C to open it.',
    tags: ['fragile', 'flammable'],
    props: { breakSpeed: 4, burnTime: 4 },
    debris: ['ball', 'balloon'],
    tintKeys: ['giftWrap', 'giftWrapDark'],
    burstColor: '#e8435a',
    spawnSound: 'magic',
    voxelSize: 0.04,
    use: 'open',
    physics: { mass: 0.8, shape: 'box', friction: 0.6 },
    build(b) {
      b.box(0, 0, 0, 11, 9, 11, 'giftWrap');
      b.box(-1, 7, -1, 12, 9, 12, 'giftWrapDark');
      b.box(5, 0, -1, 6, 10, 12, 'giftRibbon');
      b.box(-1, 0, 5, 12, 10, 6, 'giftRibbon');
      b.box(5, 10, 5, 6, 10, 6, 'giftRibbon');
      // bow
      b.ellipsoid(2.6, 12.6, 6, 3, 2.4, 1.4, 'giftRibbon');
      b.ellipsoid(9.4, 12.6, 6, 3, 2.4, 1.4, 'giftRibbon');
      b.ellipsoid(2.6, 12.6, 6, 1.5, 1, 3, null);
      b.ellipsoid(9.4, 12.6, 6, 1.5, 1, 3, null);
      b.box(2, 10, 5, 3, 10, 6, 'giftRibbon');
      b.box(8, 10, 5, 9, 10, 6, 'giftRibbon');
      b.box(5, 11, 5, 6, 13, 6, 'giftRibbonDark');
    },
  }),

  defineObject({
    id: 'candle',
    name: 'candle',
    synonyms: ['taper', 'candlestick', 'tealight'],
    category: 'items',
    blurb: 'A small flame. A splash snuffs it out.',
    tags: ['hot', 'glows'],
    props: { heatRadius: 0.4, glow: 2.5, extinguishable: 1 },
    tintKeys: ['candleWax', 'candleWaxShade'],
    burstColor: '#ffcf70',
    spawnSound: 'ignite',
    voxelSize: 0.04,
    physics: { mass: 0.2, shape: 'box', uprightOnly: true, friction: 0.7 },
    parts: [
      {
        name: 'flame',
        pivot: [4.5, 15, 4.5],
        build(b) {
          flameShape(b, 4.5, 15, 4.5, 0.85);
        },
      },
    ],
    build(b) {
      // brass dish holder with finger loop
      b.cylinderY(4.5, 4.5, 0, 0, 5.2, 'candleBrass');
      b.cylinderY(4.5, 4.5, 1, 1, 5.2, 'candleBrassDark');
      b.cylinderY(4.5, 4.5, 1, 1, 3.4, null);
      b.box(10, 0, 3, 12, 0, 5, 'candleBrass');
      b.box(11, 0, 4, 11, 0, 4, null);
      // wax
      b.cylinderY(4.5, 4.5, 1, 13, 2.2, 'candleWax');
      b.paint((x, y, z, c) => (c === 'candleWax' && y <= 8 && x <= 3 ? 'candleWaxShade' : undefined));
      b.box(7, 10, 4, 7, 12, 4, 'candleWax');
      b.box(4, 8, 7, 4, 10, 7, 'candleWax');
      b.set(4, 14, 4, 'candleWick');
    },
    update(e, world, dt) {
      flicker(e, world, 1.3);
      emitFlames(world, e, dt, 0.12);
    },
  }),

  defineObject({
    id: 'mirror',
    name: 'mirror',
    synonyms: ['looking glass', 'hand mirror'],
    category: 'items',
    blurb: 'Fancy glass. Seven years of bad luck if smashed.',
    tags: ['fragile'],
    props: { breakSpeed: 4 },
    tintKeys: ['mirrorFrame', 'mirrorFrameDark'],
    burstColor: '#bfe8fb',
    spawnSound: 'chime',
    voxelSize: 0.04,
    physics: { mass: 2, shape: 'auto', maxBoxes: 5, friction: 0.6 },
    build(b) {
      const cx = 8, cy = 14;
      for (let x = 0; x < 16; x++)
        for (let y = 2; y < 27; y++) {
          const o = ((x + 0.5 - cx) / 8.3) ** 2 + ((y + 0.5 - cy) / 11.3) ** 2;
          if (o > 1) continue;
          const i = ((x + 0.5 - cx) / 6.3) ** 2 + ((y + 0.5 - cy) / 9.3) ** 2;
          if (i > 1) {
            b.box(x, y, 0, x, y, 2, o > 0.9 ? 'mirrorFrameDark' : 'mirrorFrame');
          } else {
            const k = x - y;
            const shine = (k >= -9 && k <= -8) || k === -5 || k === -4 || (k >= -3 && k <= -3 && x > 8);
            b.box(x, y, 0, x, y, 1, shine ? 'mirrorShine' : 'mirrorGlass');
          }
        }
      // stand
      b.box(7, 0, 0, 8, 4, 1, 'mirrorFrameDark');
      b.box(1, 0, -2, 14, 1, 4, 'mirrorFrameDark');
    },
  }),

  defineObject({
    id: 'hammer',
    name: 'hammer',
    synonyms: ['mallet', 'sledgehammer', 'gavel'],
    category: 'items',
    blurb: 'Hold C to smash stone, ice and anything fragile.',
    tags: ['heavy', 'metal'],
    tintKeys: ['hammerHandle'],
    burstColor: '#8a939e',
    spawnSound: 'clank',
    voxelSize: 0.03,
    use: 'smash',
    grip: 1.1,
    physics: { mass: 8, shape: 'auto', maxBoxes: 4, friction: 0.6 },
    build(b) {
      // handle
      b.box(7, 0, 1, 8, 19, 2, 'hammerHandle');
      b.box(7, 0, 1, 8, 7, 2, 'hammerGrip');
      for (let y = 1; y <= 7; y += 2) b.box(7, y, 1, 8, y, 2, 'hammerHandle');
      // head
      b.box(5, 20, 0, 10, 24, 3, 'hammerHead');
      b.box(11, 19, 0, 12, 25, 3, 'hammerFace');
      b.box(5, 24, 0, 10, 24, 3, 'hammerFace');
      // claw: curves down and left, split in the middle
      b.box(4, 21, 0, 4, 24, 3, 'hammerHead');
      b.box(3, 20, 0, 3, 23, 3, 'hammerHead');
      b.box(2, 19, 0, 2, 22, 3, 'hammerHead');
      b.box(1, 17, 0, 1, 20, 3, 'hammerHead');
      b.box(0, 15, 0, 0, 18, 3, 'hammerHead');
      b.box(0, 15, 1, 3, 22, 2, null);
      b.box(1, 19, 1, 4, 22, 2, null);
      b.box(2, 19, 1, 4, 21, 2, null);
    },
  }),

  defineObject({
    id: 'sword',
    name: 'sword',
    synonyms: ['blade', 'katana', 'sabre', 'saber', 'broadsword'],
    category: 'items',
    blurb: 'Sharp! Hold C to slash bushes and boxes. Pops balloons.',
    tags: ['metal', 'sharp'],
    tintKeys: ['swordBlade', 'swordEdge'],
    burstColor: '#c3cdd8',
    spawnSound: 'clank',
    voxelSize: 0.04,
    use: 'slash',
    grip: 1.0,
    physics: { mass: 1.5, shape: 'auto', maxBoxes: 4, friction: 0.5 },
    build(b) {
      // blade along +Y, with a lighter sharp edge and a tip
      b.box(2, 9, 1, 4, 21, 2, 'swordBlade');
      b.box(2, 9, 1, 2, 21, 2, 'swordEdge');
      b.box(4, 9, 1, 4, 21, 2, 'swordEdge');
      b.box(3, 22, 1, 3, 23, 2, 'swordEdge');
      b.box(3, 24, 1, 3, 24, 1, 'swordEdge');
      // crossguard
      b.box(-2, 7, 0, 8, 8, 3, 'swordGuard');
      b.box(-2, 6, 0, -2, 6, 3, 'swordGuardDark');
      b.box(8, 6, 0, 8, 6, 3, 'swordGuardDark');
      b.box(2, 7, 3, 4, 8, 3, 'swordGuardDark');
      b.set(3, 8, 3, 'swordGem');
      // grip + pommel
      b.box(2, 2, 1, 4, 6, 2, 'swordGrip');
      for (let y = 2; y <= 6; y += 2) b.box(2, y, 1, 4, y, 2, 'swordGripDark');
      b.ellipsoid(3.5, 1, 2, 2.4, 1.8, 2.4, 'swordGuard');
    },
  }),
];
