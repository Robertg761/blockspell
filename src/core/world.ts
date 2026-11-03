import { Body, Box, DistanceConstraint, LockConstraint, Material as PhysMaterial, SAPBroadphase, Vec3, World, type Constraint } from 'cannon-es';
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial, Mesh, MeshStandardMaterial, type Scene } from 'three';
import { buildModifiers } from '../adjectives';
import type { AdjectiveDef, SpawnModifiers } from '../adjectives/types';
import { emptyModifiers } from '../adjectives/types';
import { behaviorsFor } from '../behaviors';
import type { BehaviorDef } from '../behaviors/types';
import type { Color } from 'three';
import type { Effects } from '../engine/fx';
import { ease } from '../engine/tween';
import { buildTerrain, type Terrain, type TerrainOptions } from '../engine/terrain';
import { objects } from '../objects';
import type { ObjectDef } from '../objects/types';
import { VoxelBuilder } from '../voxel/builder';
import { bindVoxelMesh, releaseVoxelMesh } from '../voxel/hd';
import type { Entity } from './entity';
import { EventBus, type GameEvents } from './events';
import { createEntity } from './spawn';
import type { Tag } from './tags';

const STEP = 1 / 60;
const MAX_STEPS = 4;
/** Removal reasons that play the voxel dissolve (others vanish at once: falls, resets, pops, blasts). */
const DISSOLVE_REASONS = new Set(['limit', 'used', 'burned', 'melted', 'extinguished', 'eaten']);

/** Tags whose arrival (or departure) sweeps a change across the object, with the wave's glow color. */
const MORPH_TAGS: Record<string, [on: string, off: string]> = {
  frozen: ['#bfe8ff', '#ffb070'],
  wet: ['#7cc4ff', '#fff0c0'],
  rainbow: ['#ff7ad9', '#ffffff'],
  glows: ['#fff3b0', '#d8d0ff'],
  ghost: ['#e8f0ff', '#e8f0ff'],
  metal: ['#d8e0ea', '#d8e0ea'],
};

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

/** Keyboard state for the controllable hero, in world space (set by the game each frame). */
export interface HeroInput {
  /** Desired horizontal direction (length 0..1), already camera-relative. */
  move: { x: number; z: number };
  /** Up / W held (also climbs). */
  up: boolean;
  /** Down / S held (also climbs down). */
  down: boolean;
  /** Space held. */
  jump: boolean;
}

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
  /** Overrides some of ObjectDef.props for this spawn (passed to `build` too, e.g. a pool's size). */
  props?: Record<string, number>;
  /** Anchored objects normally snap onto the ground below them; with `exact` they keep `position.y` (a pool set into a basin). */
  exact?: boolean;
}

export interface StaticBoxOptions {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  topColor?: string;
  /** Rotation about the vertical axis in radians (diagonal bridges). */
  yaw?: number;
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
  /** Every floating island currently built (one for classic levels, several for the open world). */
  readonly terrains: Terrain[] = [];
  /** Water surface height, or null for no water (used by `floats`). */
  waterLevel: number | null = null;
  /** Level-scoped scratch state (cleared on level change). */
  flags: Record<string, unknown> = {};
  time = 0;
  /** Where the player last clicked the ground (the hero walks there). */
  aim: P3 | null = null;
  readonly links: Link[] = [];
  /** The keyboard-controlled hero of the current level (null in free play). */
  hero: Entity | null = null;
  readonly input: HeroInput = { move: { x: 0, z: 0 }, up: false, down: false, jump: false };
  /** Open world: while set, spawned entities are stamped with this zone id (state.zone), so a zone reset finds its props. */
  spawnZone: string | null = null;
  /** While true, `addStaticBox` does nothing (a zone reset re-runs setup code but keeps the statics it built). */
  skipStatics = false;
  /** While set, `on()` subscriptions are filed under this scope so `offScope` can drop them early (a task's latches). */
  subScope: string | null = null;

  /** Static boxes (mesh plus collider), invisible colliders (mesh null) and baked decor meshes (body null). */
  private statics: { mesh: Mesh | null; body: Body | null; yaw: number }[] = [];
  private bodyMap = new Map<number, Entity>();
  private pendingContacts: { e: Entity; other: Entity | null; speed: number }[] = [];
  private pendingRemoval: Entity[] = [];
  /** Removed entities whose visuals play the dissolve (handed to fx.anims when disposed). */
  private ghosted = new Set<Entity>();
  private levelSubs: { off: () => void; scope: string | null }[] = [];
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
    // state changes without a tag: a warm wave for catching fire, a cool one for being put out
    this.events.on('ignite', ({ entity }) => this.morphJuice(entity, '#ff9a3c', null));
    this.events.on('extinguish', ({ entity }) => this.morphJuice(entity, '#cfe6ff', null));
  }

  // ---------------------------------------------------------------- events
  /** Level-scoped event subscription, auto-removed on `clear()`. */
  on<K extends keyof GameEvents>(type: K, fn: (p: GameEvents[K]) => void): void {
    this.levelSubs.push({ off: this.events.on(type, fn), scope: this.subScope });
  }

  /** Drops every level subscription made under `scope` (see `subScope`). */
  offScope(scope: string): void {
    for (let i = this.levelSubs.length - 1; i >= 0; i--) {
      const s = this.levelSubs[i];
      if (s.scope !== scope) continue;
      s.off();
      this.levelSubs.splice(i, 1);
    }
  }

  /** Live counts for leak checks (zone resets): entities, physics bodies, scene children, statics, level subscriptions, links. */
  counts(): { entities: number; bodies: number; scene: number; statics: number; subs: number; links: number } {
    return {
      entities: this.entities.filter((e) => e.alive).length,
      bodies: this.physics.bodies.length,
      scene: this.scene.children.length,
      statics: this.statics.length,
      subs: this.levelSubs.length,
      links: this.links.length,
    };
  }

  // ---------------------------------------------------------------- spawning
  spawn(def: ObjectDef, opts: SpawnOptions): Entity {
    let alive = 0;
    for (const o of this.entities) if (o.alive) alive++;
    if (alive >= MAX_ENTITIES) {
      const oldest = this.entities.find((o) => o.alive && !o.state.pinned);
      if (oldest) this.remove(oldest, 'limit', 'poof');
    }
    const mods = opts.mods ?? (opts.adjectives ? buildModifiers(opts.adjectives, def) : emptyModifiers());
    const e = createEntity(def, mods, opts.label ?? def.name, undefined, opts.props);
    let y = opts.grounded ? opts.position.y + e.size.y / 2 + 0.01 : opts.position.y;
    if (def.physics?.anchored && !opts.exact) {
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
    if (this.spawnZone) e.state.zone = this.spawnZone;
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
    // the voxel assembly (engine/voxanim.ts) when it plays, else the plain pop
    if (!this.fx.anims.spawn(e)) {
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
    }
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
    // visual only: the body still leaves the world at the end of this update, as always
    if ((effect === 'poof' || DISSOLVE_REASONS.has(reason)) && e !== this.hero)
      this.ghosted.add(e);
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
    const before = MORPH_TAGS[tag] ? this.fx.anims.snapshot(e) : null;
    e.tags.add(tag);
    this.refreshBehaviors(e);
    if (MORPH_TAGS[tag]) this.morphJuice(e, MORPH_TAGS[tag][0], before);
    this.events.emit('tagAdded', { entity: e, tag });
  }

  removeTag(e: Entity, tag: Tag): void {
    if (!e.tags.has(tag)) return;
    const before = MORPH_TAGS[tag] ? this.fx.anims.snapshot(e) : null;
    e.tags.delete(tag);
    this.refreshBehaviors(e);
    if (MORPH_TAGS[tag]) this.morphJuice(e, MORPH_TAGS[tag][1], before);
    this.events.emit('tagRemoved', { entity: e, tag });
  }

  /** The change sweep on an entity that has been around a moment (not part of its own spawn). */
  private morphJuice(e: Entity, color: string, before: { color: Color; emissive: Color } | null): void {
    if (!e.alive || e.age < 0.3) return;
    const after = before && this.fx.anims.snapshot(e);
    const changed = !!before && !!after && (!before.color.equals(after.color) || !before.emissive.equals(after.emissive));
    this.fx.anims.morph(e, { color, from: changed ? before : null });
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
  /** Builds the island terrain, or removes it (null) for levels made only of static boxes. */
  loadTerrain(opts: Partial<TerrainOptions> | null = {}): void {
    this.setIslands(opts ? [opts] : []);
  }

  /** Replaces every island with a fresh set (an empty list removes them all). */
  setIslands(list: Partial<TerrainOptions>[]): void {
    this.removeIslands();
    for (const opts of list) this.addIsland(opts);
  }

  /** Builds one more floating island (centered at opts.cx, opts.cz) and adds it to the scene and physics. */
  addIsland(opts: Partial<TerrainOptions> = {}): Terrain {
    const t = buildTerrain(opts, this.groundMaterial);
    this.scene.add(t.group);
    for (const b of t.bodies) this.physics.addBody(b);
    this.terrains.push(t);
    return t;
  }

  removeIslands(): void {
    for (const t of this.terrains) {
      this.scene.remove(t.group);
      for (const b of t.bodies) this.physics.removeBody(b);
      t.dispose();
    }
    this.terrains.length = 0;
  }

  /** Ground height under a point: the highest of every island and static box there. */
  groundAt(x: number, z: number): number {
    let h = -Infinity;
    for (const t of this.terrains) h = Math.max(h, t.heightAt(x, z));
    for (const s of this.statics) {
      const b = s.body;
      if (!b) continue;
      const he = (b.shapes[0] as Box).halfExtents;
      // into the box's own frame (yaw only)
      const dx = x - b.position.x, dz = z - b.position.z;
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      if (Math.abs(lx) <= he.x && Math.abs(lz) <= he.z) h = Math.max(h, b.position.y + he.y);
    }
    return h;
  }

  /** Adds a static voxel block (platforms, walls) for level design. */
  addStaticBox(o: StaticBoxOptions): Mesh | null {
    if (this.skipStatics) return null;
    const V = 0.25;
    const [sx, sy, sz] = o.size.map((s) => Math.max(1, Math.round(s / V)));
    const b = new VoxelBuilder();
    const side = o.color ?? 'stone';
    b.box(0, 0, 0, sx - 1, sy - 1, sz - 1, side);
    if (o.topColor) b.box(0, sy - 1, 0, sx - 1, sy - 1, sz - 1, o.topColor);
    const mesh = bindVoxelMesh(new Mesh(undefined, this.staticMat), { model: b.build(), voxelSize: V, style: 'decor', lod: true, label: 'static' });
    mesh.position.set(...o.position);
    const yaw = o.yaw ?? 0;
    mesh.rotation.y = yaw;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = 'static';
    const body = new Body({ mass: 0, type: Body.STATIC, material: this.groundMaterial });
    body.addShape(new Box(new Vec3((sx * V) / 2, (sy * V) / 2, (sz * V) / 2)));
    body.position.set(...o.position);
    if (yaw) body.quaternion.setFromEuler(0, yaw, 0);
    this.physics.addBody(body);
    this.scene.add(mesh);
    this.statics.push({ mesh, body, yaw });
    return mesh;
  }

  /** A static collider with no mesh of its own (its look is part of a baked decor mesh). Counts as ground. */
  addStaticCollider(position: [number, number, number], size: [number, number, number]): void {
    if (this.skipStatics) return;
    const body = new Body({ mass: 0, type: Body.STATIC, material: this.groundMaterial });
    body.addShape(new Box(new Vec3(size[0] / 2, size[1] / 2, size[2] / 2)));
    body.position.set(...position);
    this.physics.addBody(body);
    this.statics.push({ mesh: null, body, yaw: 0 });
  }

  /**
   * Bakes a voxel model (voxel size 0.25, voxel (0,0,0) at `at`) into one static mesh with no
   * collider: a zone's scenery in a single draw call. Pair it with `addStaticCollider` for solid parts.
   */
  addDecorMesh(model: ReturnType<VoxelBuilder['build']>, at: [number, number, number]): Mesh | null {
    if (this.skipStatics) return null;
    const mesh = bindVoxelMesh(new Mesh(undefined, this.staticMat), { model, voxelSize: 0.25, origin: 'model', style: 'decor', lod: true, label: 'decor' });
    mesh.position.set(...at);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = 'decor';
    this.scene.add(mesh);
    this.statics.push({ mesh, body: null, yaw: 0 });
    return mesh;
  }

  /** Meshes the player can click to place the spawn marker. */
  pickables(): Mesh[] {
    const list: Mesh[] = [];
    for (const s of this.statics) if (s.mesh) list.push(s.mesh);
    for (const t of this.terrains)
      t.group.traverse((c) => {
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
    // a level change disposes everything at once: no dissolves
    this.ghosted.clear();
    for (const l of [...this.links]) this.unlink(l);
    for (const e of this.entities) this.disposeEntity(e);
    this.entities.length = 0;
    this.bodyMap.clear();
    this.pendingContacts.length = 0;
    this.pendingRemoval.length = 0;
    for (const s of this.statics) {
      if (s.mesh) {
        this.scene.remove(s.mesh);
        releaseVoxelMesh(s.mesh);
      }
      if (s.body) this.physics.removeBody(s.body);
    }
    this.statics.length = 0;
    for (const s of this.levelSubs) s.off();
    this.levelSubs.length = 0;
    this.spawnZone = this.subScope = null;
    this.skipStatics = false;
    this.flags = {};
    this.aim = null;
    this.hero = null;
    this.input.move.x = this.input.move.z = 0;
    this.input.up = this.input.down = this.input.jump = false;
    this.waterLevel = null;
    this.acc = 0;
    this.fx.anims.clear();
    this.fx.particles.clear();
    this.fx.flames.clear();
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
      // freshly cast things that overlap geometry get pushed out gently, not flung across the map
      if (e.age < 0.6 && e.body.mass > 0) {
        const v = e.body.velocity, sp = v.length();
        if (sp > 7) v.scale(7 / sp, v);
      }
      this.syncEntity(e);
      if (e.body.position.y < -30) this.remove(e, 'fell');
    }
    this.syncLinks();

    this.flushRemovals();
  }

  /**
   * Disposes removed entities now instead of at the end of the next update (their bodies leave the
   * physics world). A zone reset calls this before rebuilding, so old things can't knock new props around.
   */
  flushRemovals(): void {
    if (!this.pendingRemoval.length) return;
    for (const e of this.pendingRemoval) this.disposeEntity(e);
    const dead = new Set(this.pendingRemoval);
    this.pendingRemoval.length = 0;
    for (let i = this.entities.length - 1; i >= 0; i--) if (dead.has(this.entities[i])) this.entities.splice(i, 1);
  }

  private syncEntity(e: Entity): void {
    const p = e.body.position, q = e.body.quaternion;
    e.root.position.set(p.x, p.y, p.z);
    e.root.quaternion.set(q.x, q.y, q.z, q.w);
  }

  private disposeEntity(e: Entity): void {
    e.alive = false;
    this.physics.removeBody(e.body);
    this.bodyMap.delete(e.body.id);
    const visuals = () => {
      e.root.removeFromParent();
      for (const m of e.materials) m.dispose();
      // voxel geometry is shared through the cache: release it rather than dispose it
      e.root.traverse((c) => {
        if (c instanceof Mesh) releaseVoxelMesh(c);
      });
    };
    // a dissolving entity's visuals outlive it for a moment (fx.anims disposes them)
    const ghost = this.ghosted.delete(e) && this.fx.anims.dissolve(e, visuals);
    if (!ghost) visuals();
  }
}
