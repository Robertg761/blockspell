/**
 * Dev-only: replays every level's scripted solutions headlessly and logs PASS/FAIL.
 *   /tools/levels.html                 all levels
 *   /tools/levels.html?level=cliff     one level (id or order number); &i=1 for one solution
 *   tools/check-levels.sh [query]      same, from the shell via headless Chrome
 */
import '../src/ui/styles.css';
import { Game } from '../src/game';
import { installDebug, findLevel, type SolveResult } from '../src/debug';

const q = new URLSearchParams(location.search);
const game = new Game(document.getElementById('app')!);
game.fx.audio.setMuted(true);
const api = installDebug(game);
const log = (...a: unknown[]) => console.log('[lvl]', ...a);

const results: SolveResult[] = [];
const key = q.get('level');
if (key) {
  const l = findLevel(key);
  if (!l) log('NO LEVEL', key);
  else {
    const only = q.get('i');
    l.solutions?.forEach((_, i) => {
      if (only === null || Number(only) === i) {
        results.push(api.solve(l.id, i));
        if (q.has('dump')) log('STATE', JSON.stringify(api.state()));
      }
    });
  }
} else if (q.has('probe')) {
  // ?probe=crate;stairs;big%20balloon  -> sizes and masses after 2 s on flat ground
  api.load(q.get('in') ?? 'sandbox');
  q.get('probe')!.split(';').forEach((s, i) => api.cast(s, [i * 3 - 6, 4]));
  api.step(2);
  for (const e of api.state().entities) log('PROBE', JSON.stringify(e));
} else results.push(...api.solveAll());

for (const r of results)
  log(`${r.pass ? 'PASS' : 'FAIL'} ${r.level} :: ${r.solution}: ${r.time}s, ${r.words} spells, ${r.stars}★${r.error ? ' ERROR ' + r.error : ''}${r.log.length ? ' | ' + r.log.join(' | ') : ''}`);
if (!r0()) log('STATE', JSON.stringify(api.state()));
const failed = results.filter((r) => !r.pass).length;
log(`SUMMARY ${results.length - failed}/${results.length} passed`);
document.title = failed ? `FAIL ${failed}` : `PASS ${results.length}`;
api.render();
function r0() { return results.length > 0 && results[results.length - 1].pass; }
