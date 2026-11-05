import { Vector3 } from 'three';
import type { Entity } from '../../core/entity';
import { random } from '../../core/rng';
import type { GameWorld } from '../../core/world';
import type { SceneryTree } from '../../engine/terrain';
import { objects } from '../../objects';
import type { ObjectDef, UseKind } from '../../objects/types';
import { emptyModifiers } from '../../adjectives/types';
import { unlock } from '../defs/lock';
import { carryOf, letGo } from './carry';
import { sampleColors, shatter } from './debris';
import { extinguish, ignite, pop } from './fire';
import { lightFuse } from './blast';
import { splash } from './water';

/** How far ahead of the hero's center tools and hands reach, to the near side of what they hit (m). */
const REACH = 1.15;
/** What a chopped thing gives, when it isn't its own `debris`. */
const LOOT: Record<string, string[]> = {
  tree: ['log', 'log'], log: ['plank', 'plank'], crate: ['plank', 'plank'], barrel: ['plank', 'plank'], door: ['plank', 'plank'], bridge: ['plank', 'plank', 'plank'],
  ramp: ['plank', 'plank'], ladder: ['plank'], fence: ['plank'], chair: ['plank'], bench: ['plank'], rock: ['coin'], crystal: ['coin', 'coin'],
};
/** What a gift can turn out to hold. */
const SURPRISES = ['ball', 'cake', 'dog', 'star', 'balloon', 'crystal', 'coin', 'umbrella', 'jetpack', 'skateboard', 'donut', 'cat', 'trampoline'];
/** Things hard enough for a pickaxe or hammer only. */
const STONE = new Set(['rock', 'wall', 'stairs', 'crystal', 'ice', 'snowman', 'cactus']);

type Work = 'cut' | 'smash' | 'slash';

interface Tool {
  label: string;
  /** Seconds between strokes with the button held down. */
  every: number;
  work: Work;
  /** Seconds of chainsaw that each stroke counts for. */
  power: number;
}

const TOOLS: Partial<Record<UseKind, Tool>> = {
  saw: { label: 'Saw', every: 0.1, work: 'cut', power: 0.14 },
  chop: { label: 'Chop', every: 0.42, work: 'cut', power: 0.4 },
  mine: { label: 'Mine', every: 0.48, work: 'smash', power: 0.55 },
  smash: { label: 'Smash', every: 0.55, work: 'smash', power: 0.6 },
  slash: { label: 'Slash', every: 0.34, work: 'slash', power: 0.3 },
};

const LABELS: Record<string, string> = { douse: 'Splash', drink: 'Drink', open: 'Open', read: 'Read', flip: 'Flip', eat: 'Eat', light: 'Light', fuse: 'Light fuse', unlock: 'Unlock', pet: 'Pet' };

/** The action Use performs with this thing, if it has one. */
function actionOf(e: Entity): string | null {
  if (e.def.use) return e.def.use;
  if (e.has('edible')) return 'eat';
  if (e.has('key')) return 'unlock';
  if (e.has('explosive')) return e.state.fuseLeft === undefined ? 'fuse' : null;
  if (e.has('hot')) return 'light';
  if (e.has('animal')) return 'pet';
  return null;
}

/** What the prompt calls Use for this thing, or null if Use does nothing with it. */
export function useLabel(e: Entity): string | null {
  const a = actionOf(e);
  return a ? (TOOLS[a as UseKind]?.label ?? LABELS[a] ?? null) : null;
}

/** Can this kind of work break that thing? Task props and creatures are off limits. */
function breakable(o: Entity, work: Work): boolean {
  if (o.has('animal') || o.has('controlled') || o.has('liquid') || o.has('ghost') || o.has('held') || o.def.levelOnly || o.state.role || o.state.pinned || o.state.felling) return false;
  const wooden = o.has('flammable') && !o.has('edible');
  if (work === 'cut') return wooden;
  if (work === 'smash') return wooden || STONE.has(o.def.id) || o.has('fragile') || o.has('cold');
  return (wooden && (o.def.physics?.mass ?? 1) <= 12) || o.has('poppable') || o.has('fragile') || o.has('cold');
}

/** Seconds of chainsaw it takes: a bush is quick, a tree takes a moment. */
const toughness = (o: Entity) => 0.3 + Math.sqrt(o.def.physics?.mass ?? 1) * 0.3 * Math.sqrt(o.scale);

/** The nearest thing the hero faces that `ok` accepts. */
function ahead(world: GameWorld, hero: Entity, ok: (o: Entity) => boolean, reach = REACH): Entity | null {
  const yaw = hero.state.yaw as number;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const feet = hero.y - hero.size.y / 2;
  let best: Entity | null = null, bestGap = Infinity;
  for (const o of world.entities) {
    if (!o.alive || o === hero || !ok(o)) continue;
    if (o.body.aabbNeedsUpdate) o.body.updateAABB();
    const { lowerBound: lo, upperBound: hi } = o.body.aabb;
    if (hi.y < feet - 0.3 || lo.y > feet + hero.size.y + 0.6) continue;
    const nx = Math.min(Math.max(hero.x, lo.x), hi.x) - hero.x, nz = Math.min(Math.max(hero.z, lo.z), hi.z) - hero.z;
    const gap = Math.hypot(nx, nz);
    if (gap > reach || gap >= bestGap) continue;
    if (gap > 0.15 && (nx * fx + nz * fz) / gap < 0.2) continue; // behind them
    best = o;
    bestGap = gap;
  }
  return best;
}

/** Chips flying off what's being worked on. */
function chips(world: GameWorld, at: { x: number; y: number; z: number }, color: string[], hard: boolean): void {
  world.fx.burst(at, { count: 5, color, speed: 2.4, up: 1.6, gravity: 9, size: hard ? 0.05 : 0.07, life: 0.45, spread: 0.1, glow: hard });
}

/** Tips a tree over, away from the hero, and leaves `logs` where it lands. */
export function fell(world: GameWorld, tree: Entity, dx: number, dz: number): void {
  tree.state.felling = true;
  world.removeTag(tree, 'climbable');
  tree.body.collisionResponse = false;
  // the axis in the tree's own frame: it may have been cast at any yaw
  const q = tree.root.quaternion.clone().invert();
  const axis = new Vector3(dz, 0, -dx).applyQuaternion(q).normalize();
  const v = tree.visual, H = tree.size.y;
  const pivot = new Vector3(0, -H / 2, 0), turned = new Vector3();
  world.fx.sound('rumble', { pitch: 1.5, volume: 0.6 });
  world.fx.tweens.add({
    duration: 1.15,
    update: (t) => {
      v.quaternion.setFromAxisAngle(axis, t * t * t * Math.PI * 0.49);
      turned.copy(pivot).applyQuaternion(v.quaternion);
      v.position.copy(pivot).sub(turned);
    },
    done: () => {
      if (!tree.alive) return;
      world.fx.sound('thud', { pitch: 0.7 });
      world.fx.addShake(0.3);
      const foot = tree.y - H / 2;
      const colors = sampleColors(tree, 6);
      for (let d = 0.3; d < H; d += 0.5) world.fx.burst({ x: tree.x + dx * d, y: foot + 0.3, z: tree.z + dz * d }, { count: 7, color: colors, speed: 2, up: 2, gravity: 8, size: 0.09, life: 0.8, spread: 0.3 });
      LOOT.tree.forEach((id, i) => {
        const def = objects.get(id);
        if (!def) return;
        const mods = emptyModifiers();
        mods.scale = Math.min(1, tree.scale);
        const d = 0.9 + i * 1.05;
        world.spawn(def, { position: { x: tree.x + dx * d, y: foot + 0.5, z: tree.z + dz * d }, mods, silent: true, yaw: Math.atan2(dz, dx) });
      });
      world.events.emit('broken', { entity: tree });
      world.remove(tree, 'felled');
    },
  });
}

/** A baked tree comes down: the real one takes its place for the fall. */
function fellScenery(world: GameWorld, t: SceneryTree, dx: number, dz: number): void {
  const def = objects.get('tree');
  if (!def) return;
  world.removeSceneryTree(t);
  const mods = emptyModifiers();
  // a spell's tree is about 3.6 m tall
  mods.scale = Math.max(0.6, Math.min(1.4, t.height / 3.6));
  const tree = world.spawn(def, { position: { x: t.x, y: t.y, z: t.z }, mods, silent: true, exact: true, grounded: true });
  fell(world, tree, dx, dz);
}

/** Which way a tree falls: away from `from`. Straight overhead, any way will do. */
function awayFrom(from: { x: number; z: number }, x: number, z: number): [number, number] {
  const dx = x - from.x, dz = z - from.z, d = Math.hypot(dx, dz);
  if (d > 0.2) return [dx / d, dz / d];
  const a = random() * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)];
}

/** One stroke landing on a thing or a baked tree. `from` is where it came from, `at` where the chips fly. */
function land(world: GameWorld, tool: Tool, kind: UseKind, o: Entity | null, baked: SceneryTree | null, from: { x: number; z: number }, at: { x: number; y: number; z: number }): boolean {
  if (baked && (!o || o.def.id === 'tree')) {
    baked.damage += tool.power;
    chips(world, at, ['#c9a06a', '#a57a48', '#efd9b0'], false);
    if (baked.damage >= 1.9) fellScenery(world, baked, ...awayFrom(from, baked.x, baked.z));
    return true;
  }
  if (!o) return false;
  if (o.has('poppable')) {
    pop(o, world);
    return true;
  }
  const metal = o.has('metal') || STONE.has(o.def.id);
  o.state.worked = ((o.state.worked as number | undefined) ?? 0) + tool.power * (kind === 'mine' && STONE.has(o.def.id) ? 1.6 : 1);
  chips(world, at, metal ? ['#ffffff', '#ffe9a0', '#cfd8e0'] : sampleColors(o, 3), metal);
  if ((o.state.worked as number) < toughness(o)) return true;
  if (o.def.id === 'tree') fell(world, o, ...awayFrom(from, o.x, o.z));
  else shatter(o, world, 'chopped', LOOT[o.def.id]);
  return true;
}

/** One stroke of a tool at whatever the hero faces. Returns true if it landed on something. */
function strike(world: GameWorld, hero: Entity, tool: Tool, kind: UseKind): boolean {
  const o = ahead(world, hero, (c) => breakable(c, tool.work));
  const yaw = hero.state.yaw as number;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const baked = tool.work === 'cut' ? world.sceneryTreeNear(hero.x + fx * 0.6, hero.z + fz * 0.6, 0.95) : null;
  return land(world, tool, kind, o, baked, hero.body.position, { x: hero.x + fx * 0.7, y: hero.y + 0.1, z: hero.z + fz * 0.7 });
}

function strokeSound(world: GameWorld, action: string, hit: boolean): void {
  if (action === 'saw') world.fx.sound('buzz', { pitch: hit ? 1.5 : 1.9, volume: hit ? 0.8 : 0.45 });
  else world.fx.sound(hit ? 'knock' : 'whoosh', { pitch: hit ? 1 : 1.5, volume: 0.6 });
}

/** The thing a tool held by the pointer is over. It hovers a little above what's under the pointer, so that counts. */
function underHand(world: GameWorld, item: Entity, ok: (o: Entity) => boolean): Entity | null {
  const p = item.body.position;
  let best: Entity | null = null, bestD = Infinity;
  for (const o of world.entities) {
    if (!o.alive || o === item || !ok(o)) continue;
    if (o.body.aabbNeedsUpdate) o.body.updateAABB();
    const { lowerBound: lo, upperBound: hi } = o.body.aabb;
    if (p.x < lo.x - 0.4 || p.x > hi.x + 0.4 || p.z < lo.z - 0.4 || p.z > hi.z + 0.4 || p.y < lo.y - 0.4 || p.y > hi.y + 1.1) continue;
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/** Free Play: a tool in the pointer's hold works on whatever it's held against. */
export function tickHandTool(world: GameWorld, item: Entity): void {
  const action = item.def.use;
  const tool = action && TOOLS[action];
  if (!tool || world.time < ((item.state.useReady as number | undefined) ?? 0)) return;
  const p = item.body.position;
  const o = underHand(world, item, (c) => breakable(c, tool.work));
  // a baked tree's crown is wide: the pointer lands on leaves more often than on the trunk
  const near = tool.work === 'cut' ? world.sceneryTreeNear(p.x, p.z, 1.7) : null;
  const baked = near && p.y < near.y + near.height + 1.2 ? near : null;
  if (!o && !baked) return;
  item.state.useReady = world.time + tool.every;
  strokeSound(world, action, land(world, tool, action, o, baked, p, { x: p.x, y: p.y - item.size.y / 2, z: p.z }));
}

/** True for things that work by being held against what they break. */
export const isTool = (def: ObjectDef): boolean => !!def.use && !!TOOLS[def.use];

function eat(world: GameWorld, hero: Entity, food: Entity, seconds: number): void {
  hero.state.fedUntil = world.time + seconds;
  world.fx.sound('chomp');
  world.fx.sparkle(hero.body.position, ['#fff6a8', '#ffd84a', '#ffffff'], 14);
  world.fx.burst(food.body.position, { count: 10, color: sampleColors(food, 3), speed: 1.6, up: 1.2, gravity: 8, size: 0.06, life: 0.5 });
}

/** A one-off action. Returns false if there was nothing to do it to. */
function act(world: GameWorld, hero: Entity, item: Entity, action: string): boolean {
  switch (action) {
    case 'eat':
      eat(world, hero, item, 12);
      letGo(hero, item);
      world.remove(item, 'eaten');
      return true;
    case 'drink':
      eat(world, hero, item, 8);
      return true;
    case 'pet':
      world.fx.sound(item.def.voice ?? 'squeak');
      world.fx.burst(item.body.position, { count: 8, color: ['#ff8fb0', '#ffc2d4', '#ffffff'], speed: 1, up: 2, gravity: -0.5, size: 0.08, life: 0.9, glow: true });
      return true;
    case 'light': {
      const o = ahead(world, hero, (c) => c !== item && (c.has('flammable') || c.has('explosive')) && !c.state.burning);
      world.fx.burst(item.body.position, { count: 6, color: ['#fff4b8', '#ffb43c'], speed: 1.5, up: 1.5, gravity: 2, size: 0.07, life: 0.35, glow: true });
      return !!o && ignite(o, world);
    }
    case 'fuse':
      lightFuse(item, world, item.prop('fuse', 0) || 3);
      return true;
    case 'douse': {
      const yaw = hero.state.yaw as number;
      const at = { x: hero.x + Math.sin(yaw) * 1.1, y: hero.y, z: hero.z + Math.cos(yaw) * 1.1 };
      splash(world, at, 1.2);
      for (const o of world.nearby(at, 2.2, (c) => !!c.state.burning || (c.has('hot') && c.prop('extinguishable', 0) === 1))) extinguish(o, world);
      return true;
    }
    case 'unlock': {
      const door = ahead(world, hero, (c) => c.has('locked'), REACH + 0.5);
      if (!door) return false;
      unlock(door, item, world);
      return true;
    }
    case 'open': {
      const id = SURPRISES[Math.floor(random() * SURPRISES.length)];
      const def = objects.get(id);
      letGo(hero, item);
      world.fx.sound('confetti');
      world.fx.sparkle(item.body.position, undefined, 24);
      if (def) world.spawn(def, { position: { x: item.x, y: item.y, z: item.z }, silent: true });
      world.remove(item, 'opened', 'poof');
      return true;
    }
    case 'read':
      world.events.emit('hint', {});
      world.fx.sound('uiClick');
      return true;
    case 'flip':
      world.events.emit('say', { text: random() < 0.5 ? 'Heads!' : 'Tails!' });
      world.fx.sound('chime', { pitch: 1.6 });
      return true;
  }
  return false;
}

/** Runs once a tick: Use on what the hero holds, or on a rocket they stand beside. */
export function tickUse(world: GameWorld, hero: Entity, held: Entity | null, tapped: boolean, down: boolean, dt: number): void {
  hero.state.swing = Math.max(0, ((hero.state.swing as number | undefined) ?? 0) - dt * 5);
  if (!held) return;
  if (carryOf(held)?.mode !== 'lift') return;
  const action = actionOf(held);
  if (!action) return;
  const tool = TOOLS[action as UseKind];
  if (!tool) {
    if (tapped && !act(world, hero, held, action)) world.fx.sound('click', { volume: 0.5 });
    return;
  }
  if (!down || world.time < ((hero.state.useReady as number | undefined) ?? 0)) return;
  hero.state.useReady = world.time + tool.every;
  hero.state.swing = 1;
  strokeSound(world, action, strike(world, hero, tool, action as UseKind));
}
