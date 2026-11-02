/**
 * A dense voxel model. `grid[i]` is 0 for empty, otherwise `1 + index into keys`.
 * Index layout: x + sx * (y + sy * z). `min` is the original coordinate of
 * voxel (0,0,0), so models built at arbitrary coordinates keep their placement.
 */
export interface VoxelModel {
  sx: number;
  sy: number;
  sz: number;
  min: [number, number, number];
  keys: string[];
  grid: Uint8Array;
  count: number;
}

export function voxelIndex(m: VoxelModel, x: number, y: number, z: number): number {
  return x + m.sx * (y + m.sy * z);
}

export function voxelAt(m: VoxelModel, x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0 || x >= m.sx || y >= m.sy || z >= m.sz) return 0;
  return m.grid[x + m.sx * (y + m.sy * z)];
}

/** Returns a copy of the model with color keys remapped (used by color adjectives). */
export function remapModel(m: VoxelModel, map: Map<string, string>): VoxelModel {
  if (map.size === 0) return m;
  return { ...m, keys: m.keys.map((k) => map.get(k) ?? k) };
}
