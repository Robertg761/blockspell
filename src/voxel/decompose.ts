import type { VoxelModel } from './model';

/** Axis-aligned box in voxel coordinates, `max` exclusive. */
export interface VoxelBox {
  min: [number, number, number];
  max: [number, number, number];
}

function greedy(occ: Uint8Array, sx: number, sy: number, sz: number): VoxelBox[] {
  const used = new Uint8Array(occ.length);
  const idx = (x: number, y: number, z: number) => x + sx * (y + sy * z);
  const free = (x: number, y: number, z: number) => occ[idx(x, y, z)] === 1 && used[idx(x, y, z)] === 0;
  const boxes: VoxelBox[] = [];
  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        if (!free(x, y, z)) continue;
        let x1 = x;
        while (x1 + 1 < sx && free(x1 + 1, y, z)) x1++;
        let y1 = y;
        grow: while (y1 + 1 < sy) {
          for (let xx = x; xx <= x1; xx++) if (!free(xx, y1 + 1, z)) break grow;
          y1++;
        }
        let z1 = z;
        growZ: while (z1 + 1 < sz) {
          for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) if (!free(xx, yy, z1 + 1)) break growZ;
          z1++;
        }
        for (let zz = z; zz <= z1; zz++) for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) used[idx(xx, yy, zz)] = 1;
        boxes.push({ min: [x, y, z], max: [x1 + 1, y1 + 1, z1 + 1] });
      }
  return boxes;
}

/**
 * Approximates a voxel model with at most `maxBoxes` boxes for physics.
 * Tries an exact greedy decomposition, then progressively coarser grids
 * (cells count as solid when ≥ 50% filled), falling back to the bounding box.
 */
export function decomposeBoxes(model: VoxelModel, maxBoxes = 10): VoxelBox[] {
  const { sx, sy, sz } = model;
  for (let f = 1; f <= 4; f++) {
    const cx = Math.ceil(sx / f), cy = Math.ceil(sy / f), cz = Math.ceil(sz / f);
    const occ = new Uint8Array(cx * cy * cz);
    for (let z = 0; z < cz; z++)
      for (let y = 0; y < cy; y++)
        for (let x = 0; x < cx; x++) {
          let filled = 0, total = 0;
          for (let dz = 0; dz < f; dz++)
            for (let dy = 0; dy < f; dy++)
              for (let dx = 0; dx < f; dx++) {
                const vx = x * f + dx, vy = y * f + dy, vz = z * f + dz;
                if (vx >= sx || vy >= sy || vz >= sz) continue;
                total++;
                if (model.grid[vx + sx * (vy + sy * vz)]) filled++;
              }
          occ[x + cx * (y + cy * z)] = total > 0 && filled / total >= 0.5 ? 1 : 0;
        }
    const boxes = greedy(occ, cx, cy, cz);
    if (boxes.length > 0 && boxes.length <= maxBoxes) {
      return boxes.map((b) => ({
        min: [b.min[0] * f, b.min[1] * f, b.min[2] * f],
        max: [Math.min(sx, b.max[0] * f), Math.min(sy, b.max[1] * f), Math.min(sz, b.max[2] * f)],
      }));
    }
  }
  return [{ min: [0, 0, 0], max: [sx, sy, sz] }];
}
