import type { VoxelModel } from './model';

const OFFSET = 1024;
const pack = (x: number, y: number, z: number) => ((x + OFFSET) * 2048 + (y + OFFSET)) * 2048 + (z + OFFSET);

/**
 * Tiny procedural voxel DSL. Coordinates are integers; Y is up. All shape
 * helpers take a color key from the palette (or a '#hex' string).
 *
 *   b.box(0,0,0, 3,3,3, 'cardboard')         // inclusive bounds
 *   b.sphere(4,4,4, 3.5, 'red')
 *   b.layers([['#.#', '...']], { '#': 'wood' }) // y-layers of z-rows of x-chars
 */
export class VoxelBuilder {
  private cells = new Map<number, { x: number; y: number; z: number; c: string }>();

  set(x: number, y: number, z: number, c: string): this {
    this.cells.set(pack(x, y, z), { x, y, z, c });
    return this;
  }

  clear(x: number, y: number, z: number): this {
    this.cells.delete(pack(x, y, z));
    return this;
  }

  get(x: number, y: number, z: number): string | undefined {
    return this.cells.get(pack(x, y, z))?.c;
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(pack(x, y, z));
  }

  /** Inclusive axis-aligned box. Pass `null` as color to carve. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string | null): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
          c === null ? this.clear(x, y, z) : this.set(x, y, z, c);
    return this;
  }

  /** Ellipsoid centered at (cx,cy,cz) — centers may be fractional (x.5 = between voxels). */
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: string | null): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, dz = (z + 0.5 - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1) c === null ? this.clear(x, y, z) : this.set(x, y, z, c);
        }
    return this;
  }

  sphere(cx: number, cy: number, cz: number, r: number, c: string | null): this {
    return this.ellipsoid(cx, cy, cz, r, r, r, c);
  }

  /** Vertical cylinder from y0..y1 inclusive. */
  cylinderY(cx: number, cz: number, y0: number, y1: number, r: number, c: string | null): this {
    for (let y = y0; y <= y1; y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
          const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
          if (dx * dx + dz * dz <= r * r) c === null ? this.clear(x, y, z) : this.set(x, y, z, c);
        }
    return this;
  }

  /**
   * Layered string grids: `layers[y][z]` is a row string, one char per x.
   * '.' and ' ' are empty; other chars look up `legend`.
   */
  layers(layers: string[][], legend: Record<string, string>, ox = 0, oy = 0, oz = 0): this {
    layers.forEach((rows, y) =>
      rows.forEach((row, z) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '.' || ch === ' ') continue;
          const c = legend[ch];
          if (c) this.set(ox + x, oy + y, oz + z, c);
        }
      }),
    );
    return this;
  }

  /** Recolor existing voxels: return a new key, or undefined to keep, or null to delete. */
  paint(fn: (x: number, y: number, z: number, c: string) => string | null | undefined): this {
    for (const [k, v] of [...this.cells]) {
      const r = fn(v.x, v.y, v.z, v.c);
      if (r === null) this.cells.delete(k);
      else if (r !== undefined) v.c = r;
    }
    return this;
  }

  /** Copies every voxel of `other` into this builder. */
  merge(other: VoxelBuilder): this {
    for (const v of other.cells.values()) this.set(v.x, v.y, v.z, v.c);
    return this;
  }

  /** Mirror all voxels across the plane x = axis (useful for symmetric models). */
  mirrorX(axis: number): this {
    for (const v of [...this.cells.values()]) this.set(Math.round(2 * axis - v.x), v.y, v.z, v.c);
    return this;
  }

  get size(): number {
    return this.cells.size;
  }

  build(): VoxelModel {
    if (this.cells.size === 0) this.set(0, 0, 0, '#ff00ff');
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const v of this.cells.values()) {
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
      if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
    }
    const sx = maxX - minX + 1, sy = maxY - minY + 1, sz = maxZ - minZ + 1;
    const grid = new Uint8Array(sx * sy * sz);
    const keys: string[] = [];
    const keyIndex = new Map<string, number>();
    for (const v of this.cells.values()) {
      let ki = keyIndex.get(v.c);
      if (ki === undefined) {
        ki = keys.length;
        if (ki >= 255) throw new Error('VoxelBuilder: more than 255 colors in one model');
        keys.push(v.c);
        keyIndex.set(v.c, ki);
      }
      grid[v.x - minX + sx * (v.y - minY + sy * (v.z - minZ))] = ki + 1;
    }
    return { sx, sy, sz, min: [minX, minY, minZ], keys, grid, count: this.cells.size };
  }
}
