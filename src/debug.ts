import type { Game } from './game';
import { orderedLevels } from './levels';
import { SolutionRunner } from './levels/solve';
import type { LevelDef, LevelSolution, SolutionStep, V3 } from './levels/types';
import { parseSpell } from './parser/parser';
import { seedRandom } from './core/rng';
import { orderedTasks, tasks, zoneEntry } from './tasks';
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
 *   __blockspell.solveTask('feed-pup', 0, 120, 7)  ... with the game's randomness seeded (7)
 *   __blockspell.playTask('feed-pup', 0)      like solveTask, but the completion is saved for real
 *   __blockspell.resetZone()                  reset the hero's zone (like pressing R in the world)
 *   __blockspell.leakCheck()                  cast things and reset each zone a few times; counts must match
 *   __blockspell.solveAll()                   every level solution, every task solution, a "3 distinct
 *                                             ways" check and a "solves again after a zone reset" check per
 *                                             task, an idle check per zone and the leak check (the save is
 *                                             restored after)
 *   __blockspell.solveAll({ seeds: [1, 2, 3] })  the same, with every task solution run once per seed
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
 *   &levels                open the menu (the title screen)
 *   &journal               with ?level=world: open the Journal
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
  /** Seed of the game's randomness for this run (absent: unseeded). */
  seed?: number;
}

export interface SolveAllOptions {
  /** Run every task solution once per seed (default: once, unseeded). */
  seeds?: number[];
}

/** Seconds each zone is left alone in the idle check. */
const IDLE_SECONDS = 30;

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
  function solveTask(id: string, index: number | LevelSolution, maxSeconds: number, seed?: number): SolveResult {
    if (seed === undefined) return runTask(id, index, maxSeconds);
    seedRandom(seed);
    try {
      return { ...runTask(id, index, maxSeconds), seed };
    } finally {
      seedRandom(null);
    }
  }

  function runTask(id: string, index: number | LevelSolution, maxSeconds: number): SolveResult {
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

  const check = (task: string, solution: string, pass: boolean, error: string | null, log: string[] = []): SolveResult => ({
    task, solution, pass, time: 0, words: 0, stars: 0, log, error: pass ? null : error,
  });

  /**
   * Solves a task, resets its zone (from the task start, like a player
   * pressing R there) and solves it again with another solution, without
   * reloading the world. Proves the reset rebuilds the props and re-arms the checks.
   */
  function solveAfterReset(id: string): SolveResult {
    const task = tasks.get(id)!;
    const first = runTask(id, 0, 120);
    if (!first.pass) return check(id, 'solves again after a zone reset', false, `first solve failed: ${first.error}`, first.log);
    const second = task.solutions[1 % task.solutions.length];
    const runner = new SolutionRunner(game, {
      ...second,
      steps: [{ teleport: task.start }, { wait: 0.3 }, { resetZone: true }, { teleport: task.start }, { wait: 0.3 }, ...second.steps],
    });
    game.runner = runner;
    let t = 0, cleared = false;
    try {
      while (!runner.timedOut && t < 120) {
        game.tick(1 / 60);
        t += 1 / 60;
        if (!cleared && runner.log.includes('reset zone')) cleared = !game.tracker.isDone(id);
        if (cleared && game.tracker.isDone(id)) break;
      }
    } finally {
      game.runner = null;
    }
    const pass = cleared && game.tracker.isDone(id);
    return { ...check(id, `solves again after a zone reset (${second.name})`, pass, cleared ? `not completed again: ${runner.error ?? ''}` : 'the reset did not clear the task', runner.log), time: +t.toFixed(1) };
  }

  /** Leaves each zone alone for a while with the hero at its entry: no task may complete by itself. */
  function idleChecks(): SolveResult[] {
    const world = orderedLevels().find((l) => l.tasks);
    if (!world) return [];
    return (world.zones ?? []).map((zone) => {
      game.hud.hideOverlay();
      game.loadLevel(world.id);
      game.teleportHero(zoneEntry(zone));
      const fired: string[] = [];
      const off = game.world.events.on('taskComplete', ({ taskId }) => void fired.push(taskId));
      try {
        game.step(IDLE_SECONDS);
      } finally {
        off();
      }
      const ok = !fired.length && game.zone === zone;
      return { ...check(`zone:${zone.id}`, `idle ${IDLE_SECONDS} s completes nothing`, ok, fired.length ? `completed by itself: ${fired.join(', ')}` : `hero left the zone (in ${game.zone?.id})`), time: IDLE_SECONDS };
    });
  }

  /** Casts a handful of things in each zone and resets it a few times: live entity, body, static, subscription and link counts must return to the baseline. */
  function leakCheck(rounds = 4): SolveResult[] {
    const world = orderedLevels().find((l) => l.tasks);
    if (!world) return [];
    const out: SolveResult[] = [];
    for (const zone of world.zones ?? []) {
      game.hud.hideOverlay();
      game.loadLevel(world.id);
      const [ex, ey, ez] = zoneEntry(zone);
      game.teleportHero([ex, ey, ez]);
      game.step(1);
      game.resetZone(); // the first reset may differ from the fresh load (an enter hook, settled props)
      game.step(1);
      const base = game.world.counts();
      const seen: string[] = [];
      let ok = true;
      for (let r = 0; r < rounds; r++) {
        for (const [spell, dx, dz] of [['ball', 1.5, -1.5], ['3 dogs', -2, -2], ['fire', 2.5, 0], ['big box', -2.5, 1], ['balloon', 0, -2.5]] as const) {
          const g = game.world.groundAt(ex + dx, ez + dz);
          game.castAt(spell, [ex + dx, Number.isFinite(g) ? g : ey, ez + dz]);
        }
        game.step(2);
        game.resetZone();
        game.step(0.5);
        const now = game.world.counts();
        seen.push(JSON.stringify(now));
        if ((Object.keys(base) as (keyof typeof base)[]).some((k) => now[k] !== base[k])) ok = false;
      }
      out.push(check(`zone:${zone.id}`, `${rounds} resets leak nothing`, ok, `baseline ${JSON.stringify(base)}, after resets ${seen.join(' ')}`, [JSON.stringify(base), ...seen]));
    }
    return out;
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
    resetZone: () => game.resetZone(),
    leakCheck: (rounds = 4) => keepingSave(() => leakCheck(rounds)),
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
        counts: game.world.counts(),
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
    solveTask: (id: string, index: number | LevelSolution = 0, maxSeconds = 120, seed?: number): SolveResult =>
      keepingSave(() => solveTask(id, index, maxSeconds, seed)),
    /** Plays a task's solution like solveTask, but keeps the save: the task is really marked done. */
    playTask: (id: string, index: number | LevelSolution = 0, maxSeconds = 120): SolveResult => solveTask(id, index, maxSeconds),
    /**
     * Every solution of every level, then every task solution (once per seed
     * when `seeds` is given), then per task: at least 3 solutions passed (in
     * every seed) with distinct sets of cast object ids, and it solves again
     * after a zone reset. Then an idle check per zone (nothing completes by
     * itself) and the zone reset leak check. Restores the player's save afterwards.
     */
    solveAll(opts: SolveAllOptions = {}): SolveResult[] {
      const seeds: (number | undefined)[] = opts.seeds?.length ? opts.seeds : [undefined];
      return keepingSave(() => {
        const out: SolveResult[] = [];
        for (const l of orderedLevels()) l.solutions?.forEach((_, i) => out.push(api.solve(l.id, i)));
        for (const task of orderedTasks()) {
          const ways = new Set<string>();
          task.solutions.forEach((sol, i) => {
            let passed = true;
            for (const seed of seeds) {
              const r = solveTask(task.id, i, 120, seed);
              out.push(r);
              passed &&= r.pass;
            }
            if (passed) ways.add(solutionWay(sol));
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
          out.push(solveAfterReset(task.id));
        }
        out.push(...idleChecks(), ...leakCheck());
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
    game.step(0.1); // pick up the task's zone before anything else
    const sol = solve !== null ? task.solutions[Number(solve) || 0] : undefined;
    if (sol) game.runner = new SolutionRunner(game, sol);
  } else if (solve !== null) {
    const sol = game.level.solutions?.[Number(solve) || 0];
    if (sol) game.runner = new SolutionRunner(game, sol);
  }
  const t = Number(q.get('t') ?? 0);
  if (t > 0) game.step(t);
  if (q.has('journal')) game.showJournal();
  return true;
}
