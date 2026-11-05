import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

definePalette({
  ropeTan: '#cfae6e',
  ropeDark: '#a07f45',
  trampBlue: '#3a6fd8',
  trampBlueDark: '#2b53a8',
  trampMat: '#25242b',
  trampMatLight: '#3b3a46',
  magRed: '#d93a3a',
  magRedDark: '#a82525',
  magRedLight: '#ef6a63',
  magTip: '#d8dee6',
  magTipDark: '#a3adb8',
  springCoil: '#cfd6de',
  springCoilDark: '#8e98a5',
  springPlate: '#e0603a',
  springPlateDark: '#b4431f',
  doorGold: '#f2c230',
  doorGoldDark: '#c39518',
  fanBody: '#4aa3d8',
  fanBodyDark: '#3585b5',
  fanCage: '#6f7782',
  fanBlade: '#f4f1ea',
  fanBladeDark: '#d9d4c6',
  bombBody: '#26252c',
  bombLight: '#5a5966',
  bombCap: '#8a8f99',
  bombFuse: '#b58a52',
  wallBrick: '#b9573e',
  wallBrickDark: '#9e4531',
  wallBrickLight: '#cc6a4d',
  wallMortar: '#d6cdbd',
  stairStone: '#9a9ba3',
  stairStoneDark: '#7b7c85',
  stairStoneLight: '#b8b9c0',
  barrelHoop: '#565c66',
  barrelHoopLight: '#7d8591',
  anvilBody: '#4d525c',
  anvilDark: '#33363e',
  anvilTop: '#8a909c',
  tntRed: '#d83a34',
  tntRedDark: '#a8231f',
  tntBand: '#f4f1ea',
  tntText: '#1f1e24',
  tntCap: '#6b6f78',
  tntFuse: '#b58a52',
});

const hash = (x: number, y: number, z = 0) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export default [
  // ---------------------------------------------------------------- bridge
  defineObject({
    id: 'bridge',
    name: 'bridge',
    synonyms: ['footbridge', 'walkway', 'span', 'rope bridge'],
    category: 'structures',
    blurb: 'Lay it across a gap. Burns, floats.',
    tags: ['flammable', 'floats'],
    tintKeys: ['wood', 'woodDark', 'woodLight'],
    burstColor: '#b07a43',
    voxelSize: 0.1,
    orient: 'span',
    physics: { mass: 15, shape: 'auto', maxBoxes: 6, friction: 0.8 },
    props: { burnTime: 12 },
    build(b) {
      const L = 32;
      b.box(0, 1, 1, L - 1, 2, 7, 'wood');
      for (let x = 0; x < L; x++) {
        if (x % 4 === 3) b.box(x, 2, 1, x, 2, 7, 'woodDark');
        else if (x % 4 === 1) b.box(x, 2, 1, x, 2, 7, 'woodLight');
      }
      b.box(0, 0, 1, L - 1, 0, 1, 'woodDark');
      b.box(0, 0, 7, L - 1, 0, 7, 'woodDark');
      const posts = [0, 10, 21, 30];
      for (const z of [0, 8]) {
        for (const px of posts) {
          b.box(px, 1, z, px + 1, 9, z, 'woodDark');
          b.box(px, 10, z, px + 1, 10, z, 'wood');
        }
        for (let i = 0; i < posts.length - 1; i++) {
          const x0 = posts[i] + 2, x1 = posts[i + 1] - 1;
          for (let x = x0; x <= x1; x++) {
            const t = (x - x0) / (x1 - x0);
            const sag = Math.round(1.5 * 4 * t * (1 - t));
            b.set(x, 8 - sag, z, 'ropeTan');
            b.set(x, 5, z, 'ropeDark');
          }
        }
      }
    },
  }),

  // ----------------------------------------------------------------- crate
  defineObject({
    id: 'crate',
    name: 'crate',
    synonyms: ['wooden crate', 'chest', 'shipping crate', 'treasure chest'],
    category: 'structures',
    blurb: 'Stack it, push it. Cracks open into planks.',
    tags: ['flammable', 'fragile', 'floats'],
    tintKeys: ['wood', 'woodDark', 'woodLight'],
    burstColor: '#b07a43',
    debris: ['plank'],
    voxelSize: 0.1,
    physics: { mass: 5, shape: 'box', friction: 0.6, restitution: 0.1 },
    props: { burnTime: 7, breakSpeed: 7 },
    build(b) {
      const S = 7;
      b.box(0, 0, 0, S, S, S, 'wood');
      // slats: horizontal lines on the faces
      b.paint((x, y, z) => {
        if (y % 3 === 2 && (x === 0 || x === S || z === 0 || z === S)) return 'woodDark';
        return undefined;
      });
      // corner posts
      for (const x of [0, S]) for (const z of [0, S]) b.box(x, 0, z, x, S, z, 'woodDark');
      // top and bottom frames
      for (const y of [0, S]) {
        b.box(0, y, 0, S, y, 0, 'woodDark');
        b.box(0, y, S, S, y, S, 'woodDark');
        b.box(0, y, 0, 0, y, S, 'woodDark');
        b.box(S, y, 0, S, y, S, 'woodDark');
      }
      // cross braces on the front/back and sides
      for (let i = 1; i < S; i++) {
        b.set(i, i, S, 'woodLight');
        b.set(S - i, i, S, 'woodLight');
        b.set(i, i, 0, 'woodLight');
        b.set(S - i, i, 0, 'woodLight');
        b.set(0, i, i, 'woodLight');
        b.set(S, i, S - i, 'woodLight');
      }
    },
  }),

  // ------------------------------------------------------------------ rope
  defineObject({
    id: 'rope',
    name: 'rope',
    synonyms: ['cord', 'lasso', 'line', 'hanging rope'],
    category: 'structures',
    blurb: 'Climb it, or grab it and press C to lasso things and haul them in.',
    tags: ['climbable', 'flammable'],
    tintKeys: ['ropeTan', 'ropeDark'],
    burstColor: '#cfae6e',
    // Half-size voxels (same 1 m x 2.2 m bounds as before) so the strand can be thin and braided.
    voxelSize: 0.05,
    // Collider: the same small 0.4 m block at the base that the old coarse rope decomposed to.
    use: 'lasso',
    physics: { mass: 1, shape: 'auto', boxes: [[6, 0, 6, 14, 8, 14]], friction: 0.8 },
    props: { burnTime: 4 },
    build(b) {
      // Two-tone twist: the color steps around the strand as it goes, giving diagonal stripes.
      const twist = (x: number, y: number, z: number, cx: number, cz: number) =>
        ((Math.round(((Math.atan2(z - cz, x - cx) / Math.PI) * 2 + 4) + y / 2) % 2) === 0 ? 'ropeTan' : 'ropeDark');
      // Coil at the bottom: three stacked rings, each a little smaller, twisted like the strand.
      for (const [y, r] of [[0, 9.4], [2, 8], [4, 6.6]] as const) {
        for (let x = 0; x < 20; x++)
          for (let z = 0; z < 20; z++) {
            const d = Math.hypot(x - 9.5, z - 9.5);
            if (d <= r && d >= r - 2.2) for (const yy of [y, y + 1]) b.set(x, yy, z, twist(x, yy, z, 9.5, 9.5));
          }
      }
      // Loose frayed end trailing off the coil.
      b.box(17, 0, 13, 18, 0, 15, 'ropeTan').set(19, 0, 15, 'ropeDark').set(19, 1, 16, 'ropeTan').set(18, 0, 16, 'ropeDark');
      // The hanging strand: 3x3 with rounded corners, a gentle S-curve, rising out of the coil.
      const sway = (y: number) => Math.round(Math.sin(y * 0.16) * 1.5);
      for (let y = 4; y < 40; y++) {
        const cx = 9 + sway(y);
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++) {
            if (dx && dz && (y + dx + dz) % 3 !== 0) continue; // nubbly corners read as twisted fibre
            b.set(cx + dx, y, 9 + dz, twist(cx + dx, y, 9 + dz, cx, 9));
          }
      }
      // Two knots: rounded bulges, twisted like the rest of the rope.
      for (const ky of [16, 30]) {
        const cx = 9 + sway(ky);
        for (let x = cx - 3; x <= cx + 3; x++)
          for (let y = ky - 3; y <= ky + 3; y++)
            for (let z = 6; z <= 12; z++)
              if (((x - cx) / 2.3) ** 2 + ((y - ky) / 2.6) ** 2 + ((z - 9) / 2.3) ** 2 <= 1) b.set(x, y, z, twist(x, y + (x - cx), z, cx, 9));
      }
      // Hanging loop at the top (a vertical ring).
      const top = 9 + sway(40);
      for (let x = -4; x <= 4; x++)
        for (let y = -4; y <= 4; y++) {
          const d = Math.hypot(x, y);
          if (d <= 3.9 && d >= 2.4) for (const z of [8, 9]) b.set(top + x, 40 + y, z, twist(top + x, 40 + y, z, top, 40));
        }
    },
  }),

  // ------------------------------------------------------------ trampoline
  defineObject({
    id: 'trampoline',
    name: 'trampoline',
    synonyms: ['trampolene', 'bouncer', 'jumping mat', 'bouncy mat'],
    category: 'structures',
    blurb: 'Boing! Launches whatever lands on it.',
    tags: ['launcher', 'bouncy'],
    tintKeys: ['trampBlue', 'trampBlueDark'],
    burstColor: '#3a6fd8',
    spawnSound: 'boing',
    voxelSize: 0.1,
    physics: { mass: 20, shape: 'auto', maxBoxes: 5, friction: 0.5, restitution: 0.3 },
    props: { launch: 11 },
    build(b) {
      const c = 8;
      for (const [x, z] of [[3, 3], [12, 3], [3, 12], [12, 12]] as const) b.box(x, 0, z, x + 1, 2, z + 1, 'trampBlueDark');
      b.cylinderY(c, c, 3, 3, 8, 'trampBlue');
      b.cylinderY(c, c, 3, 3, 6.5, 'trampBlueDark');
      b.cylinderY(c, c, 4, 4, 8, 'trampBlue');
      b.cylinderY(c, c, 4, 4, 6.5, 'trampMat');
      b.paint((x, y, z, col) => {
        if (col === 'trampMat' && (x + z) % 4 === 0) return 'trampMatLight';
        return undefined;
      });
    },
  }),

  // ---------------------------------------------------------------- magnet
  defineObject({
    id: 'magnet',
    name: 'magnet',
    synonyms: ['horseshoe magnet', 'electromagnet', 'u magnet'],
    category: 'structures',
    blurb: 'Pulls metal things toward it.',
    tags: ['magnet', 'metal'],
    tintKeys: ['magRed', 'magRedDark', 'magRedLight'],
    burstColor: '#d93a3a',
    voxelSize: 0.08,
    physics: { mass: 4, shape: 'auto', maxBoxes: 5, friction: 0.6 },
    props: { magnetRange: 5, magnetForce: 30 },
    build(b) {
      const cx = 8, cy = 8, D = 4;
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 22; y++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          let d: number;
          if (dy > 0) d = Math.abs(dx);
          else d = Math.hypot(dx, dy);
          const outer = d <= 8, inner = d >= 4.2;
          if (!(outer && inner)) continue;
          if (y > 19) continue;
          for (let z = 0; z < D; z++) {
            let col = 'magRed';
            if (z === D - 1 && d > 5.4) col = 'magRedLight';
            else if (z === 0 || d < 4.8) col = 'magRedDark';
            if (dy > 0 && y >= 15) col = y === 15 ? 'magTipDark' : 'magTip';
            b.set(x, y, z, col);
          }
        }
    },
  }),

  // ---------------------------------------------------------------- spring
  defineObject({
    id: 'spring',
    name: 'spring',
    synonyms: ['coil', 'coil spring', 'springboard'],
    category: 'structures',
    blurb: 'Sproing! Launches things that land on top.',
    tags: ['launcher', 'metal', 'bouncy'],
    tintKeys: ['springPlate', 'springPlateDark'],
    burstColor: '#cfd6de',
    spawnSound: 'boing',
    voxelSize: 0.1,
    physics: { mass: 6, shape: 'auto', maxBoxes: 4, friction: 0.6, restitution: 0.3 },
    props: { launch: 9 },
    build(b) {
      b.box(0, 0, 0, 9, 0, 9, 'springPlate');
      b.box(0, 1, 0, 9, 1, 9, 'springPlateDark');
      b.box(0, 17, 0, 9, 17, 9, 'springPlate');
      b.box(0, 18, 0, 9, 18, 9, 'springPlateDark');
      b.box(0, 18, 0, 9, 18, 9, 'springPlate');
      b.box(1, 17, 1, 8, 17, 8, 'springPlateDark');
      const N = 300, turns = 3;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = t * turns * Math.PI * 2;
        const x = Math.round(4.5 + 3.6 * Math.cos(a) - 0.5);
        const z = Math.round(4.5 + 3.6 * Math.sin(a) - 0.5);
        const y = 2 + Math.round(t * 13);
        const front = Math.sin(a) > 0;
        const col = front ? 'springCoil' : 'springCoilDark';
        b.set(x, y, z, col);
        b.set(x, y + 1, z, col);
      }
      // center post stub
      b.box(4, 1, 4, 5, 1, 5, 'springCoilDark');
    },
  }),

  // ------------------------------------------------------------------ door
  defineObject({
    id: 'door',
    name: 'door',
    synonyms: ['gate', 'doorway', 'wooden door'],
    category: 'structures',
    blurb: 'Locked tight. Needs a key.',
    tags: ['locked', 'flammable'],
    tintKeys: ['wood', 'woodLight'],
    burstColor: '#b07a43',
    voxelSize: 0.1,
    physics: { mass: 30, anchored: true, shape: 'box', friction: 0.6 },
    props: { burnTime: 10 },
    build(b) {
      // frame
      b.box(0, 0, 0, 17, 21, 2, 'woodDark');
      // opening / door slab
      b.box(2, 0, 1, 15, 19, 2, 'wood');
      for (let x = 2; x <= 15; x++) if ((x - 2) % 3 === 2) b.box(x, 0, 2, x, 19, 2, 'woodLight');
      // raised panels
      for (const [y0, y1] of [[2, 8], [11, 17]] as const) {
        b.box(4, y0, 2, 13, y1, 2, 'woodDark');
        b.box(5, y0 + 1, 2, 12, y1 - 1, 2, 'wood');
        b.box(5, y0 + 1, 3, 12, y1 - 1, 3, 'woodLight');
      }
      // lock plate, knob, keyhole
      b.box(12, 8, 3, 13, 11, 3, 'doorGoldDark');
      b.box(12, 9, 4, 13, 10, 4, 'doorGold');
      b.set(5, 10, 3, 'black');
      b.set(5, 9, 3, 'black');
      b.box(4, 9, 3, 6, 11, 3, 'doorGold');
      b.set(5, 10, 3, 'black');
      b.set(5, 9, 3, 'black');
      // hinges
      for (const y of [3, 16]) b.box(2, y, 3, 3, y + 1, 3, 'doorGoldDark');
    },
  }),

  // ------------------------------------------------------------------- fan
  defineObject({
    id: 'fan',
    name: 'fan',
    synonyms: ['electric fan', 'blower', 'ventilator', 'desk fan'],
    category: 'structures',
    blurb: 'Blows light things away from you, the way you cast it.',
    tags: ['wind', 'metal'],
    tintKeys: ['fanBody', 'fanBodyDark'],
    burstColor: '#4aa3d8',
    voxelSize: 0.06,
    orient: 'away',
    grip: 0,
    physics: { mass: 6, shape: 'auto', maxBoxes: 5, friction: 0.6 },
    props: { windForce: 16, windRange: 7 },
    parts: [
      {
        name: 'blades',
        pivot: [8, 18, 8.5],
        build(b) {
          b.box(7, 17, 8, 8, 18, 9, 'fanBodyDark');
          for (let k = 0; k < 4; k++) {
            for (let r = 1; r <= 6; r++) {
              const wid = r < 3 ? 2 : r < 6 ? 3 : 3;
              for (let u = 0; u < wid; u++) {
                // blade pointing up in local indices, then rotated k*90deg about corner (0,0)
                let dx = u - (wid >> 1) - 0 + (k % 2 === 0 ? 0 : 0);
                let dy = r + 0;
                for (let i = 0; i < k; i++) {
                  const nx = -dy - 1;
                  const ny = dx;
                  dx = nx;
                  dy = ny;
                }
                b.set(8 + dx, 18 + dy, 8, u === 0 ? 'fanBladeDark' : 'fanBlade');
              }
            }
          }
        },
      },
    ],
    build(b) {
      // base disc + pole
      b.cylinderY(8, 4, 0, 1, 5.5, 'fanBodyDark');
      b.cylinderY(8, 4, 2, 2, 4, 'fanBody');
      b.box(7, 3, 3, 8, 12, 4, 'metal');
      b.box(7, 13, 3, 8, 13, 4, 'fanBodyDark');
      // motor housing
      b.ellipsoid(8, 18, 4.5, 3.5, 3.5, 3, 'fanBody');
      b.ellipsoid(8, 18, 3.5, 2.2, 2.2, 1.5, 'fanBodyDark');
      // cage: back ring, front ring, rim, spokes
      for (let x = 0; x < 16; x++)
        for (let y = 10; y < 26; y++) {
          const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 18);
          if (d >= 7.2 && d <= 8.4) {
            for (let z = 6; z <= 10; z++) b.set(x, y, z, 'fanCage');
          } else if (d <= 8.4) {
            const rr = Math.round(d);
            const ang = Math.atan2(y + 0.5 - 18, x + 0.5 - 8);
            if (rr === 6) b.set(x, y, 10, 'fanCage');
            const sp = ((Math.round((ang / Math.PI) * 4) + 8) % 8 + 8) % 8;
            if (Math.abs(ang * 4 / Math.PI - Math.round(ang * 4 / Math.PI)) < 0.12 && d > 3 && sp >= 0) b.set(x, y, 10, 'fanCage');
          }
        }
      b.box(7, 17, 10, 8, 18, 10, 'fanBodyDark');
      // tilt knob
      b.box(7, 13, 5, 8, 14, 5, 'red');
    },
    update(e, _w, dt) {
      const p = e.parts.get('blades');
      if (p) p.rotation.z -= dt * 22;
    },
  }),

  // ------------------------------------------------------------------ bomb
  defineObject({
    id: 'bomb',
    name: 'bomb',
    synonyms: ['grenade', 'cannonball', 'cartoon bomb'],
    category: 'structures',
    blurb: 'Lit fuse. Stand back.',
    tags: ['explosive', 'metal'],
    tintKeys: ['bombBody', 'bombLight'],
    burstColor: '#ffb43c',
    voxelSize: 0.05,
    physics: { mass: 6, shape: 'sphere', friction: 0.5, restitution: 0.2 },
    props: { fuse: 4, blastRadius: 4.5, blastForce: 16 },
    parts: [
      {
        name: 'spark',
        pivot: [11, 23, 8],
        build(b) {
          b.box(10, 22, 7, 12, 24, 9, 'flameMid');
          b.box(11, 22, 8, 11, 24, 8, 'flameCore');
          b.box(10, 23, 8, 12, 23, 8, 'flameCore');
          b.set(11, 25, 8, 'flameTip');
          b.set(9, 23, 8, 'flameOuter');
          b.set(13, 23, 8, 'flameOuter');
        },
      },
    ],
    build(b) {
      b.sphere(8, 8, 8, 8, 'bombBody');
      // highlight
      b.paint((x, y, z, c) => {
        const d = Math.hypot(x - 4.5, y - 12, z - 12);
        if (c === 'bombBody' && d < 2.2) return 'white';
        if (c === 'bombBody' && d < 4.2) return 'bombLight';
        return undefined;
      });
      // cap
      b.cylinderY(8, 8, 15, 17, 3, 'bombCap');
      b.cylinderY(8, 8, 17, 17, 2, 'bombFuse');
      // fuse curling up and to the right
      b.set(8, 18, 8, 'bombFuse');
      b.set(8, 19, 8, 'bombFuse');
      b.set(9, 20, 8, 'bombFuse');
      b.set(9, 21, 8, 'bombFuse');
      b.set(10, 21, 8, 'bombFuse');
      b.set(10, 22, 8, 'bombFuse');
      // angry cartoon eyes
      for (const x of [5, 9]) {
        b.box(x, 7, 15, x + 2, 10, 16, 'white');
        b.box(x + 1, 7, 16, x + 2, 8, 16, 'eye');
        b.box(x + 1, 7, 16, x + 2, 8, 16, 'black');
      }
      b.box(4, 11, 15, 7, 11, 15, 'black');
      b.box(10, 11, 15, 13, 11, 15, 'black');
    },
    update(e) {
      const p = e.parts.get('spark');
      if (p) {
        const t = performance.now() / 1000;
        p.scale.setScalar(0.8 + 0.35 * Math.abs(Math.sin(t * 17)) + 0.1 * Math.sin(t * 41));
        p.rotation.y = t * 6;
      }
    },
  }),

  // ------------------------------------------------------------------ wall
  defineObject({
    id: 'wall',
    name: 'wall',
    synonyms: ['brick wall', 'barrier', 'bricks', 'brick'],
    category: 'structures',
    blurb: 'Solid brick. Blocks the way.',
    tags: ['heavy'],
    tintKeys: ['wallBrick', 'wallBrickDark', 'wallBrickLight'],
    burstColor: '#b9573e',
    voxelSize: 0.1,
    physics: { mass: 60, anchored: true, shape: 'box', friction: 0.7 },
    build(b) {
      const W = 24, H = 16, T = 4;
      for (let x = 0; x < W; x++)
        for (let y = 0; y < H; y++)
          for (let z = 0; z < T; z++) {
            const row = Math.floor(y / 4);
            const off = row % 2 === 0 ? 0 : 3;
            const bx = x + off;
            const mortar = y % 4 === 3 || bx % 6 === 5;
            if (mortar) {
              b.set(x, y, z, 'wallMortar');
            } else {
              const h = hash(Math.floor(bx / 6) + row * 7, row);
              b.set(x, y, z, h < 0.3 ? 'wallBrickDark' : h > 0.75 ? 'wallBrickLight' : 'wallBrick');
            }
          }
      // top course gets cap mortar line
      b.box(0, H - 1, 0, W - 1, H - 1, T - 1, 'wallMortar');
    },
  }),

  // ------------------------------------------------------------------ ramp
  defineObject({
    id: 'ramp',
    name: 'ramp',
    synonyms: ['slope', 'incline', 'wedge'],
    category: 'structures',
    blurb: 'Roll things up and over.',
    tags: ['flammable'],
    tintKeys: ['wood', 'woodLight', 'woodDark'],
    burstColor: '#b07a43',
    voxelSize: 0.1,
    orient: 'span',
    physics: { mass: 25, shape: 'auto', maxBoxes: 10, friction: 0.7 },
    props: { burnTime: 8 },
    build(b) {
      const L = 20, Wd = 10;
      for (let x = 0; x < L; x++) {
        const h = Math.floor(x / 2) + 1;
        for (let z = 0; z < Wd; z++) {
          b.box(x, 0, z, x, h - 1, z, 'woodDark');
          b.set(x, h - 1, z, z % 3 === 2 ? 'wood' : 'woodLight');
          if (z === 0 || z === Wd - 1) b.set(x, h - 1, z, 'wood');
        }
        // side beam highlight
        b.set(x, h - 2 < 0 ? 0 : h - 2, 0, 'wood');
        b.set(x, h - 2 < 0 ? 0 : h - 2, Wd - 1, 'wood');
      }
    },
  }),

  // ---------------------------------------------------------------- stairs
  defineObject({
    id: 'stairs',
    name: 'stairs',
    synonyms: ['staircase', 'steps', 'stairway'],
    category: 'structures',
    blurb: 'Climbable steps, front to back.',
    tags: ['climbable'],
    tintKeys: ['stairStone', 'stairStoneDark', 'stairStoneLight'],
    burstColor: '#9a9ba3',
    voxelSize: 0.1,
    orient: 'face',
    physics: { mass: 40, shape: 'auto', maxBoxes: 6, friction: 0.8 },
    build(b) {
      const N = 5, D = 5, R = 3, Wd = 14;
      for (let i = 0; i < N; i++) {
        const z0 = D * (N - 1 - i);
        const h = R * (i + 1);
        b.box(0, 0, z0, Wd - 1, h - 1, z0 + D - 1, 'stairStone');
        // tread
        b.box(0, h - 1, z0, Wd - 1, h - 1, z0 + D - 1, 'stairStoneLight');
        // front lip
        b.box(0, h - 1, z0 + D - 1, Wd - 1, h - 1, z0 + D - 1, 'stairStoneDark');
        // riser shading
        b.box(0, h - 2, z0 + D - 1, Wd - 1, h - 2, z0 + D - 1, 'stairStoneDark');
        // side blocks
        for (const x of [0, Wd - 1]) b.box(x, 0, z0, x, h - 1, z0 + D - 1, 'stairStoneDark');
        b.box(0, h - 1, z0, 0, h - 1, z0 + D - 1, 'stairStoneLight');
        b.box(Wd - 1, h - 1, z0, Wd - 1, h - 1, z0 + D - 1, 'stairStoneLight');
      }
      b.paint((x, y, z, c) => (c === 'stairStone' && hash(x, y, z) < 0.12 ? 'stairStoneDark' : undefined));
    },
  }),

  // ---------------------------------------------------------------- barrel
  defineObject({
    id: 'barrel',
    name: 'barrel',
    synonyms: ['keg', 'cask', 'drum'],
    category: 'structures',
    blurb: 'Rolls, floats, and burns.',
    tags: ['flammable', 'floats'],
    tintKeys: ['wood', 'woodDark', 'woodLight'],
    burstColor: '#b07a43',
    voxelSize: 0.06,
    physics: { mass: 12, shape: 'auto', maxBoxes: 4, friction: 0.6 },
    props: { burnTime: 9 },
    build(b) {
      const H = 16, c = 7.5;
      for (let y = 0; y < H; y++) {
        const t = (y - 7.5) / 8;
        const r = 5.6 + 1.6 * (1 - t * t);
        const hoop = y === 2 || y === 3 || y === 12 || y === 13 || y === 0 || y === H - 1;
        for (let x = 0; x < 16; x++)
          for (let z = 0; z < 16; z++) {
            const dx = x + 0.5 - c, dz = z + 0.5 - c;
            const d = Math.hypot(dx, dz);
            if (d > r) continue;
            if (hoop && d > r - 1.1) {
              b.set(x, y, z, y === 3 || y === 13 ? 'barrelHoopLight' : 'barrelHoop');
              continue;
            }
            const ang = Math.atan2(dz, dx);
            const stave = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 14);
            b.set(x, y, z, stave % 3 === 0 ? 'woodDark' : stave % 3 === 1 ? 'wood' : 'woodLight');
          }
      }
      // lid
      b.cylinderY(c, c, H - 1, H - 1, 4.6, 'woodLight');
      b.cylinderY(c, c, H - 1, H - 1, 3, 'wood');
      b.box(7, H - 1, 4, 8, H - 1, 11, 'woodDark');
    },
  }),

  // ----------------------------------------------------------------- anvil
  defineObject({
    id: 'anvil',
    name: 'anvil',
    synonyms: ['anvils', 'smithing block', 'blacksmith anvil'],
    category: 'structures',
    blurb: 'Drops like a ton of bricks. Crushes fragile things.',
    tags: ['heavy', 'metal'],
    tintKeys: ['anvilBody', 'anvilDark', 'anvilTop'],
    burstColor: '#4d525c',
    spawnSound: 'clank',
    voxelSize: 0.045,
    physics: { mass: 70, shape: 'auto', maxBoxes: 6, friction: 0.7 },
    build(b) {
      // foot
      b.box(3, 0, 0, 18, 2, 7, 'anvilDark');
      b.box(3, 2, 0, 18, 2, 7, 'anvilBody');
      // waist
      b.box(6, 3, 1, 15, 6, 6, 'anvilBody');
      b.box(6, 3, 1, 15, 3, 6, 'anvilDark');
      // body (face)
      b.box(0, 7, 0, 21, 10, 7, 'anvilBody');
      b.box(0, 10, 0, 21, 10, 7, 'anvilTop');
      b.box(0, 7, 0, 21, 7, 7, 'anvilDark');
      // horn tapering to -X
      for (let x = -8; x < 0; x++) {
        const t = (x + 8) / 8;
        const half = Math.max(0.6, 3.5 * t);
        const drop = Math.round(1 + 2.5 * t);
        for (let z = 0; z < 8; z++) {
          const dz = Math.abs(z + 0.5 - 4);
          if (dz > half) continue;
          for (let y = 10 - drop + 1; y <= 10; y++) b.set(x, y, z, y === 10 ? 'anvilTop' : 'anvilBody');
        }
      }
      // heel
      b.box(22, 8, 1, 24, 10, 6, 'anvilBody');
      b.box(22, 10, 1, 24, 10, 6, 'anvilTop');
      // hardy + pritchel holes
      b.box(18, 10, 3, 19, 10, 4, 'black');
      b.set(14, 10, 3, 'black');
      // shine
      b.box(5, 10, 7, 12, 10, 7, 'anvilTop');
    },
  }),

  // ------------------------------------------------------------------- tnt
  defineObject({
    id: 'tnt',
    name: 'TNT',
    synonyms: ['dynamite', 'explosives', 'stick of dynamite', 'dynamite box'],
    category: 'structures',
    blurb: 'Only goes off when lit. Keep it away from fire.',
    tags: ['explosive'],
    tintKeys: ['tntRed', 'tntRedDark'],
    burstColor: '#d83a34',
    voxelSize: 0.05,
    physics: { mass: 3, shape: 'box', friction: 0.6, restitution: 0.1 },
    props: { fuse: 0, blastRadius: 5, blastForce: 20 },
    build(b) {
      const W = 14, H = 14, Dp = 8;
      b.box(0, 0, 0, W - 1, H - 1, Dp - 1, 'tntRed');
      // dark vertical stripes outside the band
      b.paint((x, y) => (x % 4 === 3 && (y < 4 || y > 10) ? 'tntRedDark' : undefined));
      // rounded vertical edges
      for (const x of [0, W - 1]) for (const z of [0, Dp - 1]) b.box(x, 0, z, x, H - 1, z, 'tntRedDark');
      // white band
      for (let y = 4; y <= 10; y++) {
        b.box(0, y, 0, W - 1, y, Dp - 1, 'tntBand');
      }
      // letters on the front face (z = Dp - 1)
      const T = ['###', '.#.', '.#.', '.#.', '.#.'];
      const N = ['#..#', '##.#', '#.##', '#..#', '#..#'];
      const draw = (g: string[], x0: number) =>
        g.forEach((row, i) => {
          for (let j = 0; j < row.length; j++) if (row[j] === '#') b.set(x0 + j, 9 - i, Dp - 1, 'tntText');
        });
      draw(T, 1);
      draw(N, 5);
      draw(T, 10);
      // top: darker lid, cap and fuse
      b.box(0, H - 1, 0, W - 1, H - 1, Dp - 1, 'tntRedDark');
      b.box(5, H, 2, 8, H, 5, 'tntCap');
      b.set(6, H + 1, 3, 'tntFuse');
      b.set(6, H + 2, 3, 'tntFuse');
      b.set(7, H + 3, 3, 'tntFuse');
      b.set(7, H + 4, 3, 'tntFuse');
      b.set(8, H + 4, 3, 'tntFuse');
      b.set(8, H + 5, 3, 'ropeDark');
    },
  }),

  // ----------------------------------------------------------------- chair
  defineObject({
    id: 'chair',
    name: 'chair',
    synonyms: ['seat', 'stool', 'wooden chair'],
    category: 'structures',
    blurb: 'Press C to take a seat, and a rest does you good. Burns well.',
    tags: ['flammable'],
    tintKeys: ['wood', 'woodDark', 'woodLight'],
    burstColor: '#b07a43',
    voxelSize: 0.06,
    use: 'sit',
    physics: { mass: 4, shape: 'auto', maxBoxes: 6, friction: 0.6 },
    props: { burnTime: 7 },
    build(b) {
      // legs
      for (const x of [0, 8]) for (const z of [0, 8]) b.box(x, 0, z, x + 1, 7, z + 1, 'woodDark');
      // seat
      b.box(0, 8, 0, 9, 9, 9, 'wood');
      b.box(0, 9, 0, 9, 9, 9, 'woodLight');
      b.box(0, 8, 9, 9, 8, 9, 'woodDark');
      // leg braces
      b.box(2, 3, 0, 7, 3, 0, 'woodDark');
      b.box(2, 3, 9, 7, 3, 9, 'woodDark');
      // backrest posts (back is z = 0..1)
      for (const x of [0, 8]) b.box(x, 10, 0, x + 1, 20, 1, 'woodDark');
      // slats
      b.box(2, 18, 0, 7, 20, 1, 'wood');
      b.box(2, 14, 0, 7, 15, 1, 'wood');
      b.box(2, 11, 0, 7, 11, 1, 'woodDark');
      b.box(2, 20, 0, 7, 20, 1, 'woodLight');
    },
  }),
];
