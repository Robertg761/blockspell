import { makeRng, randRange, type Rng } from '../core/rng';
import { VoxelBuilder } from '../voxel/builder';
import { hash3 } from '../voxel/mesher';

/**
 * Voxel models for the world itself: trees, rocks, shrubs, level props and the
 * material styles of level blocks. Everything here is scenery with no physics
 * of its own. Colors are raw hex because nothing in the world is ever retinted.
 */

export const GRASS = ['#4c9638', '#55a03b', '#5ea93f', '#68b343', '#72bc48', '#7dc44e', '#8acc55', '#97d35e'];
export const DRY_GRASS = ['#86ad4c', '#97b552', '#a8bb5a'];
export const DIRT = ['#8c5f3d', '#7f5536', '#966845', '#74502f'];
export const DIRT_DARK = '#5f4029';
export const PEBBLE = '#a39a8f';
export const ROCK = ['#8f9098', '#83848e', '#9b9ca3', '#787a85', '#a5a5a9'];
export const ROCK_DARK = '#5f606b';
export const ROCK_LIGHT = '#b6b6b8';
export const ROCK_DEEP = ['#6c6e7a', '#62646f', '#727380'];
export const MOSS = ['#6f9347', '#5d8040', '#7fa44e'];
const WOOD = ['#b07a43', '#a56f3b', '#ba864e', '#9c6a38'];
const WOOD_DARK = ['#7d532f', '#6f4929', '#875b34'];
const BARK = ['#6e4a2e', '#5f3f27', '#7a5434'];
const BIRCH = ['#ece7da', '#ddd7c8'];
const OAK_LEAF = ['#3a8238', '#46933d', '#55a443', '#66b54a', '#79c452', '#92d45f'];
const PINE_LEAF = ['#2a7044', '#32804a', '#3d9050', '#4ca158'];
const BIRCH_LEAF = ['#5a9c3e', '#6dae45', '#83bf4e', '#9bcd59'];
const SHRUB_LEAF = ['#3a8639', '#489840', '#5aab47', '#74bf52'];

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** The ramp entry at t, where 0 is its first color and 1 its last. */
export const tone = (ramp: readonly string[], t: number) => ramp[Math.min(ramp.length - 1, Math.floor(clamp01(t) * ramp.length))];
const anyOf = (ramp: readonly string[], n: number) => ramp[Math.floor(n * ramp.length) % ramp.length];

/** Layered sedimentary rock: bands of tone, with chips and cracks. `warp` tilts the bands. */
export function rockAt(x: number, y: number, z: number, warp = 0): string {
  const band = Math.floor((y + warp) / 3);
  const n = hash3(x, y, z);
  if (n < 0.07) return ROCK_DARK;
  if (n > 0.95) return ROCK_LIGHT;
  return anyOf(ROCK, hash3(band, 17, 5));
}

/** Round beam between two points. */
function beam(b: VoxelBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number, c: string): void {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) * 1.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / Math.max(1, steps);
    b.sphere(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, r0 + (r1 - r0) * t, c);
  }
}

/** True if a voxel has an open side, i.e. it is on the outside of the shape. */
const exposed = (b: VoxelBuilder, x: number, y: number, z: number) =>
  !b.has(x + 1, y, z) || !b.has(x - 1, y, z) || !b.has(x, y + 1, z) || !b.has(x, y - 1, z) || !b.has(x, y, z + 1) || !b.has(x, y, z - 1);

/**
 * Shades a blob of leaves: lit from above and the sun side, dark beneath, in
 * clumps rather than single voxels, with a nibbled outline so it reads as foliage.
 */
function shadeFoliage(leaves: VoxelBuilder, ramp: readonly string[], cy: number, radius: number, seed: number, nibble = 0.2): void {
  leaves.paint((x, y, z) => (exposed(leaves, x, y, z) && hash3(x + seed, y, z) < nibble ? null : undefined));
  leaves.paint((x, y, z) => {
    const clump = hash3(x >> 1, (y >> 1) + seed, z >> 1) - 0.5;
    const speck = hash3(x, y + seed, z) - 0.5;
    return tone(ramp, 0.46 + ((y - cy) / radius) * 0.5 + ((x * 0.55 + z * 0.35) / radius) * 0.2 + clump * 0.42 + speck * 0.2);
  });
}

/** Tapering trunk with a flared base. Bark runs in vertical furrows. */
function trunk(b: VoxelBuilder, height: number, r0: number, r1: number, ramp: readonly string[]): void {
  for (let y = -4; y <= height; y++) {
    const t = clamp01(y / height);
    b.cylinderY(0, 0, y, y, r0 + (r1 - r0) * t + Math.max(0, 3 - y) * 0.55, ramp[0]);
  }
  b.paint((x, y, z) => {
    const furrow = Math.floor((Math.atan2(z, x) + Math.PI) * 2.2);
    return anyOf(ramp, hash3(furrow, y >> 2, 3));
  });
}

/** Broadleaf tree: gnarled trunk, branches and a canopy of overlapping lobes. Fine voxels (1/8 m). */
export function buildOak(rng: Rng, trunkHeight: number): VoxelBuilder {
  const b = new VoxelBuilder();
  trunk(b, trunkHeight, 2.5, 1.6, BARK);
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    beam(b, 0, 1, 0, Math.cos(a) * 5.5, -1, Math.sin(a) * 5.5, 1.5, 0.8, BARK[1]);
  }
  const cy = trunkHeight + 6;
  const leaves = new VoxelBuilder();
  leaves.ellipsoid(0, cy, 0, 8.5, 6.5, 8.5, OAK_LEAF[0]);
  const lobes = 7 + Math.floor(rng() * 3);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + rng() * 0.6;
    const out = randRange(rng, 6, 8.5), up = randRange(rng, -2.5, 5);
    const x = Math.cos(a) * out, z = Math.sin(a) * out, r = randRange(rng, 4.5, 6.5);
    leaves.ellipsoid(x, cy + up, z, r, r * 0.8, r, OAK_LEAF[0]);
    if (i % 2 === 0) beam(b, 0, trunkHeight * 0.75, 0, x * 0.7, cy + up - 2, z * 0.7, 1.2, 0.6, BARK[0]);
  }
  leaves.ellipsoid(randRange(rng, -2, 2), cy + 6, randRange(rng, -2, 2), 6, 4.5, 6, OAK_LEAF[0]);
  shadeFoliage(leaves, OAK_LEAF, cy, 12, Math.floor(rng() * 1000));
  return b.merge(leaves);
}

/** Conifer: thin trunk and drooping tiers of needles, widest at the bottom. */
export function buildPine(rng: Rng, trunkHeight: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const height = Math.round(trunkHeight * 1.9) + 8;
  trunk(b, height, 1.7, 0.7, BARK);
  const leaves = new VoxelBuilder();
  const start = Math.round(trunkHeight * 0.45), tiers = 6;
  const seed = Math.floor(rng() * 1000);
  for (let t = 0; t < tiers; t++) {
    const y0 = start + Math.round(((height - start) * t) / tiers);
    const R = 10.5 * (1 - t / (tiers + 0.6)) + 1;
    for (let dy = 0; dy < 5; dy++) {
      const r = R * (1 - dy / 5.5);
      for (let x = -Math.ceil(r); x <= r; x++)
        for (let z = -Math.ceil(r); z <= r; z++) {
          const d = Math.hypot(x, z), spoke = Math.floor((Math.atan2(z, x) + Math.PI) * 2.6);
          // Boughs: each spoke of the tier reaches a different length, and tips sag.
          const reach = r * (0.72 + 0.28 * hash3(spoke, t, seed));
          if (d > reach) continue;
          leaves.set(x, y0 + dy - (d > reach * 0.72 ? 1 : 0), z, PINE_LEAF[0]);
        }
    }
  }
  leaves.cylinderY(0, 0, height, height + 3, 1, PINE_LEAF[3]);
  leaves.paint((x, y, z) => {
    const out = Math.hypot(x, z) / 10;
    return tone(PINE_LEAF, 0.15 + out * 0.5 + (hash3(x, y + seed, z) - 0.5) * 0.5 + ((x * 0.55 + z * 0.35) / 10) * 0.25);
  });
  return b.merge(leaves);
}

/** Slim pale tree with dark flecks on the bark and an airy yellow-green crown. */
export function buildBirch(rng: Rng, trunkHeight: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const height = Math.round(trunkHeight * 1.3);
  trunk(b, height, 1.5, 1, BIRCH);
  b.paint((x, y, z) => {
    if (hash3(x >> 1, y, z >> 1) < 0.16) return '#2d2a2a';
    return y < 2 ? BARK[1] : undefined;
  });
  const cy = height + 3;
  const leaves = new VoxelBuilder();
  leaves.ellipsoid(0, cy, 0, 5, 8, 5, BIRCH_LEAF[0]);
  for (let i = 0; i < 6; i++) {
    const a = rng() * Math.PI * 2, out = randRange(rng, 3.5, 5.5), up = randRange(rng, -5, 6), r = randRange(rng, 2.8, 4.2);
    leaves.ellipsoid(Math.cos(a) * out, cy + up, Math.sin(a) * out, r, r * 1.1, r, BIRCH_LEAF[0]);
  }
  shadeFoliage(leaves, BIRCH_LEAF, cy, 9, Math.floor(rng() * 1000), 0.3);
  return b.merge(leaves);
}

/** Boulder with a few smaller stones at its foot, weathered and mossy on top. Sits partly in the ground. */
export function buildBoulder(rng: Rng, radius: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const lump = (x: number, z: number, r: number) => {
    b.ellipsoid(x, r * 0.35, z, r * 1.25, r * 0.95, r, ROCK[0]);
    b.ellipsoid(x + r * 0.35, r * 0.75, z - r * 0.2, r * 0.75, r * 0.55, r * 0.7, ROCK[0]);
  };
  lump(0, 0, radius);
  const chips = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < chips; i++) {
    const a = rng() * Math.PI * 2, d = radius * randRange(rng, 1.3, 1.7);
    lump(Math.cos(a) * d, Math.sin(a) * d, radius * randRange(rng, 0.3, 0.5));
  }
  // Knock a few flat facets off the outline.
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    b.sphere(Math.cos(a) * radius * 1.5, randRange(rng, radius * 0.4, radius * 1.2), Math.sin(a) * radius * 1.5, radius * 0.55, null);
  }
  const seed = Math.floor(rng() * 1000);
  b.paint((x, y, z) => {
    const facingUp = !b.has(x, y + 1, z);
    if (facingUp && y > radius * 0.5 && hash3(x >> 1, seed, z >> 1) < 0.55) return anyOf(MOSS, hash3(x, y, z));
    return rockAt(x, y, z, x * 0.35 + seed);
  });
  return b;
}

/** Low leafy shrub, with berries or small blossoms if `fruit` is given. */
export function buildShrub(rng: Rng, fruit?: string): VoxelBuilder {
  const leaves = new VoxelBuilder();
  const r = randRange(rng, 3.4, 4.6);
  leaves.ellipsoid(0, r * 0.55, 0, r * 1.15, r * 0.9, r, SHRUB_LEAF[0]);
  leaves.ellipsoid(r * 0.85, r * 0.35, r * 0.3, r * 0.7, r * 0.65, r * 0.7, SHRUB_LEAF[0]);
  leaves.ellipsoid(-r * 0.8, r * 0.3, -r * 0.3, r * 0.75, r * 0.6, r * 0.7, SHRUB_LEAF[0]);
  const seed = Math.floor(rng() * 1000);
  shadeFoliage(leaves, SHRUB_LEAF, r * 0.5, r * 1.3, seed, 0.16);
  if (fruit) leaves.paint((x, y, z) => (exposed(leaves, x, y, z) && hash3(x, y + seed, z) < 0.05 ? fruit : undefined));
  return leaves;
}

/** Cut tree stump with growth rings on top. */
export function buildStump(rng: Rng): VoxelBuilder {
  const b = new VoxelBuilder();
  const r = randRange(rng, 2.6, 3.4), h = 3 + Math.floor(rng() * 3);
  trunk(b, h, r, r * 0.9, BARK);
  for (let x = -5; x <= 5; x++)
    for (let z = -5; z <= 5; z++) {
      if (!b.has(x, h, z)) continue;
      const d = Math.hypot(x, z);
      b.set(x, h, z, d > r - 0.6 ? BARK[0] : Math.floor(d) % 2 ? '#c99a62' : '#b28350');
    }
  return b;
}

/** Fallen trunk lying along X with a mossy back and rings at both ends. */
export function buildFallenLog(rng: Rng): VoxelBuilder {
  const b = new VoxelBuilder();
  const len = 10 + Math.floor(rng() * 7), r = randRange(rng, 1.9, 2.5);
  for (let x = -len; x <= len; x++)
    for (let y = -3; y <= 3; y++)
      for (let z = -3; z <= 3; z++) {
        const d = Math.hypot(y, z);
        if (d > r) continue;
        const end = Math.abs(x) === len;
        const c = end ? (Math.floor(d) % 2 ? '#c99a62' : '#b28350') : y >= 1 && hash3(x >> 1, 9, z) < 0.5 ? anyOf(MOSS, hash3(x, y, z)) : anyOf(BARK, hash3(x >> 2, y, z));
        b.set(x, y + 1, z, c);
      }
  return b;
}

// ---------------------------------------------------------------- level blocks

/**
 * How a static level block is drawn. `plain` is a flat color; `hidden` draws
 * nothing, for colliders whose look comes from addScenery instead.
 */
export type BlockStyle = 'plain' | 'rock' | 'earth' | 'planks' | 'cobble' | 'hidden';

export interface BlockLook {
  style: BlockStyle;
  color: string;
  topColor?: string;
  seed: number;
}

export const inferBlockStyle = (color: string): BlockStyle =>
  color === 'stone' || color === 'stoneDark' ? 'rock' : color === 'dirt' ? 'earth' : color === 'wood' || color === 'woodDark' ? 'planks' : 'plain';

/** Fine voxels per 0.25 m of block. */
export const blockDetail = (style: BlockStyle) => (style === 'cobble' ? 4 : style === 'plain' || style === 'hidden' ? 1 : 2);

/** Grass color for the top of a block: gentle patches, speckled. */
const lawn = (x: number, z: number) => tone(GRASS, 0.5 + (hash3(x >> 2, 7, z >> 2) - 0.5) * 0.45 + (hash3(x, 3, z) - 0.5) * 0.5);

/**
 * Rock or packed earth. Faces are eaten back in ledges that follow the strata,
 * always inside the block's collider, and a grass top keeps a lip over them
 * with roots of turf dripping down.
 */
function natural(b: VoxelBuilder, sx: number, sy: number, sz: number, look: BlockLook): void {
  const { seed } = look;
  const soil = look.style === 'earth';
  const grassy = look.topColor === 'grass';
  const maxCut = Math.min(2, Math.floor(Math.min(sx, sz) / 6), Math.floor(sy / 4));
  const lipRows = 3;
  // How far a face has eroded at (u, y). Slabs are wider than they are tall.
  const cut = (u: number, y: number, face: number) => {
    if (y >= sy - lipRows || maxCut === 0) return 0;
    const band = Math.floor(y / 3);
    const slab = Math.floor((u + hash3(band, face, seed) * 9) / 6);
    return Math.floor(hash3(slab, band, face + seed) * (maxCut + 1));
  };
  for (let y = 0; y < sy; y++)
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const edgeX = Math.min(x, sx - 1 - x), edgeZ = Math.min(z, sz - 1 - z);
        const perimeter = edgeX === 0 || edgeZ === 0;
        if (edgeX < maxCut + 1 || edgeZ < maxCut + 1) {
          if (x < cut(z, y, 0) || sx - 1 - x < cut(z, y, 1) || z < cut(x, y, 2) || sz - 1 - z < cut(x, y, 3)) continue;
        }
        // Worn corners on the top edge, and a broken rim.
        if (y === sy - 1 && perimeter && hash3(x, seed, z) < 0.22) continue;
        const faceU = edgeX <= edgeZ ? z : x;
        const down = sy - 1 - y;
        let c: string;
        if (grassy && down === 0) c = lawn(x + seed, z);
        else if (grassy && down <= 1 + Math.floor(hash3(faceU >> 1, seed, 1) * 3)) c = hash3(x, y, z) < 0.6 ? GRASS[1] : DIRT[3];
        else if (grassy && down <= 5 + Math.floor(hash3(faceU >> 2, seed, 2) * 3)) c = hash3(x, y + seed, z) < 0.12 ? DIRT_DARK : anyOf(DIRT, hash3(x, y, z));
        else if (soil) {
          const n = hash3(x + seed, y, z);
          c = n < 0.05 ? PEBBLE : n < 0.14 ? DIRT_DARK : anyOf(DIRT, hash3(x >> 1, y, z >> 1));
        } else {
          c = rockAt(x, y, z, seed + (x + z) * 0.12);
          // Moss creeps down from the top in patches.
          if (y > sy * 0.45 && hash3(x >> 1, y >> 1, (z >> 1) + seed) < 0.1) c = anyOf(MOSS, hash3(x, y, z));
        }
        b.set(x, y, z, c);
      }
}

/** Vertical boards with dark seams, two cross rails with nails, and a decking on top. */
function planks(b: VoxelBuilder, sx: number, sy: number, sz: number, look: BlockLook): void {
  const { seed } = look;
  const dark = look.color === 'woodDark';
  const main = dark ? WOOD_DARK : WOOD, accent = dark ? BARK : WOOD_DARK;
  const railRows = [Math.round(sy * 0.22), Math.round(sy * 0.72)];
  const isRail = (y: number) => railRows.some((r) => y === r || y === r + 1);
  const WIDTH = 3;
  const alongX = sx >= sz;
  for (let y = 0; y < sy; y++)
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const onX = x === 0 || x === sx - 1, onZ = z === 0 || z === sz - 1;
        if (y === sy - 1) {
          // Decking runs the long way, one board per 3 voxels across.
          const across = alongX ? z : x, along = alongX ? x : z;
          const board = Math.floor(across / WIDTH);
          const seam = across % WIDTH === 0 && across !== 0;
          const nail = along % 12 === 2 && across % WIDTH === 1;
          b.set(x, y, z, look.topColor ? (seam ? BARK[1] : nail ? '#5a5a60' : anyOf(look.topColor === 'wood' ? WOOD : WOOD_DARK, hash3(board, along >> 3, seed))) : anyOf(main, hash3(board, 1, seed)));
          continue;
        }
        if (!onX && !onZ) {
          b.set(x, y, z, BARK[1]); // shows through the seams
          continue;
        }
        const u = onZ ? x : z;
        const board = Math.floor(u / WIDTH);
        const seam = u % WIDTH === 0;
        if (isRail(y)) {
          const nail = !seam && u % WIDTH === 1 && y === railRows.find((r) => y === r || y === r + 1);
          b.set(x, y, z, nail ? '#55565c' : anyOf(accent, hash3(u >> 3, y, seed)));
        } else if (seam && !(onX && onZ)) {
          // Open seam: the outer voxel is left out so a real shadow line falls between boards.
          continue;
        } else {
          const n = hash3(x, y + seed, z);
          b.set(x, y, z, n < 0.05 ? accent[0] : anyOf(main, hash3(board, y >> 3, seed)));
        }
      }
}

/** Set flagstones in dark mortar, with a slightly broken edge. */
function cobble(b: VoxelBuilder, sx: number, sy: number, sz: number, look: BlockLook): void {
  const { seed } = look;
  const STONE = 5;
  for (let z = 0; z < sz; z++) {
    const row = Math.floor(z / STONE);
    for (let x = 0; x < sx; x++) {
      const shifted = x + (row % 2) * 2;
      const col = Math.floor(shifted / STONE);
      const mortar = z % STONE === 0 || shifted % STONE === 0;
      const edge = Math.min(x, sx - 1 - x, z, sz - 1 - z);
      if (edge < 2 && hash3(col, row, seed) < 0.3) continue;
      const stone = anyOf(ROCK, hash3(col, row, seed + 1));
      for (let y = 0; y < sy; y++) {
        const top = y === sy - 1;
        if (top && mortar) continue;
        b.set(x, y, z, y >= sy - 2 && mortar ? '#5b5140' : top ? (hash3(x, z, seed) < 0.1 ? ROCK_LIGHT : stone) : DIRT[3]);
      }
    }
  }
}

/** Voxels for a block of sx * sy * sz fine cells, with corner (0,0,0) at the origin. */
export function buildBlock(b: VoxelBuilder, sx: number, sy: number, sz: number, look: BlockLook): void {
  if (look.style === 'rock' || look.style === 'earth') natural(b, sx, sy, sz, look);
  else if (look.style === 'planks') planks(b, sx, sy, sz, look);
  else if (look.style === 'cobble') cobble(b, sx, sy, sz, look);
  else {
    b.box(0, 0, 0, sx - 1, sy - 1, sz - 1, look.color);
    if (look.topColor) b.box(0, sy - 1, 0, sx - 1, sy - 1, sz - 1, look.topColor);
  }
}

// ---------------------------------------------------------------- level props

/** Rock tapering down from y = 0: the underside of a floating cliff or island. Footprint is w x d, centered. */
export function buildUnderside(b: VoxelBuilder, w: number, d: number, depth: number, seed: number): void {
  const rng = makeRng(seed);
  const hx = w / 2, hz = d / 2;
  for (let x = -hx; x < hx; x++)
    for (let z = -hz; z < hz; z++) {
      const nx = (x + 0.5) / hx, nz = (z + 0.5) / hz;
      const reach = Math.pow(Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(nz), 4), 1 / 4);
      if (reach >= 1) continue;
      // Fat in the middle, with spires where the coarse noise peaks.
      const spire = 0.72 + 0.5 * hash3(x >> 2, seed, z >> 2) + 0.12 * hash3(x >> 1, seed + 1, z >> 1);
      const len = Math.round(depth * Math.pow(1 - reach, 0.62) * spire);
      for (let y = 0; y > -len; y--) {
        const deep = -y / depth;
        const c = hash3(x, y, z) < deep * 0.75 ? anyOf(ROCK_DEEP, hash3(x, y, z + 3)) : rockAt(x, y, z, seed + (x - z) * 0.1);
        b.set(x, y, z, c);
      }
    }
  // Roots and creepers hang off the rim.
  for (let i = 0; i < (w + d) * 0.7; i++) {
    const a = rng() * Math.PI * 2;
    const x = Math.round(Math.cos(a) * hx * 0.93), z = Math.round(Math.sin(a) * hz * 0.93);
    const len = 3 + Math.floor(rng() * depth * 0.35);
    const leafy = rng() < 0.5;
    for (let k = 0; k < len; k++) b.set(x, -k, z, leafy ? anyOf(OAK_LEAF, hash3(x, k, z) * 0.6) : BARK[1]);
  }
}

/** Flag on a pole. The pole stands on (0,0,0), the cloth flies toward +X. Voxels are 1/16 m. */
export function buildFlag(b: VoxelBuilder, poleVoxels: number, cloth: string, clothDark: string, stripe: string): void {
  b.cylinderY(0, 0, 0, poleVoxels, 1.6, WOOD_DARK[0]);
  b.paint((x, y) => (y % 7 === 0 ? BARK[1] : (x & 1) === 0 ? WOOD_DARK[1] : undefined));
  b.sphere(0, poleVoxels + 1, 0, 2.2, '#f2c24a');
  const W = 18, H = 11, top = poleVoxels - 2;
  for (let x = 0; x < W; x++) {
    const sway = Math.round(Math.sin(x * 0.42) * 1.5);
    const sag = Math.round(x * 0.08);
    const notch = W - 1 - x < 4 ? 4 - (W - 1 - x) : 0; // swallowtail
    const c = Math.sin(x * 0.42 + 0.9) > 0.45 ? clothDark : cloth;
    for (let y = 0; y < H; y++) {
      if (notch && Math.abs(y - (H - 1) / 2) < notch * 0.8) continue;
      b.set(x + 2, top - y - sag, sway, x < 3 ? stripe : c);
    }
  }
}

/** Glyphs for signs: # is carved. */
export const SIGN_ARROW = ['.....#...', '......#..', '.......#.', '#########', '.......#.', '......#..', '.....#...'];
export const SIGN_PAW = ['..#...#..', '#.......#', '...###...', '..#####..', '..#####..', '...#.#...', '.........'];

/** Wooden sign on a post, board facing +Z, 1/16 m voxels. The post stands on the origin. */
export function buildSign(b: VoxelBuilder, glyph: string[]): void {
  b.box(-1, -2, -1, 1, 15, 1, WOOD_DARK[0]);
  b.paint((x, y, z) => (hash3(x, y >> 1, z) < 0.3 ? WOOD_DARK[1] : undefined));
  const W = 8, H = 4;
  for (let y = 10; y <= 10 + H * 2 + 1; y++)
    for (let x = -W; x <= W; x++) {
      const frame = Math.abs(x) === W || y === 10 || y === 10 + H * 2 + 1;
      // Ragged board ends.
      if (Math.abs(x) === W && hash3(y, 3, 1) < 0.25) continue;
      const row = Math.floor((y - 10) / 3);
      b.set(x, y, 2, frame ? WOOD_DARK[2] : anyOf(WOOD, hash3(row, x >> 3, 2)));
      b.set(x, y, 1, WOOD[3]);
    }
  glyph.forEach((row, r) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') b.set(i - 4, 17 - r, 2, BARK[1]);
  });
  for (const x of [-W + 2, W - 2]) for (const y of [11, 18]) b.set(x, y, 3, '#c9ccd2');
}

/** Dog bowl with kibble, 1/16 m voxels, standing on the origin. */
export function buildBowl(b: VoxelBuilder): void {
  b.cylinderY(0, 0, 0, 1, 3.6, '#2f62b8');
  b.cylinderY(0, 0, 2, 3, 4.1, '#3a78d8');
  b.cylinderY(0, 0, 2, 3, 3, null);
  b.cylinderY(0, 0, 2, 2, 3, '#7a4c2a');
  b.paint((x, y, z) => (y === 2 && hash3(x, y, z) < 0.4 ? '#996338' : undefined));
}

/** Dog kennel with a pitched shingle roof and an arched door toward +Z. Origin at the floor's center, 1/16 m voxels. */
export function buildKennel(b: VoxelBuilder, width: number, height: number, depth: number): void {
  const hw = width >> 1, hd = depth >> 1;
  for (let y = 0; y < height; y++)
    for (let z = -hd; z < hd; z++)
      for (let x = -hw; x < hw; x++) {
        const wall = x === -hw || x === hw - 1 || z === -hd || z === hd - 1;
        if (!wall) b.set(x, y, z, '#3b2a1c');
        else {
          const u = z === -hd || z === hd - 1 ? x : z;
          const seam = (u + hw) % 5 === 0;
          b.set(x, y, z, seam ? BARK[1] : anyOf(WOOD, hash3(Math.floor((u + hw) / 5), 2, 8)));
        }
      }
  // Arched doorway with a dark, hollow inside.
  const doorW = 5, doorH = Math.round(height * 0.72);
  for (let y = 0; y < doorH; y++)
    for (let x = -doorW; x <= doorW; x++) {
      const t = (y - (doorH - doorW)) / doorW;
      if (t > 0 && (x / doorW) ** 2 + t * t > 1) continue;
      b.box(x, y, hd - 5, x, y, hd - 1, null);
      b.set(x, y, hd - 6, '#20150e');
    }
  for (let a = 0; a <= 24; a++) {
    const t = (a / 24) * Math.PI;
    const x = Math.round(Math.cos(t) * (doorW + 1)), y = doorH - doorW + Math.round(Math.sin(t) * (doorW + 1));
    b.set(x, y, hd - 1, WOOD_DARK[0]);
  }
  // Roof: stepped shingles along the ridge, overhanging all round.
  const slopes = hw + 3;
  for (let i = 0; i < slopes; i++) {
    const c = (z: number) => (hash3(i, z >> 2, 4) < 0.5 ? '#a93a33' : '#c04a3f');
    for (const x of [-hw - 3 + i, hw + 2 - i])
      for (let z = -hd - 2; z < hd + 2; z++) {
        b.set(x, height + i - 1, z, (z + i * 2) % 6 === 0 ? '#8c2f2a' : c(z));
        b.set(x, height + i, z, c(z));
      }
    // Gable boards under the slope.
    for (const z of [-hd, hd - 1]) b.box(-hw - 3 + i + 1, height + i - 1, z, hw + 2 - i - 1, height + i - 1, z, WOOD[1]);
  }
  b.box(-1, height + slopes - 1, -hd - 3, 0, height + slopes, hd + 2, '#7c2925');
}
