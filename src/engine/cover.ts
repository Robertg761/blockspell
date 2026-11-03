import { BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { Rng } from '../core/rng';

/**
 * Ground cover: grass tufts, wildflowers, toadstools and pebbles. There are
 * thousands of these, so each kind is one small shared geometry drawn as an
 * InstancedMesh. They are purely cosmetic and take no part in physics or picking.
 */
export type CoverKind = 'tuftShort' | 'tuftTall' | 'clover' | 'daisy' | 'poppy' | 'buttercup' | 'bluebell' | 'toadstool' | 'pebbles';

export interface CoverItem {
  kind: CoverKind;
  x: number;
  y: number;
  z: number;
  /** Multiplies the model's colors, so tufts can follow the grass tone beneath them. */
  tint: number;
}

/** A column in centimeters: x, base y, z, width, height, depth, base color, top color. */
type Piece = [number, number, number, number, number, number, string, string?];

const blade = (x: number, z: number, h: number, root: string, tip: string): Piece => [x, 0, z, 4, h, 4, root, tip];

/** A stem with a cross of petals and a raised center. */
const bloom = (x: number, z: number, h: number, petal: string, heart: string): Piece[] => [
  [x, 0, z, 2, h, 2, '#3f8f35', '#57a844'],
  [x - 4, h, z - 1, 10, 2.5, 4, petal],
  [x - 1, h, z - 4, 4, 2.5, 10, petal],
  [x - 1, h + 2.5, z - 1, 4, 1, 4, heart],
];

const ROOT = '#3f8a33', ROOT_DEEP = '#357a30', TIP = '#74be4a', TIP_PALE = '#88cb54';

const MODELS: Record<CoverKind, Piece[]> = {
  tuftShort: [
    blade(-8, -3, 9, ROOT, TIP), blade(-2, 4, 13, ROOT, TIP), blade(3, -7, 8, ROOT_DEEP, TIP), blade(7, 2, 11, ROOT, TIP_PALE),
  ],
  tuftTall: [
    blade(-11, 1, 13, ROOT_DEEP, TIP), blade(-5, -6, 19, ROOT, TIP_PALE), blade(0, 3, 24, ROOT, TIP_PALE),
    blade(6, -3, 17, ROOT, TIP), blade(10, 6, 12, ROOT_DEEP, TIP),
  ],
  clover: [
    [-8, 0, -6, 7, 3, 7, '#3f8f3a', '#5fb24c'], [1, 0, -9, 7, 4, 7, '#3f8f3a', '#68ba52'],
    [-3, 0, 2, 7, 3, 7, '#3f8f3a', '#5fb24c'], [6, 0, 3, 6, 5, 6, '#3f8f3a', '#73c35a'],
    [7, 5, 4, 4, 2, 4, '#f4f1ea'],
  ],
  daisy: [...bloom(-6, 3, 12, '#fbf8ef', '#ffd24a'), ...bloom(6, -5, 8, '#fbf8ef', '#ffd24a')],
  poppy: [...bloom(-4, -4, 15, '#ef4a4a', '#3a2020'), ...bloom(7, 5, 10, '#e23c3c', '#3a2020')],
  buttercup: [...bloom(-5, 5, 9, '#ffd93b', '#f2a31c'), ...bloom(4, -6, 13, '#ffe25c', '#f2a31c')],
  bluebell: [...bloom(-3, -2, 13, '#7d7bf0', '#d8d4ff'), ...bloom(7, 6, 9, '#9a6ff0', '#e4d4ff')],
  toadstool: [
    [-1.5, 0, -1.5, 3, 5, 3, '#efe4cc'], [-4.5, 5, -4.5, 9, 2, 9, '#c93a35'], [-3, 7, -3, 6, 2, 6, '#d9473f'], [-1.5, 9, -1.5, 3, 1, 3, '#d9473f'],
    [-3, 7, 1, 1.5, 2.5, 1.5, '#fbf3e4'], [1, 7, -3, 1.5, 2.5, 1.5, '#fbf3e4'],
    [6, 0, 4, 2, 3, 2, '#efe4cc'], [4.5, 3, 2.5, 5, 2, 5, '#b5683c'],
  ],
  pebbles: [
    [-9, 0, -4, 9, 5, 7, '#8a8b93', '#a2a3a9'], [2, 0, 1, 6, 4, 6, '#777881', '#8f9098'], [-3, 0, 7, 5, 3, 4, '#9a9ba2', '#b0b0b4'],
  ],
};

/** Merges upright boxes into one geometry: no bottom faces, colors fade from base to top. */
function piecesGeometry(pieces: Piece[]): BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [];
  const a = new Color(), b = new Color();
  const quad = (corners: number[][], normal: number[], colors: Color[]) => {
    const base = pos.length / 3;
    corners.forEach((c, i) => {
      pos.push(c[0] / 100, c[1] / 100, c[2] / 100);
      nrm.push(normal[0], normal[1], normal[2]);
      col.push(colors[i].r, colors[i].g, colors[i].b);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // Sides lean toward "up" so tufts pick up the same light as the ground they stand on.
  const lean = 0.42, up = 0.91;
  for (const [x, y, z, w, h, d, c0, c1] of pieces) {
    a.set(c0);
    b.set(c1 ?? c0);
    const x1 = x + w, y1 = y + h, z1 = z + d;
    const sides = [a, a, b, b];
    quad([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], [0, up, lean], sides);
    quad([[x1, y, z], [x, y, z], [x, y1, z], [x1, y1, z]], [0, up, -lean], sides);
    quad([[x1, y, z1], [x1, y, z], [x1, y1, z], [x1, y1, z1]], [lean, up, 0], sides);
    quad([[x, y, z], [x, y, z1], [x, y1, z1], [x, y1, z]], [-lean, up, 0], sides);
    quad([[x, y1, z1], [x1, y1, z1], [x1, y1, z], [x, y1, z]], [0, 1, 0], [b, b, b, b]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  return g;
}

// Shared by every GroundCover and kept for the life of the page.
const geometries = new Map<CoverKind, BufferGeometry>();
const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

function geometryFor(kind: CoverKind): BufferGeometry {
  let g = geometries.get(kind);
  if (!g) geometries.set(kind, (g = piecesGeometry(MODELS[kind])));
  return g;
}

const HIDDEN = new Matrix4().makeScale(0, 0, 0);
const QUARTER_TURNS = [0, 1, 2, 3].map((k) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (k * Math.PI) / 2));

interface CoverSet {
  mesh: InstancedMesh;
  items: CoverItem[];
  matrices: Matrix4[];
}

export class GroundCover {
  readonly group = new Group();
  private sets: CoverSet[] = [];
  private hiding = false;

  constructor(items: CoverItem[]) {
    const byKind = new Map<CoverKind, CoverItem[]>();
    for (const it of items) {
      const list = byKind.get(it.kind);
      if (list) list.push(it);
      else byKind.set(it.kind, [it]);
    }
    const color = new Color(), p = new Vector3(), s = new Vector3(1, 1, 1);
    for (const [kind, list] of byKind) {
      const mesh = new InstancedMesh(geometryFor(kind), material, list.length);
      mesh.receiveShadow = true;
      const matrices = list.map((it, i) => {
        // The turn comes from the position, so an item looks the same on every rebuild.
        const turn = QUARTER_TURNS[Math.floor(Math.abs(it.x * 37 + it.z * 91)) % 4];
        const m = new Matrix4().compose(p.set(it.x, it.y, it.z), turn, s);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, color.setScalar(it.tint));
        return m;
      });
      this.group.add(mesh);
      this.sets.push({ mesh, items: list, matrices });
    }
  }

  /** Hides everything inside a rectangle, e.g. the footprint of a level's path or wall. */
  clearRect(x0: number, z0: number, x1: number, z1: number): void {
    for (const { mesh, items } of this.sets) {
      let touched = false;
      items.forEach((it, i) => {
        if (it.x < x0 || it.x > x1 || it.z < z0 || it.z > z1) return;
        mesh.setMatrixAt(i, HIDDEN);
        touched = true;
      });
      if (touched) {
        mesh.instanceMatrix.needsUpdate = true;
        this.hiding = true;
      }
    }
  }

  /** Undoes every clearRect. */
  restore(): void {
    if (!this.hiding) return;
    for (const { mesh, matrices } of this.sets) {
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.hiding = false;
  }

  dispose(): void {
    for (const { mesh } of this.sets) mesh.dispose();
  }
}

/** Grass and clover for a small grassy surface such as the top of a cliff block. */
export function scatterTufts(rng: Rng, x0: number, z0: number, x1: number, z1: number, y: number): CoverItem[] {
  const items: CoverItem[] = [];
  for (let z = z0; z < z1; z += 0.4)
    for (let x = x0; x < x1; x += 0.4) {
      const r = rng(), px = x + rng() * 0.3, pz = z + rng() * 0.3;
      if (r > 0.62 || px > x1 || pz > z1) continue;
      const kind: CoverKind = r < 0.32 ? 'tuftShort' : r < 0.47 ? 'tuftTall' : r < 0.55 ? 'clover' : r < 0.59 ? 'daisy' : 'buttercup';
      items.push({ kind, x: px, y, z: pz, tint: 0.85 + rng() * 0.3 });
    }
  return items;
}
