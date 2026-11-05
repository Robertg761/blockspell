import { Body, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { GROUP } from '../../core/groups';
import type { GameWorld } from '../../core/world';
import { board, canRide, ridingOf } from './ride';

type P3 = { x: number; y: number; z: number };

export const CARRY = {
  /** Heaviest thing the hero lifts overhead (kg). */
  lift: 16,
  /** Heaviest thing the hero drags along the ground (kg). Animals and engines refuse to be dragged. */
  drag: 45,
  /** How far from the hero's center a thing can be grabbed, measured to its nearest side (m). */
  reach: 1.1,
  /** Throw speed of something weightless (m/s); the limit of what the hero can lift goes half as fast. */
  throwSpeed: 9,
  /** A lifted thing further than this from the hero's hands is lost: it got stuck on a wall or low ceiling (m). */
  snap: 1.5,
  /** Turn per press of the turn key (radians). */
  turn: Math.PI / 4,
  /** How far above what's under the pointer a thing hovers in Free Play (m). */
  hover: 0.6,
};

/** What the hero can do with a thing: lift it overhead, drag it, or only strain at it. */
export type CarryKind = 'lift' | 'drag' | 'heavy';

/**
 * A `held` entity's state.carry. `lift` and `drag`: in the hero's hands. `place`: on its way to a
 * spot in front of the hero. `loose`: let go, and passing through the hero until they've parted.
 * `hand`: in Free Play, where there's no hero, hovering at `at` under the pointer.
 */
export interface Carry {
  /** `aboard`: a pet or a parcel in the passenger seat, carried along by lib/ride.ts. */
  mode: 'lift' | 'drag' | 'place' | 'loose' | 'hand' | 'aboard';
  /** Yaw relative to the hero's (hand: the thing's own). */
  yaw: number;
  /** Drag: the distance kept from the hero. */
  dist: number;
  /** Place and hand: where it's going. */
  at: P3 | null;
  /** Seconds in this mode. */
  t: number;
}

/** What the on-screen prompt, touch buttons and target ring show. */
export type CarryHint =
  | { verb: CarryKind | 'ride' | 'wear' | 'dragging'; entity: Entity }
  /** `fresh`: just climbed aboard, so it's worth saying what the keys do. */
  | { verb: 'riding'; entity: Entity; fresh: boolean }
  /** `aboard`: what the hero could climb into with this in their arms. */
  | { verb: 'holding'; entity: Entity; spot: P3 | null; aboard: Entity | null };

const from = new Vec3(), to = new Vec3();

export const carryOf = (e: Entity) => e.state.carry as Carry | undefined;

/** True while the hero is lifting, dragging or setting this down (its own movement is on hold). */
export function inHands(e: Entity): boolean {
  const c = carryOf(e);
  return !!c && e.has('held') && c.mode !== 'loose';
}

/** The thing in the hero's hands. */
export function heldBy(hero: Entity): Entity | null {
  const e = hero.state.held as Entity | null | undefined;
  return e?.alive ? e : null;
}

/** How the hero can handle this thing, or null if there's nothing to get hold of (statics, ghosts, water, the hero). */
export function carryKind(e: Entity): CarryKind | null {
  if (e.body.mass === 0 || e.has('ghost') || e.has('controlled')) return null;
  if (e.body.mass <= CARRY.lift) return 'lift';
  const selfPropelled = e.has('animal') || e.has('vehicle') || e.has('flies');
  return e.body.mass <= CARRY.drag && !selfPropelled ? 'drag' : 'heavy';
}

/** Multipliers on the hero's walking speed and jump for what they're holding. */
export function carryLoad(hero: Entity): { speed: number; jump: number } {
  const e = heldBy(hero);
  if (!e) return { speed: 1, jump: 1 };
  if (carryOf(e)?.mode === 'drag') return { speed: 0.45, jump: 0 };
  const k = e.body.mass / CARRY.lift;
  return { speed: 1 - 0.4 * k, jump: 1 - 0.2 * k };
}

/** Nearest hit along from → to, skipping bodies `skip` accepts. Things in the hero's hands are never hit. */
function firstHit(world: GameWorld, skip: (b: Body) => boolean): { distance: number; y: number } | null {
  let best: { distance: number; y: number } | null = null;
  world.physics.raycastAll(from, to, { skipBackfaces: true, collisionFilterMask: GROUP.STATIC | GROUP.ENTITY }, (r) => {
    if (!r.body || skip(r.body)) return;
    if (!best || r.distance < best.distance) best = { distance: r.distance, y: r.hitPointWorld.y };
  });
  return best;
}

const notWall = (b: Body) => b.type !== Body.STATIC;

/** True if no wall stands between the hero (their chest or the top of their head) and the thing. */
function inSight(world: GameWorld, hero: Entity, o: Entity): boolean {
  for (const y of [hero.y, hero.y + hero.size.y / 2]) {
    from.set(hero.x, y, hero.z);
    to.copy(o.body.position);
    if (!firstHit(world, notWall)) return true;
  }
  return false;
}

/** What E would grab: the nearest thing in reach, favoring what the hero faces and what they can actually move. */
export function carryTarget(world: GameWorld, hero: Entity): Entity | null {
  const yaw = hero.state.yaw as number;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const feet = hero.y - hero.size.y / 2;
  const list: { e: Entity; score: number }[] = [];
  for (const o of world.entities) {
    if (!o.alive || o === hero || inHands(o)) continue;
    const kind = carryKind(o);
    if (!kind) continue;
    if (o.body.aabbNeedsUpdate) o.body.updateAABB();
    const { lowerBound: lo, upperBound: hi } = o.body.aabb;
    const gap = Math.hypot(hero.x - Math.min(Math.max(hero.x, lo.x), hi.x), hero.z - Math.min(Math.max(hero.z, lo.z), hi.z));
    // a dragon hovers: the hero can climb on higher than they can reach
    if (gap > CARRY.reach || hi.y < feet - 0.4 || lo.y > feet + hero.size.y + (canRide(o) ? 1.2 : 0.5)) continue;
    if (gap < 0.05 && hi.y < feet + 0.12 && !canRide(o)) continue; // standing on it
    const dx = o.x - hero.x, dz = o.z - hero.z;
    const facing = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
    list.push({ e: o, score: gap - facing * 0.4 + (kind === 'heavy' && !canRide(o) ? 1 : 0) });
  }
  list.sort((a, b) => a.score - b.score);
  return list.find((c) => inSight(world, hero, c.e))?.e ?? null;
}

/** Where a lifted thing would be set down: in front of the hero, on whatever is there. Null over a drop. */
export function placeSpot(world: GameWorld, hero: Entity, e: Entity): P3 | null {
  const yaw = hero.state.yaw as number, rel = carryOf(e)?.yaw ?? 0;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  // half the thing's footprint along the hero's facing
  const foot = (Math.abs(Math.cos(rel)) * e.size.z + Math.abs(Math.sin(rel)) * e.size.x) / 2;
  let d = hero.size.z / 2 + foot + 0.15;
  from.set(hero.x, hero.y, hero.z);
  to.set(hero.x + fx * (d + foot), hero.y, hero.z + fz * (d + foot));
  const wall = firstHit(world, notWall);
  if (wall) d = Math.max(0, wall.distance - foot - 0.05);
  const x = hero.x + fx * d, z = hero.z + fz * d;
  const feet = hero.y - hero.size.y / 2;
  from.set(x, feet + hero.size.y, z);
  to.set(x, feet - 1.2, z);
  const floor = firstHit(world, (b) => b === hero.body);
  return floor ? { x, y: floor.y + e.size.y / 2 + 0.04, z } : null;
}

/** What the hero could ride with this in their arms: a pet, or a parcel to deliver. Tools and worn things stay on them. */
export function petSeat(world: GameWorld, hero: Entity, held: Entity): Entity | null {
  if (carryOf(held)?.mode !== 'lift' || held.def.grip !== undefined || held.has('wearable')) return null;
  const target = carryTarget(world, hero);
  return target && canRide(target) ? target : null;
}

/** What the hero can do right now with the things around them. */
export function carryHint(world: GameWorld, hero: Entity): CarryHint | null {
  const riding = ridingOf(hero);
  if (riding) return { verb: 'riding', entity: riding, fresh: !!hero.state.pilot || world.time - (hero.state.boardedAt as number) < 7 };
  const held = heldBy(hero);
  if (held) return carryOf(held)?.mode === 'drag' ? { verb: 'dragging', entity: held } : { verb: 'holding', entity: held, spot: placeSpot(world, hero, held), aboard: petSeat(world, hero, held) };
  const entity = carryTarget(world, hero);
  if (!entity) return null;
  if (canRide(entity)) return { verb: 'ride', entity };
  const verb = carryKind(entity);
  return verb ? { verb: verb === 'lift' && entity.has('wearable') ? 'wear' : verb, entity } : null;
}

/** Turns toward the thing and takes hold of it. Too heavy: a strain and nothing more. */
export function grab(world: GameWorld, hero: Entity, e: Entity): void {
  if (canRide(e)) {
    board(world, hero, e);
    return;
  }
  const kind = carryKind(e);
  if (!kind) return;
  if (kind === 'heavy') {
    world.fx.sound('thud', { pitch: 1.6, volume: 0.5 });
    world.fx.addShake(0.06);
    return;
  }
  const dx = e.x - hero.x, dz = e.z - hero.z;
  if (Math.hypot(dx, dz) > 0.05) hero.state.yaw = Math.atan2(dx, dz);
  const q = e.body.quaternion;
  const objYaw = Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
  e.state.carry = { mode: kind, yaw: objYaw - (hero.state.yaw as number), dist: Math.max(Math.hypot(dx, dz), hero.size.z / 2 + 0.3), at: null, t: 0 } satisfies Carry;
  hero.state.held = e;
  e.state.landedAt = -Infinity; // it has arrived: from here on a fragile thing breaks if thrown
  world.addTag(e, 'held');
  world.fx.sound('pop', { pitch: 1.3 / Math.sqrt(Math.max(0.25, e.body.mass / 2)), volume: 0.7 });
  world.fx.sparkle(e.body.position, undefined, 6);
}

/** Free Play: takes hold of a thing with the pointer. Move it with `state.carry.at`. */
export function handGrab(world: GameWorld, e: Entity): void {
  const q = e.body.quaternion;
  const yaw = Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
  e.state.carry = { mode: 'hand', yaw, dist: 0, at: { x: e.x, y: e.y, z: e.z }, t: 0 } satisfies Carry;
  e.state.landedAt = -Infinity;
  world.addTag(e, 'held');
  world.fx.sound('pop', { pitch: 1.3, volume: 0.7 });
}

/** Lets go where it is, keeping its velocity. */
export function letGo(hero: Entity, e: Entity): void {
  const c = carryOf(e);
  if (c) {
    c.mode = 'loose';
    c.t = 0;
  }
  if (hero.state.held === e) hero.state.held = null;
}

/** Sets a lifted thing down in front of the hero (or lets it fall, over a drop). Lets go of a dragged one. */
export function putDown(world: GameWorld, hero: Entity, e: Entity): void {
  const c = carryOf(e);
  const spot = c?.mode === 'lift' ? placeSpot(world, hero, e) : null;
  letGo(hero, e);
  if (c && spot) {
    c.mode = 'place';
    c.at = spot;
  }
  world.fx.sound('step', { pitch: 0.8 });
}

/** Throws a lifted thing the way the hero is facing, a little upward, on top of the hero's own speed. */
export function toss(world: GameWorld, hero: Entity, e: Entity): void {
  const yaw = hero.state.yaw as number;
  const s = CARRY.throwSpeed * (1 - 0.5 * (e.body.mass / CARRY.lift));
  const v = hero.body.velocity;
  e.body.velocity.set(v.x + Math.sin(yaw) * s, Math.max(0, v.y) + s * 0.55, v.z + Math.cos(yaw) * s);
  e.body.angularVelocity.set(Math.cos(yaw) * 3, 0, -Math.sin(yaw) * 3);
  letGo(hero, e);
  world.fx.sound('whoosh', { pitch: 1.2 });
  world.fx.burst(e.body.position, { count: 6, color: ['#ffffff', '#e8dcc0'], speed: 1.5, up: 0.4, size: 0.07, life: 0.35, grow: true });
}
