import { Group, Mesh, MeshStandardMaterial } from 'three';
import { makeRng, randRange } from '../core/rng';
import { VoxelBuilder } from '../voxel/builder';
import { meshVoxels } from '../voxel/mesher';

/** A ring of chunky voxel clouds that slowly drift around the island. */
export class Clouds {
  readonly group = new Group();
  private items: { mesh: Mesh; speed: number; radius: number; angle: number }[] = [];

  constructor(seed = 7, count = 14) {
    const rng = makeRng(seed);
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35 });
    for (let i = 0; i < count; i++) {
      const b = new VoxelBuilder();
      const blobs = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < blobs; k++) {
        const r = randRange(rng, 1.6, 3);
        b.ellipsoid(k * 2.6 + rng() * 1.5, rng() * 1.2, rng() * 2.5, r * 1.3, r * 0.7, r, 'cloud');
      }
      b.paint((_x, y, _z) => (y < 0 ? '#e4ecf5' : undefined));
      const { geometry } = meshVoxels(b.build(), { voxelSize: 1.6, ao: 0.5, jitter: 0.01 });
      const mesh = new Mesh(geometry, mat);
      const item = { mesh, speed: randRange(rng, 0.004, 0.012), radius: randRange(rng, 55, 140), angle: rng() * Math.PI * 2 };
      mesh.position.y = randRange(rng, 22, 45);
      mesh.rotation.y = rng() * Math.PI;
      this.items.push(item);
      this.group.add(mesh);
    }
    this.update(0);
  }

  update(dt: number): void {
    for (const c of this.items) {
      c.angle += c.speed * dt;
      c.mesh.position.x = Math.cos(c.angle) * c.radius;
      c.mesh.position.z = Math.sin(c.angle) * c.radius;
    }
  }
}
