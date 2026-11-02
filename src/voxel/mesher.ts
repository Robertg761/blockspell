import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { VoxelModel } from './model';
import { voxelAt } from './model';
import { resolveColor } from './palette';

export interface MeshOptions {
  /** World size of one voxel. */
  voxelSize: number;
  /**
   * 'center' puts the model's bounding-box center at the origin (dynamic objects);
   * 'model' keeps voxel (x,y,z) at world (min + x) * voxelSize (terrain, statics).
   */
  origin?: 'center' | 'model';
  /** Per-voxel brightness jitter amplitude, gives a hand-made look. */
  jitter?: number;
  /** Strength of baked ambient occlusion (0..1). */
  ao?: number;
}

export interface VoxelMeshData {
  geometry: BufferGeometry;
  /** World-space dimensions of the model's bounding box. */
  size: Vector3;
  /** True if the geometry contains an emissive group (material index 1). */
  hasEmissive: boolean;
}

interface FaceDef {
  axis: number;
  sign: number;
  normal: [number, number, number];
  /** Four corners as (u, v) in {0,1}, CCW seen from outside. */
  corners: [number, number][];
  u: number;
  v: number;
}

const FACES: FaceDef[] = [];
for (let axis = 0; axis < 3; axis++) {
  for (const sign of [-1, 1]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const n: [number, number, number] = [0, 0, 0];
    n[axis] = sign;
    const ccw: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    FACES.push({ axis, sign, normal: n, u, v, corners: sign > 0 ? ccw : [...ccw].reverse() });
  }
}

const AO_CURVE = [0.5, 0.68, 0.84, 1];

function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Greedy-free but face-culled mesher with baked per-vertex AO and vertex colors.
 * Produces a single BufferGeometry with two groups: 0 = lit, 1 = emissive.
 * Object models are small (≤ ~40³), so this is plenty fast and yields one draw
 * call per material per object.
 */
export function meshVoxels(model: VoxelModel, opts: MeshOptions): VoxelMeshData {
  const vs = opts.voxelSize;
  const jitter = opts.jitter ?? 0.04;
  const aoStrength = opts.ao ?? 1;
  const { sx, sy, sz } = model;
  const ox = opts.origin === 'model' ? model.min[0] * vs : -sx * vs * 0.5;
  const oy = opts.origin === 'model' ? model.min[1] * vs : -sy * vs * 0.5;
  const oz = opts.origin === 'model' ? model.min[2] * vs : -sz * vs * 0.5;

  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const litIdx: number[] = [];
  const emIdx: number[] = [];
  const resolved = model.keys.map(resolveColor);

  const p = [0, 0, 0];
  const q = [0, 0, 0];
  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        const id = model.grid[x + sx * (y + sy * z)];
        if (!id) continue;
        const rc = resolved[id - 1];
        const j = 1 + (hash3(x + model.min[0], y + model.min[1], z + model.min[2]) - 0.5) * 2 * jitter;
        for (const f of FACES) {
          p[0] = x; p[1] = y; p[2] = z;
          p[f.axis] += f.sign;
          if (voxelAt(model, p[0], p[1], p[2])) continue;
          const base = pos.length / 3;
          const ao: number[] = [];
          for (const [cu, cv] of f.corners) {
            q[0] = x; q[1] = y; q[2] = z;
            q[f.axis] += f.sign > 0 ? 1 : 0;
            q[f.u] += cu;
            q[f.v] += cv;
            pos.push(ox + q[0] * vs, oy + q[1] * vs, oz + q[2] * vs);
            nrm.push(f.normal[0], f.normal[1], f.normal[2]);
            let shade = 1;
            if (!rc.emissive && aoStrength > 0) {
              // neighbors in the layer just outside this face
              const du = cu ? 1 : -1, dv = cv ? 1 : -1;
              const s1 = [p[0], p[1], p[2]]; s1[f.u] += du;
              const s2 = [p[0], p[1], p[2]]; s2[f.v] += dv;
              const cc = [p[0], p[1], p[2]]; cc[f.u] += du; cc[f.v] += dv;
              const a = voxelAt(model, s1[0], s1[1], s1[2]) ? 1 : 0;
              const b = voxelAt(model, s2[0], s2[1], s2[2]) ? 1 : 0;
              const c = voxelAt(model, cc[0], cc[1], cc[2]) ? 1 : 0;
              const level = a && b ? 0 : 3 - (a + b + c);
              ao.push(level);
              shade = 1 - (1 - AO_CURVE[level]) * aoStrength;
            } else ao.push(3);
            const k = shade * (rc.emissive ? 1 + (j - 1) * 2 : j);
            col.push(rc.color.r * k, rc.color.g * k, rc.color.b * k);
          }
          const target = rc.emissive ? emIdx : litIdx;
          // flip the quad diagonal to avoid AO interpolation artifacts
          if (ao[0] + ao[2] >= ao[1] + ao[3]) target.push(base, base + 1, base + 2, base, base + 2, base + 3);
          else target.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
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

  return { geometry, size: new Vector3(sx * vs, sy * vs, sz * vs), hasEmissive: emIdx.length > 0 };
}
