import { defineObject } from '../types';

/** Voxel size of a pool (coarse: pools are big and only the surface really shows). */
const V = 0.25;

/**
 * A body of still water set into the ground (a level object, never cast).
 * Sized by props: `width` (x) and `length` (z) in meters, `depth` in meters
 * and a `corner` radius that rounds the corners of the surface. The `liquid`
 * behavior makes it intangible, soaks and splashes; things tagged `floats`
 * bob on its surface (src/behaviors/defs/floats.ts). Its physics box is the
 * full rectangle, so the corners still count as water under the bank.
 */
export default defineObject({
  id: 'pool',
  name: 'pool',
  levelOnly: true,
  category: 'nature',
  blurb: 'Still water. Floating things bob on it.',
  tags: ['liquid', 'wet'],
  tintKeys: ['waterMid', 'waterDeep', 'waterTop'],
  burstColor: '#68b6f4',
  spawnSound: 'splash',
  voxelSize: V,
  physics: { anchored: true, mass: 0, shape: 'box' },
  props: { width: 6, length: 6, depth: 1, corner: 1 },
  build(b, rng, props) {
    const nx = Math.max(2, Math.round(props.width / V)), nz = Math.max(2, Math.round(props.length / V));
    const ny = Math.max(1, Math.round(props.depth / V));
    const r = props.corner / V;
    // inside the rounded rectangle?
    const inside = (x: number, z: number) => {
      const cx = Math.max(r, Math.min(nx - r, x + 0.5)), cz = Math.max(r, Math.min(nz - r, z + 0.5));
      return Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r;
    };
    for (let x = 0; x < nx; x++)
      for (let z = 0; z < nz; z++) {
        // the corners keep a single bottom voxel so the model (and its box) spans the full rectangle
        if (!inside(x, z)) {
          if ((x === 0 || x === nx - 1) && (z === 0 || z === nz - 1)) b.set(x, 0, z, 'waterDeep');
          continue;
        }
        if (ny > 1) b.box(x, 0, z, x, ny - 2, z, 'waterDeep');
        const ripple = Math.sin(x * 0.9 + z * 0.4) + Math.cos(z * 0.8 - x * 0.3) + (rng() - 0.5);
        b.set(x, ny - 1, z, ripple > 1.6 && rng() > 0.6 ? 'waterFoam' : ripple > 0.6 ? 'waterTop' : 'waterMid');
      }
  },
});
