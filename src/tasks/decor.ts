import type { GameWorld } from '../core/world';
import type { V3 } from '../levels/types';
import { VoxelBuilder } from '../voxel/builder';
import { ROOF } from '../voxel/hd';

/** Voxel size of baked scenery (the same as static boxes). */
const V = 0.25;

/**
 * Collects a zone's scenery (rocks, trees, fences, ruins...) and bakes it
 * into a single static mesh: one draw call for the whole zone, which matters
 * in software WebGL. Solid pieces add an invisible box collider each (cheap,
 * no mesh). Coordinates are local to `origin` (the zone center); `y` is the
 * height above it. Boxes are given by their center and size, like
 * `addStaticBox`, and snap to the 0.25 m grid.
 */
export class Decor {
  private b = new VoxelBuilder();
  private solids: { position: V3; size: V3 }[] = [];
  private any = false;
  /** Trees, kept apart so a tool can take one back out of the baked mesh. */
  private trees: { x: number; z: number; height: number; boxes: number[][]; solid: number }[] = [];
  /** While set, `box` also notes the voxel bounds it fills. */
  private noting: number[][] | null = null;

  constructor(private readonly origin: V3) {}

  /** A box of voxels centered at (x, y, z) in local coordinates. `solid` adds a collider. */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, solid = false, top?: string): this {
    const nx = Math.max(1, Math.round(sx / V)), ny = Math.max(1, Math.round(sy / V)), nz = Math.max(1, Math.round(sz / V));
    const x0 = Math.round((x - sx / 2) / V), y0 = Math.round((y - sy / 2) / V), z0 = Math.round((z - sz / 2) / V);
    this.b.box(x0, y0, z0, x0 + nx - 1, y0 + ny - 1, z0 + nz - 1, color);
    this.noting?.push([x0, y0, z0, x0 + nx - 1, y0 + ny - 1, z0 + nz - 1]);
    if (top) this.b.box(x0, y0 + ny - 1, z0, x0 + nx - 1, y0 + ny - 1, z0 + nz - 1, top);
    this.any = true;
    if (solid) {
      const [ox, oy, oz] = this.origin;
      this.solids.push({ position: [ox + (x0 + nx / 2) * V, oy + (y0 + ny / 2) * V, oz + (z0 + nz / 2) * V], size: [nx * V, ny * V, nz * V] });
    }
    return this;
  }

  /** A single voxel (flowers, pebbles). */
  dot(x: number, y: number, z: number, color: string): this {
    this.b.set(Math.round(x / V - 0.5), Math.round(y / V - 0.5), Math.round(z / V - 0.5), color);
    this.any = true;
    return this;
  }

  /** Adds the baked mesh and the colliders to the world (skipped on a zone reset, like other statics). */
  build(world: GameWorld): void {
    if (!this.any || world.skipStatics) return;
    const mesh = world.addDecorMesh(this.b.build(), this.origin);
    const bodies = this.solids.map((s) => world.addStaticCollider(s.position, s.size));
    const [ox, oy, oz] = this.origin;
    for (const t of this.trees)
      world.addSceneryTree({
        x: ox + t.x, y: oy, z: oz + t.z, height: t.height, body: bodies[t.solid], damage: 0, gone: false,
        erase: () => {
          for (const [x0, y0, z0, x1, y1, z1] of t.boxes) this.b.box(x0, y0, z0, x1, y1, z1, null);
          if (mesh) world.rebakeDecor(mesh, this.b.build());
        },
      });
  }

  /** Notes what `draw` builds as one tree, standing at (x, z) and `height` m tall. */
  private plant(x: number, z: number, height: number, draw: () => void): this {
    const boxes: number[][] = [];
    const solid = this.solids.length;
    this.noting = boxes;
    draw();
    this.noting = null;
    this.trees.push({ x, z, height, boxes, solid });
    return this;
  }

  // ------------------------------------------------------------ pieces
  /** A lumpy rock about `s` m across. Rocks of 0.75 m or more are solid. */
  rock(x: number, z: number, s = 1, color = 'stone'): this {
    const solid = s >= 0.75;
    this.box(x, s * 0.3, z, s, s * 0.6, s * 0.8, color, solid);
    if (s >= 0.75) this.box(x + s * 0.12, s * 0.7, z - s * 0.05, s * 0.6, s * 0.3, s * 0.5, 'stoneDark');
    return this;
  }

  /** A round leafy tree, `h` m to the top of the trunk. Only the trunk is solid. */
  tree(x: number, z: number, h = 2.5, leaf = 'leaf'): this {
    return this.plant(x, z, h + 1.75, () => {
      this.box(x, h / 2, z, 0.5, h, 0.5, 'bark', true);
      this.box(x, h + 0.5, z, 2.25, 1.25, 2.25, leaf);
      this.box(x, h + 1.4, z, 1.5, 0.75, 1.5, leaf === 'leaf' ? 'leafDark' : leaf);
    });
  }

  /** A pointy pine tree. */
  pine(x: number, z: number, h = 3): this {
    return this.plant(x, z, h * 1.05, () => {
      this.box(x, 0.5, z, 0.5, 1, 0.5, 'bark', true);
      this.box(x, h * 0.45, z, 2, h * 0.3, 2, 'leafDark');
      this.box(x, h * 0.72, z, 1.5, h * 0.3, 1.5, 'leafDark');
      this.box(x, h * 0.95, z, 0.75, h * 0.25, 0.75, 'leaf');
    });
  }

  /** A dead, leafless tree (ember country). */
  deadTree(x: number, z: number, h = 2.5): this {
    return this.plant(x, z, h, () => {
      this.box(x, h / 2, z, 0.5, h, 0.5, 'charcoal', true);
      this.box(x + 0.5, h * 0.7, z, 0.75, 0.25, 0.25, 'charcoal');
      this.box(x - 0.4, h * 0.85, z + 0.25, 0.25, 0.25, 0.75, 'charcoal');
    });
  }

  /** A low shrub (not solid). */
  shrub(x: number, z: number, color = 'leafDark'): this {
    return this.box(x, 0.25, z, 0.75, 0.5, 0.75, color);
  }

  /** A little patch of flowers (not solid). */
  flowers(x: number, z: number, color = 'flowerRed'): this {
    for (const [dx, dz] of [[0, 0], [0.5, 0.25], [-0.25, 0.5], [0.25, -0.5], [-0.5, -0.25]]) {
      this.dot(x + dx, 0.125, z + dz, 'grassDark');
      this.dot(x + dx, 0.375, z + dz, color);
    }
    return this;
  }

  /** Tall grass or reeds (not solid). */
  reeds(x: number, z: number, color = 'grassDark'): this {
    for (const [dx, dz, h] of [[0, 0, 3], [0.25, 0.5, 2], [-0.5, 0.25, 4], [0.5, -0.25, 3]]) for (let i = 0; i < h; i++) this.dot(x + dx, 0.125 + i * V, z + dz, i === h - 1 ? 'grassLight' : color);
    return this;
  }

  /** A post-and-rail fence along x or z (axis-aligned), solid. */
  fence(x0: number, z0: number, x1: number, z1: number, color = 'wood'): this {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.box(x0 + (x1 - x0) * t, 0.5, z0 + (z1 - z0) * t, 0.25, 1, 0.25, 'woodDark');
    }
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const y of [0.375, 0.75]) this.box(mx, y, mz, along ? len : 0.25, 0.25, along ? 0.25 : len, color);
    this.solids.push({ position: [this.origin[0] + mx, this.origin[1] + 0.5, this.origin[2] + mz], size: along ? [len, 1, 0.3] : [0.3, 1, len] });
    return this;
  }

  /** A stone column, optionally broken off (ruins), solid. */
  pillar(x: number, z: number, h = 3, broken = false): this {
    this.box(x, 0.125, z, 1.25, 0.25, 1.25, 'stoneDark', true);
    this.box(x, 0.25 + h / 2, z, 0.75, h, 0.75, 'stone', true);
    if (!broken) this.box(x, h + 0.375, z, 1.25, 0.25, 1.25, 'stoneDark');
    else this.box(x + 0.125, h + 0.375, z, 0.5, 0.25, 0.5, 'stone');
    return this;
  }

  /** A small decorative cottage with a pitched roof, solid. `roof` is a palette key. */
  cottage(x: number, z: number, roof = 'red', wall = 'wood'): this {
    this.box(x, 0.75, z, 2, 1.5, 2, wall, true);
    // the roof key carries a hint so HD voxels slope it (the classic look ignores it)
    const r = ROOF + roof;
    this.box(x, 1.625, z, 2.5, 0.25, 2.5, r);
    this.box(x, 1.875, z, 2, 0.25, 2, r);
    this.box(x, 2.125, z, 1.25, 0.25, 1.25, r);
    this.box(x, 0.5, z + 1, 0.5, 1, 0.1, 'woodDark');
    return this;
  }

  /** A hay bale. */
  hay(x: number, z: number): this {
    return this.box(x, 0.375, z, 1, 0.75, 0.75, 'flowerYellow', true, 'sand');
  }

  /** A stone well with a little roof, solid. */
  well(x: number, z: number): this {
    this.box(x, 0.4, z, 1.25, 0.75, 1.25, 'stone', true);
    this.box(x, 0.7, z, 0.75, 0.25, 0.75, 'black');
    for (const dx of [-0.5, 0.5]) this.box(x + dx, 1.25, z, 0.25, 1, 0.25, 'woodDark');
    this.box(x, 1.875, z, 1.5, 0.25, 1, ROOF + 'redDark');
    return this;
  }

  /** A lamp post with a warm lantern (not lit, just warm colors), solid. */
  lamp(x: number, z: number): this {
    this.box(x, 1, z, 0.25, 2, 0.25, 'woodDark', true);
    this.box(x, 2.125, z, 0.5, 0.5, 0.5, 'flameMid');
    this.box(x, 2.5, z, 0.5, 0.25, 0.5, 'woodDark');
    return this;
  }
}

/** A pole with a colored flag, standing on the ground at `at` (placeholder zone marker). */
export function banner(world: GameWorld, at: V3, color: string): void {
  const [x, y, z] = at;
  world.addStaticBox({ position: [x, y + 1.25, z], size: [0.25, 2.5, 0.25], color: 'woodDark' });
  world.addStaticBox({ position: [x + 0.45, y + 2.1, z], size: [0.75, 0.5, 0.08], color });
}
