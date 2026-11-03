import type { Entity } from '../core/entity';
import type { GameEvents } from '../core/events';
import type { Tag } from '../core/tags';
import type { GameWorld } from '../core/world';
import { heroInside, withRole } from '../levels/goals';
import type { Frame } from './frame';
import type { Box, Pred } from './types';

/**
 * Task check combinators, built on the src/levels/goals.ts helpers. Tasks are
 * detected by outcome (where things are, what is burning, what happened),
 * never by which words were cast, so any creative solution counts.
 *
 * Every predicate is a `(world) => boolean`. Stateful ones (`latch`, `hold`,
 * `distinctEaters`) also carry an `arm(world, taskId)` that the tracker calls
 * after each world (or zone) setup; combinators pass it down to their children.
 * State goes in `world.flags['task:<id>:...']` so a zone reset can clear it.
 */

/** Which entities a predicate looks at. Every given field must match. */
export interface Filter {
  role?: string;
  tag?: string;
  notTag?: string;
  /** Object id, e.g. 'star'. */
  id?: string;
  /** Only things without a role: what the player cast, never the zone's own props. */
  noRole?: boolean;
}

export const matches = (e: Entity, f: Filter): boolean =>
  (f.role === undefined || e.state.role === f.role) &&
  (f.tag === undefined || e.has(f.tag as Tag)) &&
  (f.notTag === undefined || !e.has(f.notTag as Tag)) &&
  (f.id === undefined || e.def.id === f.id) &&
  (!f.noRole || e.state.role === undefined);

export const select = (w: GameWorld, f: Filter): Entity[] => w.living((e) => e !== w.hero && matches(e, f));

/** A point is inside an axis-aligned box. */
export const inBox = (b: Box, x: number, y: number, z: number): boolean =>
  x >= b[0][0] && x <= b[1][0] && y >= b[0][1] && y <= b[1][1] && z >= b[0][2] && z <= b[1][2];

const armAll = (ps: Pred[]) => (w: GameWorld, task: string) => {
  for (const p of ps) p.arm?.(w, task);
};

// ------------------------------------------------------------ hero
/** The hero's feet are in the box. With a frame, the box is in that frame's local coordinates (a diagonal ledge). */
export const heroIn = (b: Box, frame?: Frame): Pred => (w) => {
  if (!frame) return heroInside(w, b[0], b[1]);
  const h = w.hero;
  return !!h?.alive && frame.contains(b[0], b[1], h.x, h.y - h.size.y / 2, h.z);
};

/** The hero's feet are in the box and they are standing there (not climbing, not falling). */
export const heroStandingIn = (b: Box): Pred => (w) => {
  const h = w.hero;
  return heroInside(w, b[0], b[1]) && !!h && !h.state.climbing && Math.abs(h.body.velocity.y) < 0.6;
};

// ------------------------------------------------------------ things
/** At least `n` matching entities have their center in the box. */
export const countIn = (f: Filter, b: Box, n = 1): Pred => (w) => select(w, f).filter((e) => inBox(b, e.x, e.y, e.z)).length >= n;

/** The total mass of every dynamic body (hero included) centered in the box is at least `kg`. */
export const massIn = (b: Box, kg: number): Pred => (w) =>
  w.living((e) => e.body.mass > 0 && inBox(b, e.x, e.y, e.z)).reduce((m, e) => m + e.body.mass, 0) >= kg;

/** Some matching entity is on fire. */
export const burning = (f: Filter): Pred => (w) => select(w, f).some((e) => e.state.burning);

/** No matching entity is on fire (true when there are none). */
export const noneBurning = (f: Filter): Pred => (w) => !select(w, f).some((e) => e.state.burning);

/** At least one entity with this role is alive. */
export const alive = (role: string): Pred => (w) => withRole(w, role).length > 0;

/** Every entity with this role is gone (burned up, broken, eaten...). */
export const gone = (role: string): Pred => (w) => withRole(w, role).length === 0;

/** An entity with this role exists and no longer has the tag (thawed, put out, unlocked...). */
export const lacksTag = (role: string, tag: string): Pred => (w) => withRole(w, role).some((e) => !e.has(tag as Tag));

/** Some entity with this role has its bottom at or below (`<=`) or at or above (`>=`) height `y`. */
export const heightOf = (role: string, op: '<=' | '>=', y: number): Pred => (w) =>
  withRole(w, role).some((e) => {
    const bottom = e.y - e.size.y / 2;
    return op === '<=' ? bottom <= y : bottom >= y;
  });

/** Some entity with this role has its center in the box and has (nearly) stopped: the delivery check. */
export const restingIn = (role: string, b: Box, maxSpeed = 1.5): Pred => (w) =>
  withRole(w, role).some((e) => inBox(b, e.x, e.y, e.z) && e.body.velocity.length() < maxSpeed);

// ------------------------------------------------------------ events
type EventName = 'ignite' | 'popped' | 'broken' | 'unlocked' | 'ate' | 'tagRemoved' | 'exploded' | 'extinguish' | 'burnedUp';

/**
 * Becomes (and stays) true once `event` fires with a payload that `match`
 * accepts. The listener is armed after each world setup and stores the
 * result in `world.flags['task:<id>:<event>']` (plus `:<key>` if given).
 */
export function latch<K extends EventName>(event: K, match: (p: GameEvents[K], w: GameWorld) => boolean, key?: string): Pred {
  let flag = '';
  const p: Pred = (w) => w.flags[flag] === true;
  p.arm = (w, task) => {
    flag = `task:${task}:${event}${key ? ':' + key : ''}`;
    const f = flag;
    w.on(event, ((payload: GameEvents[K]) => {
      if (match(payload, w)) w.flags[f] = true;
    }) as (p: GameEvents[K]) => void);
  };
  return p;
}

/**
 * At least `n` different eaters inside the box have eaten something since the world was set up.
 * `by: 'kind'` counts different kinds of eater (object ids: a rabbit, a duck and a monkey) instead of entities.
 */
export function distinctEaters(b: Box, n: number, by: 'entity' | 'kind' = 'entity'): Pred {
  let flag = '';
  const p: Pred = (w) => ((w.flags[flag] as Set<number | string> | undefined)?.size ?? 0) >= n;
  p.arm = (w, task) => {
    flag = `task:${task}:eaters`;
    const f = flag;
    const seen = new Set<number | string>();
    w.flags[f] = seen;
    w.on('ate', ({ eater }) => {
      if (eater !== w.hero && inBox(b, eater.x, eater.y, eater.z)) seen.add(by === 'kind' ? eater.def.id : eater.id);
    });
  };
  return p;
}

// ------------------------------------------------------------ logic
export const all = (...ps: Pred[]): Pred => {
  const p: Pred = (w) => ps.every((q) => q(w));
  p.arm = armAll(ps);
  return p;
};

export const any = (...ps: Pred[]): Pred => {
  const p: Pred = (w) => ps.some((q) => q(w));
  p.arm = armAll(ps);
  return p;
};

export const not = (q: Pred): Pred => {
  const p: Pred = (w) => !q(w);
  p.arm = q.arm;
  return p;
};

let holdSeq = 0;

/**
 * True once `q` has held continuously for `seconds` (so a ball bouncing
 * through the goal does not count). The tracker polls about 10 times a second;
 * a gap of more than half a second between polls (the hero walked to another
 * zone) restarts the clock.
 */
export function hold(seconds: number, q: Pred): Pred {
  const n = holdSeq++;
  // filed under the task once armed, so a zone reset clears it with the task's other flags
  let key = `hold:${n}`;
  const p: Pred = (w) => {
    if (!q(w)) {
      delete w.flags[key];
      return false;
    }
    const rec = w.flags[key] as { since: number; last: number } | undefined;
    if (!rec || w.time - rec.last > 0.5) {
      w.flags[key] = { since: w.time, last: w.time };
      return seconds <= 0;
    }
    rec.last = w.time;
    return w.time - rec.since >= seconds;
  };
  p.arm = (w, task) => {
    key = `task:${task}:hold:${n}`;
    q.arm?.(w, task);
  };
  return p;
}
