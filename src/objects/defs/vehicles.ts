import { definePalette } from '../../voxel/palette';
import type { VoxelBuilder } from '../../voxel/builder';
import type { Entity } from '../../core/entity';
import { defineObject } from '../types';

definePalette({
  // rocket
  rocketBody: '#f4f1ea',
  rocketRed: '#e04848',
  rocketRedDark: '#b13232',
  rocketGlass: '#7fd8ff',
  rocketRing: '#9aa3b0',
  rocketNozzle: '#4a4d57',
  // car
  carBody: '#e5483f',
  carBodyDark: '#b3322b',
  carGlass: '#8fd3f0',
  carChrome: '#c9d0d8',
  carUnder: '#34343c',
  carTire: '#202026',
  carHub: '#bfc5cc',
  carLight: { color: '#fff3a8', emissive: true },
  carTail: { color: '#ff3b30', emissive: true },
  // boat
  boatHull: '#a8693a',
  boatHullDark: '#7d4c28',
  boatTrim: '#e3bb82',
  boatSail: '#f6f2e8',
  boatStripe: '#3a6fd8',
  // helicopter
  heliBody: '#3f8fe0',
  heliBodyDark: '#2b6bb0',
  heliGlass: '#aee6ff',
  heliBlade: '#2a2a30',
  heliSkid: '#8a929c',
  // jetpack
  jetTank: '#b9c2cc',
  jetTankDark: '#7f8895',
  jetBand: '#e04848',
  jetStrap: '#6b4a2f',
  jetNozzle: '#3b3e48',
  jetBuckle: '#ffd84a',
  // wings
  wingWhite: '#f7f7fb',
  wingShade: '#cfd6e8',
  wingBone: '#e3c98a',
  // airplane
  planeBody: '#e04848',
  planeBodyDark: '#b13232',
  planeWing: '#f4f1ea',
  planeGlass: '#8fd3f0',
  planeDark: '#4a4d57',
  planeTire: '#202026',
  planeProp: '#3b2f2a',
  // ufo
  ufoHull: '#b9c1cf',
  ufoHullDark: '#808a9b',
  ufoGlass: '#8dffd9',
  ufoLight: { color: '#7dffb0', emissive: true },
  ufoLight2: { color: '#fff07a', emissive: true },
  ufoBeam: { color: '#d8fff0', emissive: true },
  // kite
  kiteRed: '#e84a5f',
  kiteYellow: '#ffd84a',
  kiteBlue: '#3a8fe0',
  kiteStick: '#8a6a45',
  // parachute
  chuteRed: '#e04848',
  chuteWhite: '#f4f1ea',
  chuteCrate: '#b07a43',
  chuteCrateDark: '#7d532f',
  // skateboard
  skateDeck: '#2fb6a3',
  skateDeckDark: '#228a7b',
  skateGrip: '#25252b',
  skateWheel: '#ffd84a',
  skateTruck: '#9aa3b0',
  // hot air balloon
  hbRed: '#e04848',
  hbCream: '#f4e9c8',
  hbBlue: '#3a6fd8',
  hbBasket: '#c28a4b',
  hbBasketDark: '#8f6232',
  hbRope: '#d9cfae',
  hbBurner: '#7d8591',
  // train
  trainBody: '#2f7a52',
  trainBodyDark: '#225c3c',
  trainDark: '#26262d',
  trainBrass: '#e0b040',
  trainRed: '#c0392b',
  trainGlass: '#9fd8f0',
  trainWheel: '#1c1c22',
  trainLamp: { color: '#fff3a8', emissive: true },
});

/** Wheel with its axis along X, spanning x0..x1, centered at (cy, cz). */
function wheelX(b: VoxelBuilder, x0: number, x1: number, cy: number, cz: number, r: number, tire: string, hub: string) {
  for (let x = x0; x <= x1; x++)
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
        const dy = y + 0.5 - cy, dz = z + 0.5 - cz, d2 = dy * dy + dz * dz;
        if (d2 > r * r) continue;
        const spoke = Math.abs(dz) < 0.6 && dy > 0;
        b.set(x, y, z, d2 <= r * r * 0.25 || spoke ? hub : tire);
      }
}

/** Cylinder with its axis along Z. */
function cylZ(b: VoxelBuilder, cx: number, cy: number, z0: number, z1: number, r: number, c: string | null) {
  for (let z = z0; z <= z1; z++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) (c === null ? b.clear(x, y, z) : b.set(x, y, z, c));
      }
}

/** Spin rolling parts around X in proportion to speed. */
function rollWheels(e: Entity, names: string[], radiusVox: number, dt: number) {
  const r = radiusVox * (e.def.voxelSize ?? 0.1) * e.scale;
  const w = Math.min(e.body.velocity.length(), 12) / r;
  for (const n of names) {
    const p = e.parts.get(n);
    if (p) p.rotation.x += w * dt;
  }
}

const sector = (x: number, z: number, cx: number, cz: number, n: number) =>
  Math.floor(((Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) / (Math.PI * 2)) * n) % n;

const carWheels = ['wFL', 'wFR', 'wRL', 'wRR'];
const trainWheels: string[] = [];
const trainWheelSpecs: Array<[string, number, number, number, number]> = [];
for (const [side, px] of [['L', 0], ['R', 10]] as const)
  [[6, 3, 3], [13, 3, 3], [24, 2, 2]].forEach(([cz, cy, r], i) => {
    const name = `w${side}${i}`;
    trainWheels.push(name);
    trainWheelSpecs.push([name, px, cy, cz, r]);
  });

export default [
  // ---------------------------------------------------------------- rocket
  defineObject({
    id: 'rocket',
    name: 'rocket',
    synonyms: ['spaceship', 'missile', 'space rocket', 'firework', 'rocket ship'],
    category: 'vehicles',
    blurb: 'E to climb on and Space to blast off, or C to light it and stand back.',
    tags: ['thrust', 'metal', 'rideable'],
    tintKeys: ['rocketRed', 'rocketRedDark'],
    burstColor: '#ff9a3c',
    spawnSound: 'whoosh',
    voxelSize: 0.1,
    orient: 'away',
    ride: { kind: 'hover', speed: 7, turn: 1.4, climb: 9, seat: [0, 0.45, -0.4], verb: 'Ride' },
    physics: { mass: 5, shape: 'auto', maxBoxes: 6, friction: 0.5 },
    props: { thrust: 2.6, fuel: 4 },
    build(b) {
      // nozzle
      b.cylinderY(4, 4, 0, 1, 2.2, 'rocketNozzle');
      // body
      b.cylinderY(4, 4, 2, 10, 3.9, 'rocketBody');
      b.cylinderY(4, 4, 8, 8, 3.9, 'rocketRed'); // stripe
      b.cylinderY(4, 4, 2, 2, 3.9, 'rocketRing');
      // nose cone
      [3.5, 3.0, 2.4, 1.7, 1.1].forEach((r, i) => b.cylinderY(4, 4, 11 + i, 11 + i, r, 'rocketRed'));
      b.set(3, 16, 3, 'rocketRedDark').set(4, 16, 3, 'rocketRedDark').set(3, 16, 4, 'rocketRedDark').set(4, 16, 4, 'rocketRedDark');
      b.cylinderY(4, 4, 11, 11, 3.5, 'rocketRedDark');
      // round window with ring
      b.box(2, 5, 7, 5, 8, 7, 'rocketRing');
      b.box(3, 5, 7, 4, 8, 7, 'rocketGlass');
      b.box(2, 6, 7, 5, 7, 7, 'rocketGlass');
      b.set(3, 7, 7, 'white');
      // fins
      for (let y = 0; y <= 6; y++) {
        const e = 4 - Math.floor(y * 0.6);
        b.box(-e, y, 3, -1, y, 4, 'rocketRed');
        b.box(8, y, 3, 7 + e, y, 4, 'rocketRed');
        b.box(3, y, -e, 4, y, -1, 'rocketRed');
        b.box(3, y, 8, 4, y, 7 + e, 'rocketRed');
      }
    },
  }),

  // ------------------------------------------------------------------- car
  defineObject({
    id: 'car',
    name: 'car',
    synonyms: ['automobile', 'auto', 'taxi', 'sedan', 'racecar', 'race car'],
    category: 'vehicles',
    blurb: 'Beep beep! Press E to get in, then W to drive.',
    tags: ['vehicle', 'metal', 'heavy', 'rideable'],
    tintKeys: ['carBody', 'carBodyDark'],
    burstColor: '#e5483f',
    spawnSound: 'engine',
    voxelSize: 0.1,
    orient: 'away',
    ride: { kind: 'ground', speed: 11, turn: 2, seat: [0, 0.32, -0.1], verb: 'Drive' },
    physics: { mass: 60, shape: 'auto', maxBoxes: 6, friction: 0.3 },
    props: { speed: 5 },
    parts: [
      ['wFL', 0.5, 4.5], ['wFR', 9.5, 4.5], ['wRL', 0.5, 14.5], ['wRR', 9.5, 14.5],
    ].map(([n, x, z]) => ({
      name: n as string,
      pivot: [x as number, 2.5, z as number] as [number, number, number],
      build(b: VoxelBuilder) {
        const x0 = Math.round((x as number) - 1.5);
        wheelX(b, x0, x0 + 2, 2.5, z as number, 2.5, 'carTire', 'carHub');
      },
    })),
    build(b) {
      // undercarriage (gives the collider ground contact; wheels are parts)
      b.box(1, 0, 4, 8, 2, 5, 'carUnder');
      b.box(1, 0, 14, 8, 2, 15, 'carUnder');
      b.box(1, 2, 2, 8, 2, 17, 'carUnder');
      // body
      b.box(0, 3, 1, 9, 5, 19, 'carBody');
      b.box(0, 3, 6, 0, 3, 13, 'carBodyDark');
      b.box(9, 3, 6, 9, 3, 13, 'carBodyDark');
      // cabin
      b.box(1, 6, 5, 8, 8, 13, 'carBody');
      b.box(1, 6, 6, 1, 7, 12, 'carGlass');
      b.box(8, 6, 6, 8, 7, 12, 'carGlass');
      b.box(1, 6, 9, 1, 7, 9, 'carBodyDark');
      b.box(8, 6, 9, 8, 7, 9, 'carBodyDark');
      b.box(2, 6, 13, 7, 7, 13, 'carGlass');
      b.box(2, 6, 5, 7, 7, 5, 'carGlass');
      b.box(1, 8, 5, 8, 8, 13, 'carBodyDark');
      // racing stripe
      b.box(4, 5, 14, 5, 5, 19, 'white');
      b.box(4, 5, 1, 5, 5, 4, 'white');
      b.box(4, 8, 5, 5, 8, 13, 'white');
      // bumpers, lights, grille
      b.box(0, 3, 19, 9, 3, 19, 'carChrome');
      b.box(0, 3, 1, 9, 3, 1, 'carChrome');
      b.box(1, 4, 19, 2, 5, 19, 'carLight');
      b.box(7, 4, 19, 8, 5, 19, 'carLight');
      b.box(3, 4, 19, 6, 4, 19, 'black');
      b.box(1, 4, 1, 2, 5, 1, 'carTail');
      b.box(7, 4, 1, 8, 5, 1, 'carTail');
      // side mirrors
      b.set(-1, 6, 12, 'carBodyDark').set(10, 6, 12, 'carBodyDark');
    },
    update(e, _w, dt) {
      rollWheels(e, carWheels, 2.5, dt);
    },
  }),

  // ------------------------------------------------------------------ boat
  defineObject({
    id: 'boat',
    name: 'boat',
    synonyms: ['ship', 'sailboat', 'sail boat', 'canoe', 'raft', 'rowboat', 'dinghy'],
    category: 'vehicles',
    blurb: 'Press E to climb in and sail. Wood burns, though.',
    tags: ['floats', 'vehicle', 'flammable', 'rideable'],
    tintKeys: ['boatHull', 'boatHullDark'],
    burstColor: '#a8693a',
    spawnSound: 'splash',
    voxelSize: 0.1,
    orient: 'away',
    // the hull is hollow, which decomposes into a thin keel; give it a solid hull to bump things with
    ride: { kind: 'water', speed: 5, turn: 1.3, seat: [0, 0.22, -0.1], verb: 'Sail' },
    physics: { mass: 12, shape: 'auto', boxes: [[2, 0, 2, 8, 2, 20], [1, 2, 1, 9, 6, 21]], friction: 0.4 },
    props: { speed: 3, burnTime: 10 },
    build(b) {
      const base = (z: number) => (z < 3 ? 3 + z * 0.5 : z <= 12 ? 4.5 : 4.5 - (z - 12) * 0.4);
      const hw = (y: number, z: number) => Math.max(0.6, base(z) - (4 - y) * 0.6);
      for (let z = 0; z <= 21; z++)
        for (let y = 0; y <= 5; y++) {
          const h = hw(Math.min(y, 4), z);
          for (let x = 0; x <= 9; x++) {
            if (Math.abs(x - 4.5 + 0.5) > h) continue;
            b.set(x, y, z, y === 5 ? 'boatTrim' : y % 2 === 0 ? 'boatHull' : 'boatHullDark');
          }
        }
      // hollow the inside
      for (let z = 1; z <= 19; z++)
        for (let y = 2; y <= 5; y++) {
          const h = hw(Math.min(y, 4), z) - 1.1;
          for (let x = 0; x <= 9; x++) if (Math.abs(x - 4) < h) b.clear(x, y, z);
        }
      b.box(2, 3, 7, 6, 3, 8, 'boatTrim'); // bench
      b.box(2, 3, 16, 6, 3, 16, 'boatTrim');
      // mast, boom, sail
      b.box(4, 2, 12, 4, 21, 12, 'boatHullDark');
      b.box(4, 7, 4, 4, 7, 11, 'boatHullDark');
      for (let y = 8; y <= 19; y++) {
        const len = Math.round((20 - y) * 0.8);
        for (let z = 11 - len + 1; z <= 11; z++) b.set(4, y, z, y === 13 || y === 14 ? 'boatStripe' : 'boatSail');
      }
      // pennant
      b.box(4, 20, 13, 4, 21, 16, 'red');
      // bow lantern
      b.set(4, 6, 20, 'boatTrim');
    },
  }),

  // ------------------------------------------------------------ helicopter
  defineObject({
    id: 'helicopter',
    name: 'helicopter',
    synonyms: ['chopper', 'heli', 'copter'],
    category: 'vehicles',
    blurb: 'Press E to climb in. Space lifts off, Shift comes down, W flies forward.',
    tags: ['flies', 'metal', 'rideable'],
    tintKeys: ['heliBody', 'heliBodyDark'],
    burstColor: '#3f8fe0',
    spawnSound: 'engine',
    voxelSize: 0.1,
    orient: 'away',
    ride: { kind: 'hover', speed: 9, turn: 1.8, climb: 4.5, seat: [0, 0.05, 0.42], verb: 'Fly' },
    physics: { mass: 20, shape: 'auto', maxBoxes: 6, friction: 0.4, angularDamping: 0.6 },
    props: { lift: 1.3, ceiling: 5 },
    parts: [
      {
        name: 'rotor',
        pivot: [4.5, 13.5, 11.5],
        build(b) {
          b.box(-5, 13, 11, 13, 13, 11, 'heliBlade');
          b.box(4, 13, 0, 4, 13, 22, 'heliBlade');
          b.box(-5, 13, 11, -4, 13, 11, 'red');
          b.box(12, 13, 11, 13, 13, 11, 'red');
          b.box(4, 13, 0, 4, 13, 1, 'red');
          b.box(4, 13, 21, 4, 13, 22, 'red');
        },
      },
      {
        name: 'tail',
        pivot: [5.5, 10.5, -11.5],
        build(b) {
          b.box(5, 8, -12, 5, 12, -12, 'heliBlade');
          b.box(5, 10, -14, 5, 10, -10, 'heliBlade');
        },
      },
    ],
    build(b) {
      b.ellipsoid(4.5, 6, 11.5, 4.5, 4, 8.5, 'heliBody');
      b.ellipsoid(4.5, 4.5, 11.5, 3.5, 2, 7.5, 'heliBodyDark');
      b.ellipsoid(4.5, 6.8, 15.5, 3.7, 3, 4, 'heliGlass');
      b.box(3, 6, -12, 5, 7, 4, 'heliBody'); // tail boom
      b.box(4, 6, -14, 4, 12, -10, 'heliBodyDark'); // tail fin
      b.box(2, 7, -10, 7, 7, -8, 'heliBody'); // stabilizer
      b.box(4, 10, 10, 4, 12, 12, 'heliBlade'); // rotor mast
      b.box(3, 10, 10, 5, 10, 12, 'heliBodyDark');
      // skids
      for (const x of [1, 8]) {
        b.box(x, 0, 3, x, 0, 19, 'heliSkid');
        b.set(x, 1, 19, 'heliSkid').set(x, 1, 3, 'heliSkid');
      }
      for (const z of [7, 15]) {
        b.box(2, 1, z, 2, 2, z, 'heliSkid');
        b.box(7, 1, z, 7, 2, z, 'heliSkid');
        b.box(1, 1, z, 1, 1, z, 'heliSkid');
        b.box(8, 1, z, 8, 1, z, 'heliSkid');
      }
      b.box(3, 4, 6, 6, 4, 8, 'heliBodyDark');
    },
    update(e, _w, dt) {
      e.parts.get('rotor')!.rotation.y += dt * 30;
      e.parts.get('tail')!.rotation.x += dt * 35;
    },
  }),

  // --------------------------------------------------------------- jetpack
  defineObject({
    id: 'jetpack',
    name: 'jetpack',
    synonyms: ['rocket pack', 'jet pack', 'rocketpack'],
    category: 'vehicles',
    blurb: 'Press E to strap it on, then hold Space in the air. Refuels when you land.',
    tags: ['thrust', 'metal', 'wearable'],
    tintKeys: ['jetTank', 'jetTankDark'],
    burstColor: '#ffb43c',
    spawnSound: 'whoosh',
    voxelSize: 0.07,
    physics: { mass: 3, shape: 'auto', maxBoxes: 5, friction: 0.5 },
    props: { thrust: 1.8, fuel: 5 },
    build(b) {
      for (const cx of [3, 9]) {
        b.cylinderY(cx, 3, 4, 17, 2.7, 'jetTank');
        b.cylinderY(cx, 3, 4, 17, 2.7, 'jetTank');
        b.sphere(cx, 17.5, 3, 2.6, 'jetTank');
        b.cylinderY(cx, 3, 11, 11, 2.7, 'jetBand');
        b.cylinderY(cx, 3, 14, 14, 2.7, 'jetBand');
        b.cylinderY(cx, 3, 4, 4, 2.7, 'jetTankDark');
        // nozzle
        b.cylinderY(cx, 3, 2, 3, 2.1, 'jetNozzle');
        b.cylinderY(cx, 3, 0, 1, 1.6 + 0.9, 'jetNozzle');
        b.cylinderY(cx, 3, 0, 0, 1.3, 'ember');
        // highlight
        b.box(cx - 2, 6, 5, cx - 2, 15, 5, 'white');
      }
      // brace between tanks
      b.box(5, 6, 2, 6, 14, 3, 'jetTankDark');
      b.box(5, 9, 5, 6, 9, 5, 'jetTankDark');
      // straps
      b.box(0, 12, 5, 11, 13, 6, 'jetStrap');
      b.box(0, 7, 5, 11, 7, 6, 'jetStrap');
      b.box(5, 12, 6, 6, 13, 7, 'jetBuckle');
      // shoulder straps
      b.box(2, 8, 6, 3, 17, 6, 'jetStrap');
      b.box(8, 8, 6, 9, 17, 6, 'jetStrap');
    },
  }),

  // ------------------------------------------------------------------ wing
  defineObject({
    id: 'wing',
    name: 'wings',
    synonyms: ['wings', 'angel wings', 'angel wing', 'feather wings', 'feather wing'],
    category: 'vehicles',
    blurb: 'Press E to put them on. Tap Space in the air to flap. Do not set on fire.',
    tags: ['flies', 'flammable', 'wearable'],
    tintKeys: ['wingWhite', 'wingShade'],
    burstColor: '#f7f7fb',
    spawnSound: 'whoosh',
    voxelSize: 0.06,
    physics: { mass: 0.6, shape: 'auto', maxBoxes: 4, linearDamping: 0.4 },
    props: { lift: 1.1, ceiling: 4, burnTime: 4 },
    parts: (['R', 'L'] as const).map((side) => ({
      name: `wing${side}`,
      pivot: [side === 'R' ? 1 : -1, 4, 1] as [number, number, number],
      build(b: VoxelBuilder) {
        const s = side === 'R' ? 1 : -1;
        for (let x = 1; x <= 15; x++) {
          const top = 6 + Math.floor(x * 0.8);
          const bottom = Math.max(0, Math.round(x * 0.4)) - (x % 2 === 0 ? 1 : 0);
          for (let y = Math.max(0, bottom); y <= top; y++)
            for (let z = 0; z <= 1; z++) {
              const c = y - Math.max(0, bottom) < 2 || (x % 2 === 0 && y < bottom + 4) ? 'wingShade' : 'wingWhite';
              b.set(s === 1 ? x : -1 - x, y, z, c);
            }
        }
      },
    })),
    build(b) {
      b.box(-1, 2, 0, 0, 10, 1, 'wingBone');
      b.box(-1, 11, 0, 0, 11, 1, 'wingWhite');
    },
    update(e, _w, dt) {
      const a = Math.sin(e.age * 9) * 0.3;
      e.parts.get('wingR')!.rotation.z = a;
      e.parts.get('wingL')!.rotation.z = -a;
      void dt;
    },
  }),

  // -------------------------------------------------------------- airplane
  defineObject({
    id: 'airplane',
    name: 'airplane',
    synonyms: ['plane', 'aeroplane', 'jet', 'biplane', 'aircraft'],
    category: 'vehicles',
    blurb: 'Press E to climb in. Hold W to take off speed, Space to pull up, A and D to turn.',
    tags: ['flies', 'vehicle', 'metal', 'rideable'],
    tintKeys: ['planeBody', 'planeBodyDark'],
    burstColor: '#e04848',
    spawnSound: 'engine',
    voxelSize: 0.1,
    orient: 'away',
    ride: { kind: 'plane', speed: 16, turn: 1.1, seat: [0, 0.42, -0.1], verb: 'Fly' },
    physics: { mass: 10, shape: 'auto', maxBoxes: 6, friction: 0.4 },
    props: { lift: 1.2, ceiling: 6, speed: 5 },
    parts: [
      {
        name: 'prop',
        pivot: [0.5, 5, 20.5],
        build(b) {
          b.box(0, 1, 20, 0, 8, 20, 'planeProp');
          b.box(-3, 4, 20, 4, 5, 20, 'planeProp');
          b.box(0, 4, 21, 0, 5, 21, 'planeBodyDark');
        },
      },
    ],
    build(b) {
      b.ellipsoid(0.5, 5, 10, 3.5, 3.5, 10, 'planeBody');
      cylZ(b, 0.5, 5, 17, 19, 2.3, 'planeDark');
      b.ellipsoid(0.5, 7.8, 12, 2, 1.6, 3.2, 'planeGlass');
      // wings
      b.box(-14, 4, 6, 15, 5, 11, 'planeWing');
      b.box(-14, 4, 6, -12, 5, 11, 'planeBody');
      b.box(13, 4, 6, 15, 5, 11, 'planeBody');
      // tail
      b.box(-6, 5, 0, 7, 5, 3, 'planeWing');
      for (let y = 6; y <= 12; y++) b.box(0, y, 0, 0, y, Math.max(1, 4 - Math.floor((y - 6) * 0.6)), 'planeBody');
      b.box(0, 12, 0, 0, 12, 1, 'planeBodyDark');
      // landing gear
      b.box(-3, 0, 8, -2, 2, 10, 'planeTire');
      b.box(3, 0, 8, 4, 2, 10, 'planeTire');
      b.box(0, 0, 2, 0, 2, 2, 'planeTire');
      b.box(-3, 3, 9, -3, 3, 9, 'planeDark').set(4, 3, 9, 'planeDark');
    },
    update(e, _w, dt) {
      e.parts.get('prop')!.rotation.z += dt * 40;
    },
  }),

  // ------------------------------------------------------------------- ufo
  defineObject({
    id: 'ufo',
    name: 'UFO',
    synonyms: ['flying saucer', 'saucer', 'alien ship', 'spacecraft', 'alien spaceship'],
    category: 'vehicles',
    blurb: 'Bzzzt. Press E to climb aboard. Space and Shift go up and down.',
    tags: ['flies', 'metal', 'glows', 'rideable'],
    tintKeys: ['ufoHull', 'ufoHullDark'],
    burstColor: '#7dffd0',
    spawnSound: 'magic',
    voxelSize: 0.1,
    orient: 'away',
    ride: { kind: 'hover', speed: 12, turn: 2.4, climb: 6, seat: [0, 0.45, 0], verb: 'Fly' },
    physics: { mass: 8, shape: 'auto', maxBoxes: 5, friction: 0.3 },
    props: { lift: 1.25, ceiling: 6, glow: 5 },
    build(b) {
      b.ellipsoid(10, 5.5, 10, 5.2, 4.5, 5.2, 'ufoGlass'); // dome (lower half hidden by the hull)
      b.ellipsoid(10, 3, 10, 10, 2.6, 10, 'ufoHull');
      b.ellipsoid(10, 1.5, 10, 6, 2, 6, 'ufoHullDark');
      b.ellipsoid(10, 2.6, 10, 10, 0.8, 10, 'ufoHullDark'); // rim band
      b.paint((x, y, z, c) => (y < 5 && c === 'ufoGlass' ? 'ufoHull' : undefined));
      // lights ring on the rim
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = Math.round(10 + Math.cos(a) * 9.3 - 0.5), z = Math.round(10 + Math.sin(a) * 9.3 - 0.5);
        b.set(x, 3, z, k % 2 ? 'ufoLight' : 'ufoLight2');
      }
      // belly lights
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        b.set(Math.round(10 + Math.cos(a) * 4 - 0.5), 0, Math.round(10 + Math.sin(a) * 4 - 0.5), 'ufoLight');
      }
      b.box(9, 0, 9, 10, 0, 10, 'ufoBeam');
      // antenna
      b.box(10, 10, 10, 10, 12, 10, 'ufoHullDark');
      b.set(10, 13, 10, 'ufoLight2');
    },
    update(e, _w, dt) {
      e.visual.rotation.y += dt * 1.2;
    },
  }),

  // ------------------------------------------------------------------ kite
  defineObject({
    id: 'kite',
    name: 'kite',
    synonyms: ['diamond kite', 'paper kite'],
    category: 'vehicles',
    blurb: 'Catches the breeze. Hold on to it and you fall gently. Paper and string burn fast.',
    tags: ['flies', 'flammable'],
    tintKeys: ['kiteRed', 'kiteYellow'],
    burstColor: '#e84a5f',
    spawnSound: 'whoosh',
    voxelSize: 0.06,
    physics: { mass: 0.2, shape: 'auto', maxBoxes: 4, linearDamping: 0.5 },
    props: { lift: 1.2, ceiling: 6, burnTime: 3 },
    build(b) {
      for (let y = 4; y <= 24; y++) {
        const hw = y <= 17 ? (7 * (y - 4)) / 13 : (7 * (24 - y)) / 7;
        for (let x = 0; x <= 16; x++) {
          if (Math.abs(x - 8) > hw) continue;
          b.set(x, y, 0, x < 8 !== y < 17 ? 'kiteRed' : 'kiteYellow');
        }
      }
      b.box(8, 4, -1, 8, 24, -1, 'kiteStick');
      b.box(1, 17, -1, 15, 17, -1, 'kiteStick');
      b.box(8, 17, 0, 8, 17, 0, 'white');
      // tail with bows
      for (let i = 0; i < 18; i++) {
        const x = 8 + Math.round(Math.sin(i * 0.8));
        b.set(x, 3 - i, 0, 'string');
        if (i % 4 === 3) {
          const c = (i >> 2) % 2 ? 'kiteBlue' : 'kiteRed';
          b.box(x - 2, 3 - i, 0, x + 2, 3 - i - 1, 0, c);
          b.set(x, 3 - i, 0, 'white');
        }
      }
    },
  }),

  // ------------------------------------------------------------- parachute
  defineObject({
    id: 'parachute',
    name: 'parachute',
    synonyms: ['chute', 'paraglider'],
    category: 'vehicles',
    blurb: 'Grab it and jump off something high: you drift down gently.',
    tags: ['glider', 'flammable'],
    tintKeys: ['chuteRed'],
    burstColor: '#e04848',
    spawnSound: 'whoosh',
    voxelSize: 0.08,
    physics: { mass: 1, shape: 'auto', maxBoxes: 4, linearDamping: 0.3 },
    props: { fallSpeed: 1.2, burnTime: 4 },
    build(b) {
      b.ellipsoid(10, 18, 10, 10, 8, 10, 'chuteRed');
      b.ellipsoid(10, 18, 10, 8.8, 6.8, 8.8, null);
      b.paint((x, y, z, c) => (y < 18 ? null : sector(x, z, 10, 10, 12) % 2 ? 'chuteWhite' : c));
      // strings from the rim down to the crate
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x0 = 10 + Math.cos(a) * 9.4, z0 = 10 + Math.sin(a) * 9.4;
        for (let y = 18; y >= 5; y--) {
          const t = (18 - y) / 13;
          b.set(Math.round(x0 + (10 - x0) * t - 0.5), y, Math.round(z0 + (10 - z0) * t - 0.5), 'string');
        }
      }
      // little crate
      b.box(8, 0, 8, 11, 4, 11, 'chuteCrate');
      b.box(8, 2, 8, 11, 2, 11, 'chuteCrateDark');
      b.box(8, 0, 8, 8, 4, 8, 'chuteCrateDark').box(11, 0, 11, 11, 4, 11, 'chuteCrateDark');
      b.box(11, 0, 8, 11, 4, 8, 'chuteCrateDark').box(8, 0, 11, 8, 4, 11, 'chuteCrateDark');
    },
  }),

  // ------------------------------------------------------------ skateboard
  defineObject({
    id: 'skateboard',
    name: 'skateboard',
    synonyms: ['skate board', 'skate', 'longboard'],
    category: 'vehicles',
    blurb: 'Press E to hop on. Faster than running, and it goes where you steer.',
    tags: ['vehicle', 'rideable'],
    tintKeys: ['skateDeck', 'skateDeckDark'],
    burstColor: '#2fb6a3',
    spawnSound: 'click',
    voxelSize: 0.045,
    orient: 'away',
    ride: { kind: 'ground', speed: 8, turn: 2.6, seat: [0, 0.75, 0], verb: 'Ride', stand: true },
    physics: { mass: 2, shape: 'auto', maxBoxes: 5, friction: 0.15 },
    props: { speed: 3 },
    build(b) {
      b.box(0, 3, 0, 7, 3, 21, 'skateDeck');
      b.box(0, 4, 3, 7, 4, 18, 'skateGrip');
      // kicked-up ends
      b.box(0, 4, 0, 7, 4, 2, 'skateDeck').box(0, 4, 19, 7, 4, 21, 'skateDeck');
      b.box(0, 5, 0, 7, 5, 0, 'skateDeckDark').box(0, 5, 21, 7, 5, 21, 'skateDeckDark');
      b.box(0, 3, 0, 7, 3, 0, 'skateDeckDark').box(0, 3, 21, 7, 3, 21, 'skateDeckDark');
      // trucks and wheels
      for (const z of [4, 16]) {
        b.box(1, 2, z, 6, 2, z + 1, 'skateTruck');
        b.box(-1, 0, z - 1, 0, 2, z + 2, 'skateWheel');
        b.box(7, 0, z - 1, 8, 2, z + 2, 'skateWheel');
      }
    },
  }),

  // ---------------------------------------------------------- hot air balloon
  defineObject({
    id: 'hotairballoon',
    name: 'hot air balloon',
    synonyms: ['hot air balloon', 'air balloon', 'blimp', 'zeppelin', 'airship'],
    category: 'vehicles',
    blurb: 'Press E to climb in the basket. Slow, high and peaceful. Mind the flames.',
    tags: ['flies', 'carrier', 'flammable', 'rideable'],
    tintKeys: ['hbRed'],
    burstColor: '#e04848',
    spawnSound: 'whoosh',
    voxelSize: 0.08,
    orient: 'away',
    ride: { kind: 'hover', speed: 3, turn: 0.9, climb: 2, seat: [0, -0.62, 0], verb: 'Fly', stand: true },
    physics: { mass: 15, shape: 'auto', maxBoxes: 6, linearDamping: 0.5, angularDamping: 0.8 },
    props: { lift: 1.35, ceiling: 7, carryMass: 20, burnTime: 6 },
    build(b) {
      b.ellipsoid(10, 22, 10, 9.6, 10.5, 9.6, 'hbRed');
      [[8, 2.6], [9, 3.2], [10, 4.4], [11, 6]].forEach(([y, r]) => b.cylinderY(10, 10, y, y, r, 'hbRed'));
      b.cylinderY(10, 10, 8, 10, 2.2, null);
      const stripes = ['hbRed', 'hbCream', 'hbBlue', 'hbCream'];
      b.paint((x, y, z) => (y >= 8 ? stripes[sector(x, z, 10, 10, 16) % 4] : undefined));
      // basket
      b.box(7, 0, 7, 12, 5, 12, 'hbBasket');
      for (let y = 0; y <= 4; y += 2) b.box(7, y, 7, 12, y, 12, 'hbBasketDark');
      b.box(8, 1, 8, 11, 5, 11, null);
      b.box(7, 5, 7, 12, 5, 12, 'woodDark');
      b.box(8, 5, 8, 11, 5, 11, null);
      // ropes from basket corners up to the skirt
      for (const [cx, cz] of [[7, 7], [12, 7], [7, 12], [12, 12]]) {
        for (let y = 6; y <= 11; y++) {
          const t = (y - 6) / 5;
          b.set(Math.round(cx + (cx < 10 ? 1 : -1) * t * 1.5), y, Math.round(cz + (cz < 10 ? 1 : -1) * t * 1.5), 'hbRope');
        }
      }
      // burner
      b.box(9, 6, 9, 10, 7, 10, 'hbBurner');
      b.box(9, 8, 9, 10, 10, 10, 'flameOuter');
      b.box(9, 8, 9, 10, 9, 10, 'flameMid');
      b.set(9, 8, 9, 'flameCore');
    },
    update(e, _w, dt) {
      e.visual.rotation.y += dt * 0.2;
    },
  }),

  // ----------------------------------------------------------------- train
  defineObject({
    id: 'train',
    name: 'train',
    synonyms: ['locomotive', 'choo choo', 'steam engine', 'steam train'],
    category: 'vehicles',
    blurb: 'Chugga chugga! Press E to climb on and drive it anywhere. No tracks needed.',
    tags: ['vehicle', 'metal', 'heavy', 'rideable'],
    tintKeys: ['trainBody', 'trainBodyDark'],
    burstColor: '#2f7a52',
    spawnSound: 'engine',
    voxelSize: 0.09,
    orient: 'away',
    ride: { kind: 'ground', speed: 8, turn: 1.3, seat: [0, 0.4, -0.5], verb: 'Drive' },
    physics: { mass: 70, shape: 'auto', maxBoxes: 8, friction: 0.3 },
    props: { speed: 3 },
    parts: trainWheelSpecs.map(([name, px, cy, cz, r]) => ({
      name,
      pivot: [px, cy, cz] as [number, number, number],
      build(b: VoxelBuilder) {
        const x0 = px === 0 ? -1 : 9;
        wheelX(b, x0, x0 + 1, cy, cz, r, 'trainWheel', 'trainBrass');
      },
    })),
    build(b) {
      // chassis + axles
      b.box(0, 3, 0, 9, 4, 33, 'trainDark');
      b.box(1, 0, 5, 8, 2, 6, 'trainDark').box(1, 0, 12, 8, 2, 13, 'trainDark').box(1, 0, 23, 8, 1, 24, 'trainDark');
      // boiler
      cylZ(b, 5, 8.5, 11, 30, 4.2, 'trainBody');
      b.paint((x, y, z, c) =>
        c !== 'trainBody' ? undefined : z >= 28 ? 'trainDark' : z === 13 || z === 20 || z === 25 ? 'trainBrass' : undefined,
      );
      cylZ(b, 5, 8.5, 30, 30, 1.6, 'trainBrass'); // smokebox door
      cylZ(b, 5, 8.5, 31, 31, 0.8, 'trainLamp');
      // cab
      b.box(0, 5, 0, 9, 15, 10, 'trainBody');
      b.box(0, 11, 2, 0, 14, 7, 'trainGlass').box(9, 11, 2, 9, 14, 7, 'trainGlass');
      b.box(3, 9, 0, 6, 12, 0, 'trainGlass');
      b.box(0, 5, 0, 9, 5, 10, 'trainBodyDark');
      b.box(-1, 16, -1, 10, 17, 11, 'trainDark');
      // chimney + dome
      b.cylinderY(5, 26, 12, 18, 1.6, 'trainDark');
      b.cylinderY(5, 26, 19, 20, 2.4, 'trainBrass');
      b.ellipsoid(5, 12.5, 18, 2, 1.8, 2, 'trainBrass');
      // cowcatcher
      for (let i = 0; i < 4; i++) b.box(1, 1, 32 + i, 8, 4 - i, 32 + i, 'trainRed');
      b.box(0, 3, 33, 9, 3, 33, 'trainRed');
    },
    update(e, _w, dt) {
      rollWheels(e, trainWheels, 3, dt);
    },
  }),
];
