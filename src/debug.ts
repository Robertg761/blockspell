import { handGrab, type Carry } from './behaviors/lib/carry';
import { objects } from './objects';
import type { Game } from './game';
import { orderedLevels } from './levels';
import { SolutionRunner } from './levels/solve';
import type { LevelDef, LevelSolution, SolutionStep, V3 } from './levels/types';
import { parseSpell } from './parser/parser';
import { seedRandom } from './core/rng';
import { decodeScene } from './share';
import { orderedTasks, tasks, zoneEntry } from './tasks';
import { wayKey } from './tasks/save';
import { Mesh } from 'three';
import { setAnimLevel, type AnimLevel } from './engine/voxanim';
import { clearHDSetting, geometryBytes, hdPending, hdStats, hdTop, setHDEnabled } from './voxel/hd';

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
 *   __blockspell.solve('chasm', 3, 120, 1)    ... with the game's randomness seeded (1)
 *   __blockspell.solveTask('feed-pup', 0)     replay an open-world task's solution from its start -> result
 *   __blockspell.solveTask('feed-pup', 0, 120, 7)  ... with the game's randomness seeded (7)
 *   __blockspell.playTask('feed-pup', 0)      like solveTask, but the completion is saved for real
 *   __blockspell.hd()                         HD voxels: setting (and why), cache, workers and build totals
 *   __blockspell.setHD(true)                  turn HD voxels on or off right away (saved). Also ?hd=1 / ?hd=0;
 *                                             setHD(null) forgets the saved choice (auto detection next load)
 *   __blockspell.hdPending()                  HD meshes still being built (0 = everything in view is final)
 *   __blockspell.anim()                       voxel spawn/change/despawn animations: quality (and why), what is running
 *   __blockspell.setAnim('lite')              'full' | 'lite' | 'off' (null: automatic again). Also ?anim=full|lite|off
 *   __blockspell.retag('ball', 'frozen')      add a tag to the newest living 'ball' (false as 3rd arg removes it)
 *   __blockspell.despawn('ball')              remove the newest living 'ball' the way a used-up thing goes (dissolve)
 *   __blockspell.renderStats()                last frame's draw calls/triangles, scene triangles and bytes (HD vs classic)
 *   __blockspell.resetZone()                  reset the hero's zone (like pressing R in the world)
 *   __blockspell.leakCheck()                  cast things and reset each zone a few times; counts must match
 *   __blockspell.fragileCheck()               a cast mug lands, is carried and put down whole, then breaks when thrown
 *   __blockspell.actionChecks()               the hero runs, rides everything rideable and fells trees with a chainsaw
 *   __blockspell.solveAll()                   every level solution, every task solution, a "3 distinct
 *                                             ways" check and a "solves again after a zone reset" check per
 *                                             task, an idle check per zone, the leak check and a fragile thing
 *                                             carried from landing to breaking (the save is restored after)
 *   __blockspell.solveAll({ seeds: [1, 2, 3] })  the same, with every task solution run once per seed
 *                                             (every task solve also fails if a task in another zone completes)
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
 *   #scene=spell@x,z;...   (the URL hash) open Free Play and replay a shared scene
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

/** Seed for the old puzzle levels' solutions in solveAll. */
const LEVEL_SEED = 1;

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
      if (zone !== task.zone) wrongZone ??= taskId; // negative check: a solve never completes another zone's task
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

  /** A cast mug lands whole, can be picked up once it has gone to sleep, can be put down, and still breaks when thrown. */
  function fragileCheck(): SolveResult {
    const name = 'a fragile thing lands, carries and breaks';
    const world = orderedLevels().find((l) => l.tasks);
    if (!world) return check('fragile', name, true, '');
    game.hud.hideOverlay();
    game.loadLevel(world.id);
    const hero = game.world.hero!;
    const press = (key: 'grab' | 'toss') => api.run([{ press: key }, { wait: 0.1 }], 3);
    const seen = new Set<string>();
    let doubled = false;
    const off = game.world.events.on('contact', ({ a, b }) => {
      const key = `${a.body.id}:${b?.body.id}:${game.world.time}`;
      doubled ||= seen.has(key);
      seen.add(key);
    });
    game.castAt('mug', [hero.x + 2.5, hero.y - hero.size.y / 2, hero.z]);
    game.step(4);
    off();
    const mug = game.world.living((e) => e.def.id === 'mug').pop();
    if (!mug) return check('fragile', name, false, 'it broke on landing');
    if (doubled) return check('fragile', name, false, 'one impact reached behaviors more than once');
    game.teleportHero([mug.x, mug.z + 1]);
    game.step(0.2);
    press('grab');
    game.step(0.6);
    if (hero.state.held !== mug || !mug.alive) return check('fragile', name, false, 'it broke or slipped when picked up');
    press('grab');
    game.step(1.5);
    if (hero.state.held || !mug.alive) return check('fragile', name, false, 'it broke when put down');
    press('grab');
    game.step(0.6);
    press('toss');
    game.step(2);
    return check('fragile', name, !mug.alive, 'it survived being thrown');
  }

  /**
   * What the hero can do with things: runs, gets in everything rideable, drives it somewhere and gets out,
   * and fells a cast tree and a tree from the scenery with a chainsaw.
   */
  function actionChecks(): SolveResult[] {
    const worldLevel = orderedLevels().find((l) => l.tasks);
    if (!worldLevel) return [];
    const w = game.world;
    const fresh = () => {
      game.loadLevel(worldLevel.id);
      game.teleportHero([0, 9]);
      game.step(0.3);
      return w.hero!;
    };
    const press = (key: 'grab' | 'use') => api.run([{ press: key }, { wait: 0.1 }], 3);
    const out: SolveResult[] = [];

    let hero = fresh();
    const z0 = hero.z;
    api.run([{ hold: { dir: [0, -1], run: true }, for: 1.5 }], 3);
    out.push(check('actions', 'the hero runs', z0 - hero.z > 6, `ran ${(z0 - hero.z).toFixed(1)} m in 1.5 s`));

    for (const def of objects.all().filter((d) => d.tags.includes('rideable') && d.ride?.kind !== 'water')) {
      hero = fresh();
      game.castAt(def.id, [hero.x + 2.5, 0, hero.z]);
      game.step(1.2);
      const v = w.living((e) => e.def === def).pop();
      if (!v) {
        out.push(check('actions', `ride a ${def.id}`, false, 'it did not appear'));
        continue;
      }
      const rest = { x: v.x, z: v.z };
      if (!v.has('animal')) {
        game.step(2);
        if (Math.hypot(v.x - rest.x, v.z - rest.z) > 0.5) {
          out.push(check('actions', `ride a ${def.id}`, false, 'it went off without a driver'));
          continue;
        }
      }
      // walk up to it the way a player would, and animals wander off: go after them a few times
      for (let i = 0; i < 10 && hero.state.riding !== v; i++) {
        api.run([{ walkTo: [Math.min(v.size.x, v.size.z) / 2 + 0.4, 0], of: def.id, timeout: 1.5 }], 2);
        press('grab');
      }
      if (hero.state.riding !== v) {
        out.push(check('actions', `ride a ${def.id}`, false, 'could not get in'));
        continue;
      }
      const from = { x: v.x, y: v.y, z: v.z };
      api.run([{ hold: { drive: [0, 1], jump: true }, for: 2.5 }], 4);
      const moved = Math.hypot(v.x - from.x, v.y - from.y, v.z - from.z);
      api.run([{ hold: { drive: [0, -1] }, for: 1.5 }], 3);
      press('grab');
      // a respawn (it drove off the edge) is a fresh hero on their feet
      const aboard = w.hero === hero && !!hero.state.riding;
      out.push(check('actions', `ride a ${def.id}`, moved > 1 && !aboard, `moved ${moved.toFixed(1)} m, ${aboard ? 'still aboard' : 'got out'}`));
    }

    hero = fresh();
    game.castAt('chainsaw', [hero.x + 2.2, 0, hero.z]);
    game.step(1.2);
    api.run([{ walkTo: [-0.9, 0], of: 'chainsaw', timeout: 2 }], 3);
    press('grab');
    const holding = hero.state.held;
    game.castAt('tree', [hero.x, 0, hero.z - 4]);
    game.step(1);
    const tree = w.living((e) => e.def.id === 'tree').pop();
    api.run([{ hold: { dir: [0, -1] }, for: 1.5 }, { hold: { use: true }, for: 3 }, { wait: 1.5 }], 8);
    out.push(check('actions', 'a chainsaw fells a tree', !!holding && !tree?.alive && w.living((e) => e.def.id === 'log' && !e.state.role).length === 2, 'the tree still stands'));

    const stand = w.sceneryNear(-3, 10, 30, ['tree']);
    if (stand) {
      const statics = w.counts().statics;
      game.teleportHero([stand.x + 1, stand.z]);
      hero.state.yaw = -Math.PI / 2;
      api.run([{ hold: { use: true }, for: 3 }, { wait: 1.5 }], 8);
      out.push(check('actions', 'a chainsaw fells a scenery tree', stand.gone && w.counts().statics === statics - 1, 'the scenery tree still stands'));
    }

    // a seat, and three planks laid together
    hero = fresh();
    game.castAt('chair', [hero.x + 2.2, 0, hero.z]);
    game.step(1.2);
    const chair = w.living((e) => e.def.id === 'chair').pop();
    api.run([{ walkTo: [-0.9, 0], of: 'chair', timeout: 2 }, { press: 'use' }, { wait: 0.2 }], 4);
    out.push(check('actions', 'sit on a chair', !!chair && hero.state.sitting === chair, 'did not sit'));
    hero = fresh();
    game.castAt('3 planks', [hero.x + 2.4, 0, hero.z]);
    game.step(1.8);
    api.run([{ walkTo: [-1.5, 0], of: 'plank', timeout: 2.5 }, { press: 'grab' }, { wait: 0.1 }, { press: 'use' }, { wait: 0.4 }], 6);
    out.push(check('actions', 'three planks build a bridge', w.living((e) => e.def.id === 'bridge').length === 1, `${w.living((e) => e.def.id === 'plank').length} planks left`));

    // Free Play: nobody's there, so the plane has to wait to be clicked
    const free = orderedLevels().find((l) => !l.hero && !l.goal && !l.tasks);
    if (free) {
      game.loadLevel(free.id);
      game.castAt('airplane', [0, 0, 0]);
      game.step(3);
      const plane = w.living((e) => e.def.id === 'airplane').pop();
      const waited = !!plane && Math.hypot(plane.x, plane.z) < 0.5;
      const took = !!plane && game.pilotClick(plane);
      const pilot = w.hero;
      api.run([{ hold: { drive: [0, 1] }, for: 2 }], 3);
      const flew = !!plane && Math.hypot(plane.x, plane.z) > 3;
      api.run([{ hold: { drive: [0, -1] }, for: 1.5 }], 3);
      press('grab');
      game.step(0.2);
      out.push(check('actions', 'Free Play: click a plane and drive it', waited && took && flew && !w.hero && !pilot?.alive, `waited ${waited}, took ${took}, flew ${flew}, pilot gone ${!pilot?.alive}`));

      // the pointer holds a chainsaw against a tree, and only that tree
      game.loadLevel(free.id);
      game.castAt('tree', [0, 0, 0]);
      game.castAt('tree', [6, 0, 0]);
      game.castAt('chainsaw', [3, 0, 3]);
      game.step(1.2);
      const [near, far] = w.living((e) => e.def.id === 'tree');
      const saw = w.living((e) => e.def.id === 'chainsaw').pop();
      if (saw && near && far) {
        handGrab(w, saw);
        const at = (saw.state.carry as Carry).at!;
        game.step(1);
        const idle = !near.state.worked && !far.state.worked;
        Object.assign(at, { x: near.x + 0.3, y: 1.4, z: near.z });
        game.step(4.5);
        out.push(check('actions', 'Free Play: drag a chainsaw onto a tree', idle && !near.alive && far.alive && w.living((e) => e.def.id === 'log').length === 2, `idle ${idle}, near fell ${!near.alive}, far stands ${far.alive}`));
      } else out.push(check('actions', 'Free Play: drag a chainsaw onto a tree', false, 'the things did not appear'));
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
    fragileCheck: () => keepingSave(() => fragileCheck()),
    actionChecks: () => keepingSave(() => actionChecks()),
    cast(text: string, at?: [number, number] | V3) {
      if (!at) return game.cast(text);
      const g = game.world.groundAt(at[0], at[1]);
      const p: V3 = at.length === 3 ? at : [at[0], Number.isFinite(g) ? g : 0, at[1]];
      return game.castAt(text, p);
    },
    step: (seconds: number) => game.step(seconds),
    /** HD voxels: current setting (and why), cache, workers and build totals (see src/voxel/hd.ts). */
    hd: () => hdStats(),
    /** Turns HD voxels on or off right away (saved); null forgets the saved choice. */
    setHD(on: boolean | null) {
      if (on === null) clearHDSetting();
      else setHDEnabled(on);
      return hdStats();
    },
    hdPending: () => hdPending(),
    anim: () => game.fx.anims.stats(),
    retag(id: string, tag: string, on = true) {
      const e = game.world.living((o) => o.def.id === id).pop();
      if (!e) return false;
      if (on) game.world.addTag(e, tag as never);
      else game.world.removeTag(e, tag as never);
      return true;
    },
    despawn(id: string, reason = 'used') {
      const e = game.world.living((o) => o.def.id === id).pop();
      if (!e) return false;
      game.world.remove(e, reason);
      return true;
    },
    setAnim: (level: AnimLevel | null) => {
      setAnimLevel(level);
      return game.fx.anims.stats();
    },
    hdTop: (n?: number) => hdTop(n),
    /** Draw calls and triangles of the last frame, plus mesh triangles and buffer bytes in the scene, split HD / classic. */
    renderStats() {
      const info = game.renderer.gl.info;
      const scene = { hd: { meshes: 0, triangles: 0, bytes: 0 }, classic: { meshes: 0, triangles: 0, bytes: 0 } };
      game.renderer.scene.traverse((o) => {
        if (!(o instanceof Mesh) || !o.geometry.index) return;
        const k = o.geometry.userData.hd ? scene.hd : scene.classic;
        k.meshes++;
        k.triangles += o.geometry.index.count / 3;
        k.bytes += geometryBytes(o.geometry);
      });
      return { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, scene };
    },
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
        hero: h?.alive ? { x: +h.x.toFixed(2), y: +(h.y - h.size.y / 2).toFixed(2), z: +h.z.toFixed(2), climbing: !!h.state.climbing, held: (h.state.held as { alive: boolean; label: string } | null)?.alive ? (h.state.held as { label: string }).label : null } : null,
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
    solve: (key: string | number, index = 0, maxSeconds = 120, seed?: number): SolveResult =>
      keepingSave(() => {
        if (seed === undefined) return solveLevel(key, index, maxSeconds);
        seedRandom(seed);
        try {
          return { ...solveLevel(key, index, maxSeconds), seed };
        } finally {
          seedRandom(null);
        }
      }),
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
     * itself), the zone reset leak check and the fragile check. Restores the player's save afterwards.
     */
    solveAll(opts: SolveAllOptions = {}): SolveResult[] {
      const seeds: (number | undefined)[] = opts.seeds?.length ? opts.seeds : [undefined];
      return keepingSave(() => {
        const out: SolveResult[] = [];
        // The old puzzle levels are a regression baseline; their solutions run seeded (seed 1) so a
        // rare unlucky bounce can't fail the run. Their world task versions run plain and with every seed.
        for (const l of orderedLevels()) l.solutions?.forEach((_, i) => out.push(api.solve(l.id, i, 120, LEVEL_SEED)));
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
        out.push(...idleChecks(), ...leakCheck(), fragileCheck(), ...actionChecks());
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
  // a shared scene link (#scene=...) opens Free Play and replays the casts
  const scene = decodeScene(location.hash);
  if (scene?.length && q.get('level') === null) {
    game.playScene(scene);
    return true;
  }
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
