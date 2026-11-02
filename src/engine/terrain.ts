import { Body, Box, Vec3, type Material as PhysMaterial } from 'cannon-es';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { makeRng, randRange } from '../core/rng';
import { VoxelBuilder } from '../voxel/builder';
import { meshVoxels } from '../voxel/mesher';
import { makeNoise2D } from './noise';

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
}

export const DEFAULT_TERRAIN: TerrainOptions = {
  seed: 3,
  radius: 20,
  flatRadius: 9,
  tile: 0.5,
  hilliness: 1,
  trees: 9,
  rocks: 10,
};

export interface Terrain {
  group: Group;
  bodies: Body[];
  /** Top surface height at a world position (−Infinity over the void). */
  heightAt(x: number, z: number): number;
  dispose(): void;
}

const BOTTOM = -3; // meters; collision boxes extend down to here

/** Builds a floating voxel island: flat center, rolling hills, trees and rocks. */
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

  const b = new VoxelBuilder();
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
      heights[hIdx(i, j)] = h;
      const depth = Math.round(4 + (1 - d / edge) * 14 + fbm(i * 0.15 + 9, j * 0.15, 2) * 6);
      const grassTone = fbm(i * 0.12 + 20, j * 0.12, 2);
      for (let y = -depth; y < h; y++) {
        let c: string;
        if (y === h - 1) c = grassTone > 0.62 ? 'grassLight' : grassTone < 0.38 ? 'grassDark' : 'grass';
        else if (y >= h - 3) c = (i * 7 + y * 13 + j * 3) % 11 === 0 ? 'dirtDark' : 'dirt';
        else c = (i * 5 + y * 11 + j * 17) % 7 === 0 ? 'stoneDark' : 'stone';
        b.set(i, y, j, c);
      }
    }

  const group = new Group();
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const terrainMesh = new Mesh(meshVoxels(b.build(), { voxelSize: T, origin: 'model', jitter: 0.05 }).geometry, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  terrainMesh.name = 'terrain';
  group.add(terrainMesh);

  // --- collision: 2D greedy rectangles of equal height ---
  const bodies: Body[] = [];
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
      body.position.set(i * T + hx, BOTTOM + hy, j * T + hz);
      bodies.push(body);
    }

  const heightAt = (x: number, z: number) => {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    if (Math.abs(i) > n || Math.abs(j) > n) return -Infinity;
    const h = heights[hIdx(i, j)];
    return h === -999 ? -Infinity : h * T;
  };

  // --- decor: trees and rocks on the hills (finer voxels) ---
  const DV = 0.25;
  const decor = new VoxelBuilder();
  const placeRing = (minFrac: number) => {
    for (let tries = 0; tries < 50; tries++) {
      const a = rng() * Math.PI * 2;
      const r = randRange(rng, o.flatRadius + 2, o.radius * minFrac);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h > -1) return { x, z, h };
    }
    return null;
  };
  for (let t = 0; t < o.trees; t++) {
    const p = placeRing(0.85);
    if (!p) continue;
    const cx = Math.round(p.x / DV), cz = Math.round(p.z / DV), cy = Math.round(p.h / DV);
    const trunkH = 6 + Math.floor(rng() * 5);
    decor.box(cx, cy, cz, cx + 1, cy + trunkH, cz + 1, 'bark');
    const lr = 3 + rng() * 1.5;
    decor.ellipsoid(cx + 1, cy + trunkH + lr * 0.6, cz + 1, lr + 0.5, lr, lr + 0.5, 'leaf');
    decor.ellipsoid(cx + 1 + rng() * 2 - 1, cy + trunkH + lr * 1.3, cz + 1, lr * 0.7, lr * 0.6, lr * 0.7, 'leafDark');
    const tb = new Body({ mass: 0, material: physMat, type: Body.STATIC });
    tb.addShape(new Box(new Vec3(DV, (trunkH * DV) / 2, DV)));
    tb.position.set((cx + 1) * DV, p.h + (trunkH * DV) / 2, (cz + 1) * DV);
    bodies.push(tb);
  }
  for (let r = 0; r < o.rocks; r++) {
    const p = placeRing(0.95);
    if (!p) continue;
    const cx = Math.round(p.x / DV), cz = Math.round(p.z / DV), cy = Math.round(p.h / DV);
    const s = 1 + rng() * 1.6;
    decor.ellipsoid(cx, cy, cz, s * 1.3, s, s, rng() > 0.5 ? 'stone' : 'stoneDark');
  }
  if (decor.size > 0) {
    const dm = new Mesh(meshVoxels(decor.build(), { voxelSize: DV, origin: 'model' }).geometry, mat);
    dm.castShadow = true;
    dm.receiveShadow = true;
    group.add(dm);
  }

  return {
    group,
    bodies,
    heightAt,
    dispose() {
      group.traverse((c) => {
        if (c instanceof Mesh) c.geometry.dispose();
      });
      mat.dispose();
    },
  };
}
