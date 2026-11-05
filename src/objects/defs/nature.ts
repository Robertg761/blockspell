import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

definePalette({
  waterDeep: '#2f7fd8',
  waterMid: '#3f95e8',
  waterTop: '#68b6f4',
  waterFoam: '#e9f7ff',
  rockMoss: '#5f8f45',
  rockLight: '#a9aab2',
  treeApple: '#e8392f',
  treeLeafLight: '#66bd4f',
  iceBlue: '#b4ecf5',
  iceDeep: '#8ad6e8',
  iceFrost: '#f2fdff',
  cloudWhite: '#ffffff',
  cloudShade: '#dfe6ee',
  cloudGrey: '#aeb8c6',
  sunCore: { color: '#ffd84a', emissive: true },
  sunOrange: { color: '#ffa530', emissive: true },
  sunRay: { color: '#ffb92e', emissive: true },
  sunFace: '#8a4a12',
  starYellow: { color: '#ffe066', emissive: true },
  starLight: { color: '#fff3a8', emissive: true },
  starOrange: { color: '#ffc233', emissive: true },
  snowWhite: '#f6fbff',
  snowShade: '#d4e6f5',
  snowCoal: '#25242a',
  snowCarrot: '#ff8a1f',
  snowScarf: '#e04848',
  snowStick: '#6b4a2b',
  snowHat: '#2b2a33',
  snowballShade: '#cfe3f6',
  bushLeaf: '#3f9a3c',
  bushLeafDark: '#2f7d2f',
  bushLeafLight: '#58b84a',
  bushBerry: '#d6304a',
  flowerStem: '#4fa341',
  flowerPetal: '#ffffff',
  flowerPetalShade: '#e6e6ee',
  flowerCenter: '#ffc933',
  mushCap: '#e0403f',
  mushCapDark: '#b92f33',
  mushSpot: '#fff6e4',
  mushStem: '#f1e6d2',
  mushStemShade: '#d8c8aa',
  cactusGreen: '#3f9a4a',
  cactusDark: '#2f7d3b',
  cactusSpine: '#e8f2b8',
  cactusBloom: '#ff6fa8',
  logBark: '#6e4a2e',
  logBarkDark: '#54381f',
  logWood: '#d9a86a',
  logRing: '#b07d44',
  lavaCore: { color: '#ffd23a', emissive: true },
  lavaMid: { color: '#ff8a1e', emissive: true },
  lavaHot: { color: '#ff5a1a', emissive: true },
  lavaCrust: '#2e2420',
  lavaCrustLight: '#4a3a33',
  crystalBase: '#6d6b78',
  crystalBaseDark: '#55535f',
  crystalPurple: { color: '#a24bff', emissive: true },
  crystalViolet: { color: '#c58bff', emissive: true },
  crystalCyan: { color: '#43e0f0', emissive: true },
  crystalLight: { color: '#e9fbff', emissive: true },
});

export default [
  // ---------------------------------------------------------------- water
  defineObject({
    id: 'water',
    name: 'water',
    synonyms: ['pool', 'pond', 'puddle', 'lake', 'splash', 'water pool'],
    category: 'nature',
    blurb: 'Splash! Puts out fires. Things sink in, some things float.',
    tags: ['liquid', 'wet'],
    tintKeys: ['waterMid', 'waterDeep', 'waterTop'],
    burstColor: '#68b6f4',
    spawnSound: 'splash',
    voxelSize: 0.1,
    physics: { anchored: true, mass: 0, shape: 'box' },
    build(b, rng) {
      b.box(-12, 0, -12, 11, 3, 11, 'waterDeep');
      b.box(-12, 3, -12, 11, 3, 11, 'waterMid');
      // rippled top layer, rounded corners
      for (let x = -12; x <= 11; x++)
        for (let z = -12; z <= 11; z++) {
          const corner = Math.abs(x + 0.5) > 10.5 && Math.abs(z + 0.5) > 10.5;
          if (corner) {
            for (let y = 0; y <= 4; y++) b.clear(x, y, z);
            continue;
          }
          const ripple = Math.sin(x * 0.9 + z * 0.4) + Math.cos(z * 0.8 - x * 0.3) + (rng() - 0.5);
          b.set(x, 4, z, ripple > 0.6 ? 'waterTop' : 'waterMid');
          if (ripple > 1.5 && rng() > 0.5) b.set(x, 4, z, 'waterFoam');
        }
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(rng() * 22) - 10, z = Math.floor(rng() * 22) - 10;
        if (b.has(x, 4, z)) b.set(x, 4, z, 'waterFoam');
      }
    },
  }),

  // ---------------------------------------------------------------- rock
  defineObject({
    id: 'rock',
    name: 'rock',
    synonyms: ['stone', 'boulder', 'pebble', 'rocks'],
    category: 'nature',
    blurb: 'Heavy and dumb. Lands with a thud.',
    tags: ['heavy'],
    tintKeys: ['stone', 'stoneDark', 'rockLight'],
    burstColor: '#8f9098',
    spawnSound: 'thud',
    voxelSize: 0.08,
    physics: { mass: 40, shape: 'auto', maxBoxes: 6, friction: 0.8 },
    build(b, rng) {
      b.ellipsoid(0, 5, 0, 7, 5, 6, 'stone');
      b.ellipsoid(-4, 4, 2, 4.5, 4, 4, 'stone');
      b.ellipsoid(4, 3.5, -2, 4, 3.5, 4, 'stone');
      // carve noise
      for (let i = 0; i < 10; i++) {
        const a = rng() * Math.PI * 2;
        b.sphere(Math.cos(a) * 8, 3 + rng() * 6, Math.sin(a) * 7, 1.4 + rng() * 1.2, null);
      }
      b.box(-12, -1, -12, 12, -1, 12, null);
      b.box(-12, 0, -12, 12, 0, 12, null);
      b.paint((x, y, z) => {
        const n = rng();
        if (y >= 8 && n < 0.35) return 'rockMoss';
        if (y >= 6 && n < 0.18) return 'rockLight';
        if (y <= 3 && n < 0.5) return 'stoneDark';
        if (n < 0.12) return 'stoneDark';
        return undefined;
      });
    },
  }),

  // ---------------------------------------------------------------- tree
  defineObject({
    id: 'tree',
    name: 'tree',
    synonyms: ['oak', 'pine', 'trees', 'sapling'],
    category: 'nature',
    blurb: 'Climb it, burn it, or chop it down for logs.',
    tags: ['flammable', 'climbable'],
    tintKeys: ['leaf', 'leafDark', 'treeLeafLight'],
    burstColor: '#4fa341',
    spawnSound: 'pop',
    voxelSize: 0.1,
    physics: { anchored: true, mass: 40, shape: 'auto', maxBoxes: 6 },
    props: { burnTime: 14 },
    debris: ['plank'],
    build(b, rng) {
      // roots and trunk
      b.cylinderY(0, 0, 0, 18, 2.2, 'bark');
      b.cylinderY(0, 0, 0, 2, 3.2, 'bark');
      for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) b.box(dx - 1 + (dx ? Math.sign(dx) : 0), 0, dz - 1, dx + (dx ? Math.sign(dx) : 0), 1, dz, 'bark');
      b.paint((x, y, z, c) => (c === 'bark' && (x * 7 + z * 3 + y) % 5 === 0 ? 'logBarkDark' : undefined));
      // branch stubs
      b.box(2, 13, 0, 4, 14, 1, 'bark');
      b.box(-4, 15, -1, -2, 16, 0, 'bark');
      // layered canopy
      const lobes: [number, number, number, number, number][] = [
        [0, 24, 0, 9, 5],
        [-6, 22, 2, 6, 4],
        [6, 22, -2, 6, 4],
        [1, 29, 1, 6, 4.5],
        [-2, 21, -6, 5.5, 4],
        [3, 20, 6, 5.5, 4],
      ];
      for (const [x, y, z, r, ry] of lobes) b.ellipsoid(x, y, z, r, ry, r, 'leaf');
      b.paint((x, y, z, c) => {
        if (c !== 'leaf') return undefined;
        const n = rng();
        if (y > 26 && n < 0.45) return 'treeLeafLight';
        if (y < 22 && n < 0.55) return 'leafDark';
        if (n < 0.2) return 'leafDark';
        if (n < 0.3) return 'treeLeafLight';
        return undefined;
      });
      // rng clumps poking out
      for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2, h = 19 + rng() * 11;
        b.sphere(Math.round(Math.cos(a) * 9), Math.round(h), Math.round(Math.sin(a) * 9), 1.5 + rng() * 1.5, rng() > 0.5 ? 'leaf' : 'leafDark');
      }
      // apples
      for (let i = 0; i < 5; i++) {
        const a = rng() * Math.PI * 2, r = 8;
        const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
        for (let y = 24; y >= 17; y--) if (b.has(x, y, z) && !b.has(x, y - 1, z)) { b.set(x, y - 1, z, 'treeApple'); break; }
      }
    },
  }),

  // ---------------------------------------------------------------- ice
  defineObject({
    id: 'ice',
    name: 'ice',
    synonyms: ['ice cube', 'ice block', 'iceberg'],
    category: 'nature',
    blurb: 'Super slippery. Melts near heat. Freezes water.',
    tags: ['cold', 'slippery', 'floats'],
    tintKeys: ['iceBlue', 'iceDeep'],
    burstColor: '#b4ecf5',
    spawnSound: 'freeze',
    voxelSize: 0.07,
    physics: { mass: 3, shape: 'box', friction: 0.03 },
    props: { meltTime: 5 },
    build(b, rng) {
      b.box(0, 0, 0, 9, 9, 9, 'iceBlue');
      b.paint((x, y, z, c) => {
        const edges = [x === 0 || x === 9, y === 0 || y === 9, z === 0 || z === 9].filter(Boolean).length;
        if (edges >= 2) return 'iceFrost';
        if (rng() < 0.12) return 'iceDeep';
        return undefined;
      });
      // crack streaks on front, top and side faces
      let x = 2 + Math.floor(rng() * 3);
      for (let y = 8; y >= 2; y--) {
        b.set(x, y, 9, 'iceFrost');
        if (rng() > 0.5) x = Math.max(1, Math.min(8, x + (rng() > 0.5 ? 1 : -1)));
      }
      for (let i = 0; i < 5; i++) b.set(2 + i, 9, 2 + Math.floor(i * 1.3), 'iceFrost');
      for (let i = 0; i < 5; i++) b.set(9, 3 + i, 2 + i, 'iceFrost');
      b.box(3, 3, 9, 4, 3, 9, 'iceDeep');
    },
  }),

  // ---------------------------------------------------------------- cloud
  defineObject({
    id: 'cloud',
    name: 'cloud',
    synonyms: ['raincloud', 'storm cloud', 'rain', 'cumulus'],
    category: 'nature',
    blurb: 'Drifts up high and rains on everything below.',
    tags: ['flies', 'rains'],
    tintKeys: ['cloudWhite', 'cloudShade', 'cloudGrey'],
    burstColor: '#dfe6ee',
    spawnSound: 'whoosh',
    voxelSize: 0.1,
    physics: { mass: 1, shape: 'box', linearDamping: 0.6, angularDamping: 0.9 },
    props: { lift: 1.25, ceiling: 4.5 },
    build(b) {
      b.ellipsoid(0, 4, 0, 6, 3.5, 4.5, 'cloudWhite');
      b.ellipsoid(-6, 3, 0, 4.5, 3, 3.5, 'cloudWhite');
      b.ellipsoid(6, 3, 0.5, 4.5, 3, 3.5, 'cloudWhite');
      b.ellipsoid(-2, 6, 0, 4, 3.5, 3.5, 'cloudWhite');
      b.ellipsoid(3, 6, 1, 3.5, 3, 3, 'cloudWhite');
      b.ellipsoid(0, 3, 3, 5, 2.5, 3, 'cloudWhite');
      b.paint((x, y, z) => (y <= 1 ? 'cloudGrey' : y === 2 ? 'cloudShade' : y === 3 && (x + z) % 2 === 0 ? 'cloudShade' : undefined));
    },
    update(e, world) {
      e.visual.position.y = Math.sin(world.time * 1.5 + e.id) * 0.03;
    },
  }),

  // ---------------------------------------------------------------- sun
  defineObject({
    id: 'sun',
    name: 'sun',
    synonyms: ['sunshine', 'sunny'],
    category: 'nature',
    blurb: 'Warm and glowing. Melts ice, dries things, may light fires.',
    tags: ['flies', 'hot', 'glows'],
    tintKeys: ['sunCore', 'sunOrange', 'sunRay'],
    burstColor: '#ffd84a',
    spawnSound: 'magic',
    voxelSize: 0.1,
    physics: { mass: 1, shape: 'sphere', linearDamping: 0.6, angularDamping: 0.9 },
    props: { lift: 1.3, ceiling: 6.5, heatRadius: 3, glow: 8 },
    build(b) {
      b.sphere(0, 0, 0, 5.6, 'sunCore');
      b.paint((x, y, z) => (Math.hypot(x + 0.5, y + 0.5) > 4.4 ? 'sunOrange' : undefined));
      // rays: 8 spikes in the XY plane, 3 voxels long, tapered
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4, dx = Math.cos(a), dy = Math.sin(a);
        for (let d = 6; d <= 9; d++) {
          const w = d < 8 ? 1 : 0;
          const x = Math.round(dx * d - 0.5), y = Math.round(dy * d - 0.5);
          b.box(x - w, y - w, -1, x, y, 0, 'sunRay');
        }
      }
      // cute face on +Z
      b.box(-3, 0, 5, -2, 1, 5, 'sunFace');
      b.box(1, 0, 5, 2, 1, 5, 'sunFace');
      b.box(-2, -3, 5, 1, -3, 5, 'sunFace');
      b.set(-3, -2, 5, 'sunFace');
      b.set(2, -2, 5, 'sunFace');
      b.box(-4, -2, 5, -4, -2, 5, 'sunRay');
      b.box(3, -2, 5, 3, -2, 5, 'sunRay');
    },
    update(e, _world, dt) {
      e.visual.rotation.z += dt * 0.5;
    },
  }),

  // ---------------------------------------------------------------- star
  defineObject({
    id: 'star',
    name: 'star',
    synonyms: ['stars', 'twinkle', 'shooting star'],
    category: 'nature',
    blurb: 'A twinkling star that hovers and lights up the dark.',
    tags: ['flies', 'glows'],
    tintKeys: ['starYellow', 'starLight', 'starOrange'],
    burstColor: '#ffe066',
    spawnSound: 'chime',
    voxelSize: 0.08,
    physics: { mass: 0.8, shape: 'sphere', linearDamping: 0.6, angularDamping: 0.9 },
    props: { lift: 1.3, ceiling: 3, glow: 4 },
    build(b) {
      const R = 9, r = 4;
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      const inside = (px: number, py: number) => {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      for (let x = -10; x <= 9; x++)
        for (let y = -10; y <= 10; y++) {
          if (!inside(x + 0.5, y + 0.5)) continue;
          const core = Math.hypot(x + 0.5, y + 0.5) < 4.2;
          for (let z = 0; z < 3; z++) b.set(x, y, z, core ? 'starLight' : z === 1 ? 'starYellow' : 'starOrange');
        }
      // slightly lighter front face centre
      b.paint((x, y, z, c) => (z === 2 && c === 'starOrange' ? 'starYellow' : undefined));
      // eyes
      b.set(-2, 0, 2, 'sunFace');
      b.set(1, 0, 2, 'sunFace');
      b.box(-1, -2, 2, 0, -2, 2, 'sunFace');
    },
    update(e, _world, dt) {
      e.visual.rotation.y += dt * 1.2;
    },
  }),

  // ---------------------------------------------------------------- snowman
  defineObject({
    id: 'snowman',
    name: 'snowman',
    synonyms: ['snowmen', 'snow man', 'frosty'],
    category: 'nature',
    blurb: 'Cool guy. Melts if things get hot.',
    tags: ['cold'],
    tintKeys: ['snowWhite', 'snowShade'],
    burstColor: '#f6fbff',
    spawnSound: 'freeze',
    voxelSize: 0.05,
    physics: { mass: 15, shape: 'auto', maxBoxes: 5, uprightOnly: true, friction: 0.5 },
    props: { meltTime: 7 },
    build(b, rng) {
      b.sphere(0, 7, 0, 7.5, 'snowWhite');
      b.sphere(0, 18.5, 0, 5.5, 'snowWhite');
      b.sphere(0, 27.5, 0, 4.5, 'snowWhite');
      b.paint((x, y, z, c) => {
        if (c !== 'snowWhite') return undefined;
        if (z + 0.5 < -2 && rng() < 0.5) return 'snowShade';
        if (rng() < 0.05) return 'snowShade';
        return undefined;
      });
      // eyes + mouth + nose
      b.box(-2, 28, 4, -2, 29, 4, 'snowCoal');
      b.box(1, 28, 4, 1, 29, 4, 'snowCoal');
      for (const x of [-3, 2]) b.set(x, 25, 4, 'snowCoal');
      b.box(-2, 25, 4, 1, 25, 4, null);
      b.set(-2, 25, 4, 'snowCoal');
      b.set(1, 25, 4, 'snowCoal');
      b.box(-1, 26, 4, 0, 27, 6, 'snowCarrot');
      b.box(-1, 26, 7, 0, 26, 8, 'snowCarrot');
      b.box(-2, 26, 4, -2, 26, 4, null);
      b.box(-1, 26, 4, 0, 26, 4, 'snowCarrot');
      b.box(-1, 26, 6, 0, 26, 8, 'snowCarrot');
      b.box(-1, 27, 4, 0, 27, 4, null);
      b.box(-1, 27, 4, 0, 27, 5, 'snowCarrot');
      // buttons
      for (const y of [20, 16, 12]) b.box(0, y, y === 16 ? 6 : 6, 0, y, 6, 'snowCoal');
      b.paint((x, y, z, c) => (c === 'snowCoal' && z > 5 && y < 22 ? 'snowCoal' : undefined));
      // scarf
      b.cylinderY(0, 0, 22, 23, 5.6, 'snowScarf');
      b.box(2, 17, 4, 3, 22, 5, 'snowScarf');
      // arms (sticks)
      for (let i = 0; i < 8; i++) {
        b.box(5 + i, 17 + Math.floor(i * 0.7), 0, 5 + i, 17 + Math.floor(i * 0.7), 0, 'snowStick');
        b.box(-6 - i, 17 + Math.floor(i * 0.7), 0, -6 - i, 17 + Math.floor(i * 0.7), 0, 'snowStick');
      }
      b.box(11, 22, 0, 11, 23, 0, 'snowStick');
      b.box(-12, 22, 0, -12, 23, 0, 'snowStick');
      // top hat
      b.cylinderY(0, 0, 31, 31, 5.2, 'snowHat');
      b.cylinderY(0, 0, 32, 37, 3.4, 'snowHat');
      b.cylinderY(0, 0, 32, 33, 3.5, 'snowScarf');
    },
  }),

  // ---------------------------------------------------------------- snowball
  defineObject({
    id: 'snowball',
    name: 'snowball',
    synonyms: ['snow', 'snow ball'],
    category: 'nature',
    blurb: 'Throw it! Splats on hard hits.',
    tags: ['cold', 'fragile'],
    tintKeys: ['snowWhite', 'snowballShade'],
    burstColor: '#f6fbff',
    spawnSound: 'pop',
    voxelSize: 0.04,
    physics: { mass: 0.3, shape: 'sphere', friction: 0.3, restitution: 0.1 },
    props: { meltTime: 3, breakSpeed: 7 },
    debris: [],
    build(b, rng) {
      b.sphere(0, 0, 0, 3.9, 'snowWhite');
      b.paint((x, y, z) => (y < -1 && rng() < 0.7 ? 'snowballShade' : rng() < 0.08 ? 'snowballShade' : undefined));
    },
  }),

  // ---------------------------------------------------------------- bush
  defineObject({
    id: 'bush',
    name: 'bush',
    synonyms: ['shrub', 'hedge', 'shrubbery'],
    category: 'nature',
    blurb: 'A leafy shrub with berries. Burns quickly.',
    tags: ['flammable'],
    tintKeys: ['bushLeaf', 'bushLeafDark', 'bushLeafLight'],
    burstColor: '#3f9a3c',
    spawnSound: 'pop',
    voxelSize: 0.1,
    physics: { anchored: true, mass: 8, shape: 'auto', maxBoxes: 4 },
    props: { burnTime: 5 },
    build(b, rng) {
      b.ellipsoid(0, 5, 0, 6.5, 5, 5.5, 'bushLeaf');
      b.ellipsoid(-4.5, 3.5, 1, 4, 3.5, 4, 'bushLeaf');
      b.ellipsoid(4.5, 3.5, -1, 4, 3.5, 4, 'bushLeaf');
      b.box(-12, -1, -12, 12, -1, 12, null);
      b.box(-12, 0, -12, 12, 0, 12, null);
      b.paint((x, y, z) => {
        const n = rng();
        if (y > 6 && n < 0.4) return 'bushLeafLight';
        if (y < 4 && n < 0.5) return 'bushLeafDark';
        if (n < 0.15) return 'bushLeafDark';
        return undefined;
      });
      // berries on the surface
      let placed = 0;
      for (let tries = 0; tries < 80 && placed < 7; tries++) {
        const a = rng() * Math.PI * 2, y = 3 + Math.floor(rng() * 6);
        const x = Math.round(Math.cos(a) * 9), z = Math.round(Math.sin(a) * 8);
        for (let k = 9; k >= 0; k--) {
          const xx = Math.round((x * k) / 9), zz = Math.round((z * k) / 8 * 8 / 8);
          if (b.has(xx, y, zz)) { b.set(xx, y, zz, 'bushBerry'); placed++; break; }
        }
      }
    },
  }),

  // ---------------------------------------------------------------- flower
  defineObject({
    id: 'flower',
    name: 'flower',
    synonyms: ['daisy', 'rose', 'tulip', 'flowers', 'blossom'],
    category: 'nature',
    blurb: 'Pretty! Paint it any color.',
    tags: ['flammable'],
    tintKeys: ['flowerPetal', 'flowerPetalShade'],
    burstColor: '#ff5d6c',
    spawnSound: 'pop',
    voxelSize: 0.04,
    physics: { mass: 0.4, shape: 'box', uprightOnly: true, friction: 0.6 },
    props: { burnTime: 2 },
    build(b) {
      // stem & leaves
      b.box(0, 0, 0, 0, 12, 0, 'flowerStem');
      b.box(1, 0, 0, 1, 0, 0, 'flowerStem');
      b.box(-1, 0, 0, -1, 0, 0, 'flowerStem');
      b.layers([['.....', '.....', '.....']], {});
      for (let i = 0; i < 4; i++) { b.set(1 + i, 3 + Math.floor(i / 2), 0, 'flowerStem'); b.set(1 + i, 4 + Math.floor(i / 2), 0, 'flowerStem'); }
      for (let i = 0; i < 4; i++) { b.set(-1 - i, 6 + Math.floor(i / 2), 0, 'flowerStem'); b.set(-1 - i, 7 + Math.floor(i / 2), 0, 'flowerStem'); }
      b.box(2, 3, 0, 2, 3, 0, 'flowerStem');
      // flower head: petals around a center, facing +Z
      const cy = 15;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const px = Math.round(Math.cos(a) * 4 - 0.5 + (Math.cos(a) > 0.1 ? 0.5 : 0)), py = Math.round(Math.sin(a) * 4);
        b.box(px - 1, cy + py - 1, 0, px + 1, cy + py + 1, 1, i % 2 ? 'flowerPetal' : 'flowerPetalShade');
      }
      b.ellipsoid(0, cy, 0, 3.2, 3.2, 1.2, 'flowerPetal');
      b.ellipsoid(0, cy, 1.5, 2.2, 2.2, 1.3, 'flowerCenter');
      b.box(-1, 11, -1, 1, 11, 1, 'flowerStem');
      b.paint((x, y, z, c) => (c === 'flowerPetal' && (x + y) % 3 === 0 ? 'flowerPetalShade' : undefined));
    },
  }),

  // ---------------------------------------------------------------- mushroom
  defineObject({
    id: 'mushroom',
    name: 'mushroom',
    synonyms: ['toadstool', 'shroom', 'fungus'],
    category: 'nature',
    blurb: 'Boing! Bouncy cap, and edible.',
    tags: ['edible', 'bouncy'],
    tintKeys: ['mushCap', 'mushCapDark'],
    burstColor: '#e0403f',
    spawnSound: 'boing',
    voxelSize: 0.04,
    physics: { mass: 0.6, shape: 'auto', maxBoxes: 3, restitution: 0.9, friction: 0.4, uprightOnly: true },
    build(b, rng) {
      b.cylinderY(0, 0, 0, 6, 2.6, 'mushStem');
      b.paint((x, _y, z, c) => (c === 'mushStem' && x + z < -1 ? 'mushStemShade' : undefined));
      // cap: upper half-ellipsoid
      b.ellipsoid(0, 6, 0, 7.5, 6, 7.5, 'mushCap');
      b.box(-9, 0, -9, 9, 5, 9, null);
      b.cylinderY(0, 0, 0, 6, 2.6, 'mushStem');
      b.paint((x, y, z, c) => (c === 'mushStem' && x + z < -1 ? 'mushStemShade' : undefined));
      // underside rim
      b.box(-9, 6, -9, 9, 6, 9, null);
      b.ellipsoid(0, 6.5, 0, 7.5, 5.5, 7.5, 'mushCap');
      b.box(-9, 0, -9, 9, 5, 9, null);
      b.cylinderY(0, 0, 0, 6, 2.6, 'mushStem');
      b.cylinderY(0, 0, 5, 5, 6.2, 'mushCapDark');
      b.cylinderY(0, 0, 5, 5, 2.6, 'mushStem');
      // spots
      const spots: [number, number, number][] = [[0, 12, 0], [-4, 10, 4], [4, 10, 3], [-5, 9, -3], [3, 9, -5], [0, 9, 6], [6, 8, -1]];
      for (const [sx, sy, sz] of spots) {
        for (let dx = -1; dx <= 0; dx++)
          for (let dz = -1; dz <= 0; dz++)
            for (let y = 5; y <= 13; y++)
              if (b.get(sx + dx, y, sz + dz) === 'mushCap' && Math.abs(y - sy) <= 1 && rng() < 0.95) b.set(sx + dx, y, sz + dz, 'mushSpot');
      }
      b.paint((x, y, z, c) => (c === 'mushCap' && y < 8 && rng() < 0.3 ? 'mushCapDark' : undefined));
    },
  }),

  // ---------------------------------------------------------------- cactus
  defineObject({
    id: 'cactus',
    name: 'cactus',
    synonyms: ['cacti', 'saguaro'],
    category: 'nature',
    blurb: 'Prickly! Pops balloons.',
    tags: ['sharp'],
    tintKeys: ['cactusGreen', 'cactusDark'],
    burstColor: '#3f9a4a',
    spawnSound: 'squeak',
    voxelSize: 0.06,
    physics: { mass: 20, shape: 'auto', maxBoxes: 5, uprightOnly: true, friction: 0.6 },
    build(b, rng) {
      b.cylinderY(0, 0, 0, 22, 3.4, 'cactusGreen');
      b.ellipsoid(0, 22, 0, 3.4, 2.5, 3.4, 'cactusGreen');
      // arms
      b.box(-8, 9, -1, -3, 11, 1, 'cactusGreen');
      b.cylinderY(-7.5 + 0.5, 0, 9, 17, 1.9, 'cactusGreen');
      b.ellipsoid(-6.5, 17, 0, 1.9, 1.5, 1.9, 'cactusGreen');
      b.box(3, 12, -1, 7, 14, 1, 'cactusGreen');
      b.cylinderY(7, 0, 12, 20, 1.9, 'cactusGreen');
      b.ellipsoid(7, 20, 0, 1.9, 1.5, 1.9, 'cactusGreen');
      // ribs & spines
      b.paint((x, y, z, c) => {
        if (c !== 'cactusGreen') return undefined;
        if (x % 3 === 0 && z > -1 && (y + x) % 2 === 0 && rng() < 0.0) return undefined;
        if ((x + 100) % 3 === 0 && (z > 0 ? true : false) && (x === 0 || Math.abs(x) % 3 === 0)) return 'cactusDark';
        if (rng() < 0.07) return 'cactusSpine';
        return undefined;
      });
      // pink flower on top
      b.box(-1, 24, -1, 0, 24, 0, 'cactusBloom');
      b.box(-2, 24, 0, 1, 24, 0, 'cactusBloom');
      b.box(0, 24, -2, 0, 24, 1, 'cactusBloom');
      b.set(0, 25, 0, 'flowerCenter');
      b.set(-1, 25, -1, 'cactusBloom');
    },
  }),

  // ---------------------------------------------------------------- log
  defineObject({
    id: 'log',
    name: 'log',
    synonyms: ['tree trunk', 'firewood', 'stump'],
    category: 'nature',
    blurb: 'Floats and burns. Lay another nearby and press C to build a boat.',
    tags: ['flammable', 'floats'],
    tintKeys: ['logBark', 'logBarkDark'],
    burstColor: '#6e4a2e',
    spawnSound: 'thud',
    voxelSize: 0.05,
    orient: 'span',
    use: 'craft',
    physics: { mass: 12, shape: 'box', friction: 0.7 },
    props: { burnTime: 12 },
    debris: ['plank'],
    build(b, rng) {
      const x0 = 0, x1 = 21;
      for (let x = x0; x <= x1; x++) {
        b.cylinderY(0, 0, 0, 0, 0, null);
      }
      // build the cylinder along X
      for (let x = x0; x <= x1; x++)
        for (let y = -5; y <= 4; y++)
          for (let z = -5; z <= 4; z++) {
            const d = Math.hypot(y + 0.5, z + 0.5);
            if (d <= 5) b.set(x, y, z, (x * 3 + y * 5 + z) % 7 === 0 ? 'logBarkDark' : 'logBark');
          }
      // rings on the end faces
      for (const x of [x0, x1])
        for (let y = -5; y <= 4; y++)
          for (let z = -5; z <= 4; z++) {
            const d = Math.hypot(y + 0.5, z + 0.5);
            if (d > 4) continue;
            b.set(x, y, z, Math.floor(d * 1.1) % 2 === 0 ? 'logWood' : 'logRing');
          }
      b.set(x0, 0, 0, 'logRing');
      b.set(x1, 0, 0, 'logRing');
      // knots
      for (let i = 0; i < 2; i++) {
        const x = 4 + Math.floor(rng() * 12);
        b.box(x, 4, -1, x + 1, 4, 0, 'logBarkDark');
      }
    },
  }),

  // ---------------------------------------------------------------- lava
  defineObject({
    id: 'lava',
    name: 'lava',
    synonyms: ['magma', 'molten rock'],
    category: 'nature',
    blurb: 'Ouch! Burns flammables, melts cold things.',
    tags: ['hot', 'glows'],
    tintKeys: ['lavaMid', 'lavaCore', 'lavaHot'],
    burstColor: '#ff6c1e',
    spawnSound: 'ignite',
    voxelSize: 0.1,
    physics: { anchored: true, mass: 0, shape: 'box' },
    props: { heatRadius: 1.4, glow: 6, extinguishable: 0 },
    build(b, rng) {
      for (let x = -10; x <= 9; x++)
        for (let z = -10; z <= 9; z++) {
          if (Math.abs(x + 0.5) > 9 && Math.abs(z + 0.5) > 9) continue;
          const n = Math.sin(x * 0.7 + z * 0.5) + Math.cos(z * 0.9 - x * 0.2) + (rng() - 0.5);
          const h = 3 + (n > 1.1 ? 1 : 0);
          for (let y = 0; y <= h; y++) b.set(x, y, z, y === h ? (n > 0.9 ? 'lavaCore' : n > -0.3 ? 'lavaMid' : 'lavaHot') : 'lavaHot');
        }
      // dark crust patches
      for (let i = 0; i < 6; i++) {
        const cx = Math.floor(rng() * 16) - 8, cz = Math.floor(rng() * 16) - 8, r = 1.5 + rng() * 2;
        for (let x = Math.floor(cx - r); x <= cx + r; x++)
          for (let z = Math.floor(cz - r); z <= cz + r; z++)
            for (let y = 3; y <= 4; y++)
              if (b.has(x, y, z) && b.has(x, y, z) && Math.hypot(x - cx, z - cz) <= r * (0.7 + rng() * 0.4) && !b.has(x, y + 1, z))
                b.set(x, y, z, rng() > 0.4 ? 'lavaCrust' : 'lavaCrustLight');
      }
      // crust rim chunks around the edge
      b.paint((x, y, z, c) => (y === 0 && rng() < 0.4 ? 'lavaCrust' : undefined));
    },
    update(e, world) {
      e.visual.scale.y = 1 + Math.sin(world.time * 2 + e.id) * 0.04;
    },
  }),

  // ---------------------------------------------------------------- crystal
  defineObject({
    id: 'crystal',
    name: 'crystal',
    synonyms: ['gem', 'gemstone', 'diamond', 'jewel'],
    category: 'nature',
    blurb: 'Glittering gems. Shatters if dropped hard.',
    tags: ['glows', 'fragile'],
    tintKeys: ['crystalPurple', 'crystalViolet', 'crystalCyan'],
    burstColor: '#a24bff',
    spawnSound: 'chime',
    voxelSize: 0.05,
    physics: { mass: 3, shape: 'auto', maxBoxes: 5, friction: 0.6 },
    props: { glow: 3, breakSpeed: 6 },
    build(b, rng) {
      // rock base
      b.ellipsoid(0, 2, 0, 9, 3, 7, 'crystalBase');
      b.box(-12, -2, -12, 12, -1, 12, null);
      b.paint((x, y, z) => (rng() < 0.25 ? 'crystalBaseDark' : undefined));
      // shards: [x, z, height, radius, color]
      const shards: [number, number, number, number, string][] = [
        [0, 0, 20, 3, 'crystalPurple'],
        [-5, 1, 13, 2.3, 'crystalCyan'],
        [5, -1, 15, 2.5, 'crystalViolet'],
        [2, 4, 10, 2, 'crystalCyan'],
        [-3, -4, 11, 2.2, 'crystalPurple'],
      ];
      const count = 3 + Math.floor(rng() * 3);
      shards.slice(0, count).forEach(([sx, sz, h, r, c], i) => {
        const lean = i === 0 ? 0 : (sx > 0 ? 0.12 : -0.12);
        for (let y = 2; y <= h; y++) {
          const t = (y - 2) / (h - 2);
          const rad = r * (t < 0.7 ? 1 - t * 0.2 : 1 - (t - 0.7) * 2.8 + 0.14);
          if (rad < 0.4) continue;
          const cx = sx + lean * (y - 2);
          b.cylinderY(cx, sz, y, y, Math.max(0.6, rad), c);
        }
      });
      // highlights
      b.paint((x, y, z, c) => (c.startsWith('crystal') && !c.startsWith('crystalBase') && x % 4 === 0 && y > 5 && z >= 0 && (y % 3 === 0) ? 'crystalLight' : undefined));
    },
  }),
];
