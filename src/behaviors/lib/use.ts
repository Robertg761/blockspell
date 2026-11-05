import { Vector3 } from 'three';
import type { Entity } from '../../core/entity';
import { random } from '../../core/rng';
import type { GameWorld } from '../../core/world';
import type { SceneryKind, SceneryPiece } from '../../engine/terrain';
import { objects } from '../../objects';
import type { ObjectDef, UseKind } from '../../objects/types';
import { emptyModifiers } from '../../adjectives/types';
import { unlock } from '../defs/lock';
import { carryOf, carryTarget, letGo } from './carry';
import { sampleColors, shatter } from './debris';
import { extinguish, ignite, pop } from './fire';
import { lightFuse } from './blast';
import { canEat } from './diet';
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
type Work = 'cut' | 'smash' | 'slash';

/** What each kind of work breaks in the scenery, how long it takes in seconds of chainsaw, and what it leaves. */
const SCENERY: Record<Work, readonly SceneryKind[]> = { cut: ['tree', 'wood'], smash: ['rock', 'building', 'wood'], slash: [] };
const SCENERY_TOUGH: Record<SceneryKind, number> = { tree: 1.9, wood: 1, rock: 1.6, building: 3 };
const SCENERY_LOOT: Record<SceneryKind, string[]> = { tree: [], wood: ['plank'], rock: ['coin'], building: ['plank', 'plank', 'coin'] };
const SCENERY_CHIPS: Record<SceneryKind, string[]> = { tree: ['#c9a06a', '#a57a48', '#efd9b0'], wood: ['#c9a06a', '#a57a48', '#efd9b0'], rock: ['#ffffff', '#cfd8e0', '#8f9098'], building: ['#ffffff', '#cfd8e0', '#b6b6b8'] };
/** Things hard enough for a pickaxe or hammer only. */
const STONE = new Set(['rock', 'wall', 'stairs', 'crystal', 'ice', 'snowman', 'cactus']);

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

/** Used with the hands free, standing next to it: their labels, and how often holding C repeats them. */
const NEARBY: Partial<Record<UseKind, { label: string; every?: number }>> = {
  sit: { label: 'Sit' },
  nap: { label: 'Nap' },
  kick: { label: 'Kick' },
  play: { label: 'Play', every: 0.3 },
};
/** What a click sets off in Free Play, with no hero to do it. */
const CLICKABLE = new Set(['open', 'read', 'flip', 'fuse']);
/** A little tune for pianos, in semitones. */
const TUNE = [0, 4, 7, 12, 9, 7, 4, 7, 5, 2, 7, 11, 12, 7, 4, 0];
/** How far a thrown rope reaches, and the heaviest thing it can haul in (kg). */
const LASSO_REACH = 6, LASSO_MASS = 16;
/** How long a seat or a pillow takes to do you good (s), and how long the good lasts. */
const REST_TIME = 3, REST_BOOST = 15;

/** What materials build, best first: how many it takes, and what comes out. */
const RECIPES: Record<string, { need: number; makes: string }[]> = {
  plank: [{ need: 3, makes: 'bridge' }, { need: 2, makes: 'ladder' }],
  log: [{ need: 2, makes: 'boat' }],
};
/** How far from the hero materials still count (m). */
const CRAFT_REACH = 4;

const LABELS: Record<string, string> = { craft: 'Build', lasso: 'Lasso', douse: 'Splash', drink: 'Drink', open: 'Open', read: 'Read', flip: 'Flip', eat: 'Eat', light: 'Light', fuse: 'Light fuse', unlock: 'Unlock', pet: 'Pet' };

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

/** What the prompt calls Use for this thing in the hands, or null if Use does nothing with it. */
export function useLabel(e: Entity): string | null {
  const a = actionOf(e);
  return a ? (TOOLS[a as UseKind]?.label ?? LABELS[a] ?? null) : null;
}

/** What the prompt calls Use for this thing with the hands free, or null if it has to be picked up first. */
export function nearbyLabel(e: Entity): string | null {
  if (e.has('thrust') && e.has('rideable') && !e.state.lit) return 'Light fuse';
  return (e.def.use && NEARBY[e.def.use]?.label) || null;
}

/** Sits the hero down on a thing, until they move. */
function sitDown(world: GameWorld, hero: Entity, seat: Entity, nap: boolean): void {
  hero.state.sitting = seat;
  hero.state.napping = nap;
  hero.state.satAt = world.time;
  hero.state.rested = false;
  hero.body.collisionFilterMask = 0;
  world.fx.sound('step', { pitch: 0.7 });
}

/** Gets the hero up. */
export function standUp(hero: Entity): void {
  hero.state.sitting = null;
  hero.state.napping = false;
  hero.body.collisionFilterMask = -1;
}

/** One physics step of sitting: stays on the seat, and a moment's rest does them good. Returns false once they're up. */
export function sit(world: GameWorld, hero: Entity): boolean {
  const seat = hero.state.sitting as Entity | null | undefined;
  if (!seat) return false;
  const inp = world.input;
  if (!seat.alive || seat.has('held') || Math.hypot(inp.move.x, inp.move.z) > 0.1 || inp.jump) {
    standUp(hero);
    return false;
  }
  const b = hero.body;
  if (seat.body.aabbNeedsUpdate) seat.body.updateAABB();
  b.position.set(seat.x, Math.min(seat.body.aabb.upperBound.y, seat.y + 0.2) + hero.size.y * 0.3, seat.z);
  b.velocity.set(0, 0, 0);
  b.force.set(0, 9.82 * b.mass, 0);
  if (!hero.state.rested && world.time - (hero.state.satAt as number) > REST_TIME) {
    hero.state.rested = true;
    hero.state.fedUntil = world.time + REST_BOOST;
    world.fx.sparkle(b.position, ['#fff6a8', '#ffffff'], 12);
    world.fx.sound('chime', { pitch: 1.4, volume: 0.6 });
  }
  if (hero.state.napping && Math.random() < 1 / 40)
    world.fx.burst({ x: b.position.x, y: b.position.y + hero.size.y * 0.45, z: b.position.z }, { count: 1, color: ['#ffffff', '#cfe6ff'], speed: 0.2, up: 0.9, gravity: -0.3, size: 0.09, life: 1.4 });
  return true;
}

function playPiano(world: GameWorld, piano: Entity): void {
  const i = ((piano.state.tune as number | undefined) ?? 0) % TUNE.length;
  piano.state.tune = i + 1;
  piano.state.plinks = ((piano.state.plinks as number | undefined) ?? 0) + 1; // the piano task counts notes, however they get played
  world.fx.sound('chime', { pitch: 2 ** (TUNE[i] / 12) * 0.8, volume: 0.8 });
  const p = piano.body.position;
  world.fx.burst({ x: p.x, y: p.y + piano.size.y * 0.55, z: p.z }, { count: 4, color: ['#ffe27a', '#ffffff', '#9fd8ff'], speed: 1.3, up: 2, gravity: -0.5, size: 0.08, life: 0.9, glow: true });
}

function kick(world: GameWorld, hero: Entity, ball: Entity): void {
  const dx = ball.x - hero.x, dz = ball.z - hero.z, d = Math.hypot(dx, dz) || 1;
  hero.state.yaw = Math.atan2(dx, dz);
  ball.body.wakeUp();
  ball.body.velocity.set((dx / d) * 8, 4.5, (dz / d) * 8);
  hero.state.swing = 1;
  world.fx.sound('knock', { pitch: 1.2 });
}

/** C with empty hands, on what's in reach. */
function useNearby(world: GameWorld, hero: Entity, o: Entity | null, tapped: boolean, down: boolean): void {
  if (!o) return;
  if (o.has('thrust') && o.has('rideable')) {
    if (tapped && !o.state.lit) {
      o.state.lit = true;
      world.fx.sound('ignite');
    }
    return;
  }
  const kind = o.def.use, near = kind && NEARBY[kind];
  if (!near) return;
  if (near.every) {
    if (!down || world.time < ((hero.state.useReady as number | undefined) ?? 0)) return;
    hero.state.useReady = world.time + near.every;
  } else if (!tapped) return;
  if (kind === 'play') playPiano(world, o);
  else if (kind === 'kick') kick(world, hero, o);
  else sitDown(world, hero, o, kind === 'nap');
}

/** Puts what's held together with the same stuff lying around it. Returns false if there's not enough. */
function craft(world: GameWorld, hero: Entity, item: Entity): boolean {
  const recipes = RECIPES[item.def.id] ?? [];
  const spare = world.nearby(hero.body.position, CRAFT_REACH, (o) => o !== item && o.def === item.def && !o.state.role);
  const recipe = recipes.find((r) => spare.length + 1 >= r.need);
  const def = recipe && objects.get(recipe.makes);
  if (!recipe || !def) {
    const short = recipes[recipes.length - 1].need - 1 - spare.length;
    world.events.emit('say', { text: `Lay ${short} more ${item.def.name}${short === 1 ? '' : 's'} nearby to build with.` });
    return false;
  }
  letGo(hero, item);
  for (const o of [item, ...spare.slice(0, recipe.need - 1)]) {
    world.fx.poof(o.body.position, ['#e8dcc0', '#ffffff'], 0.5);
    world.remove(o, 'crafted');
  }
  const yaw = hero.state.yaw as number;
  const facing = def.orient === 'span' ? yaw - Math.PI / 2 : def.orient === 'face' ? yaw + Math.PI : yaw;
  const out = (def.orient === 'span' ? 1.5 : 1.3) + hero.size.z / 2;
  const x = hero.x + Math.sin(yaw) * out, z = hero.z + Math.cos(yaw) * out;
  const made = world.spawn(def, { position: { x, y: hero.y - hero.size.y / 2 + 0.05, z }, grounded: true, yaw: facing });
  world.fx.sparkle(made.body.position, ['#fff6a8', '#ffd84a', '#ffffff'], 18);
  world.fx.sound('assemble');
  return true;
}

/** Throws the rope at the nearest thing it can move, and hauls it in. */
function lasso(world: GameWorld, hero: Entity, rope: Entity): boolean {
  const o = ahead(world, hero, (c) => c !== rope && c.body.mass > 0 && c.body.mass <= LASSO_MASS && !c.has('liquid') && !c.has('ghost') && !c.has('frozen') && !c.state.role, LASSO_REACH);
  if (!o) return false;
  const dx = hero.x - o.x, dz = hero.z - o.z, d = Math.hypot(dx, dz) || 1;
  const steps = Math.ceil(d / 0.4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    world.fx.burst({ x: o.x + dx * t, y: o.y + (hero.y - o.y) * t + Math.sin(t * Math.PI) * 0.4, z: o.z + dz * t }, { count: 1, color: ['#c9a06a', '#a57a48'], speed: 0.1, up: 0, gravity: 0, size: 0.06, life: 0.3 });
  }
  o.body.wakeUp();
  const pull = Math.min(9, 3 + d * 1.4);
  o.body.velocity.set((dx / d) * pull, 3.5, (dz / d) * pull);
  world.fx.sound('whoosh', { pitch: 1.3 });
  return true;
}

/** Can this kind of work break that thing? Task props and creatures are off limits. */
function breakable(o: Entity, work: Work): boolean {
  if (o.has('animal') || o.has('controlled') || o.has('liquid') || o.has('ghost') || o.has('held') || o.def.levelOnly || ((o.state.role || o.state.pinned) && !o.state.choppable) || o.state.felling) return false;
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

/** Something baked into the scenery breaks up where it stands. */
function crumble(world: GameWorld, p: SceneryPiece): void {
  world.removeScenery(p);
  const big = Math.max(0.6, p.radius);
  for (let y = 0.2; y < p.height; y += 0.5)
    world.fx.burst({ x: p.x, y: p.y + y, z: p.z }, { count: Math.round(8 * big), color: SCENERY_CHIPS[p.kind], speed: 3, up: 2, gravity: 9, size: 0.1, life: 0.8, spread: big * 0.6 });
  world.fx.sound(p.kind === 'wood' ? 'thud' : 'shatter', { pitch: 1 / Math.sqrt(big) });
  world.fx.addShake(Math.min(0.3, 0.1 + big * 0.1));
  SCENERY_LOOT[p.kind].forEach((id, i) => {
    const def = objects.get(id);
    if (!def) return;
    const a = (i / 3) * Math.PI * 2;
    const d = world.spawn(def, { position: { x: p.x + Math.cos(a) * 0.4, y: p.y + 0.5 + i * 0.2, z: p.z + Math.sin(a) * 0.4 }, silent: true, yaw: a });
    d.body.velocity.set(Math.cos(a) * 1.5, 3, Math.sin(a) * 1.5);
    d.state.loot = true;
  });
}

/** A baked tree comes down: the real one takes its place for the fall. */
function fellScenery(world: GameWorld, t: SceneryPiece, dx: number, dz: number): void {
  const def = objects.get('tree');
  if (!def) return;
  world.removeScenery(t);
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
function land(world: GameWorld, tool: Tool, kind: UseKind, o: Entity | null, baked: SceneryPiece | null, from: { x: number; z: number }, at: { x: number; y: number; z: number }): boolean {
  if (baked && (!o || o.def.id === 'tree' || baked.kind !== 'tree')) {
    baked.damage += tool.power * (kind === 'mine' && baked.kind === 'rock' ? 1.6 : 1);
    chips(world, at, SCENERY_CHIPS[baked.kind], baked.kind === 'rock' || baked.kind === 'building');
    if (baked.damage >= SCENERY_TOUGH[baked.kind]) {
      if (baked.kind === 'tree') fellScenery(world, baked, ...awayFrom(from, baked.x, baked.z));
      else crumble(world, baked);
    }
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
  const baked = world.sceneryNear(hero.x + fx * 0.6, hero.z + fz * 0.6, 0.7, SCENERY[tool.work]);
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

/** Free Play: food held to a hungry animal gets eaten, and a bucket held over a fire puts it out. */
function handFeedOrDouse(world: GameWorld, item: Entity): void {
  if (world.time < ((item.state.useReady as number | undefined) ?? 0)) return;
  if (item.has('edible')) {
    const eater = underHand(world, item, (o) => o.has('eats') && canEat(o, item));
    if (!eater) return;
    world.events.emit('ate', { eater, food: item });
    world.fx.sound('chomp');
    world.fx.burst(item.body.position, { count: 10, color: sampleColors(item, 3), speed: 1.6, up: 1.2, gravity: 8, size: 0.06, life: 0.5 });
    world.remove(item, 'eaten');
  } else if (item.def.use === 'douse') {
    const fires = world.nearby(item.body.position, 2, (o) => o !== item && (!!o.state.burning || (o.has('hot') && o.prop('extinguishable', 0) === 1)));
    if (!fires.length) return;
    item.state.useReady = world.time + 0.7;
    splash(world, item.body.position, 1);
    for (const o of fires) extinguish(o, world);
  }
}

/** Free Play: a thing in the pointer's hold does its job on whatever it's held against. */
export function tickHandTool(world: GameWorld, item: Entity): void {
  const action = item.def.use;
  const tool = action && TOOLS[action];
  if (!tool) return handFeedOrDouse(world, item);
  if (world.time < ((item.state.useReady as number | undefined) ?? 0)) return;
  const p = item.body.position;
  const o = underHand(world, item, (c) => breakable(c, tool.work));
  // a baked tree's crown is wide: the pointer lands on leaves more often than on the trunk
  const near = world.sceneryNear(p.x, p.z, 1.45, SCENERY[tool.work]);
  const baked = near && p.y < near.y + near.height + 1.2 ? near : null;
  if (!o && !baked) return;
  item.state.useReady = world.time + tool.every;
  strokeSound(world, action, land(world, tool, action, o, baked, p, { x: p.x, y: p.y - item.size.y / 2, z: p.z }));
}

/** True for things that work by being held against what they break. */
export const isTool = (def: ObjectDef): boolean => !!def.use && !!TOOLS[def.use];

/** Free Play: clicking a thing that does something by itself. Returns false if it doesn't. */
export function clickUse(world: GameWorld, item: Entity): boolean {
  if (item.def.use === 'play') {
    playPiano(world, item);
    return true;
  }
  const action = actionOf(item);
  return !!action && CLICKABLE.has(action) && act(world, null, item, action);
}

function eat(world: GameWorld, hero: Entity, food: Entity, seconds: number): void {
  hero.state.fedUntil = world.time + seconds;
  world.fx.sound('chomp');
  world.fx.sparkle(hero.body.position, ['#fff6a8', '#ffd84a', '#ffffff'], 14);
  world.fx.burst(food.body.position, { count: 10, color: sampleColors(food, 3), speed: 1.6, up: 1.2, gravity: 8, size: 0.06, life: 0.5 });
}

/** A one-off action. Returns false if there was nothing to do it to. */
function act(world: GameWorld, hero: Entity | null, item: Entity, action: string): boolean {
  if (!hero) return actAlone(world, item, action);
  switch (action) {
    case 'eat':
      eat(world, hero, item, 12);
      letGo(hero, item);
      world.remove(item, 'eaten');
      return true;
    case 'drink':
      eat(world, hero, item, 8);
      return true;
    case 'lasso':
      return lasso(world, hero, item);
    case 'craft':
      return craft(world, hero, item);
    case 'pet':
      world.fx.sound(item.def.voice ?? 'squeak');
      world.fx.burst(item.body.position, { count: 8, color: ['#ff8fb0', '#ffc2d4', '#ffffff'], speed: 1, up: 2, gravity: -0.5, size: 0.08, life: 0.9, glow: true });
      return true;
    case 'light': {
      const o = ahead(world, hero, (c) => c !== item && (c.has('flammable') || c.has('explosive')) && !c.state.burning);
      world.fx.burst(item.body.position, { count: 6, color: ['#fff4b8', '#ffb43c'], speed: 1.5, up: 1.5, gravity: 2, size: 0.07, life: 0.35, glow: true });
      return !!o && ignite(o, world);
    }
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
    case 'open':
      letGo(hero, item);
      return actAlone(world, item, action);
  }
  return actAlone(world, item, action);
}

/** What a thing does whoever sets it off. */
function actAlone(world: GameWorld, item: Entity, action: string): boolean {
  switch (action) {
    case 'fuse':
      lightFuse(item, world, item.prop('fuse', 0) || 3);
      return true;
    case 'open': {
      const id = SURPRISES[Math.floor(random() * SURPRISES.length)];
      const def = objects.get(id);
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

/** Runs once a tick: Use on what the hero holds, or with empty hands on what's in reach. */
export function tickUse(world: GameWorld, hero: Entity, held: Entity | null, tapped: boolean, down: boolean, dt: number): void {
  hero.state.swing = Math.max(0, ((hero.state.swing as number | undefined) ?? 0) - dt * 5);
  for (const c of world.nearby(hero.body.position, 0.95, (o) => o.def.id === 'coin' && !!o.state.loot && !o.has('held'))) {
    world.fx.sound('chime', { pitch: 1.8, volume: 0.7 });
    world.fx.sparkle(c.body.position, ['#ffe27a', '#fff6a8'], 10);
    world.remove(c, 'collected');
    world.events.emit('coin', {});
  }
  if (!held) {
    if ((tapped || down) && !hero.state.sitting) useNearby(world, hero, carryTarget(world, hero), tapped, down);
    return;
  }
  if (carryOf(held)?.mode !== 'lift') return;
  const action = actionOf(held);
  if (!action || NEARBY[action as UseKind]) return;
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
