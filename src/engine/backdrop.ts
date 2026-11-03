import { Group, Mesh, MeshStandardMaterial } from 'three';
import { makeRng, randRange, type Rng } from '../core/rng';
import { VoxelBuilder } from '../voxel/builder';
import { hash3, meshVoxels } from '../voxel/mesher';
import { GRASS, ROCK } from './scenery';

const VOXEL = 0.75;

function buildIslet(rng: Rng): VoxelBuilder {
  const b = new VoxelBuilder();
  const r = randRange(rng, 4, 8);
  const seed = Math.floor(rng() * 1000);
  for (let x = -Math.ceil(r); x <= r; x++)
    for (let z = -Math.ceil(r); z <= r; z++) {
      const d = Math.hypot(x, z) / r + (hash3(x >> 1, seed, z >> 1) - 0.5) * 0.25;
      if (d >= 1) continue;
      const depth = Math.round((1 - d) * r * (0.9 + hash3(x >> 1, seed + 1, z >> 1) * 0.9)) + 1;
      for (let y = 0; y > -depth; y--) b.set(x, y, z, y === 0 ? GRASS[3] : y === -1 ? '#8c5f3d' : ROCK[Math.floor(hash3(0, y >> 1, seed) * ROCK.length)]);
    }
  // A hump and a couple of tree silhouettes break up the flat top.
  const trees = Math.floor(r / 3);
  for (let i = 0; i < trees; i++) {
    const a = rng() * Math.PI * 2, d = rng() * r * 0.6;
    const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d);
    b.box(x, 1, z, x, 3, z, '#6e4a2e');
    b.ellipsoid(x + 0.5, 5, z + 0.5, 2.4, 2.8, 2.4, GRASS[0]);
  }
  return b;
}

/** Far-off floating islets. Fog softens them into silhouettes, giving the sky some depth. */
export function createBackdrop(seed = 11, count = 9): Group {
  const group = new Group();
  const rng = makeRng(seed);
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  for (let i = 0; i < count; i++) {
    const mesh = new Mesh(meshVoxels(buildIslet(rng).build(), { voxelSize: VOXEL, ao: 0.7 }).geometry, mat);
    const a = (i / count) * Math.PI * 2 + rng() * 0.5, d = randRange(rng, 100, 140);
    mesh.position.set(Math.cos(a) * d, randRange(rng, -16, 8), Math.sin(a) * d);
    mesh.rotation.y = rng() * Math.PI;
    group.add(mesh);
  }
  return group;
}
