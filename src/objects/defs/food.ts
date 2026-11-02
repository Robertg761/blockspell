import type { VoxelBuilder } from '../../voxel/builder';
import type { Rng } from '../../core/rng';
import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

definePalette({
  cheeseYellow: '#ffc933',
  cheeseDark: '#e0a21c',
  cheeseLight: '#ffe27a',
  appleRed: '#d93a3a',
  appleDark: '#a82a30',
  appleShine: '#ff8f8a',
  appleStem: '#6b4423',
  appleLeaf: '#4fa341',
  bananaYellow: '#ffdd3c',
  bananaShade: '#e3b92a',
  bananaTip: '#5e3d1f',
  carrotOrange: '#ff8a1f',
  carrotDark: '#d96a10',
  carrotLeaf: '#4fb340',
  carrotLeafDark: '#3a8c32',
  cakeSponge: '#f3d28f',
  cakeFrosting: '#ff9ec4',
  cakeFrostDark: '#f07aa6',
  cakeCream: '#fff3e0',
  cakeCandle: '#6ec1ff',
  cakeSprinkleA: '#ffe14d',
  cakeSprinkleB: '#6ee0a0',
  cakeSprinkleC: '#6aa8ff',
  pizzaCrust: '#e0a95c',
  pizzaCrustDark: '#bf803a',
  pizzaSauce: '#d6342a',
  pizzaCheese: '#ffd966',
  pizzaPepperoni: '#b3262b',
  pizzaPepperoniDark: '#8a1b20',
  pizzaBasil: '#3f9a3a',
  breadCrust: '#c8823a',
  breadDark: '#9c5e24',
  breadScore: '#eab56a',
  breadCrumb: '#f6dfa8',
  cookieDough: '#d9a05a',
  cookieEdge: '#b97b3a',
  cookieChip: '#4a2a1a',
  steakMeat: '#a9502c',
  steakDark: '#7a3420',
  steakLight: '#cf7442',
  steakFat: '#f5e6c8',
  eggShell: '#fbf0d8',
  eggShade: '#e4d3b0',
  eggLight: '#ffffff',
  melonGreen: '#4fb04a',
  melonDark: '#256b30',
  melonStem: '#7a5a2c',
  honeyPot: '#bd7a34',
  honeyPotDark: '#8f5724',
  honeyGold: '#ffc21f',
  honeyDeep: '#e39a0c',
  honeyLabel: '#f6ead0',
  honeyInk: '#6b3a14',
  donutDough: '#e0a560',
  donutDark: '#bb8240',
  donutIcing: '#ff7fb0',
  donutIcingDark: '#ec5f95',
  donutSprinkleA: '#ffffff',
  donutSprinkleB: '#ffe14d',
  donutSprinkleC: '#5fd1ff',
  donutSprinkleD: '#7be07b',
  iceWaffle: '#d9a05a',
  iceWaffleDark: '#b97d3a',
  icePink: '#ffb3cf',
  iceCream: '#fff0d0',
  iceCherry: '#d8203a',
  iceStem: '#5b8a2e',
  burgerBun: '#e0a24a',
  burgerBunDark: '#bc7c2c',
  burgerSesame: '#fff1cf',
  burgerPatty: '#6b3a22',
  burgerPattyDark: '#4d2616',
  burgerLettuce: '#79c84a',
  burgerLettuceDark: '#5aa93a',
  burgerTomato: '#e0432f',
  burgerCheese: '#ffc933',
});

const hash = (x: number, y: number, z: number) => {
  let h = Math.imul(x + 101, 374761393) ^ Math.imul(y + 57, 668265263) ^ Math.imul(z + 13, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Random points inside a disc, kept at least `minD` apart. */
function scatter(rng: Rng, cx: number, cz: number, rad: number, n: number, minD: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 200 && pts.length < n; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * rad;
    const p: [number, number] = [Math.round(cx + Math.cos(a) * r), Math.round(cz + Math.sin(a) * r)];
    if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minD)) pts.push(p);
  }
  return pts;
}

/** Dots on the topmost surface voxels of colors in `on`. */
function sprinkle(b: VoxelBuilder, rng: Rng, on: string[], p: number, colors: string[], minY = 0) {
  b.paint((x, y, z, c) => {
    if (!on.includes(c) || y < minY || b.has(x, y + 1, z)) return undefined;
    return rng() < p ? colors[Math.floor(rng() * colors.length)] : undefined;
  });
}

export default [
  defineObject({
    id: 'cheese',
    name: 'cheese',
    synonyms: ['cheddar', 'swiss cheese', 'cheese wedge', 'brie'],
    category: 'food',
    blurb: 'Smells great. Mice will come running!',
    tags: ['edible'],
    tintKeys: ['cheeseYellow', 'cheeseDark', 'cheeseLight'],
    burstColor: '#ffc933',
    voxelSize: 0.04,
    physics: { mass: 0.6, shape: 'auto', maxBoxes: 4, friction: 0.6 },
    build(b) {
      // triangular wedge profile in x/y, extruded along z
      for (let x = 0; x <= 13; x++) {
        const h = Math.round(9 - x * 0.4);
        for (let y = 0; y < h; y++) for (let z = 0; z <= 8; z++) {
          const top = y === h - 1;
          b.set(x, y, z, top ? 'cheeseYellow' : y === 0 ? 'cheeseDark' : 'cheeseYellow');
        }
      }
      // rind edge on the back
      b.paint((x, y, z, c) => (z === 0 || (y === 0 && x > 11) ? 'cheeseDark' : undefined));
      // holes: front face, top slope, a few through-the-side bites
      const holes: [number, number, number, number][] = [[3, 4, 8, 1.8], [8, 3, 8, 1.4], [5, 7, 8, 1.1], [11, 5, 8, 1.0], [2, 1, 8, 1.0]];
      for (const [x, y, z, r] of holes) b.sphere(x + 0.5, y + 0.5, z + 0.5, r, null);
      b.sphere(4.5, 8.5, 4.5, 1.5, null);
      b.sphere(8.5, 3.5, 2.5, 1.3, null);
      b.sphere(0.5, 3.5, 5.5, 1.3, null);
    },
  }),

  defineObject({
    id: 'apple',
    name: 'apple',
    synonyms: ['crabapple', 'fruit', 'pomme'],
    category: 'food',
    blurb: 'Crunchy and red. Floats on water.',
    tags: ['edible', 'floats'],
    tintKeys: ['appleRed', 'appleDark', 'appleShine'],
    burstColor: '#d93a3a',
    voxelSize: 0.05,
    physics: { mass: 0.3, shape: 'sphere', friction: 0.5, restitution: 0.2 },
    build(b) {
      b.ellipsoid(5.5, 5, 5.5, 5.4, 4.8, 5.4, 'appleRed');
      b.ellipsoid(5.5, 7, 5.5, 5.5, 3.2, 5.5, 'appleRed'); // fuller shoulders
      b.sphere(5.5, 9.8, 5.5, 1.8, null); // dimple
      b.paint((x, y, z, c) => (y <= 1 ? 'appleDark' : y <= 2 && hash(x, y, z) < 0.5 ? 'appleDark' : c));
      for (const [x, y, z] of [[2, 7, 9], [2, 6, 9], [3, 8, 9], [2, 7, 8]]) if (b.has(x, y, z)) b.set(x, y, z, 'appleShine');
      b.box(5, 8, 5, 5, 11, 5, 'appleStem');
      b.set(6, 11, 5, 'appleStem');
      b.box(6, 10, 6, 8, 10, 6, 'appleLeaf');
      b.box(8, 11, 6, 9, 11, 7, 'appleLeaf');
      b.set(7, 10, 7, 'appleLeaf');
    },
  }),

  defineObject({
    id: 'banana',
    name: 'banana',
    synonyms: ['plantain', 'nana'],
    category: 'food',
    blurb: 'Monkeys go bananas for it.',
    tags: ['edible'],
    tintKeys: ['bananaYellow', 'bananaShade'],
    burstColor: '#ffdd3c',
    voxelSize: 0.05,
    physics: { mass: 0.25, shape: 'auto', maxBoxes: 4, friction: 0.6 },
    build(b) {
      for (let i = -11; i <= 11; i++) {
        const x = i + 12, y = 2.5 + (i * i) / 14;
        const r = 2.1 - Math.abs(i) * 0.05;
        b.ellipsoid(x + 0.5, y, 3.5, 1.2, r, r, 'bananaYellow');
      }
      b.paint((x, y, z, c) => {
        const i = x - 12;
        if (Math.abs(i) >= 10) return 'bananaTip';
        // underside / back shading and a few freckles
        if (!b.has(x, y - 1, z) || z <= 2) return 'bananaShade';
        if (hash(x, y, z) < 0.05) return 'bananaTip';
        return c;
      });
      // stalk end sticks up a little
      b.box(0, 7, 3, 1, 8, 4, 'bananaTip');
    },
  }),

  defineObject({
    id: 'carrot',
    name: 'carrot',
    synonyms: ['veggie', 'vegetable', 'carrot stick'],
    category: 'food',
    blurb: 'Rabbits will hop right over for this.',
    tags: ['edible'],
    tintKeys: ['carrotOrange', 'carrotDark'],
    burstColor: '#ff8a1f',
    voxelSize: 0.05,
    physics: { mass: 0.3, shape: 'auto', maxBoxes: 4, friction: 0.6 },
    build(b) {
      const cy = 3.5, cz = 3.5;
      for (let x = 0; x <= 15; x++) {
        const r = 0.7 + x * 0.17;
        for (let y = 0; y <= 7; y++) for (let z = 0; z <= 7; z++) {
          if (Math.hypot(y + 0.5 - cy, z + 0.5 - cz) <= r) b.set(x, y, z, 'carrotOrange');
        }
      }
      // ridges and underside shade
      b.paint((x, y, z, c) => (x % 5 === 2 && z > 3 ? 'carrotDark' : y < 2 || z < 2 ? 'carrotDark' : c));
      // leafy top
      for (const [dy, dz, len] of [[0, 0, 7], [2, 2, 6], [-2, -1, 6], [1, -2, 5], [-1, 2, 5]]) {
        for (let i = 0; i < len; i++) {
          const x = 15 + i;
          b.box(x, Math.round(cy + dy * (i / 3)) - 0, Math.round(cz + dz * (i / 3)), x, Math.round(cy + dy * (i / 3)) + (i < 3 ? 1 : 0), Math.round(cz + dz * (i / 3)), (i + dy) % 3 === 0 ? 'carrotLeafDark' : 'carrotLeaf');
        }
      }
    },
  }),

  defineObject({
    id: 'cake',
    name: 'cake',
    synonyms: ['birthday cake', 'cupcake', 'gateau', 'sponge cake'],
    category: 'food',
    blurb: 'Make a wish! Careful, the candle is lit.',
    tags: ['edible', 'flammable'],
    tintKeys: ['cakeFrosting', 'cakeFrostDark'],
    burstColor: '#ff9ec4',
    voxelSize: 0.035,
    physics: { mass: 1.2, shape: 'auto', maxBoxes: 5, friction: 0.7 },
    props: { burnTime: 4 },
    build(b, rng) {
      const c = 8;
      b.cylinderY(c, c, 0, 3, 7.5, 'cakeSponge');
      b.cylinderY(c, c, 4, 4, 7.6, 'cakeCream');
      b.cylinderY(c, c, 5, 8, 7.5, 'cakeSponge');
      b.cylinderY(c, c, 9, 10, 8.2, 'cakeFrosting');
      // frosting drips down the sides
      for (let x = 0; x < 17; x++) for (let z = 0; z < 17; z++) {
        const d = Math.hypot(x + 0.5 - c, z + 0.5 - c);
        if (d < 6.8 || d > 8.2) continue;
        const bin = Math.floor(((Math.atan2(z + 0.5 - c, x + 0.5 - c) + Math.PI) / (Math.PI * 2)) * 14);
        const len = [3, 0, 1, 4, 0, 2, 0, 3, 1, 0, 2, 4, 0, 1][bin];
        for (let k = 1; k <= len; k++) b.set(x, 9 - k, z, 'cakeFrosting');
      }
      b.paint((x, y, z, col) => (col === 'cakeFrosting' && y < 9 ? 'cakeFrostDark' : col));
      // sprinkles
      const cols = ['cakeSprinkleA', 'cakeSprinkleB', 'cakeSprinkleC', 'white'];
      for (const [x, z] of scatter(rng, c, c, 6.2, 16, 2)) b.set(x, 11, z, cols[Math.floor(rng() * cols.length)]);
      // candle + flame
      b.box(7, 11, 7, 8, 15, 8, 'white');
      for (let y = 12; y <= 15; y += 2) b.box(7, y, 7, 8, y, 8, 'cakeCandle');
      b.box(7, 16, 7, 8, 17, 8, 'flameMid');
      b.box(7, 16, 7, 8, 16, 8, 'flameCore');
      b.box(7, 18, 7, 8, 18, 8, 'flameOuter');
    },
  }),

  defineObject({
    id: 'pizza',
    name: 'pizza',
    synonyms: ['pizza pie', 'pizza slice', 'pepperoni pizza'],
    category: 'food',
    blurb: 'Cheesy, saucy, and flat. Burns if you leave it near a fire.',
    tags: ['edible', 'flammable'],
    tintKeys: ['pizzaPepperoni', 'pizzaPepperoniDark'],
    burstColor: '#d6342a',
    voxelSize: 0.04,
    physics: { mass: 0.5, shape: 'box', friction: 0.7 },
    props: { burnTime: 3 },
    build(b, rng) {
      const c = 7.5;
      b.cylinderY(c, c, 0, 0, 7.5, 'pizzaCrustDark');
      b.cylinderY(c, c, 1, 1, 7.5, 'pizzaCrust');
      b.cylinderY(c, c, 2, 2, 7.5, 'pizzaCrust');
      b.cylinderY(c, c, 2, 2, 6.0, null); // rim stays raised
      b.cylinderY(c, c, 1, 1, 6.0, 'pizzaSauce');
      // melted cheese patches
      for (let x = 0; x < 15; x++) for (let z = 0; z < 15; z++) {
        const d = Math.hypot(x + 0.5 - c, z + 0.5 - c);
        if (d < 5.8 && hash(x, 0, z) > 0.25 && Math.sin(x * 0.9) + Math.cos(z * 1.1) > -1.3) b.set(x, 2, z, 'pizzaCheese');
      }
      // pepperoni
      for (const [x, z] of scatter(rng, c, c, 4.3, 8, 3.6)) {
        b.box(x, 3, z, x + 1, 3, z + 1, 'pizzaPepperoni');
        b.set(x + (rng() < 0.5 ? 0 : 1), 3, z + (rng() < 0.5 ? 0 : 1), 'pizzaPepperoniDark');
        b.box(x, 2, z, x + 1, 2, z + 1, 'pizzaPepperoni');
      }
      for (const [x, z] of scatter(rng, c, c, 5, 4, 3)) if (!b.has(x, 3, z)) b.set(x, 3, z, 'pizzaBasil');
      // slice cuts
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + 0.2;
        for (let r = 1; r <= 5; r++) {
          const x = Math.floor(c + Math.cos(a) * r), z = Math.floor(c + Math.sin(a) * r);
          if (b.get(x, 2, z) === 'pizzaCheese') b.set(x, 2, z, 'pizzaSauce');
        }
      }
    },
  }),

  defineObject({
    id: 'bread',
    name: 'bread',
    synonyms: ['loaf', 'baguette', 'toast', 'bread loaf'],
    category: 'food',
    blurb: 'Fresh from the oven. Birds love the crumbs.',
    tags: ['edible', 'flammable'],
    tintKeys: ['breadCrust', 'breadDark'],
    burstColor: '#c8823a',
    voxelSize: 0.05,
    physics: { mass: 0.5, shape: 'auto', maxBoxes: 3, friction: 0.7 },
    props: { burnTime: 4 },
    build(b) {
      b.ellipsoid(8, 3.5, 4.5, 8, 4.6, 4.5, 'breadCrust');
      b.box(-2, -3, -1, 18, -1, 10, null);
      b.box(-2, 0, -1, 18, 0, 10, null);
      b.paint((x, y, z, c) => {
        if (y <= 1) return 'breadDark';
        if (!b.has(x, y + 1, z) && y >= 4) {
          // diagonal scoring slashes
          if (((x + z) % 4 === 0 || (x + z) % 4 === 1) && z >= 2 && z <= 6 && x >= 3 && x <= 12) return 'breadScore';
        }
        if (x <= 0 || x >= 15) return 'breadDark';
        return c;
      });
    },
  }),

  defineObject({
    id: 'cookie',
    name: 'cookie',
    synonyms: ['biscuit', 'chocolate chip cookie', 'choc chip cookie'],
    category: 'food',
    blurb: 'Chock full of chocolate chips.',
    tags: ['edible'],
    tintKeys: ['cookieDough', 'cookieEdge'],
    burstColor: '#d9a05a',
    voxelSize: 0.04,
    physics: { mass: 0.2, shape: 'box', friction: 0.6 },
    build(b, rng) {
      const c = 6.5;
      b.cylinderY(c, c, 0, 0, 5.4, 'cookieEdge');
      b.cylinderY(c, c, 1, 1, 6.4, 'cookieDough');
      b.cylinderY(c, c, 2, 2, 6.4, 'cookieDough');
      b.cylinderY(c, c, 3, 3, 5.6, 'cookieDough');
      // lumpy, darker rim
      b.paint((x, y, z, col) => {
        const d = Math.hypot(x + 0.5 - c, z + 0.5 - c);
        if (d > 5.4 && y <= 2) return 'cookieEdge';
        if (d > 6 && hash(x, y, z) < 0.35) return null;
        return col;
      });
      for (const [x, z] of scatter(rng, c, c, 4.8, 9, 2.6)) {
        const y = b.has(x, 3, z) ? 3 : 2;
        b.set(x, y, z, 'cookieChip');
        if (rng() < 0.6) b.set(x + 1, y, z, 'cookieChip');
        if (rng() < 0.3) b.set(x, y + 1, z, 'cookieChip');
      }
    },
  }),

  defineObject({
    id: 'steak',
    name: 'steak',
    synonyms: ['meat', 'ham', 'drumstick', 't-bone', 'ham hock'],
    category: 'food',
    blurb: 'A juicy cut on the bone. Dogs go wild for it.',
    tags: ['edible', 'flammable'],
    tintKeys: ['steakMeat', 'steakDark', 'steakLight'],
    burstColor: '#a9502c',
    voxelSize: 0.05,
    physics: { mass: 0.6, shape: 'auto', maxBoxes: 5, friction: 0.6 },
    props: { burnTime: 5 },
    build(b) {
      b.ellipsoid(6.5, 5, 4.5, 6.5, 4.8, 4.5, 'steakMeat');
      b.ellipsoid(5, 7, 4.5, 4.5, 3, 4, 'steakMeat');
      // grill marks and fatty edge
      b.paint((x, y, z, c) => {
        if (z >= 8 && (x + y) % 4 === 0) return 'steakDark';
        if (y >= 8 && (x + z) % 5 === 0) return 'steakLight';
        if (y <= 1) return 'steakDark';
        if (x <= 1 && hash(x, y, z) < 0.6) return 'steakFat';
        return c;
      });
      // bone
      b.box(12, 4, 3, 17, 5, 4, 'bone');
      b.box(12, 3, 3, 17, 3, 4, 'boneShade');
      b.sphere(18, 6, 3.5, 1.6, 'bone');
      b.sphere(18, 3, 3.5, 1.6, 'bone');
      b.set(18, 2, 3, 'boneShade');
      b.set(17, 6, 3, 'boneShade');
      b.box(11, 3, 3, 11, 6, 4, 'steakFat');
    },
  }),

  defineObject({
    id: 'egg',
    name: 'egg',
    synonyms: ['hen egg', 'boiled egg'],
    category: 'food',
    blurb: 'Handle with care. It cracks on hard landings.',
    tags: ['edible', 'fragile'],
    tintKeys: ['eggShell', 'eggShade'],
    burstColor: '#fbf0d8',
    voxelSize: 0.018,
    physics: { mass: 0.06, shape: 'auto', maxBoxes: 3, friction: 0.5, restitution: 0.1 },
    props: { breakSpeed: 4 },
    build(b) {
      b.ellipsoid(4, 4.5, 4, 4, 4.6, 4, 'eggShell');
      b.ellipsoid(4, 7.5, 4, 3.2, 3.6, 3.2, 'eggShell');
      b.paint((x, y, z, c) => {
        if (y <= 1 || (z <= 2 && y <= 6)) return 'eggShade';
        if (z >= 6 && x <= 2 && y >= 6 && y <= 9) return 'eggLight';
        return c;
      });
    },
  }),

  defineObject({
    id: 'watermelon',
    name: 'watermelon',
    synonyms: ['melon', 'water melon', 'cantaloupe'],
    category: 'food',
    blurb: 'Big, striped and heavy. Bursts if dropped.',
    tags: ['edible', 'fragile'],
    tintKeys: ['melonGreen'],
    burstColor: '#e8445a',
    voxelSize: 0.03,
    physics: { mass: 5, shape: 'auto', maxBoxes: 4, friction: 0.6, restitution: 0.1 },
    props: { breakSpeed: 7 },
    build(b, rng) {
      const cx = 10, cy = 7, cz = 7;
      b.ellipsoid(cx, cy, cz, 10, 7, 7, 'melonGreen');
      const phase = rng() * 6;
      b.paint((x, y, z) => {
        const ang = Math.atan2(z + 0.5 - cz, y + 0.5 - cy);
        const wob = Math.sin((x - cx) * 0.35 + phase) * 0.35;
        return Math.sin(ang * 8 + wob * 3) > 0.25 ? 'melonDark' : undefined;
      });
      b.box(9, 14, 6, 10, 15, 7, 'melonStem');
      b.set(11, 15, 7, 'melonStem');
    },
  }),

  defineObject({
    id: 'honey',
    name: 'honey',
    synonyms: ['honey pot', 'honey jar', 'honeycomb', 'hunny'],
    category: 'food',
    blurb: 'A sweet, sticky pot. Bears adore it.',
    tags: ['edible', 'sticky'],
    tintKeys: ['honeyPot', 'honeyPotDark'],
    burstColor: '#ffc21f',
    voxelSize: 0.04,
    physics: { mass: 1, shape: 'auto', maxBoxes: 3, friction: 0.8 },
    build(b) {
      const c = 5.5;
      b.cylinderY(c, c, 0, 0, 4.2, 'honeyPotDark');
      b.cylinderY(c, c, 1, 7, 5.4, 'honeyPot');
      b.cylinderY(c, c, 8, 8, 5.6, 'honeyPotDark'); // rim
      b.cylinderY(c, c, 8, 8, 4.3, 'honeyGold'); // honey surface
      b.cylinderY(c, c, 9, 9, 3.2, 'honeyGold');
      // drips running over the rim
      const drips: [number, number, number][] = [[3, 10, 3], [8, 10, 4], [10, 9, 2], [6, 10, 2]];
      for (const [x, z, len] of drips) {
        for (let k = 0; k < len; k++) b.set(x, 8 - k, z, k === len - 1 ? 'honeyDeep' : 'honeyGold');
      }
      b.set(5, 8, 10, 'honeyGold');
      for (let k = 1; k <= 4; k++) b.set(5, 8 - k, 10, k === 4 ? 'honeyDeep' : 'honeyGold');
      // label
      b.paint((x, y, z, col) => {
        if (z >= 9 && x >= 2 && x <= 8 && y >= 2 && y <= 6) {
          if (y === 4 && (x === 3 || x === 5 || x === 7)) return 'honeyInk';
          if (y === 5 && (x === 4 || x === 6)) return 'honeyInk';
          return 'honeyLabel';
        }
        return col;
      });
      // dipper handle
      b.box(5, 9, 5, 5, 13, 5, 'woodDark');
      b.box(4, 13, 4, 6, 14, 6, 'honeyGold');
    },
  }),

  defineObject({
    id: 'donut',
    name: 'donut',
    synonyms: ['doughnut', 'glazed donut', 'krapfen'],
    category: 'food',
    blurb: 'Pink icing, sprinkles, and a little bounce.',
    tags: ['edible', 'bouncy'],
    tintKeys: ['donutIcing', 'donutIcingDark'],
    burstColor: '#ff7fb0',
    voxelSize: 0.04,
    physics: { mass: 0.3, shape: 'auto', maxBoxes: 6, friction: 0.6, restitution: 0.8 },
    build(b, rng) {
      const c = 6.5, cy = 2.5, Rm = 4.2, rt = 2.3;
      for (let x = 0; x < 13; x++) for (let z = 0; z < 13; z++) for (let y = 0; y < 6; y++) {
        const dx = x + 0.5 - c, dz = z + 0.5 - c, dy = y + 0.5 - cy;
        if (Math.hypot(Math.hypot(dx, dz) - Rm, dy) > rt) continue;
        const ang = Math.atan2(dz, dx);
        const edge = 0.1 + Math.sin(ang * 6) * 0.55 + Math.sin(ang * 11) * 0.25;
        if (dy > edge) b.set(x, y, z, dy > edge + 0.9 ? 'donutIcing' : 'donutIcingDark');
        else b.set(x, y, z, dy < -1 ? 'donutDark' : 'donutDough');
      }
      b.paint((x, y, z, col) => (col === 'donutIcingDark' && hash(x, y, z) < 0.5 ? 'donutIcing' : col));
      sprinkle(b, rng, ['donutIcing', 'donutIcingDark'], 0.16, ['donutSprinkleA', 'donutSprinkleB', 'donutSprinkleC', 'donutSprinkleD']);
    },
  }),

  defineObject({
    id: 'icecream',
    name: 'ice cream',
    synonyms: ['ice cream', 'ice cream cone', 'gelato', 'sundae'],
    category: 'food',
    blurb: 'Two scoops with a cherry. Melts near heat!',
    tags: ['edible', 'cold'],
    tintKeys: ['icePink', 'iceCream'],
    burstColor: '#ffb3cf',
    voxelSize: 0.03,
    physics: { mass: 0.3, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.6 },
    props: { meltTime: 4 },
    build(b) {
      const c = 5.5;
      for (let y = 0; y <= 9; y++) {
        const r = 0.9 + y * 0.36;
        b.cylinderY(c, c, y, y, r, 'iceWaffle');
      }
      b.paint((x, y, z, col) => {
        if (y >= 9) return 'iceWaffleDark';
        return (Math.floor((x + z) / 2) + Math.floor(y / 2)) % 2 === 0 ? 'iceWaffle' : 'iceWaffleDark';
      });
      // melty skirt of the lower scoop
      b.sphere(c, 12.5, c, 4.7, 'icePink');
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        b.sphere(c + Math.cos(a) * 4, 10.5, c + Math.sin(a) * 4, 1.3 + (k % 3) * 0.2, 'icePink');
      }
      b.sphere(c, 17, c, 4.1, 'iceCream');
      b.paint((x, y, z, col) => (col === 'iceCream' && y >= 19 && hash(x, y, z) < 0.15 ? 'white' : col));
      // cherry
      b.sphere(c, 21.2, c, 1.9, 'iceCherry');
      b.set(5, 23, 5, 'iceStem');
      b.set(6, 24, 5, 'iceStem');
      b.set(6, 24, 6, 'iceStem');
    },
  }),

  defineObject({
    id: 'burger',
    name: 'burger',
    synonyms: ['hamburger', 'cheeseburger', 'sandwich', 'sub'],
    category: 'food',
    blurb: 'Stacked high with all the fixings.',
    tags: ['edible'],
    tintKeys: ['burgerBun', 'burgerBunDark'],
    burstColor: '#e0a24a',
    voxelSize: 0.04,
    physics: { mass: 0.5, shape: 'auto', maxBoxes: 5, friction: 0.7 },
    build(b, rng) {
      const c = 6.5;
      // bottom bun
      b.cylinderY(c, c, 0, 0, 5.2, 'burgerBunDark');
      b.cylinderY(c, c, 1, 1, 6, 'burgerBun');
      // wavy lettuce skirt
      for (let x = -2; x < 16; x++) for (let z = -2; z < 16; z++) {
        const dx = x + 0.5 - c, dz = z + 0.5 - c, d = Math.hypot(dx, dz);
        const a = Math.atan2(dz, dx);
        if (d <= 6.6 + Math.sin(a * 7) * 0.9) b.set(x, 2, z, hash(x, 2, z) < 0.4 ? 'burgerLettuceDark' : 'burgerLettuce');
      }
      b.cylinderY(c, c, 3, 3, 6, 'burgerTomato');
      // cheese square with drooping corners
      b.box(0, 4, 0, 12, 4, 12, 'burgerCheese');
      for (const [x, z] of [[0, 0], [12, 0], [0, 12], [12, 12], [6, 12], [12, 6]]) b.set(x, 3, z, 'burgerCheese');
      b.box(5, 3, 12, 7, 3, 12, 'burgerCheese');
      // patty
      b.cylinderY(c, c, 5, 6, 6, 'burgerPatty');
      b.paint((x, y, z, col) => (col === 'burgerPatty' && hash(x, y, z) < 0.25 ? 'burgerPattyDark' : col));
      // domed top bun
      for (let y = 7; y <= 11; y++) {
        const t = (y - 7 + 0.5) / 5.2;
        b.cylinderY(c, c, y, y, 6.8 * Math.sqrt(1 - t * t), y <= 7 ? 'burgerBunDark' : 'burgerBun');
      }
      sprinkle(b, rng, ['burgerBun'], 0.2, ['burgerSesame'], 8);
    },
  }),
];
