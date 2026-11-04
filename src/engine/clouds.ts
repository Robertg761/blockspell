import { Group, Mesh, MeshStandardMaterial, type Color } from 'three';
import { makeRng, randRange } from '../core/rng';
import { VoxelBuilder } from '../voxel/builder';
import { meshVoxels } from '../voxel/mesher';

// Bright crowns fading to a cool, shaded belly.
const CLOUD_TONES = ['#d6e0ee', '#e2e9f3', '#eef2f8', '#f9fbfd', '#ffffff'];
const VOXEL = 1;

/** A cumulus: flat-bottomed, heaped in the middle, with little puffs breaking off the edges. */
function buildCloud(rng: () => number): VoxelBuilder {
  const b = new VoxelBuilder();
  const length = randRange(rng, 8, 16);
  const puffs = 5 + Math.floor(rng() * 5);
  for (let k = 0; k < puffs; k++) {
    const t = k / (puffs - 1);
    const heap = Math.sin(t * Math.PI);
    const r = randRange(rng, 2.2, 3.4) + heap * 2.6;
    b.ellipsoid((t - 0.5) * length * 2, heap * 2.5 + rng() * 1.2, randRange(rng, -2.5, 2.5), r * 1.25, r * 0.85, r, 'cloud');
  }
  for (let k = 0; k < 4; k++) {
    const side = rng() < 0.5 ? -1 : 1;
    b.sphere(side * (length + randRange(rng, 1, 4)), rng() * 2, randRange(rng, -3, 3), randRange(rng, 0.9, 1.7), 'cloud');
  }
  const base = -2;
  b.paint((_x, y) => (y < base ? null : undefined));
  const top = 9;
  b.paint((_x, y) => CLOUD_TONES[Math.min(CLOUD_TONES.length - 1, Math.max(0, Math.floor(((y - base) / (top - base)) * 7)))]);
  return b;
}

/** A ring of voxel clouds that slowly drift around the island. */
export class Clouds {
  readonly group = new Group();
  private mat: MeshStandardMaterial;
  private items: { mesh: Mesh; speed: number; radius: number; angle: number }[] = [];

  constructor(seed = 7, count = 15) {
    const rng = makeRng(seed);
    const mat = (this.mat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.5 }));
    for (let i = 0; i < count; i++) {
      const { geometry } = meshVoxels(buildCloud(rng).build(), { voxelSize: VOXEL, ao: 0.3, jitter: 0.006 });
      const mesh = new Mesh(geometry, mat);
      const item = { mesh, speed: randRange(rng, 0.004, 0.012), radius: randRange(rng, 50, 135), angle: rng() * Math.PI * 2 };
      mesh.position.y = randRange(rng, 20, 44);
      mesh.rotation.y = rng() * Math.PI;
      this.items.push(item);
      this.group.add(mesh);
    }
    this.update(0);
  }

  /** Time of day: how much the clouds glow by themselves and the color they are lit with. */
  setLight(glow: number, tint: Color): void {
    this.mat.emissiveIntensity = glow;
    this.mat.emissive.copy(tint);
    this.mat.color.copy(tint);
  }

  update(dt: number): void {
    for (const c of this.items) {
      c.angle += c.speed * dt;
      c.mesh.position.x = Math.cos(c.angle) * c.radius;
      c.mesh.position.z = Math.sin(c.angle) * c.radius;
    }
  }
}
