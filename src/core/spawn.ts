import { Body, Box, Material as PhysMaterial, Sphere, Vec3 } from 'cannon-es';
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3, type Material } from 'three';
import type { SpawnModifiers } from '../adjectives/types';
import type { ObjectDef } from '../objects/types';
import { VoxelBuilder } from '../voxel/builder';
import { decomposeBoxes } from '../voxel/decompose';
import { meshVoxels } from '../voxel/mesher';
import { remapModel } from '../voxel/model';
import { makeTintMap, resolveColor } from '../voxel/palette';
import { Entity } from './entity';
import { GROUP } from './groups';
import { envMap } from '../engine/env';
import { makeRng } from './rng';

/** Builds the mesh + physics body for an object definition with modifiers applied. */
export function createEntity(def: ObjectDef, mods: SpawnModifiers, label: string, seed = Math.random() * 1e9): Entity {
  const rng = makeRng(seed);
  const builder = new VoxelBuilder();
  def.build(builder, rng);
  const partBuilders = (def.parts ?? []).map((part) => {
    const pb = new VoxelBuilder();
    part.build(pb, rng);
    return { part, pb };
  });
  const visible = builder.build();
  // the whole body: what the object measures and collides as, solid parts included
  const solidParts = partBuilders.filter(({ part }) => part.solid);
  let model = solidParts.length ? solidParts.reduce((b, { pb }) => b.merge(pb), new VoxelBuilder().merge(builder)).build() : visible;

  const tintMap = mods.tint ? makeTintMap(def.tintKeys ?? model.keys.filter((k) => !resolveColor(k).emissive), mods.tint) : null;
  if (tintMap) model = remapModel(model, tintMap);

  const vs = (def.voxelSize ?? 0.1) * mods.scale;
  const size = new Vector3(model.sx * vs, model.sy * vs, model.sz * vs);
  const { geometry } = meshVoxels(tintMap ? remapModel(visible, tintMap) : visible, { voxelSize: vs });
  // with solid parts split off, the main mesh no longer spans the whole body: keep it where it was
  if (solidParts.length) {
    const off = (axis: 0 | 1 | 2, n: 'sx' | 'sy' | 'sz') => (visible.min[axis] + visible[n] / 2 - model.min[axis] - model[n] / 2) * vs;
    geometry.translate(off(0, 'sx'), off(1, 'sy'), off(2, 'sz'));
  }
  const materials: Material[] = [
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: (mods.flags.roughness as number | undefined) ?? 0.78,
      metalness: (mods.flags.metalness as number | undefined) ?? 0.02,
    }),
    new MeshBasicMaterial({ vertexColors: true }),
  ];
  if (((mods.flags.metalness as number | undefined) ?? 0) > 0.3 && envMap) {
    const m = materials[0] as MeshStandardMaterial;
    m.envMap = envMap;
    m.envMapIntensity = 1.1;
  }
  const mesh = new Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const visual = new Group();
  visual.add(mesh);
  const root = new Group();
  root.add(visual);

  const partGroups: [string, Group][] = [];
  const mainAt = (v: number, axis: 0 | 1 | 2) => (v - model.min[axis]) * vs - ([size.x, size.y, size.z][axis]) / 2;
  for (const { part, pb } of partBuilders) {
    let pm = pb.build();
    if (tintMap) pm = remapModel(pm, tintMap);
    const center: [number, number, number] = [pm.min[0] + pm.sx / 2, pm.min[1] + pm.sy / 2, pm.min[2] + pm.sz / 2];
    const pivot = part.pivot ?? center;
    const pMesh = new Mesh(meshVoxels(pm, { voxelSize: vs }).geometry, materials);
    pMesh.castShadow = true;
    pMesh.receiveShadow = true;
    pMesh.position.set((center[0] - pivot[0]) * vs, (center[1] - pivot[1]) * vs, (center[2] - pivot[2]) * vs);
    const g = new Group();
    g.position.set(mainAt(pivot[0], 0), mainAt(pivot[1], 1), mainAt(pivot[2], 2));
    g.add(pMesh);
    visual.add(g);
    partGroups.push([part.name, g]);
  }

  const phys = def.physics ?? {};
  const physMat = new PhysMaterial(def.id);
  physMat.friction = mods.friction ?? phys.friction ?? 0.5;
  physMat.restitution = mods.restitution ?? phys.restitution ?? 0.15;
  const mass = phys.anchored ? 0 : (phys.mass ?? 1) * mods.scale ** 3 * mods.massMul;
  const body = new Body({
    mass,
    type: phys.anchored ? Body.STATIC : Body.DYNAMIC,
    collisionFilterGroup: GROUP.ENTITY,
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
    const boxes = phys.boxes?.map(([x0, y0, z0, x1, y1, z1]) => ({ min: [x0, y0, z0], max: [x1, y1, z1] })) ?? decomposeBoxes(model, phys.maxBoxes ?? 8);
    // Thin legs/wheels often don't make the cut; add a footing box so things stand on their feet.
    const lowest = Math.min(...boxes.map((bx) => bx.min[1]));
    if (lowest > 0) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let z = 0; z < model.sz; z++)
        for (let y = 0; y < lowest; y++)
          for (let x = 0; x < model.sx; x++)
            if (model.grid[x + model.sx * (y + model.sy * z)]) {
              x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1);
              z0 = Math.min(z0, z); z1 = Math.max(z1, z + 1);
            }
      if (x1 > x0) boxes.push({ min: [x0, 0, z0], max: [x1, lowest, z1] });
    }
    for (const bx of boxes) {
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
  for (const [name, g] of partGroups) e.parts.set(name, g);
  for (const t of def.tags) e.tags.add(t);
  for (const t of mods.addTags) e.tags.add(t);
  for (const t of mods.removeTags) e.tags.delete(t);
  Object.assign(e.state, mods.flags, mods.state);
  return e;
}
