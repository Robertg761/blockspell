import { Body, Box, Material as PhysMaterial, Sphere, Vec3 } from 'cannon-es';
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three';
import type { SpawnModifiers } from '../adjectives/types';
import type { ObjectDef } from '../objects/types';
import { VoxelBuilder } from '../voxel/builder';
import { decomposeBoxes } from '../voxel/decompose';
import { meshVoxels } from '../voxel/mesher';
import { remapModel } from '../voxel/model';
import { makeTintMap, resolveColor } from '../voxel/palette';
import { Entity } from './entity';
import { makeRng } from './rng';

/** Builds the mesh + physics body for an object definition with modifiers applied. */
export function createEntity(def: ObjectDef, mods: SpawnModifiers, label: string, seed = Math.random() * 1e9): Entity {
  const rng = makeRng(seed);
  const builder = new VoxelBuilder();
  def.build(builder, rng);
  let model = builder.build();

  if (mods.tint) {
    const keys = def.tintKeys ?? model.keys.filter((k) => !resolveColor(k).emissive);
    model = remapModel(model, makeTintMap(keys, mods.tint));
  }

  const vs = (def.voxelSize ?? 0.1) * mods.scale;
  const { geometry, size } = meshVoxels(model, { voxelSize: vs });
  const materials: Material[] = [
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 }),
    new MeshBasicMaterial({ vertexColors: true }),
  ];
  const mesh = new Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const visual = new Group();
  visual.add(mesh);
  const root = new Group();
  root.add(visual);

  const phys = def.physics ?? {};
  const physMat = new PhysMaterial(def.id);
  physMat.friction = mods.friction ?? phys.friction ?? 0.5;
  physMat.restitution = mods.restitution ?? phys.restitution ?? 0.15;
  const mass = (phys.mass ?? 1) * mods.scale ** 3 * mods.massMul;
  const body = new Body({
    mass,
    material: physMat,
    linearDamping: phys.linearDamping ?? 0.05,
    angularDamping: phys.angularDamping ?? 0.15,
    allowSleep: true,
    sleepSpeedLimit: 0.15,
    sleepTimeLimit: 0.8,
  });
  const shape = phys.shape ?? 'auto';
  if (shape === 'sphere') {
    body.addShape(new Sphere(Math.max(size.x, size.y, size.z) / 2));
  } else if (shape === 'box') {
    body.addShape(new Box(new Vec3(size.x / 2, size.y / 2, size.z / 2)));
  } else {
    for (const bx of decomposeBoxes(model, phys.maxBoxes ?? 8)) {
      const he = new Vec3(((bx.max[0] - bx.min[0]) * vs) / 2, ((bx.max[1] - bx.min[1]) * vs) / 2, ((bx.max[2] - bx.min[2]) * vs) / 2);
      const off = new Vec3(
        ((bx.min[0] + bx.max[0]) / 2) * vs - size.x / 2,
        ((bx.min[1] + bx.max[1]) / 2) * vs - size.y / 2,
        ((bx.min[2] + bx.max[2]) / 2) * vs - size.z / 2,
      );
      body.addShape(new Box(he), off);
    }
  }
  if (phys.uprightOnly) body.angularFactor.set(0, 1, 0);

  const e = new Entity(def, body, { root, visual, mesh, materials }, size, mods.scale, label);
  for (const t of def.tags) e.tags.add(t);
  for (const t of mods.addTags) e.tags.add(t);
  for (const t of mods.removeTags) e.tags.delete(t);
  Object.assign(e.state, mods.flags, mods.state);
  return e;
}
