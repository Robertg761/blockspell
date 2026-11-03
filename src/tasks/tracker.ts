import type { GameWorld } from '../core/world';
import type { Effects } from '../engine/fx';
import type { Toasts } from '../ui/toast';
import { neighborZones, zones } from './index';
import { worldSave } from './save';
import type { TaskDef, ZoneDef } from './types';

/** What the tracker needs from the game. */
export interface TrackerHost {
  readonly world: GameWorld;
  readonly fx: Effects;
  readonly hud: { toasts: Toasts };
  /** Called by the retry button on a failed task. */
  resetZone(): void;
}

const INTERVAL = 0.1; // seconds between checks (10 Hz)

/**
 * Checks the open world's tasks in place of a level's single goal. Only tasks
 * in the hero's zone and its neighbors are polled, about 10 times a second.
 * A task completes at most once per zone setup; finishing it again after a
 * reset with a different set of cast objects counts as a new way.
 */
export class TaskTracker {
  private list: TaskDef[] = [];
  /** Tasks finished (or failed) since their zone was last set up. */
  private done = new Set<string>();
  private failed = new Set<string>();
  /** Object ids cast per zone since its last setup. */
  private casts = new Map<string, Set<string>>();
  /** Zones whose `enter` hook already ran since their last setup. */
  private entered = new Set<string>();
  private acc = 0;

  constructor(private host: TrackerHost) {}

  get tasks(): readonly TaskDef[] {
    return this.list;
  }

  /** True if the task was finished since its zone was last set up. */
  isDone(id: string): boolean {
    return this.done.has(id);
  }

  /** Object ids cast in a zone since its last setup (sorted). */
  castsIn(zone: string): string[] {
    return [...(this.casts.get(zone) ?? [])].sort();
  }

  /** Starts tracking after a world setup: arms every check (event latches subscribe here). */
  reset(list: TaskDef[]): void {
    this.list = list;
    this.done.clear();
    this.failed.clear();
    this.casts.clear();
    this.entered.clear();
    this.acc = 0;
    for (const t of list) this.arm(t);
  }

  /** Arms a task's check with its subscriptions filed under `task:<id>`, so a zone reset can drop them. */
  private arm(t: TaskDef): void {
    const w = this.host.world;
    w.subScope = `task:${t.id}`;
    try {
      t.check.arm?.(w, t.id);
    } finally {
      w.subScope = null;
    }
  }

  /**
   * Forgets everything about a zone before it is set up again: its tasks'
   * done and failed marks, event latches and flags (`task:<id>:*`), the zone's
   * own flags (`<zone>:*`), its casts and its `enter` hook. Call `armZone`
   * after the zone setup has run.
   */
  resetZone(zone: ZoneDef): void {
    const w = this.host.world;
    const prefixes = [`${zone.id}:`];
    for (const t of this.list) {
      if (t.zone !== zone.id) continue;
      this.done.delete(t.id);
      this.failed.delete(t.id);
      w.offScope(`task:${t.id}`);
      prefixes.push(`task:${t.id}:`);
    }
    for (const k of Object.keys(w.flags)) if (prefixes.some((p) => k.startsWith(p))) delete w.flags[k];
    this.casts.delete(zone.id);
    this.entered.delete(zone.id);
  }

  /** Arms the checks of a zone's tasks again (after `resetZone` and the zone setup). */
  armZone(zone: ZoneDef): void {
    for (const t of this.list) if (t.zone === zone.id) this.arm(t);
  }

  /** Stops tracking (classic levels). */
  clear(): void {
    this.reset([]);
  }

  /** Remembers a successful cast made from inside `zone`. */
  noteCast(zone: string | null, objectId: string): void {
    if (!zone || !this.list.length) return;
    let set = this.casts.get(zone);
    if (!set) this.casts.set(zone, (set = new Set()));
    set.add(objectId);
  }

  /**
   * The hero set foot in a zone: runs its `enter` hook once and (unless `remember` is false, as for the
   * spawn point on load) saves it as the last zone.
   */
  enterZone(zone: ZoneDef, remember = true): void {
    if (!this.list.length) return;
    if (remember) worldSave.setLastZone(zone.id);
    if (this.entered.has(zone.id)) return;
    this.entered.add(zone.id);
    zone.enter?.(this.host.world, zone.center);
  }

  update(dt: number, zone: ZoneDef | null): void {
    if (!this.list.length || !zone) return;
    this.acc += dt;
    if (this.acc < INTERVAL) return;
    this.acc = 0;
    const w = this.host.world;
    const near = neighborZones(zone.id);
    for (const t of this.list) {
      if (this.done.has(t.id) || !near.includes(t.zone)) continue;
      if (t.check(w)) {
        this.complete(t);
        continue;
      }
      if (t.fail && !this.failed.has(t.id)) {
        const msg = t.fail(w);
        if (msg) this.fail(t, msg);
      }
    }
  }

  private complete(t: TaskDef): void {
    this.done.add(t.id);
    const way = this.castsIn(t.zone);
    const res = worldSave.complete(t.id, way);
    const { world, fx, hud } = this.host;
    const h = world.hero;
    const p = h?.alive ? h.body.position : world.aim ?? { x: 0, y: 0, z: 0 };
    fx.celebrate({ x: p.x, y: p.y, z: p.z });
    fx.sound('chime');
    const more = res.first ? '' : res.newWay ? ` A new way! (${res.ways} ways found)` : ' (a way you already found)';
    hud.toasts.show(`${t.title}.${more}`, { kind: 'success', title: 'Task complete' });
    world.events.emit('taskComplete', { taskId: t.id, zone: t.zone, first: res.first, way, newWay: res.newWay });
  }

  private fail(t: TaskDef, msg: string): void {
    this.failed.add(t.id);
    const { fx, hud } = this.host;
    fx.sound('error');
    const zone = zones.get(t.zone);
    hud.toasts.show(`Press R (or ↺) to reset ${zone?.name ?? 'the zone'} and try again.`, {
      kind: 'error',
      title: msg,
      duration: 8000,
      actions: [{ label: '↺ Retry', onClick: () => this.host.resetZone() }],
    });
  }
}
