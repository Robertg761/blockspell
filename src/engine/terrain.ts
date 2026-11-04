import { Body, Box, Vec3, type Material as PhysMaterial } from 'cannon-es';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng, pick, randRange, type Rng } from '../core/rng';
import { VoxelBuilder } from '../voxel/builder';
import { bindVoxelMesh, releaseVoxelMesh } from '../voxel/hd';
import { hash3, meshVoxels } from '../voxel/mesher';
import type { VoxelModel } from '../voxel/model';
import { GroundCover, type CoverItem, type CoverKind } from './cover';
import { addGrain } from './grain';
import { makeNoise2D } from './noise';
import {
  buildBirch, buildBoulder, buildFallenLog, buildOak, buildPine, buildShrub, buildStump,
  DIRT, DIRT_DARK, DRY_GRASS, GRASS, MOSS, PEBBLE, ROCK, ROCK_DEEP, rockAt, tone,
} from './scenery';

export interface TerrainOptions {
  seed: number;
  /** Island radius in meters. */
  radius: number;
  /** Radius of the guaranteed flat play area at y = 0. */
  flatRadius: number;
  /** Size of one terrain voxel in meters. */
  tile: number;
  /** Hill height multiplier. */
  hilliness: number;
  trees: number;
  rocks: number;
  /** Shrubs, stumps and fallen logs out on the hills. */
  shrubs: number;
  /** World x of the island center. */
  cx: number;
  /** World z of the island center. */
  cz: number;
  /**
   * Reshapes the ground (a lake basin, an islet): given a point in island-local meters, returns the
   * ground height there (m, snapped to tiles) and optionally the color of its top voxel, or null to
   * leave it alone.
   */
  carve?: (x: number, z: number) => { h: number; top?: string } | null;
}

export const DEFAULT_TERRAIN: TerrainOptions = {
  seed: 3,
  radius: 20,
  flatRadius: 9,
  tile: 0.5,
  hilliness: 1,
  trees: 9,
  rocks: 10,
  shrubs: 12,
  cx: 0,
  cz: 0,
};

export interface Terrain {
  group: Group;
  bodies: Body[];
  /** The meshes the player can aim at. Ground cover is left out. */
  pickables: Mesh[];
  /** Top surface height at a world position (−Infinity over the void). */
  heightAt(x: number, z: number): number;
  /** Removes grass and flowers from a rectangle, so they don't poke through a level's paths and walls. */
  clearCover(x0: number, z0: number, x1: number, z1: number): void;
  /** Undoes every clearCover. */
  restoreCover(): void;
  dispose(): void;
}

const BOTTOM = -3; // meters; collision boxes extend down to here
const VOID = -999;
/** Visual voxels per collision tile along each axis. */
const FINE = 2;
/** Voxel size of trees, rocks and shrubs. */
const DECOR_VOXEL = 0.125;
/** Below this many fine voxels the island is drawn at tile resolution: nobody gets close to it. */
const FINE_FLOOR = -10;

/** Shade values for columns that aren't plain grass. */
const WORN = -2, BARE = -1;
const PATH = ['#7e5e40', '#8a6846', '#94724e', '#9d7c57'];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Builds a floating voxel island centered at (cx, cz): flat center, rolling hills, trees and rocks. */
export function buildTerrain(opts: Partial<TerrainOptions>, physMat: PhysMaterial): Terrain {
  const o = { ...DEFAULT_TERRAIN, ...opts };
  const rng = makeRng(o.seed);
  const { fbm } = makeNoise2D(rng);
  const T = o.tile;
  const R = o.radius / T;
  const F = o.flatRadius / T;
  const n = Math.ceil(R * 1.1) + 2;
  const W = 2 * n + 1;
  const heights = new Int16Array(W * W).fill(-999); // in tiles; -999 = void
  const hIdx = (i: number, j: number) => i + n + (j + n) * W;
  const tops = new Map<number, string>(); // carved tiles' top colors

  for (let j = -n; j <= n; j++)
    for (let i = -n; i <= n; i++) {
      const d = Math.hypot(i, j);
      const edge = R * (0.88 + 0.22 * fbm(i * 0.05 + 50, j * 0.05 + 50, 2));
      if (d > edge) continue;
      let h = 0;
      if (d > F) {
        const t = Math.min(1, (d - F) / 10);
        const s = t * t * (3 - 2 * t);
        h = Math.round(s * (fbm(i * 0.06, j * 0.06) * 9 - 1.5) * o.hilliness);
        h = Math.max(0, h);
      }
      const cut = o.carve?.((i + 0.5) * T, (j + 0.5) * T) ?? null;
      if (cut) h = Math.round(cut.h / T);
      if (cut?.top) tops.set(hIdx(i, j), cut.top);
      heights[hIdx(i, j)] = h;
    }

  // The surface is drawn at FINE times the resolution of the collision tiles, always
  // at the same height, except that step edges may be worn down by one fine voxel.
  const surface = buildSurface({ heights, tops, n, R, fbm, tile: T });

  const group = new Group();
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  addGrain(mat);
  const terrainMesh = bindVoxelMesh(new Mesh(undefined, mat), { model: surface.model, voxelSize: T / FINE, origin: 'model', style: 'terrain', jitter: 0.035, openBottom: true, lod: true, label: 'terrain' });
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'terrain';
  group.add(terrainMesh);
  const coreMesh = bindVoxelMesh(new Mesh(undefined, mat), { model: surface.core, voxelSize: T, origin: 'model', style: 'terrain', jitter: 0.05, openTop: true, lod: true, label: 'terrain-core' });
  group.add(coreMesh);

  // --- collision: 2D greedy rectangles of equal height ---
  const bodies: Body[] = [];
  const shadowBoxes: BufferGeometry[] = [];
  const used = new Uint8Array(W * W);
  for (let j = -n; j <= n; j++)
    for (let i = -n; i <= n; i++) {
      const h = heights[hIdx(i, j)];
      if (h === -999 || used[hIdx(i, j)]) continue;
      let i1 = i;
      while (i1 + 1 <= n && heights[hIdx(i1 + 1, j)] === h && !used[hIdx(i1 + 1, j)]) i1++;
      let j1 = j;
      grow: while (j1 + 1 <= n) {
        for (let ii = i; ii <= i1; ii++) if (heights[hIdx(ii, j1 + 1)] !== h || used[hIdx(ii, j1 + 1)]) break grow;
        j1++;
      }
      for (let jj = j; jj <= j1; jj++) for (let ii = i; ii <= i1; ii++) used[hIdx(ii, jj)] = 1;
      const top = h * T;
      const hx = ((i1 - i + 1) * T) / 2, hz = ((j1 - j + 1) * T) / 2, hy = (top - BOTTOM) / 2;
      const body = new Body({ mass: 0, material: physMat, type: Body.STATIC });
      body.addShape(new Box(new Vec3(hx, hy, hz)));
      body.position.set(o.cx + i * T + hx, BOTTOM + hy, o.cz + j * T + hz);
      bodies.push(body);
      shadowBoxes.push(new BoxGeometry(hx * 2, hy * 2, hz * 2).translate(i * T + hx, BOTTOM + hy, j * T + hz));
    }

  // local (island-centered) height lookup; the world one below subtracts the center
  const localHeight = (x: number, z: number) => {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    if (Math.abs(i) > n || Math.abs(j) > n) return -Infinity;
    const h = heights[hIdx(i, j)];
    return h === -999 ? -Infinity : h * T;
  };

  // --- decor: trees, rocks and shrubs on the hills (finer voxels) ---
  // `rng` keeps deciding where things go, so a seed's layout and tree colliders stay
  // put. How each thing looks comes from `looks`.
  const DV = 0.25;
  const SUB = DV / DECOR_VOXEL;
  const looks = makeRng(o.seed + 7001);
  const decor = new VoxelBuilder();
  const placeRing = (minFrac: number, random: Rng = rng) => {
    for (let tries = 0; tries < 50; tries++) {
      const a = random() * Math.PI * 2;
      const r = randRange(random, o.flatRadius + 2, o.radius * minFrac);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = localHeight(x, z);
      if (h > -1) return { x, z, h };
    }
    return null;
  };
  for (let t = 0; t < o.trees; t++) {
    const p = placeRing(0.85);
    if (!p) continue;
    const cx = Math.round(p.x / DV), cz = Math.round(p.z / DV);
    const trunkH = 6 + Math.floor(rng() * 5);
    const lr = 3 + rng() * 1.5;
    rng(); // the second canopy lobe's offset, kept so later placements don't move
    const species = looks();
    const height = trunkH * SUB + Math.round(lr);
    const tree = species < 0.5 ? buildOak(looks, height) : species < 0.8 ? buildPine(looks, height) : buildBirch(looks, height);
    decor.merge(tree, (cx + 1) * SUB, Math.round(p.h / DECOR_VOXEL), (cz + 1) * SUB);
    const tb = new Body({ mass: 0, material: physMat, type: Body.STATIC });
    tb.addShape(new Box(new Vec3(DV, (trunkH * DV) / 2, DV)));
    tb.position.set(o.cx + (cx + 1) * DV, p.h + (trunkH * DV) / 2, o.cz + (cz + 1) * DV);
    bodies.push(tb);
  }
  for (let r = 0; r < o.rocks; r++) {
    const p = placeRing(0.95);
    if (!p) continue;
    const s = 1 + rng() * 1.6;
    rng(); // used to pick the rock's color
    decor.merge(buildBoulder(looks, s * SUB), Math.round(p.x / DECOR_VOXEL), Math.round(p.h / DECOR_VOXEL), Math.round(p.z / DECOR_VOXEL));
  }
  for (let k = 0; k < o.shrubs; k++) {
    const p = placeRing(0.92, looks);
    if (!p) continue;
    const roll = looks();
    const model = roll < 0.62 ? buildShrub(looks, pick(looks, [undefined, '#d8413f', '#f4f1ea', '#f0a6c0'])) : roll < 0.82 ? buildStump(looks) : buildFallenLog(looks);
    decor.merge(model, Math.round(p.x / DECOR_VOXEL), Math.round(p.h / DECOR_VOXEL), Math.round(p.z / DECOR_VOXEL));
  }
  hangCreepers(decor, surface, T / FINE / DECOR_VOXEL);
  const pickables = [terrainMesh];
  if (decor.size > 0) {
    const dm = bindVoxelMesh(new Mesh(undefined, mat), { model: decor.build(), voxelSize: DECOR_VOXEL, origin: 'model', style: 'decor', ao: 0.55, lod: true, label: 'terrain-decor' });
    dm.name = 'terrain-decor';
    dm.receiveShadow = true;
    group.add(dm);
    pickables.push(dm);
  }

  // Shadows don't need the detail: the ground casts from its collision boxes,
  // and trees and rocks from a half-resolution copy of themselves.
  const shadowMat = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const shadowOf = (geometry: BufferGeometry) => {
    const m = new Mesh(geometry, shadowMat);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const ground = mergeGeometries(shadowBoxes);
  for (const g of shadowBoxes) g.dispose();
  const shadows = [shadowOf(ground)];
  if (decor.size > 0) {
    const coarse = new VoxelBuilder();
    decor.paint((x, y, z) => {
      coarse.set(x >> 1, y >> 1, z >> 1, '#000000');
      return undefined;
    });
    shadows.push(shadowOf(meshVoxels(coarse.build(), { voxelSize: DECOR_VOXEL * 2, origin: 'model', ao: 0, jitter: 0 }).geometry));
  }

  const cover = new GroundCover(scatterCover(makeRng(o.seed + 9103), o, surface, fbm));
  group.add(cover.group);

  group.position.set(o.cx, 0, o.cz);
  return {
    group,
    bodies,
    pickables,
    heightAt: (x, z) => localHeight(x - o.cx, z - o.cz),
    clearCover: (x0, z0, x1, z1) => cover.clearRect(x0 - o.cx, z0 - o.cz, x1 - o.cx, z1 - o.cz),
    restoreCover: () => cover.restore(),
    dispose() {
      for (const m of [...pickables, coreMesh]) releaseVoxelMesh(m);
      for (const m of shadows) m.geometry.dispose();
      cover.dispose();
      mat.dispose();
      shadowMat.dispose();
    },
  };
}

type Fbm = (x: number, y: number, oct?: number) => number;

interface Surface {
  /** The fine shell of the island, from the grass down to FINE_FLOOR. */
  model: VoxelModel;
  /** The rest of the rock, at tile resolution. */
  core: VoxelModel;
  /** Half-open column ranges in fine voxels, VOID where there is no island. */
  top: Int16Array;
  bottom: Int16Array;
  /** Per-column tone of the top voxel, 0..1, or WORN or BARE. */
  shade: Float32Array;
  /** Fine columns from the center to one side. */
  half: number;
  width: number;
  size: number;
}

/** Fills a dense voxel grid directly: an island has far too many voxels for a VoxelBuilder. */
function buildSurface(t: { heights: Int16Array; tops: Map<number, string>; n: number; R: number; fbm: Fbm; tile: number }): Surface {
  const { heights, tops, n, R, fbm } = t;
  const tileW = 2 * n + 1;
  const half = n * FINE;
  const width = tileW * FINE;
  const col = (I: number, J: number) => I + half + (J + half) * width;
  const tileAt = (I: number, J: number) => {
    const i = Math.floor(I / FINE), j = Math.floor(J / FINE);
    if (Math.abs(i) > n || Math.abs(j) > n) return VOID;
    return heights[i + n + (j + n) * tileW];
  };
  const carvedTop = (I: number, J: number) => tops.get(Math.floor(I / FINE) + n + (Math.floor(J / FINE) + n) * tileW);

  const top = new Int16Array(width * width).fill(VOID);
  const bottom = new Int16Array(width * width).fill(VOID);
  const shade = new Float32Array(width * width);
  // Depth of the rock core per tile, in tiles; 0 where the fine shell reaches the bottom.
  const coreDepth = new Int16Array(tileW * tileW);
  const i2 = (I: number, J: number) => I / FINE + n + (J / FINE + n) * tileW;
  let minY = 0, maxY = 0;
  for (let J = -half; J < width - half; J++)
    for (let I = -half; I < width - half; I++) {
      const h = tileAt(I, J);
      if (h === VOID) continue;
      const fi = (I + 0.5) / FINE, fj = (J + 0.5) / FINE;
      const d = Math.hypot(fi, fj);
      const edge = R * (0.88 + 0.22 * fbm(fi * 0.05 + 50, fj * 0.05 + 50, 2));
      const lower = Math.min(tileAt(I + 1, J), tileAt(I - 1, J), tileAt(I, J + 1), tileAt(I, J - 1));
      // Wear the corners of hill steps and the island's rim so contour lines wander.
      let y = h * FINE;
      if (lower < h && fbm(I * 0.31 + 11, J * 0.31 + 5, 2) > 0.44) y -= 1;
      const depth = (4 + (1 - Math.min(1, d / edge)) * 14 + fbm(fi * 0.15 + 9, fj * 0.15, 2) * 6) * FINE;
      const spires = (fbm(fi * 0.45 + 3, fj * 0.45 + 13, 2) - 0.5) * 16;
      const low = -Math.max(4, Math.round(depth + spires + hash3(I, 31, J) * 2));
      top[col(I, J)] = y;
      bottom[col(I, J)] = Math.min(Math.max(low, FINE_FLOOR), y - 4); // a basin can dip below the fine shell
      if (I % FINE === 0 && J % FINE === 0 && low < FINE_FLOOR) coreDepth[i2(I, J)] = Math.floor(low / FINE);
      if (bottom[col(I, J)] < minY) minY = bottom[col(I, J)];
      if (y > maxY) maxY = y;

      const patches = (fbm(fi * 0.045 + 20, fj * 0.045, 3) - 0.5) * 1.5 + (fbm(fi * 0.2 + 7, fj * 0.2 + 3, 2) - 0.5) * 1.3;
      shade[col(I, J)] = 0.52 + patches + (hash3(I, 5, J) - 0.5) * 0.3;
      // Worn spots: dry grass thinning to earth, with a dithered edge between them.
      const wear = fbm(fi * 0.17 + 31, fj * 0.17 + 11, 3) + (hash3(I, 8, J) - 0.5) * 0.05;
      if (d > 3 && wear > 0.745) shade[col(I, J)] = BARE;
      else if (d > 3 && wear > 0.7) shade[col(I, J)] = WORN;
      if (carvedTop(I, J)) shade[col(I, J)] = BARE; // no meadow on a beach or a lake bed
    }

  const sy = maxY - minY + 1;
  const keys: string[] = [];
  const ids = new Map<string, number>();
  const id = (c: string) => {
    let k = ids.get(c);
    if (k === undefined) {
      keys.push(c);
      ids.set(c, (k = keys.length));
    }
    return k;
  };
  const grid = new Uint8Array(width * sy * width);
  const solid = id(ROCK_DEEP[0]);
  let count = 0;

  for (let J = -half; J < width - half; J++)
    for (let I = -half; I < width - half; I++) {
      const c = col(I, J);
      const y1 = top[c], y0 = bottom[c];
      if (y1 === VOID) continue;
      const neighbors = [c + 1, c - 1, c + width, c - width].filter((k) => k >= 0 && k < top.length);
      // Only voxels the eye can reach need a real color.
      let sideTop = y1, sideBottom = y0;
      for (const k of neighbors) {
        sideTop = Math.min(sideTop, top[k] === VOID ? y0 : top[k]);
        sideBottom = Math.max(sideBottom, top[k] === VOID ? y1 : bottom[k]);
      }
      const fi = (I + 0.5) / FINE, fj = (J + 0.5) / FINE;
      const d = Math.hypot(fi, fj) / R;
      const warp = fbm(fi * 0.09 + 70, fj * 0.09, 2) * 14;
      const soil = 5 + Math.round(fbm(fi * 0.3 + 40, fj * 0.3 + 2, 2) * 7);
      const bare = shade[c] === BARE;
      const carved = carvedTop(I, J);
      const parched = smoothstep(0.72, 1, d) * 0.55 + smoothstep(2, 9, y1) * 0.5;
      const lawn = shade[c] === WORN || hash3(I, 4, J) < parched ? tone(DRY_GRASS, hash3(I, 6, J)) : tone(GRASS, shade[c]);
      for (let y = y0; y < y1; y++) {
        const at = I + half + width * (y - minY + sy * (J + half));
        count++;
        if (y < sideTop && y >= sideBottom && y !== y1 - 1 && y !== y0) {
          grid[at] = solid;
          continue;
        }
        const down = y1 - 1 - y;
        const n = hash3(I, y, J);
        let color: string;
        if (down === 0) color = carved ?? (bare ? tone(PATH, n) : lawn);
        else if (down === 1 && !bare && n < 0.55) color = GRASS[1];
        else if (down === 2 && !bare && n < 0.16) color = GRASS[0];
        else if (down < soil) color = n < 0.09 ? DIRT_DARK : n > 0.965 ? PEBBLE : DIRT[Math.floor(hash3(I >> 1, y, J >> 1) * 4) % 4];
        else {
          color = rockAt(I, y, J, warp);
          if (down < soil + 3 && hash3(I >> 1, y >> 1, J >> 1) < 0.12) color = MOSS[Math.floor(n * 9) % 3];
        }
        grid[at] = id(color);
      }
    }

  return {
    model: { sx: width, sy, sz: width, min: [-half, minY, -half], keys, grid, count },
    core: buildCore(coreDepth, n),
    top, bottom, shade, half, width, size: t.tile / FINE,
  };
}

/** Strata of rock hanging from the fine shell, one voxel per tile. */
function buildCore(depth: Int16Array, n: number): VoxelModel {
  const W = 2 * n + 1;
  const ceiling = FINE_FLOOR / FINE;
  let lowest = ceiling;
  for (const d of depth) if (d < lowest) lowest = d;
  const sy = Math.max(1, ceiling - lowest);
  const keys = [...ROCK_DEEP, ...ROCK];
  const grid = new Uint8Array(W * sy * W);
  let count = 0;
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const d = depth[i + j * W];
      if (d === 0) continue;
      for (let y = d; y < ceiling; y++) {
        const band = Math.floor(y / 2);
        const key = y - d < 2 ? Math.floor(hash3(i, y, j) * ROCK_DEEP.length) : ROCK_DEEP.length + Math.floor(hash3(band, 9, 4) * ROCK.length);
        grid[i + W * (y - lowest + sy * j)] = key + 1;
        count++;
      }
    }
  return { sx: W, sy, sz: W, min: [-n, lowest, -n], keys, grid, count };
}

/** Roots and creepers dangling from the island's rim. */
function hangCreepers(decor: VoxelBuilder, s: Surface, scale: number): void {
  const { top, half, width } = s;
  const steps: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let J = -half + 1; J < width - half - 1; J++)
    for (let I = -half + 1; I < width - half - 1; I++) {
      const y1 = top[I + half + (J + half) * width];
      if (y1 === VOID || hash3(I, 77, J) > 0.11) continue;
      const out = steps.find(([dx, dz]) => top[I + dx + half + (J + dz + half) * width] === VOID);
      if (!out) continue;
      const x = I * scale + (out[0] > 0 ? scale : out[0] < 0 ? -1 : 0);
      const z = J * scale + (out[1] > 0 ? scale : out[1] < 0 ? -1 : 0);
      const leafy = hash3(I, 78, J) < 0.6;
      const len = 4 + Math.floor(hash3(I, 79, J) * 14);
      for (let k = 0; k < len; k++) {
        const y = y1 * scale - 1 - k;
        decor.set(x, y, z, leafy ? tone(GRASS, hash3(I, k, J) * 0.45) : '#5f3f27');
        if (leafy && hash3(k, I, J) < 0.3) decor.set(x + out[0], y, z + out[1], GRASS[2]);
      }
    }
}

/** Grass in meadows, flowers in drifts of one species, pebbles and toadstools here and there. */
function scatterCover(rng: Rng, o: TerrainOptions, s: Surface, fbm: Fbm): CoverItem[] {
  const { top, shade, half, width, size } = s;
  const items: CoverItem[] = [];
  const flowers: CoverKind[] = ['daisy', 'buttercup', 'poppy', 'bluebell'];
  const STEP = 0.56;
  const extent = o.radius * 1.15;
  for (let z = -extent; z < extent; z += STEP)
    for (let x = -extent; x < extent; x += STEP) {
      const px = x + (rng() - 0.5) * STEP, pz = z + (rng() - 0.5) * STEP;
      const roll = rng(), tintRoll = rng();
      const I = Math.floor(px / size), J = Math.floor(pz / size);
      if (I < -half || J < -half || I >= width - half || J >= width - half) continue;
      const c = I + half + (J + half) * width;
      if (top[c] === VOID) continue;
      const y = top[c] * size;
      const tint = 0.82 + Math.max(0, shade[c]) * 0.34 + tintRoll * 0.1;
      if (shade[c] < 0) {
        if (shade[c] === BARE && roll < 0.1) items.push({ kind: 'pebbles', x: px, y, z: pz, tint: 0.9 + tintRoll * 0.2 });
        continue;
      }
      // Thinner far out, where a tuft is only a few pixels anyway.
      const out = Math.hypot(px, pz) - o.flatRadius;
      if (out > 3 && rng() < 0.45) continue;
      const meadow = fbm(px * 0.24 + 3, pz * 0.24 + 41, 2);
      const drift = fbm(px * 0.16 + 90, pz * 0.16 + 17, 2);
      if (drift > 0.62 && roll < 0.6) {
        const species = flowers[Math.floor(fbm(px * 0.05 + 12, pz * 0.05 + 60, 2) * 8) % flowers.length];
        items.push({ kind: species, x: px, y, z: pz, tint: 0.9 + tintRoll * 0.2 });
      } else if (roll < 0.006) items.push({ kind: 'toadstool', x: px, y, z: pz, tint: 1 });
      else if (roll < 0.035) items.push({ kind: 'pebbles', x: px, y, z: pz, tint: 0.9 + tintRoll * 0.2 });
      else if (roll < 0.1) items.push({ kind: 'clover', x: px, y, z: pz, tint });
      else if (roll < (out < 0 ? 0.2 : 0.4) + meadow * 0.5) items.push({ kind: meadow > 0.55 ? 'tuftTall' : 'tuftShort', x: px, y, z: pz, tint });
    }
  return items;
}
