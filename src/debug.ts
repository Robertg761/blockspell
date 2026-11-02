import type { Game } from './game';
import { orderedLevels } from './levels';
import { SolutionRunner } from './levels/solve';
import type { LevelDef, SolutionStep, V3 } from './levels/types';

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
 *   __blockspell.solveAll()                   every solution of every level
 *
 * Query flags (handy for screenshots):
 *   ?level=2               skip the title and load level 2 (order number or id; `world` is the open world)
 *   &spawn=giant%20balloon cast a spell (repeatable; `;` separates several)
 *   &at=x,z                where to cast (default: the level's spawn point)
 *   &t=2                   simulate 2 s before the first frame
 *   &solve=0               play solution #0 live
 *   &cam=x,y,z,tx,ty,tz    camera position + target
 *   &mute                  start muted
 *   &levels                open the level select screen
 */
export interface SolveResult {
  level: string;
  solution: string;
  pass: boolean;
  time: number;
  words: number;
  stars: number;
  log: string[];
  error: string | null;
}

export function findLevel(key: string | number): LevelDef | undefined {
  const all = orderedLevels();
  const k = String(key);
  return all.find((l) => l.id === k) ?? all.find((l) => String(l.order) === k);
}

export function installDebug(game: Game) {
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
    cast(text: string, at?: [number, number] | V3) {
      if (!at) return game.cast(text);
      const g = game.world.groundAt(at[0], at[1]);
      const p: V3 = at.length === 3 ? at : [at[0], Number.isFinite(g) ? g : 0, at[1]];
      return game.castAt(text, p);
    },
    step: (seconds: number) => game.step(seconds),
    teleport(at: [number, number] | V3) {
      const h = game.world.hero;
      if (!h?.alive) throw new Error('no hero in this level');
      const [x, z] = at.length === 3 ? [at[0], at[2]] : at;
      const g = game.world.groundAt(x, z);
      const y = at.length === 3 ? at[1] : Number.isFinite(g) ? g : 0;
      h.body.position.set(x, y + h.size.y / 2 + 0.05, z);
      h.body.velocity.set(0, 0, 0);
      h.body.wakeUp();
      const c = game.renderer.controls.target, cam = game.renderer.camera.position;
      cam.set(cam.x + x - c.x, cam.y, cam.z + z - c.z);
      c.set(x, c.y, z);
      return [x, y, z];
    },
    render: () => game.renderer.render(0, game.fx.shake),
    state() {
      const h = game.world.hero;
      return {
        level: game.level.id,
        words: game.words,
        won: game.won,
        result: game.lastResult,
        zone: game.zone?.id ?? null,
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
    /** Replays a solution synchronously. Leaves the level in its end state. */
    solve(key: string | number, index = 0, maxSeconds = 120): SolveResult {
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
    },
    solveAll(): SolveResult[] {
      const out: SolveResult[] = [];
      for (const l of orderedLevels()) l.solutions?.forEach((_, i) => out.push(api.solve(l.id, i)));
      return out;
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
  if (solve !== null) {
    const sol = game.level.solutions?.[Number(solve) || 0];
    if (sol) game.runner = new SolutionRunner(game, sol);
  }
  const t = Number(q.get('t') ?? 0);
  if (t > 0) game.step(t);
  return true;
}
