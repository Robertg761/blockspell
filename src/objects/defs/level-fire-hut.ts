import { hash3 } from '../../voxel/mesher';
import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

definePalette({
  hutShingle: '#c23a3a',
  hutShingleLight: '#ea5a52',
  hutGlass: '#9fd0e4',
  hutGlassLight: '#e3f4f8',
  hutPetal: '#ffcb4a',
  hutBrick: '#a8664c',
  hutDoor: '#5e3c24',
  hutDoorDark: '#4d301c',
});

export default defineObject({
  id: 'hut',
  name: 'hut',
  synonyms: ['cabin', 'shack', 'cottage', 'wooden hut'],
  category: 'structures',
  blurb: 'A snug little wooden hut. Very flammable!',
  tags: ['flammable'],
  tintKeys: ['redDark', 'red', 'hutShingle', 'hutShingleLight'],
  burstColor: '#b07a43',
  voxelSize: 0.1,
  physics: { anchored: true, mass: 0, shape: 'box', friction: 0.6 },
  props: { burnTime: 50 },
  build(b) {
    const W = 24, D = 20, WH = 14;
    // Stone footing, then log walls: two voxels per log, one lit and one in shadow.
    b.box(0, 0, 0, W - 1, 1, D - 1, 'stone');
    b.paint((x, y, z) => (hash3(x >> 1, y, z >> 1) < 0.35 ? 'stoneDark' : undefined));
    b.box(0, 2, 0, W - 1, WH - 1, D - 1, 'wood');
    b.paint((x, y, z, c) => {
      if (c !== 'wood') return undefined;
      if (y % 2 === 1) return 'woodDark';
      return hash3(x >> 2, y, z >> 2) < 0.35 ? 'woodLight' : undefined;
    });
    // Log ends cross at the corners, every other course.
    for (let y = 2; y < WH; y += 4) {
      for (const z of [0, D - 1]) b.box(-1, y, z, W, y + 1, z, 'woodLight');
      for (const x of [0, W - 1]) b.box(x, y + 2, -1, x, y + 3, D, 'woodLight');
    }

    // Door: recessed planks in a heavy frame, with a stone step.
    b.box(9, 2, D - 1, 14, 11, D - 1, 'woodDark');
    b.box(10, 2, D - 1, 13, 10, D - 1, null);
    b.box(10, 2, D - 2, 13, 10, D - 2, 'hutDoor');
    b.paint((x, y, z) => (z === D - 2 && x >= 10 && x <= 13 && y >= 2 && y <= 10 && x % 2 === 1 ? 'hutDoorDark' : undefined));
    b.box(10, 4, D - 2, 13, 4, D - 2, 'metal');
    b.box(10, 8, D - 2, 13, 8, D - 2, 'metal');
    b.set(13, 6, D - 1, 'flowerYellow');
    b.box(9, 0, D, 14, 1, D + 1, 'stone');
    b.box(10, 1, D + 1, 13, 1, D + 1, 'stoneDark');

    // Windows with mullions, shutters and flower boxes.
    const paneFront = (x0: number) => {
      b.box(x0 - 1, 4, D, x0 + 4, 10, D, 'woodDark');
      b.box(x0, 5, D, x0 + 3, 9, D, 'hutGlass');
      b.box(x0, 7, D, x0 + 3, 7, D, 'woodDark');
      b.box(x0 + 1, 5, D, x0 + 1, 9, D, 'woodDark');
      b.set(x0 + 3, 9, D, 'hutGlassLight');
      b.set(x0 + 2, 8, D, 'hutGlassLight');
      for (const sx of [x0 - 2, x0 + 5]) {
        b.box(sx, 4, D - 1, sx, 10, D - 1, 'red');
        b.box(sx, 7, D - 1, sx, 7, D - 1, 'redDark');
      }
      b.box(x0 - 1, 3, D, x0 + 4, 3, D + 1, 'woodDark');
      for (let x = x0 - 1; x <= x0 + 4; x++) b.set(x, 4, D + 1, x % 2 ? 'hutPetal' : 'leaf');
    };
    paneFront(3);
    paneFront(17);
    for (const x of [-1, W]) {
      b.box(x, 5, 7, x, 10, 12, 'woodDark');
      b.box(x, 6, 8, x, 9, 11, 'hutGlass');
      b.box(x, 6, 9, x, 9, 9, 'woodDark');
    }

    // Gable walls: upright boards under the roof with a little round vent.
    for (let i = 0; i <= 9; i++) {
      const z0 = i, z1 = D - 1 - i;
      if (z0 > z1) break;
      b.box(0, WH + i, z0, W - 1, WH + i, z1, 'woodLight');
    }
    b.paint((x, y, z) => (y >= WH && (x === 0 || x === W - 1) && z % 3 === 0 ? 'wood' : undefined));
    for (const x of [0, W - 1]) {
      b.box(x, WH + 3, 8, x, WH + 5, 11, 'woodDark');
      b.box(x, WH + 4, 9, x, WH + 4, 10, 'black');
    }

    // Gabled roof along x with overhang. Each 2-deep course of shingles is staggered from the last.
    const shingle = (x: number, y: number, z: number, i: number) => {
      const tab = Math.floor((x + (i % 2) * 2 + 2) / 4);
      if ((x + (i % 2) * 2 + 2) % 4 === 0) return 'redDark';
      const n = hash3(tab, i, z > D / 2 ? 1 : 0);
      return n < 0.28 ? 'hutShingle' : n < 0.62 ? 'red' : 'hutShingleLight';
    };
    for (let i = 0; i <= 10; i++) {
      const z0 = -2 + i, z1 = D + 1 - i;
      if (z0 > z1) break;
      for (let x = -2; x <= W + 1; x++) {
        for (const z of [z0, z0 + 1, z1 - 1, z1]) b.set(x, WH + i, z, shingle(x, WH + i, z, i));
        if (z1 - z0 < 3) for (let z = z0; z <= z1; z++) b.set(x, WH + i, z, 'redDark');
      }
    }
    // Fascia board along the eaves.
    b.box(-2, WH, -2, W + 1, WH, -2, 'woodDark');
    b.box(-2, WH, D + 1, W + 1, WH, D + 1, 'woodDark');

    // Brick chimney breaking through the front slope, with a cap.
    b.box(18, 18, 14, 20, 23, 16, 'stone');
    b.paint((x, y, z) => {
      if (x < 18 || x > 20 || z < 14 || z > 16 || y < 18 || y > 23) return undefined;
      return (x + z + (y % 2) * 2) % 3 === 0 ? 'stoneDark' : hash3(x, y, z) < 0.2 ? 'hutBrick' : undefined;
    });
    b.box(17, 23, 13, 21, 23, 17, 'stoneDark');
    b.box(19, 23, 15, 19, 24, 15, 'black');
  },
});
