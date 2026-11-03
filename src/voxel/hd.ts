import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { VoxelModel } from './model';
import { resolveColor } from './palette';
import type { VoxelMeshData } from './mesher';

/**
 * HD voxels (prototype): a render-only refinement of the coarse voxel models.
 * Each coarse voxel is split into `factor`^3 fine voxels with procedural detail
 * picked by material (bevelled stone with mortar, wood grain, sloped shingle
 * roofs, grass with dirt sides and tufts, ragged leaves...), then greedy meshed
 * with per-vertex fine AO times the coarse AO. Physics never sees any of it:
 * colliders and sizes still come from the coarse model, so gameplay is unchanged.
 *
 * Off by default. Turn it on with `?hd=1` (or `?hd=0` to force it off), or
 * `__blockspell.setHD(true)` (saved in localStorage, reloads the page).
 * Only one zone (Ember Village, see HD_REGION) and the objects in HD_OBJECTS
 * get the HD look; everything else keeps the classic mesher.
 */
export const hd = { enabled: readFlag(), factor: 4 };

const STORAGE_KEY = 'blockspell.hd';

function readFlag(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('hd');
    if (q !== null) return q !== '0' && q !== 'off';
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Saves the setting for the next page load. */
export function saveHDSetting(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no storage */
  }
}

/** The HD zone: Ember Village (center and island radius from src/tasks/zones/20-ember.ts, plus a margin). */
export const HD_REGION = { x: 34, z: 0, r: 15 };

/** True if static scenery at this world position gets the HD look. */
export function hdAt(x: number, z: number): boolean {
  return hd.enabled && Math.hypot(x - HD_REGION.x, z - HD_REGION.z) < HD_REGION.r;
}

type Cls = 'grass' | 'dirt' | 'sand' | 'stone' | 'ash' | 'wood' | 'bark' | 'leaf' | 'roof' | 'fur' | 'cloth' | 'metal' | 'ice' | 'plain' | 'glow';

/** Objects that get an HD mesh, with palette keys whose material can't be guessed from the name. */
export const HD_OBJECTS: Record<string, Record<string, Cls>> = {
  hero: { heroHair: 'fur', heroShirt: 'cloth', heroShirtDark: 'cloth', heroPants: 'cloth', heroBelt: 'cloth' },
  hut: { red: 'roof', redDark: 'roof' },
  bush: { bushBerry: 'plain' },
  tree: { treeApple: 'plain' },
  rock: {},
  crate: {},
  barrel: {},
  car: {},
  ice: {},
  bucket: {},
  fire: {},
};

export function hdObject(id: string): Record<string, Cls> | null {
  return hd.enabled ? (HD_OBJECTS[id] ?? null) : null;
}

/** Palette key prefix that marks a roof (Decor uses it); the classic mesher just drops it. */
export const ROOF = 'roof:';

function classify(key: string, overrides?: Record<string, Cls>): Cls {
  if (overrides?.[key]) return overrides[key];
  if (key.startsWith(ROOF)) return 'roof';
  if (resolveColor(key).emissive) return 'glow';
  const k = key.toLowerCase();
  if (k.includes('grass')) return 'grass';
  if (k.includes('dirt')) return 'dirt';
  if (k.includes('sand')) return 'sand';
  if (k.includes('hoop') || k.includes('metal') || k.includes('iron') || k.includes('steel') || k.includes('anvil')) return 'metal';
  if (k.includes('stone') || k.includes('rock') || k.includes('brick')) return 'stone';
  if (k.includes('charcoal') || k.includes('ash')) return 'ash';
  if (k.includes('bark') || k.includes('log')) return 'bark';
  if (k.includes('wood') || k.includes('plank') || k.includes('cardboard') || k.includes('crate') || k.includes('barrel')) return 'wood';
  if (k.includes('leaf') || k.includes('bush') || k.includes('moss')) return 'leaf';
  if (k.includes('fur') || k.includes('wool') || k.includes('hair')) return 'fur';
  if (k.includes('ice') || k.includes('snow')) return 'ice';
  return 'plain';
}

export type HDStyle = 'terrain' | 'decor' | 'object';

export interface HDOptions {
  voxelSize: number;
  origin?: 'center' | 'model';
  style: HDStyle;
  /** Keys used to pick materials (the model's keys before tinting); default model.keys. */
  classKeys?: string[];
  overrides?: Record<string, Cls>;
}

function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** A refined model: a dense fine grid of color ids (0 = empty) into an interned color table. */
interface Fine {
  sx: number;
  sy: number;
  sz: number;
  grid: Uint16Array;
  /** Fine voxels that cast no AO (grass tufts), so the ground around them still merges into big faces. */
  noAO: Set<number>;
  /** Linear rgb per color id - 1. */
  rgb: number[];
  emissive: boolean[];
}

class ColorTable {
  rgb: number[] = [];
  emissive: boolean[] = [];
  private ids = new Map<number, number>();
  id(r: number, g: number, b: number, em: boolean): number {
    const q = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
    const key = ((q(r) << 16) | (q(g) << 8) | q(b)) + (em ? 0x1000000 : 0);
    let id = this.ids.get(key);
    if (id === undefined) {
      if (this.emissive.length >= 65534) return this.emissive.length;
      this.rgb.push(q(r) / 255, q(g) / 255, q(b) / 255);
      this.emissive.push(em);
      id = this.emissive.length;
      this.ids.set(key, id);
    }
    return id;
  }
}

const BEVEL: Record<HDStyle, Set<Cls>> = {
  terrain: new Set(['grass', 'dirt', 'sand', 'stone', 'ash']),
  decor: new Set(['stone', 'wood', 'bark', 'metal', 'ash', 'plain', 'roof']),
  object: new Set(['stone', 'wood', 'bark', 'metal', 'ash', 'plain', 'cloth', 'ice', 'roof', 'fur']),
};

/** Splits every coarse voxel into f^3 fine ones with material detail. */
function refine(model: VoxelModel, f: number, style: HDStyle, classKeys: string[], overrides?: Record<string, Cls>): Fine {
  const { sx, sy, sz } = model;
  const FX = sx * f, FY = sy * f + f, FZ = sz * f; // one coarse layer of headroom for grass tufts
  const grid = new Uint16Array(FX * FY * FZ);
  const colors = new ColorTable();
  const classes = classKeys.map((k) => classify(k, overrides));
  const base = model.keys.map((k) => resolveColor(k.startsWith(ROOF) ? k.slice(ROOF.length) : k));
  const dirt = resolveColor('dirt').color, stone = resolveColor('stone').color, grassLight = resolveColor('grassLight').color;
  const ember = resolveColor('ember').color;
  const at = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : model.grid[x + sx * (y + sy * z)];
  // pattern coordinates follow the model's own voxel coordinates, so baked scenery lines up across pieces
  const [mx, my, mz] = model.min;
  const ex = [false, false, false, false, false, false];
  const t = [0, 0, 0, 0, 0, 0];
  const DIRS = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
  const tufts: number[] = [];
  const noAO = new Set<number>();

  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        const id = model.grid[x + sx * (y + sy * z)];
        if (!id) continue;
        const cls = classes[id - 1];
        const rc = base[id - 1];
        const c = rc.color;
        let exposed = false;
        for (let d = 0; d < 6; d++) {
          ex[d] = !at(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
          exposed ||= ex[d];
        }
        // terrain deep below the surface (the island's underside) stays plain: big faces, few triangles
        const deep = style === 'terrain' && at(x, y + 1, z) && at(x, y + 2, z) && at(x, y + 3, z);
        if (!exposed || cls === 'glow' || deep) {
          const cid = colors.id(c.r, c.g, c.b, rc.emissive);
          for (let c2 = 0; c2 < f; c2++)
            for (let b2 = 0; b2 < f; b2++) {
              const row = x * f + FX * (y * f + b2 + FY * (z * f + c2));
              grid.fill(cid, row, row + f);
            }
          continue;
        }
        const bevel = BEVEL[style].has(cls);
        const cobble = hash3(x + mx, y + my, z + mz);
        for (let c2 = 0; c2 < f; c2++)
          for (let b2 = 0; b2 < f; b2++)
            for (let a2 = 0; a2 < f; a2++) {
              t[0] = a2; t[1] = f - 1 - a2; t[2] = b2; t[3] = f - 1 - b2; t[4] = c2; t[5] = f - 1 - c2;
              let t0 = f;
              for (let d = 0; d < 6; d++) if (ex[d] && t[d] < t0) t0 = t[d];
              // carving
              if (bevel && t0 === 0) {
                let edge = false;
                for (let d1 = 0; d1 < 6 && !edge; d1++)
                  if (ex[d1] && t[d1] === 0) for (let d2 = (d1 | 1) + 1; d2 < 6; d2++) if (ex[d2] && t[d2] === 0) { edge = true; break; }
                if (edge) continue;
              }
              if (cls === 'roof' && ex[3]) {
                let cut = false;
                for (const d of [0, 1, 4, 5]) if (ex[d] && b2 > t[d]) cut = true;
                if (cut) continue;
              }
              const X = x * f + a2, Y = y * f + b2, Z = z * f + c2;
              const WX = mx * f + X, WY = my * f + Y, WZ = mz * f + Z;
              const n1 = hash3(WX, WY, WZ);
              // ragged leaves and fur: carve clumps of 2 fine voxels out of the outer layer
              if (t0 === 0 && (cls === 'leaf' || cls === 'fur') && hash3(WX >> 1, WY >> 1, WZ >> 1) < (cls === 'leaf' ? 0.3 : 0.12)) continue;
              // stone walls: carve mortar joints into the outer layer of the sides
              let side = -1;
              for (const d of [0, 1, 4, 5]) if (ex[d] && t[d] === 0) side = d;
              if (cls === 'stone' && style === 'decor' && side >= 0 && !(ex[3] && t[3] === 0)) {
                const along = side < 2 ? WZ : WX;
                const row = Math.floor(WY / 4);
                if ((WY & 3) === 0 || (along + (row & 1) * 4) % 8 === 0) continue;
              }
              // color
              let r = c.r, g = c.g, bl = c.b;
              const patch = hash3(Math.floor(WX / 3), Math.floor(WY / 3), Math.floor(WZ / 3)) - 0.5;
              let s = 1;
              let em = false;
              // cells on a coarse edge next to the bevel read as worn, lighter edges
              let rim = 0;
              for (let d = 0; d < 6; d++) if (ex[d] && t[d] <= 1) rim++;
              switch (cls) {
                case 'grass': {
                  const hang = 1 + Math.floor(hash3(WX, 7, WZ) * 2.4);
                  if (style === 'terrain' && ex[3] && t[3] >= hang) {
                    r = dirt.r; g = dirt.g; bl = dirt.b;
                    s = 1 + patch * 0.16;
                    if (n1 < 0.04) { r = stone.r; g = stone.g; bl = stone.b; }
                  } else s = 1 + patch * 0.2;
                  break;
                }
                case 'dirt':
                case 'sand':
                  s = 1 + patch * 0.16;
                  if (cls === 'dirt' && n1 < 0.035) { r = stone.r; g = stone.g; bl = stone.b; }
                  break;
                case 'stone':
                  s = 1 + (cobble - 0.5) * 0.18 + patch * 0.1;
                  if (style === 'terrain') s += Math.sin(WY * 0.7) * 0.04;
                  if (rim >= 2) s *= 1.1;
                  break;
                case 'ash':
                  s = 1 + patch * 0.2;
                  if (style !== 'object' && ex[3] && t[3] === 0 && n1 > 0.992) { r = ember.r; g = ember.g; bl = ember.b; s = 1; em = true; }
                  break;
                case 'wood': {
                  const grain = hash3(WY, Math.floor((WX + WZ) / 6), 11);
                  s = 1 + (cobble - 0.5) * 0.1 - (grain < 0.28 ? 0.1 : 0);
                  if (rim >= 2) s *= 1.06;
                  break;
                }
                case 'bark': {
                  const streak = hash3(WX * 3 + WZ * 5, Math.floor(WY / 3), 5);
                  s = 1 - (streak < 0.3 ? 0.16 : 0);
                  break;
                }
                case 'leaf':
                  s = (1 + patch * 0.26 + (n1 - 0.5) * 0.12) * (t0 > 0 ? 0.82 : 1);
                  break;
                case 'roof': {
                  const row = Math.floor(WY / 2);
                  const tab = hash3(Math.floor((WX + WZ + row * 2) / 3), row, 3);
                  s = (row & 1 ? 0.88 : 1) * (1 + (tab - 0.5) * 0.16);
                  break;
                }
                case 'fur':
                  s = 1 + (hash3(WX, Math.floor(WY / 2), WZ) - 0.5) * 0.16;
                  break;
                case 'cloth':
                  s = 1 + patch * 0.06;
                  break;
                case 'metal':
                  s = 1 + (rim >= 2 ? 0.14 : 0);
                  break;
                case 'ice':
                  s = 1 + (hash3(Math.floor((WX + WY) / 2), Math.floor((WZ - WY) / 2), 9) > 0.93 ? 0.12 : 0);
                  break;
                default:
                  s = 1 + patch * 0.05 + (rim >= 2 ? 0.05 : 0);
              }
              const q = Math.round(s * 24) / 24; // few shade steps, so the greedy mesher can merge
              grid[X + FX * (Y + FY * Z)] = colors.id(r * q, g * q, bl * q, em);
              if (cls === 'grass' && style === 'terrain' && ex[3] && t[3] === 0) tufts.push(X, Y, Z);
            }
      }

  // grass tufts (and the odd flower) poking up from the top of the terrain
  const flowers = [resolveColor('flowerYellow').color, resolveColor('flowerRed').color, resolveColor('white').color];
  for (let i = 0; i < tufts.length; i += 3) {
    const X = tufts[i], Y = tufts[i + 1], Z = tufts[i + 2];
    const WX = mx * f + X, WZ = mz * f + Z;
    const n = hash3(WX, 3, WZ);
    const h = n < 0.045 ? 1 : n < 0.065 ? 2 : n < 0.0665 ? 3 : 0;
    const below = grid[X + FX * (Y + FY * Z)];
    if (!h || !below) continue;
    for (let k = 1; k <= h; k++) {
      if (Y + k >= FY) break;
      const i2 = X + FX * (Y + k + FY * Z);
      if (grid[i2]) break;
      const fl = h === 3 && k === 3 ? flowers[Math.floor(hash3(WX, 5, WZ) * 3)] : null;
      const lift = fl ? 1 : 0.92 + k * 0.05;
      const src = fl ?? grassLight;
      grid[i2] = colors.id(src.r * lift, src.g * lift, src.b * lift, false);
      noAO.add(i2);
    }
  }
  return { sx: FX, sy: FY, sz: FZ, grid, noAO, rgb: colors.rgb, emissive: colors.emissive };
}

const AO_COARSE = [0.5, 0.68, 0.84, 1];
const AO_FINE = [0.6, 0.75, 0.88, 1];

/** Greedy mesher for a refined model: one geometry, group 0 lit and group 1 emissive (like meshVoxels). */
function meshFine(fine: Fine, model: VoxelModel, f: number, vs: number, origin: [number, number, number]): BufferGeometry {
  const { sx, sy, sz, grid, noAO, rgb, emissive } = fine;
  const dims = [sx, sy, sz];
  const strides = [1, sx, sx * sy];
  const fv = vs / f;
  const coarse = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= model.sx || y >= model.sy || z >= model.sz ? 0 : model.grid[x + model.sx * (y + model.sy * z)];
  const pos: number[] = [], nrm: number[] = [], col: number[] = [];
  const litIdx: number[] = [], emIdx: number[] = [];
  const p = [0, 0, 0], q = [0, 0, 0], cc = [0, 0, 0];
  const shades = new Float32Array(4);
  const cAO = new Float32Array(4);
  const CORNERS: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3, v = (a + 2) % 3;
    const du = dims[u], dv = dims[v];
    const mask = new Float64Array(du * dv);
    for (const s of [-1, 1]) {
      const corners = s > 0 ? CORNERS : [...CORNERS].reverse();
      const solid = (pa: number, pu: number, pv: number) => {
        if (pa < 0 || pu < 0 || pv < 0 || pa >= dims[a] || pu >= du || pv >= dv) return 0;
        return grid[pa * strides[a] + pu * strides[u] + pv * strides[v]] ? 1 : 0;
      };
      const occluder = (pa: number, pu: number, pv: number) => {
        if (!solid(pa, pu, pv)) return 0;
        return noAO.size && noAO.has(pa * strides[a] + pu * strides[u] + pv * strides[v]) ? 0 : 1;
      };
      for (let d = 0; d < dims[a]; d++) {
        const n = d + s;
        mask.fill(0);
        for (let j = 0; j < dv; j++)
          for (let i = 0; i < du; i++) {
            const id = grid[d * strides[a] + i * strides[u] + j * strides[v]];
            if (!id || solid(n, i, j)) continue;
            const em = emissive[id - 1];
            // coarse AO, bilinear across the coarse face this fine face lies on
            p[a] = d; p[u] = i; p[v] = j;
            cc[0] = Math.floor(p[0] / f); cc[1] = Math.floor(p[1] / f); cc[2] = Math.floor(p[2] / f);
            let coarseFace = false;
            if (!em && coarse(cc[0], cc[1], cc[2])) {
              q[0] = cc[0]; q[1] = cc[1]; q[2] = cc[2]; q[a] += s;
              coarseFace = !coarse(q[0], q[1], q[2]);
              if (coarseFace)
                for (let k = 0; k < 4; k++) {
                  const ddu = CORNERS[k][0] ? 1 : -1, ddv = CORNERS[k][1] ? 1 : -1;
                  q[0] = cc[0]; q[1] = cc[1]; q[2] = cc[2]; q[a] += s; q[u] += ddu;
                  const s1 = coarse(q[0], q[1], q[2]) ? 1 : 0;
                  q[u] -= ddu; q[v] += ddv;
                  const s2 = coarse(q[0], q[1], q[2]) ? 1 : 0;
                  q[u] += ddu;
                  const c3 = coarse(q[0], q[1], q[2]) ? 1 : 0;
                  cAO[k] = AO_COARSE[s1 && s2 ? 0 : 3 - (s1 + s2 + c3)];
                }
            }
            // the coarse AO is sampled once at the fine face's center: a stepped gradient, but whole runs of faces merge
            let faceAO = 1;
            if (coarseFace) {
              const fu = Math.min(1, Math.max(0, (i + 0.5 - cc[u] * f) / f));
              const fw = Math.min(1, Math.max(0, (j + 0.5 - cc[v] * f) / f));
              faceAO = (cAO[0] * (1 - fu) + cAO[1] * fu) * (1 - fw) + (cAO[3] * (1 - fu) + cAO[2] * fu) * fw;
              faceAO = Math.round(faceAO * 16) / 16;
            }
            let packed = 0;
            for (let k = 0; k < 4; k++) {
              const [cu, cv] = corners[k];
              let sh = 1;
              if (!em) {
                const ddu = cu ? 1 : -1, ddv = cv ? 1 : -1;
                const s1 = occluder(n, i + ddu, j), s2 = occluder(n, i, j + ddv), c3 = occluder(n, i + ddu, j + ddv);
                sh = AO_FINE[s1 && s2 ? 0 : 3 - (s1 + s2 + c3)];
                if (coarseFace) sh *= faceAO;
              }
              const qs = Math.round(sh * 32);
              packed = packed * 64 + qs;
            }
            mask[i + j * du] = id * 16777216 + packed;
          }
        // greedy rectangles over equal keys; only faces with uniform shading may merge
        for (let j = 0; j < dv; j++)
          for (let i = 0; i < du; ) {
            const key = mask[i + j * du];
            if (!key) { i++; continue; }
            const packed = key % 16777216;
            const sq = [Math.floor(packed / 262144) % 64, Math.floor(packed / 4096) % 64, Math.floor(packed / 64) % 64, packed % 64];
            const uniform = sq[0] === sq[1] && sq[1] === sq[2] && sq[2] === sq[3];
            let w = 1, h = 1;
            if (uniform) {
              while (i + w < du && mask[i + w + j * du] === key) w++;
              grow: while (j + h < dv) {
                for (let k = 0; k < w; k++) if (mask[i + k + (j + h) * du] !== key) break grow;
                h++;
              }
            }
            for (let jj = 0; jj < h; jj++) for (let k = 0; k < w; k++) mask[i + k + (j + jj) * du] = 0;
            const id = Math.floor(key / 16777216);
            const base = pos.length / 3;
            const plane = d + (s > 0 ? 1 : 0);
            for (let k = 0; k < 4; k++) {
              const [cu, cv] = corners[k];
              p[a] = plane; p[u] = i + cu * w; p[v] = j + cv * h;
              pos.push(origin[0] + p[0] * fv, origin[1] + p[1] * fv, origin[2] + p[2] * fv);
              nrm.push(a === 0 ? s : 0, a === 1 ? s : 0, a === 2 ? s : 0);
              shades[k] = sq[k] / 32;
              const o = (id - 1) * 3;
              col.push(rgb[o] * shades[k], rgb[o + 1] * shades[k], rgb[o + 2] * shades[k]);
            }
            const target = emissive[id - 1] ? emIdx : litIdx;
            if (shades[0] + shades[2] >= shades[1] + shades[3]) target.push(base, base + 1, base + 2, base, base + 2, base + 3);
            else target.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            i += w;
          }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  const vertCount = pos.length / 3;
  const index = vertCount > 65535 ? new Uint32Array(litIdx.length + emIdx.length) : new Uint16Array(litIdx.length + emIdx.length);
  index.set(litIdx, 0);
  index.set(emIdx, litIdx.length);
  geometry.setIndex(new BufferAttribute(index, 1));
  geometry.addGroup(0, litIdx.length, 0);
  if (emIdx.length) geometry.addGroup(litIdx.length, emIdx.length, 1);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  geometry.userData.hd = true;
  return geometry;
}

/** Running totals of what HD meshing built (read by __blockspell.hdStats()). */
export const hdTotals = { meshes: 0, triangles: 0, bytes: 0, ms: 0 };

/**
 * Drop-in for meshVoxels with the HD look: same origin and size (from the coarse
 * model), so it lines up exactly where the classic mesh would be.
 */
export function meshVoxelsHD(model: VoxelModel, opts: HDOptions): VoxelMeshData {
  const t0 = performance.now();
  const f = hd.factor;
  const vs = opts.voxelSize;
  const { sx, sy, sz } = model;
  const origin: [number, number, number] = opts.origin === 'model'
    ? [model.min[0] * vs, model.min[1] * vs, model.min[2] * vs]
    : [-sx * vs * 0.5, -sy * vs * 0.5, -sz * vs * 0.5];
  const fine = refine(model, f, opts.style, opts.classKeys ?? model.keys, opts.overrides);
  const geometry = meshFine(fine, model, f, vs, origin);
  hdTotals.meshes++;
  hdTotals.triangles += (geometry.index?.count ?? 0) / 3;
  hdTotals.bytes += geometryBytes(geometry);
  hdTotals.ms += performance.now() - t0;
  return { geometry, size: new Vector3(sx * vs, sy * vs, sz * vs), hasEmissive: (geometry.groups[1]?.count ?? 0) > 0 };
}

/** GPU buffer bytes of a geometry (attributes + index). */
export function geometryBytes(g: BufferGeometry): number {
  let n = g.index ? g.index.array.byteLength : 0;
  for (const k of Object.keys(g.attributes)) n += (g.attributes[k].array as ArrayLike<number> & { byteLength: number }).byteLength;
  return n;
}
