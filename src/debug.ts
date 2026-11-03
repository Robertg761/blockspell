import type { Game } from './game';
import { orderedLevels } from './levels';
import { SolutionRunner } from './levels/solve';
import type { LevelDef, LevelSolution, SolutionStep, V3 } from './levels/types';
import { parseSpell } from './parser/parser';
import { orderedTasks, tasks } from './tasks';
import { wayKey } from './tasks/save';

/**
 * Debug / automation hook, available as `window.__blockspell` in every build.
 *
 *   __blockspell.load(1)                      load level by order number or id
 *   __blockspell.cast('giant balloon', [x, z]) cast at a point (or at the spawn marker)
 *   __blockspell.step(3)                      run 3 s of simulation synchronously (no rendering)
 *   __blockspell.render()                     draw one frame now
 *   __blockspell.state()                      level, words, won, hero position and zone, entities
 *   __blockspell.run([{ walkTo: [27, 0] }])     run solution steps on the current level, no reload
 *   __blockspell.teleport([x, y, z])          move the hero (feet position; y omitted = ground there)
 *   __blockspell.solve('sky-island', 0)       replay a level's scripted solution headlessly -> result
 *   __blockspell.solveTask('feed-pup', 0)     replay an open-world task's solution from its start -> result
 *   __blockspell.solveAll()                   every level solution, every task solution, plus a
 *                                             "3 distinct ways" check per task (the save is restored after)
 *
 * Query flags (handy for screenshots):
 *   ?level=2               skip the title and load level 2 (order number or id; `world` is the open world)
 *   &spawn=giant%20balloon cast a spell (repeatable; `;` separates several)
 *   &at=x,z                where to cast (default: the level's spawn point)
 *   &t=2                   simulate 2 s before the first frame
 *   &solve=0               play solution #0 live
 *   &task=feed-pup         with ?level=world: jump to that task's start (and &solve=0 plays its solution)
 *   &cam=x,y,z,tx,ty,tz    camera position + target
 *   &mute                  start muted
 *   &levels                open the level select screen
 */
export interface SolveResult {
  /** Set for classic level solves. */
  level?: string;
  /** Set for open-world task solves (and the per-task distinct ways check). */
  task?: string;
  solution: string;
  pass: boolean;
  time: number;
  words: number;
  stars: number;
  log: string[];
  error: string | null;
}

/** Distinct ways a task needs (sets of cast object ids). */
const MIN_WAYS = 3;

/** The set of object ids a solution casts, as a way key ("bone,ladder"). */
export function solutionWay(sol: LevelSolution): string {
  const ids: string[] = [];
  for (const st of sol.steps) {
    if (!('cast' in st)) continue;
    const r = parseSpell(st.cast);
    if (r.ok) ids.push(r.def.id);
  }
  return wayKey(ids);
}

/** Runs `fn` and then puts every `blockspell.*` localStorage entry back as it was (scripted solves must not touch the real save). */
function keepingSave<T>(fn: () => T): T {
  const saved = new Map<string, string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('blockspell.')) saved.set(k, localStorage.getItem(k) ?? '');
    }
  } catch {
    return fn(); // no storage at all: nothing to protect
  }
  try {
    return fn();
  } finally {
    try {
      const now: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('blockspell.')) now.push(k);
      }
      for (const k of now) if (!saved.has(k)) localStorage.removeItem(k);
      for (const [k, v] of saved) localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  }
}

export function findLevel(key: string | number): LevelDef | undefined {
  const all = orderedLevels();
  const k = String(key);
  return all.find((l) => l.id === k) ?? all.find((l) => String(l.order) === k);
}

export function installDebug(game: Game) {
  function solveLevel(key: string | number, index: number, maxSeconds: number): SolveResult {
    const l = findLevel(key);
    if (!l) throw new Error(`no level "${key}"`);
    const sol = l.solutions?.[index];
    if (!sol) throw new Error(`level "${l.id}" has no solution #${index}`);
    const runner = new SolutionRunner(game, sol);
    let t = 0;
    try {
      game.hud.hideOverlay();
      game.loadLevel(l.id);
      game.runner = runner;
      const dt = 1 / 60;
      while (!game.won && !runner.timedOut && t < maxSeconds) {
        game.tick(dt);
        t += dt;
      }
    } finally {
      game.runner = null;
    }
    return {
      level: l.id,
      solution: sol.name,
      pass: game.won,
      time: +t.toFixed(1),
      words: game.words,
      stars: game.lastResult?.stars ?? 0,
      log: runner.log,
      error: runner.error,
    };
  }

  /**
   * Replays an open-world task's solution: reloads the world, teleports the
   * hero to the task's start and runs the steps. Passes when the tracker
   * marks the task done. Leaves the world in its end state.
   */
  function solveTask(id: string, index: number | LevelSolution, maxSeconds: number): SolveResult {
    const task = tasks.get(id);
    if (!task) throw new Error(`no task "${id}"`);
    const sol = typeof index === 'number' ? task.solutions[index] : index;
    if (!sol) throw new Error(`task "${id}" has no solution #${index}`);
    const world = orderedLevels().find((l) => l.tasks);
    if (!world) throw new Error('no open-world level');
    const runner = new SolutionRunner(game, { ...sol, steps: [{ teleport: task.start }, { wait: 0.3 }, ...sol.steps] });
    let t = 0;
    let wrongZone: string | null = null;
    const off = game.world.events.on('taskComplete', ({ taskId, zone }) => {
      if (zone !== task.zone && zone !== 'hub' && task.zone !== 'hub') wrongZone ??= taskId;
    });
    try {
      game.hud.hideOverlay();
      game.loadLevel(world.id);
      game.runner = runner;
      const dt = 1 / 60;
      while (!game.tracker.isDone(id) && !runner.timedOut && t < maxSeconds) {
        game.tick(dt);
        t += dt;
      }
    } finally {
      game.runner = null;
      off();
    }
    const pass = game.tracker.isDone(id) && !wrongZone;
    return {
      task: id,
      solution: sol.name,
      pass,
      time: +t.toFixed(1),
      words: game.words,
      stars: 0,
      log: runner.log,
      error: runner.error ?? (wrongZone ? `task "${wrongZone}" in another zone completed too` : pass ? null : 'task not completed'),
    };
  }

  const api = {
    game,
    get world() {
      return game.world;
    },
    levels: () => orderedLevels().map((l) => ({ id: l.id, order: l.order, name: l.name, solutions: l.solutions?.map((s) => s.name) ?? [] })),
    load(key: string | number) {
      const l = findLevel(key);
      if (!l) throw new Error(`no level "${key}"`);
      game.hud.hideOverlay();
      game.loadLevel(l.id);
      return l.id;
    },
    tasks: () => orderedTasks().map((t) => ({ id: t.id, zone: t.zone, title: t.title, done: game.tracker.isDone(t.id), solutions: t.solutions.map((s) => s.name) })),
    cast(text: string, at?: [number, number] | V3) {
      if (!at) return game.cast(text);
      const g = game.world.groundAt(at[0], at[1]);
      const p: V3 = at.length === 3 ? at : [at[0], Number.isFinite(g) ? g : 0, at[1]];
      return game.castAt(text, p);
    },
    step: (seconds: number) => game.step(seconds),
    teleport: (at: [number, number] | V3) => game.teleportHero(at),
    render: () => game.renderer.render(0, game.fx.shake),
    state() {
      const h = game.world.hero;
      return {
        level: game.level.id,
        words: game.words,
        won: game.won,
        result: game.lastResult,
        zone: game.zone?.id ?? null,
        tasksDone: game.tracker.tasks.filter((t) => game.tracker.isDone(t.id)).map((t) => t.id),
        hero: h?.alive ? { x: +h.x.toFixed(2), y: +(h.y - h.size.y / 2).toFixed(2), z: +h.z.toFixed(2), climbing: !!h.state.climbing } : null,
        entities: game.world.living().map((e) => ({ id: e.def.id, label: e.label, role: e.state.role ?? null, x: +e.x.toFixed(2), y: +e.y.toFixed(2), z: +e.z.toFixed(2), size: [+e.size.x.toFixed(2), +e.size.y.toFixed(2), +e.size.z.toFixed(2)], mass: +e.body.mass.toFixed(1), burning: e.state.burning })),
      };
    },
    /** Runs solution steps on the current level as it stands (no reload) until they finish. */
    run(steps: SolutionStep[], maxSeconds = 60) {
      const runner = new SolutionRunner(game, { name: 'run', steps });
      game.runner = runner;
      let t = 0;
      while (!runner.stepsDone && t < maxSeconds) {
        game.tick(1 / 60);
        t += 1 / 60;
      }
      game.runner = null;
      return { time: +t.toFixed(1), log: runner.log, error: runner.error, state: api.state() };
    },
    /** Replays a solution synchronously. Leaves the level in its end state (the save is left untouched). */
    solve: (key: string | number, index = 0, maxSeconds = 120): SolveResult => keepingSave(() => solveLevel(key, index, maxSeconds)),
    /** `index` may also be a solution object (world space) to try one out. */
    solveTask: (id: string, index: number | LevelSolution = 0, maxSeconds = 120): SolveResult => keepingSave(() => solveTask(id, index, maxSeconds)),
    /**
     * Every solution of every level, then every task solution, then one
     * check per task that at least 3 solutions passed with distinct sets of
     * cast object ids. Restores the player's save afterwards.
     */
    solveAll(): SolveResult[] {
      return keepingSave(() => {
        const out: SolveResult[] = [];
        for (const l of orderedLevels()) l.solutions?.forEach((_, i) => out.push(api.solve(l.id, i)));
        for (const task of orderedTasks()) {
          const ways = new Set<string>();
          task.solutions.forEach((sol, i) => {
            const r = api.solveTask(task.id, i);
            out.push(r);
            if (r.pass) ways.add(solutionWay(sol));
          });
          const ok = ways.size >= MIN_WAYS;
          out.push({
            task: task.id,
            solution: `${MIN_WAYS} distinct ways`,
            pass: ok,
            time: 0,
            words: 0,
            stars: 0,
            log: [...ways],
            error: ok ? null : `only ${ways.size} distinct passing way(s): ${[...ways].join(' | ')}`,
          });
        }
        return out;
      });
    },
  };
  (window as unknown as { __blockspell: typeof api }).__blockspell = api;
  return api;
}

/** Applies URL query flags. Returns true if a level was requested (so the title screen is skipped). */
export function applyQuery(game: Game, api: ReturnType<typeof installDebug>): boolean {
  const q = new URLSearchParams(location.search);
  if (q.has('mute')) game.fx.audio.setMuted(true);
  const levelKey = q.get('level');
  if (levelKey === null) {
    if (q.has('levels')) game.showLevels();
    return q.has('levels');
  }
  api.load(levelKey);
  const at = q.get('at')?.split(',').map(Number);
  const spells = q.getAll('spawn').flatMap((s) => s.split(';')).map((s) => s.trim()).filter(Boolean);
  for (const s of spells) api.cast(s, at && at.length >= 2 ? (at as [number, number]) : undefined);
  const cam = q.get('cam')?.split(',').map(Number);
  if (cam && cam.length === 6) game.renderer.setView([cam[0], cam[1], cam[2]], [cam[3], cam[4], cam[5]]);
  const solve = q.get('solve');
  const task = q.get('task') ? tasks.get(q.get('task')!) : undefined;
  if (task) {
    game.teleportHero(task.start);
    const sol = solve !== null ? task.solutions[Number(solve) || 0] : undefined;
    if (sol) game.runner = new SolutionRunner(game, sol);
  } else if (solve !== null) {
    const sol = game.level.solutions?.[Number(solve) || 0];
    if (sol) game.runner = new SolutionRunner(game, sol);
  }
  const t = Number(q.get('t') ?? 0);
  if (t > 0) game.step(t);
  return true;
}
