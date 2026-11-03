import { resolveColor } from './palette';

/**
 * HD voxel meshing core: pure functions on plain data, so it runs the same in
 * a Web Worker (src/voxel/hd-worker.ts) or on the main thread.
 *
 * Each coarse voxel is split into FACTOR^3 fine voxels with procedural detail
 * picked by material (bevelled stone with mortar, wood grain, sloped shingle
 * roofs, grass with dirt sides, ragged leaves...), then greedy meshed with
 * per-vertex fine AO times the coarse AO. Grass gets thin blades as extra
 * geometry. The output is packed: integer positions in SUB units of a fine
 * voxel (Int16), Int8 normals and Uint8 colors, 12 bytes per vertex. The mesh
 * that shows it is scaled by voxelSize / (FACTOR * SUB), see src/voxel/hd.ts.
 */

/** Fine voxels per coarse voxel along each axis. */
export const FACTOR = 4;
/** Position units per fine voxel (so grass blades can be thinner than a fine voxel). */
export const SUB = 4;

export type Cls = 'grass' | 'dirt' | 'sand' | 'stone' | 'ash' | 'wood' | 'bark' | 'leaf' | 'roof' | 'fur' | 'cloth' | 'metal' | 'ice' | 'plain' | 'glow';
export type HDStyle = 'terrain' | 'decor' | 'object';

/** Palette key prefix that marks a roof (Decor uses it); the classic mesher just drops it. */
export const ROOF = 'roof:';

/** What a worker needs to mesh one model. */
export interface HDJob {
  sx: number;
  sy: number;
  sz: number;
  min: [number, number, number];
  grid: Uint8Array;
  /** Linear r, g, b and emissive (0/1) per model key. */
  colors: number[][];
  /** Material per model key (from the keys before tinting). */
  classes: Cls[];
  style: HDStyle;
  origin: 'center' | 'model';
  /** The few fixed colors the detail uses (see FIXED_COLORS). */
  fixed: Record<string, [number, number, number]>;
}

/** Palette colors the HD detail paints with (dirt sides, pebbles, embers, grass blades, flowers). */
export function FIXED_COLORS(): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  for (const k of ['dirt', 'stone', 'ember', 'grassLight', 'flowerYellow', 'flowerRed', 'white']) {
    const c = resolveColor(k).color;
    out[k] = [c.r, c.g, c.b];
  }
  return out;
}

export interface HDArrays {
  /** Int16 normally; Float32 if a coordinate does not fit (never in practice). */
  position: Int16Array | Float32Array;
  normal: Int8Array;
  color: Uint8Array;
  index: Uint16Array | Uint32Array;
  /** Index counts of group 0 (lit) and group 1 (emissive). */
  lit: number;
  em: number;
  /** Bounds in position units: min xyz, max xyz. */
  box: [number, number, number, number, number, number];
  ms: number;
}

export function classify(key: string, overrides?: Record<string, Cls>): Cls {
  if (overrides?.[key]) return overrides[key];
  if (key.startsWith(ROOF)) return 'roof';
  if (resolveColor(key).emissive) return 'glow';
  const k = key.toLowerCase();
  if (k.includes('grass')) return 'grass';
  if (k.includes('dirt') || k.includes('soil') || k.includes('mud')) return 'dirt';
  if (k.includes('sand')) return 'sand';
  if (k.includes('hoop') || k.includes('metal') || k.includes('iron') || k.includes('steel') || k.includes('anvil') || k.includes('chrome')) return 'metal';
  if (k.includes('stone') || k.includes('rock') || k.includes('brick') || k.includes('cobble')) return 'stone';
  if (k.includes('charcoal') || k.includes('ash')) return 'ash';
  if (k.includes('bark') || k.includes('log') || k.includes('trunk')) return 'bark';
  if (k.includes('wood') || k.includes('plank') || k.includes('cardboard') || k.includes('crate') || k.includes('barrel') || k.includes('straw') || k.includes('hay')) return 'wood';
  if (k.includes('leaf') || k.includes('bush') || k.includes('moss') || k.includes('hedge')) return 'leaf';
  if (k.includes('fur') || k.includes('wool') || k.includes('hair') || k.includes('mane') || k.includes('feather')) return 'fur';
  if (k.includes('ice') || k.includes('snow')) return 'ice';
  return 'plain';
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
  /** Linear rgb per color id - 1. */
  rgb: number[];
  emissive: boolean[];
  /** Grass blade sites: fine x, y (the grass cell), z, then a color id of the cell. */
  blades: number[];
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

const DIRS = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];

/** Splits every coarse voxel into f^3 fine ones with material detail. */
function refine(job: HDJob, f: number): Fine {
  const { sx, sy, sz, style } = job;
  const FX = sx * f, FY = sy * f, FZ = sz * f;
  const grid = new Uint16Array(FX * FY * FZ);
  const colors = new ColorTable();
  const classes = job.classes;
  const rgb = (c: [number, number, number]) => ({ r: c[0], g: c[1], b: c[2] });
  const base = job.colors.map((c) => ({ color: { r: c[0], g: c[1], b: c[2] }, emissive: c[3] > 0 }));
  const dirt = rgb(job.fixed.dirt), stone = rgb(job.fixed.stone), ember = rgb(job.fixed.ember);
  const mg = job.grid;
  const at = (x: number, y: number, z: number) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : mg[x + sx * (y + sy * z)]);
  // pattern coordinates follow the model's own voxel coordinates, so baked scenery lines up across pieces
  const [mx, my, mz] = job.min;
  const ex = [false, false, false, false, false, false];
  const t = [0, 0, 0, 0, 0, 0];
  const blades: number[] = [];
  // walkable styles keep sharp top edges: a bevel there would show the hero standing on air
  const topBevel = style === 'object';

  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        const id = mg[x + sx * (y + sy * z)];
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
              // carving: one fine voxel off the outer edges
              if (bevel && t0 === 0) {
                let edge = false;
                for (let d1 = 0; d1 < 6 && !edge; d1++) {
                  if (!ex[d1] || t[d1] !== 0 || (d1 === 3 && !topBevel)) continue;
                  for (let d2 = (d1 | 1) + 1; d2 < 6; d2++) if (ex[d2] && t[d2] === 0 && (d2 !== 3 || topBevel)) { edge = true; break; }
                }
                if (edge) continue;
              }
              // sloped roof edges: a shallow chamfer (at most half a voxel deep at the very edge), so things
              // resting on a roof don't hover visibly above it
              if (cls === 'roof' && ex[3]) {
                let cut = false;
                for (const d of [0, 1, 4, 5]) if (ex[d] && b2 - t[d] >= f >> 1) cut = true;
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
              const cid = colors.id(r * q, g * q, bl * q, em);
              grid[X + FX * (Y + FY * Z)] = cid;
              if (cls === 'grass' && style === 'terrain' && ex[3] && t[3] === 0 && !at(x, y + 1, z)) blades.push(X, Y, Z, cid);
            }
      }
  return { sx: FX, sy: FY, sz: FZ, grid, rgb: colors.rgb, emissive: colors.emissive, blades };
}

const AO_COARSE = [0.5, 0.68, 0.84, 1];
const AO_FINE = [0.6, 0.75, 0.88, 1];

/** Growable typed output buffers (number[] pushes are slow and memory hungry for big terrain). */
class Out {
  pos = new Int32Array(1 << 14);
  nrm = new Int8Array(1 << 14);
  col = new Uint8Array(1 << 14);
  verts = 0;
  lit: number[] = [];
  em: number[] = [];
  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, r: number, g: number, b: number): number {
    const i = this.verts * 3;
    if (i + 3 > this.pos.length) {
      const grow = <T extends Int32Array | Int8Array | Uint8Array>(a: T): T => {
        const n = new (a.constructor as new (n: number) => T)(a.length * 2);
        n.set(a);
        return n;
      };
      this.pos = grow(this.pos); this.nrm = grow(this.nrm); this.col = grow(this.col);
    }
    this.pos[i] = x; this.pos[i + 1] = y; this.pos[i + 2] = z;
    this.nrm[i] = nx * 127; this.nrm[i + 1] = ny * 127; this.nrm[i + 2] = nz * 127;
    this.col[i] = Math.min(255, Math.round(r * 255)); this.col[i + 1] = Math.min(255, Math.round(g * 255)); this.col[i + 2] = Math.min(255, Math.round(b * 255));
    return this.verts++;
  }
}

/** Greedy mesher for a refined model: group 0 lit and group 1 emissive (like meshVoxels). */
function meshFine(fine: Fine, job: HDJob, f: number, origin: [number, number, number], out: Out): void {
  const { sx, sy, sz, grid, rgb, emissive } = fine;
  const dims = [sx, sy, sz];
  const strides = [1, sx, sx * sy];
  const S = SUB;
  const mg = job.grid;
  const coarse = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= job.sx || y >= job.sy || z >= job.sz ? 0 : mg[x + job.sx * (y + job.sy * z)];
  const p = [0, 0, 0], q = [0, 0, 0], cc = [0, 0, 0];
  const shades = new Float32Array(4);
  const cAO = new Float32Array(4);
  const CORNERS: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const sq = [0, 0, 0, 0];

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
      for (let d = 0; d < dims[a]; d++) {
        const n = d + s;
        let any = false;
        for (let j = 0; j < dv; j++)
          for (let i = 0; i < du; i++) {
            const id = grid[d * strides[a] + i * strides[u] + j * strides[v]];
            if (!id || solid(n, i, j)) { mask[i + j * du] = 0; continue; }
            any = true;
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
                const s1 = solid(n, i + ddu, j), s2 = solid(n, i, j + ddv), c3 = solid(n, i + ddu, j + ddv);
                sh = AO_FINE[s1 && s2 ? 0 : 3 - (s1 + s2 + c3)];
                if (coarseFace) sh *= faceAO;
              }
              const qs = Math.round(sh * 32);
              packed = packed * 64 + qs;
            }
            mask[i + j * du] = id * 16777216 + packed;
          }
        if (!any) continue;
        // greedy rectangles over equal keys; only faces with uniform shading may merge
        for (let j = 0; j < dv; j++)
          for (let i = 0; i < du; ) {
            const key = mask[i + j * du];
            if (!key) { i++; continue; }
            const packed = key % 16777216;
            sq[0] = Math.floor(packed / 262144) % 64; sq[1] = Math.floor(packed / 4096) % 64; sq[2] = Math.floor(packed / 64) % 64; sq[3] = packed % 64;
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
            const plane = d + (s > 0 ? 1 : 0);
            const o = (id - 1) * 3;
            let base = 0;
            for (let k = 0; k < 4; k++) {
              const [cu, cv] = corners[k];
              p[a] = plane; p[u] = i + cu * w; p[v] = j + cv * h;
              shades[k] = sq[k] / 32;
              const vi = out.vert(origin[0] + p[0] * S, origin[1] + p[1] * S, origin[2] + p[2] * S, a === 0 ? s : 0, a === 1 ? s : 0, a === 2 ? s : 0,
                rgb[o] * shades[k], rgb[o + 1] * shades[k], rgb[o + 2] * shades[k]);
              if (k === 0) base = vi;
            }
            const target = emissive[id - 1] ? out.em : out.lit;
            if (shades[0] + shades[2] >= shades[1] + shades[3]) target.push(base, base + 1, base + 2, base, base + 2, base + 3);
            else target.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            i += w;
          }
      }
    }
  }
}

/**
 * Grass blades: thin (one SUB unit, 3 cm on terrain) tufts of 1 to 3 blades on a few percent of the grass
 * cells, plus the odd flower. Separate geometry, so they don't break up the ground's big merged faces.
 */
function meshBlades(fine: Fine, job: HDJob, f: number, origin: [number, number, number], out: Out): void {
  const S = SUB;
  const rgb = (c: [number, number, number]) => ({ r: c[0], g: c[1], b: c[2] });
  const light = rgb(job.fixed.grassLight);
  const flowers = [rgb(job.fixed.flowerYellow), rgb(job.fixed.flowerRed), rgb(job.fixed.white)];
  const [mx, , mz] = job.min;
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, lo: number[], hi: number[]) => {
    // 4 sides and the top; the bottom sits on the ground
    const quads: [number, number, number, number[]][] = [
      [-1, 0, 0, [x0, y0, z1, x0, y0, z0, x0, y1, z0, x0, y1, z1]],
      [1, 0, 0, [x1, y0, z0, x1, y0, z1, x1, y1, z1, x1, y1, z0]],
      [0, 0, -1, [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0]],
      [0, 0, 1, [x1, y0, z1, x0, y0, z1, x0, y1, z1, x1, y1, z1]],
      [0, 1, 0, [x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1]],
    ];
    // every face uses the ground's up normal: thin blades then light like the lawn around them
    // instead of reading as dark stubble
    for (const [, , , c] of quads) {
      const b = out.verts;
      for (let k = 0; k < 4; k++) {
        const top = c[k * 3 + 1] === y1;
        const col = top ? hi : lo;
        out.vert(c[k * 3], c[k * 3 + 1], c[k * 3 + 2], 0, 1, 0, col[0], col[1], col[2]);
      }
      out.lit.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  };
  const bl = fine.blades;
  for (let i = 0; i < bl.length; i += 4) {
    const X = bl[i], Y = bl[i + 1], Z = bl[i + 2], cid = bl[i + 3];
    const WX = mx * f + X, WZ = mz * f + Z;
    const n = hash3(WX, 3, WZ);
    if (n > 0.05) continue;
    const o = (cid - 1) * 3;
    const lo = [fine.rgb[o] * 0.92, fine.rgb[o + 1] * 0.92, fine.rgb[o + 2] * 0.92];
    const y0 = origin[1] + (Y + 1) * S;
    const count = 1 + Math.floor(hash3(WX, 4, WZ) * 3);
    for (let k = 0; k < count; k++) {
      const hx = hash3(WX, 10 + k, WZ), hz = hash3(WX, 20 + k, WZ), hh = hash3(WX, 30 + k, WZ);
      const x0 = origin[0] + X * S + Math.floor(hx * S), z0 = origin[2] + Z * S + Math.floor(hz * S);
      const tall = 2 + Math.floor(hh * 4);
      const hi = [light.r * (1.05 + hh * 0.15), light.g * (1.05 + hh * 0.15), light.b * (1.05 + hh * 0.15)];
      box(x0, y0, z0, x0 + 1, y0 + tall, z0 + 1, lo, hi);
    }
    if (n < 0.008) {
      // a flower: a stem and a small head
      const fl = flowers[Math.floor(hash3(WX, 5, WZ) * 3)];
      const x0 = origin[0] + X * S + 1, z0 = origin[2] + Z * S + 1;
      box(x0, y0, z0, x0 + 1, y0 + 5, z0 + 1, lo, lo);
      const c = [fl.r, fl.g, fl.b];
      box(x0 - 1, y0 + 5, z0 - 1, x0 + 2, y0 + 7, z0 + 2, c, c);
    }
  }
}

/** Meshes one model with the HD look into packed arrays (positions in SUB units of a fine voxel). */
export function meshHD(job: HDJob): HDArrays {
  const t0 = performance.now();
  const f = FACTOR;
  const S = SUB;
  const origin: [number, number, number] = job.origin === 'model'
    ? [job.min[0] * f * S, job.min[1] * f * S, job.min[2] * f * S]
    : [(-job.sx * f * S) / 2, (-job.sy * f * S) / 2, (-job.sz * f * S) / 2];
  const fine = refine(job, f);
  const out = new Out();
  meshFine(fine, job, f, origin, out);
  if (fine.blades.length) meshBlades(fine, job, f, origin, out);

  const nv = out.verts;
  const box: [number, number, number, number, number, number] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv * 3; i += 3)
    for (let k = 0; k < 3; k++) {
      const c = out.pos[i + k];
      if (c < box[k]) box[k] = c;
      if (c > box[k + 3]) box[k + 3] = c;
    }
  if (!nv) box.fill(0);
  const fits = box[0] >= -32768 && box[1] >= -32768 && box[2] >= -32768 && box[3] <= 32767 && box[4] <= 32767 && box[5] <= 32767;
  const position = fits ? new Int16Array(out.pos.subarray(0, nv * 3)) : new Float32Array(out.pos.subarray(0, nv * 3));
  const index = nv > 65535 ? new Uint32Array(out.lit.length + out.em.length) : new Uint16Array(out.lit.length + out.em.length);
  index.set(out.lit, 0);
  index.set(out.em, out.lit.length);
  return {
    position,
    normal: out.nrm.slice(0, nv * 3),
    color: out.col.slice(0, nv * 3),
    index,
    lit: out.lit.length,
    em: out.em.length,
    box,
    ms: performance.now() - t0,
  };
}
