import { Body, Box, DistanceConstraint, LockConstraint, Material as PhysMaterial, SAPBroadphase, Vec3, World, type Constraint } from 'cannon-es';
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial, Mesh, MeshStandardMaterial, type Scene } from 'three';
import { buildModifiers } from '../adjectives';
import type { AdjectiveDef, SpawnModifiers } from '../adjectives/types';
import { emptyModifiers } from '../adjectives/types';
import { behaviorsFor } from '../behaviors';
import type { BehaviorDef } from '../behaviors/types';
import type { Effects } from '../engine/fx';
import { ease } from '../engine/tween';
import { buildTerrain, type Terrain, type TerrainOptions } from '../engine/terrain';
import { objects } from '../objects';
import type { ObjectDef } from '../objects/types';
import { VoxelBuilder } from '../voxel/builder';
import { meshVoxels } from '../voxel/mesher';
import type { Entity } from './entity';
import { EventBus, type GameEvents } from './events';
import { createEntity } from './spawn';
import type { Tag } from './tags';

const STEP = 1 / 60;
const MAX_STEPS = 4;
/** Hard cap on live objects; the oldest is poofed away to make room. */
export const MAX_ENTITIES = 80;

export { GROUP } from './groups';

export type LinkKind = 'lock' | 'rope';

/** A physics joint between two entities (sticky glue, balloon strings). */
export interface Link {
  a: Entity;
  b: Entity;
  kind: LinkKind;
  constraint: Constraint;
  line: Line | null;
}

type P3 = { x: number; y: number; z: number };

export interface SpawnOptions {
  position: P3;
  mods?: SpawnModifiers;
  adjectives?: AdjectiveDef[];
  label?: string;
  /** Skip pop-in juice (level setup). */
  silent?: boolean;
  /** Spawn already sitting on its base at `position.y` instead of centered there. */
  grounded?: boolean;
  yaw?: number;
}

export interface StaticBoxOptions {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  topColor?: string;
}

/**
 * The simulation: owns entities, physics, terrain and statics, runs behaviors,
 * and exposes the API that behaviors, objects and levels use.
 */
export class GameWorld {
  readonly physics = new World({ gravity: new Vec3(0, -9.82, 0) });
  readonly events = new EventBus();
  readonly entities: Entity[] = [];
  readonly groundMaterial = new PhysMaterial('ground');
  terrain: Terrain | null = null;
  /** Water surface height, or null for no water (used by `floats`). */
  waterLevel: number | null = null;
  /** Level-scoped scratch state (cleared on level change). */
  flags: Record<string, unknown> = {};
  time = 0;
  /** Where the player last clicked the ground (the hero walks there). */
  aim: P3 | null = null;
  readonly links: Link[] = [];

  private statics: { mesh: Mesh; body: Body }[] = [];
  private bodyMap = new Map<number, Entity>();
  private pendingContacts: { e: Entity; other: Entity | null; speed: number }[] = [];
  private pendingRemoval: Entity[] = [];
  private levelSubs: (() => void)[] = [];
  private acc = 0;
  private staticMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  private ropeMat = new LineBasicMaterial({ color: '#f4f1ea' });

  constructor(readonly scene: Scene, readonly fx: Effects) {
    this.physics.broadphase = new SAPBroadphase(this.physics);
    this.physics.allowSleep = true;
    this.physics.defaultContactMaterial.friction = 0.5;
    this.physics.defaultContactMaterial.restitution = 0.1;
    // Bodies' own materials are multiplied together when no ContactMaterial
    // exists, so the ground is 1/1 and each object's values win.
    this.groundMaterial.friction = 1;
    this.groundMaterial.restitution = 1;
    const solver = this.physics.solver as unknown as { iterations: number };
    solver.iterations = 12;
  }

  // ---------------------------------------------------------------- events
  /** Level-scoped event subscription, auto-removed on `clear()`. */
  on<K extends keyof GameEvents>(type: K, fn: (p: GameEvents[K]) => void): void {
    this.levelSubs.push(this.events.on(type, fn));
  }

  // ---------------------------------------------------------------- spawning
  spawn(def: ObjectDef, opts: SpawnOptions): Entity {
    let alive = 0;
    for (const o of this.entities) if (o.alive) alive++;
    if (alive >= MAX_ENTITIES) {
      const oldest = this.entities.find((o) => o.alive);
      if (oldest) this.remove(oldest, 'limit', 'poof');
    }
    const mods = opts.mods ?? (opts.adjectives ? buildModifiers(opts.adjectives, def) : emptyModifiers());
    const e = createEntity(def, mods, opts.label ?? def.name);
    let y = opts.grounded ? opts.position.y + e.size.y / 2 + 0.01 : opts.position.y;
    if (def.physics?.anchored) {
      const g = this.groundAt(opts.position.x, opts.position.z);
      y = (Number.isFinite(g) ? g : opts.position.y) + e.size.y / 2;
    }
    e.body.position.set(opts.position.x, y, opts.position.z);
    if (opts.yaw) e.body.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), opts.yaw);
    this.physics.addBody(e.body);
    this.bodyMap.set(e.body.id, e);
    e.body.addEventListener('collide', (ev: { body: Body; contact: { getImpactVelocityAlongNormal(): number } }) => {
      if (!e.alive) return;
      const other = this.bodyMap.get(ev.body.id) ?? null;
      this.pendingContacts.push({ e, other, speed: Math.abs(ev.contact.getImpactVelocityAlongNormal()) });
    });
    this.scene.add(e.root);
    this.entities.push(e);
    this.syncEntity(e);

    def.onSpawn?.(e, this);
    this.refreshBehaviors(e);
    if (!opts.silent) this.spawnJuice(e);
    this.events.emit('spawn', { entity: e });
    return e;
  }

  spawnById(id: string, opts: SpawnOptions): Entity | null {
    const def = objects.get(id);
    if (!def) {
      console.warn(`[blockspell] unknown object "${id}"`);
      return null;
    }
    return this.spawn(def, opts);
  }

  private spawnJuice(e: Entity): void {
    const s = e.scale;
    const v = e.visual;
    v.scale.setScalar(0.001);
    this.fx.tweens.add({
      duration: 0.5,
      update: (t) => {
        const k = ease.outBack(t, 2.6);
        const squash = 1 + Math.sin(t * Math.PI * 2) * 0.12 * (1 - t);
        v.scale.set(k / Math.sqrt(squash), k * squash, k / Math.sqrt(squash));
      },
      done: () => v.scale.setScalar(1),
    });
    const p = e.body.position;
    const color = e.def.burstColor ?? '#ffffff';
    this.fx.sparkle(p, ['#fff6a8', '#ffd84a', '#ffffff', color], 26);
    this.fx.burst(p, { count: 16, color: [color, '#ffffff'], speed: 3.5 * Math.sqrt(s), up: 2.5, size: 0.1 * Math.sqrt(s), life: 0.7 });
    this.fx.addShake(0.12 + Math.min(0.3, e.body.mass * 0.01));
    this.fx.sound(e.def.spawnSound ?? 'pop', { pitch: 1 / Math.sqrt(s) });
    this.fx.sound('magic', { pitch: 1 / Math.sqrt(s), volume: 0.6 });
  }

  /** Removes an entity. `effect: 'poof'` plays a smoke puff. */
  remove(e: Entity, reason = 'removed', effect: 'poof' | 'none' = 'none'): void {
    if (!e.alive) return;
    e.alive = false;
    if (effect === 'poof') this.fx.poof(e.body.position, undefined, Math.max(0.6, Math.min(2, e.radius * 1.5)));
    this.pendingRemoval.push(e);
    this.unlinkAll(e);
    this.events.emit('remove', { entity: e, reason });
  }

  // ---------------------------------------------------------------- links
  /** Joins two entities: 'lock' welds them rigidly, 'rope' keeps them within their current distance. */
  link(a: Entity, b: Entity, kind: LinkKind, length?: number): Link | null {
    if (!a.alive || !b.alive || a === b || this.linked(a, b)) return null;
    const constraint =
      kind === 'lock'
        ? new LockConstraint(a.body, b.body, { maxForce: 400 + 60 * (a.body.mass + b.body.mass) })
        : new DistanceConstraint(a.body, b.body, length ?? a.distanceTo(b), 1e4);
    this.physics.addConstraint(constraint);
    let line: Line | null = null;
    if (kind === 'rope') {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
      line = new Line(geo, this.ropeMat);
      line.frustumCulled = false;
      this.scene.add(line);
    }
    const l: Link = { a, b, kind, constraint, line };
    this.links.push(l);
    a.body.wakeUp();
    b.body.wakeUp();
    return l;
  }

  linked(a: Entity, b: Entity): boolean {
    return this.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  }

  linksOf(e: Entity, kind?: LinkKind): Link[] {
    return this.links.filter((l) => (l.a === e || l.b === e) && (!kind || l.kind === kind));
  }

  unlink(l: Link): void {
    const i = this.links.indexOf(l);
    if (i < 0) return;
    this.links.splice(i, 1);
    this.physics.removeConstraint(l.constraint);
    if (l.line) {
      this.scene.remove(l.line);
      l.line.geometry.dispose();
    }
  }

  unlinkAll(e: Entity): void {
    for (const l of this.linksOf(e)) this.unlink(l);
  }

  private syncLinks(): void {
    for (const l of this.links) {
      if (!l.line) continue;
      const pa = l.a.body.position, pb = l.b.body.position;
      const arr = (l.line.geometry.getAttribute('position') as BufferAttribute).array as Float32Array;
      arr[0] = pa.x; arr[1] = pa.y - l.a.size.y * 0.45; arr[2] = pa.z;
      arr[3] = pb.x; arr[4] = pb.y + l.b.size.y * 0.4; arr[5] = pb.z;
      l.line.geometry.getAttribute('position').needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- tags
  addTag(e: Entity, tag: Tag): void {
    if (e.tags.has(tag)) return;
    e.tags.add(tag);
    this.refreshBehaviors(e);
    this.events.emit('tagAdded', { entity: e, tag });
  }

  removeTag(e: Entity, tag: Tag): void {
    if (!e.tags.has(tag)) return;
    e.tags.delete(tag);
    this.refreshBehaviors(e);
    this.events.emit('tagRemoved', { entity: e, tag });
  }

  private refreshBehaviors(e: Entity): void {
    const next = behaviorsFor(e);
    const prev = e.behaviors;
    e.behaviors = next;
    for (const b of prev) if (!next.includes(b)) b.detach?.(e, this);
    for (const b of next) if (!prev.includes(b)) b.attach?.(e, this);
  }

  // ---------------------------------------------------------------- queries
  nearby(p: P3, radius: number, filter?: (e: Entity) => boolean): Entity[] {
    const r2 = radius * radius;
    return this.entities.filter((e) => {
      if (!e.alive) return false;
      const dx = e.body.position.x - p.x, dy = e.body.position.y - p.y, dz = e.body.position.z - p.z;
      return dx * dx + dy * dy + dz * dz <= r2 && (!filter || filter(e));
    });
  }

  /** Nearest living entity matching `filter` within `radius`. */
  nearest(p: P3, radius: number, filter?: (e: Entity) => boolean): Entity | null {
    let best: Entity | null = null;
    let bd = radius;
    for (const e of this.entities) {
      if (!e.alive || (filter && !filter(e))) continue;
      const d = Math.hypot(e.body.position.x - p.x, e.body.position.y - p.y, e.body.position.z - p.z);
      if (d <= bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** True when two entities' bounding spheres are (nearly) touching. */
  touching(a: Entity, b: Entity, slack = 0.15): boolean {
    return a.distanceTo(b) <= (a.radius + b.radius) * 0.8 + slack;
  }

  living(filter?: (e: Entity) => boolean): Entity[] {
    return this.entities.filter((e) => e.alive && (!filter || filter(e)));
  }

  // ---------------------------------------------------------------- level geometry
  loadTerrain(opts: Partial<TerrainOptions> = {}): void {
    if (this.terrain) {
      this.scene.remove(this.terrain.group);
      for (const b of this.terrain.bodies) this.physics.removeBody(b);
      this.terrain.dispose();
    }
    this.terrain = buildTerrain(opts, this.groundMaterial);
    this.scene.add(this.terrain.group);
    for (const b of this.terrain.bodies) this.physics.addBody(b);
  }

  /** Ground height under a point, including static boxes. */
  groundAt(x: number, z: number): number {
    let h = this.terrain ? this.terrain.heightAt(x, z) : 0;
    for (const s of this.statics) {
      const b = s.body;
      const he = (b.shapes[0] as Box).halfExtents;
      if (Math.abs(x - b.position.x) <= he.x && Math.abs(z - b.position.z) <= he.z) h = Math.max(h, b.position.y + he.y);
    }
    return h;
  }

  /** Adds a static voxel block (platforms, walls) for level design. */
  addStaticBox(o: StaticBoxOptions): Mesh {
    const V = 0.25;
    const [sx, sy, sz] = o.size.map((s) => Math.max(1, Math.round(s / V)));
    const b = new VoxelBuilder();
    const side = o.color ?? 'stone';
    b.box(0, 0, 0, sx - 1, sy - 1, sz - 1, side);
    if (o.topColor) b.box(0, sy - 1, 0, sx - 1, sy - 1, sz - 1, o.topColor);
    const mesh = new Mesh(meshVoxels(b.build(), { voxelSize: V }).geometry, this.staticMat);
    mesh.position.set(...o.position);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = 'static';
    const body = new Body({ mass: 0, type: Body.STATIC, material: this.groundMaterial });
    body.addShape(new Box(new Vec3((sx * V) / 2, (sy * V) / 2, (sz * V) / 2)));
    body.position.set(...o.position);
    this.physics.addBody(body);
    this.scene.add(mesh);
    this.statics.push({ mesh, body });
    return mesh;
  }

  /** Meshes the player can click to place the spawn marker. */
  pickables(): Mesh[] {
    const list: Mesh[] = this.statics.map((s) => s.mesh);
    this.terrain?.group.traverse((c) => {
      if (c instanceof Mesh) list.push(c);
    });
    return list;
  }

  entityFromObject(obj: { parent: unknown }): Entity | null {
    for (const e of this.entities) if (e.mesh === obj) return e.alive ? e : null;
    return null;
  }

  /** Removes all entities, statics and level subscriptions. Keeps terrain. */
  clear(): void {
    for (const l of [...this.links]) this.unlink(l);
    for (const e of this.entities) this.disposeEntity(e);
    this.entities.length = 0;
    this.bodyMap.clear();
    this.pendingContacts.length = 0;
    this.pendingRemoval.length = 0;
    for (const s of this.statics) {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      this.physics.removeBody(s.body);
    }
    this.statics.length = 0;
    for (const off of this.levelSubs) off();
    this.levelSubs.length = 0;
    this.flags = {};
    this.aim = null;
    this.waterLevel = null;
    this.fx.particles.clear();
    this.fx.tweens.clear();
  }

  // ---------------------------------------------------------------- loop
  update(dt: number): void {
    this.time += dt;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      e.age += dt;
      e.def.update?.(e, this, dt);
      for (const b of e.behaviors) if (e.alive) b.update?.(e, this, dt);
    }

    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      for (const e of this.entities) {
        if (!e.alive) continue;
        for (const b of e.behaviors) b.fixedUpdate?.(e, this, STEP);
      }
      this.physics.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;

    const contacts = this.pendingContacts.splice(0);
    for (const c of contacts) {
      if (!c.e.alive) continue;
      const info = { speed: c.speed };
      for (const b of c.e.behaviors as BehaviorDef[]) if (c.e.alive) b.contact?.(c.e, c.other, this, info);
      this.events.emit('contact', { a: c.e, b: c.other, speed: c.speed });
    }

    for (const e of this.entities) {
      if (!e.alive) continue;
      this.syncEntity(e);
      if (e.body.position.y < -30) this.remove(e, 'fell');
    }
    this.syncLinks();

    if (this.pendingRemoval.length) {
      for (const e of this.pendingRemoval) this.disposeEntity(e);
      const dead = new Set(this.pendingRemoval);
      this.pendingRemoval.length = 0;
      for (let i = this.entities.length - 1; i >= 0; i--) if (dead.has(this.entities[i])) this.entities.splice(i, 1);
    }
  }

  private syncEntity(e: Entity): void {
    const p = e.body.position, q = e.body.quaternion;
    e.root.position.set(p.x, p.y, p.z);
    e.root.quaternion.set(q.x, q.y, q.z, q.w);
  }

  private disposeEntity(e: Entity): void {
    e.alive = false;
    this.scene.remove(e.root);
    this.physics.removeBody(e.body);
    this.bodyMap.delete(e.body.id);
    e.mesh.geometry.dispose();
    for (const m of e.materials) m.dispose();
    e.root.traverse((c) => {
      if (c !== e.mesh && c instanceof Mesh) c.geometry.dispose();
    });
  }
}
