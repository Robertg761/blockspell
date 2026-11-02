/**
 * Dev-only scripted scenarios for checking interactions headlessly (not part of the build).
 *   /tools/scenario.html?s=fire      see SCENARIOS below; world events are logged to the console
 *   google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --enable-logging=stderr \
 *     --virtual-time-budget=15000 --window-size=1280,800 --screenshot=/tmp/s.png "http://localhost:5199/tools/scenario.html?s=fire"
 */
import '../src/ui/styles.css';
import { Game } from '../src/game';
import { parseSpell } from '../src/parser/parser';
import type { GameWorld } from '../src/core/world';

const q = new URLSearchParams(location.search);
const game = new Game(document.getElementById('app')!);
(window as unknown as { blockspell: Game }).blockspell = game;
document.querySelector('.overlay')?.classList.add('hidden');
const w: GameWorld = game.world;
// headless virtual time barely runs rAF, so drive the game loop with a timer
// (physics + fx every tick, rendering only twice a second to stay fast under SwiftShader)
let ticks = 0;
setInterval(() => {
  const dt = 1 / 30;
  w.update(dt);
  game.fx.update(dt);
  if (++ticks % 15 === 0) game.renderer.render(dt, game.fx.shake);
}, 1000 / 30);
const log = (...a: unknown[]) => console.log('[scn]', ...a);

for (const ev of ['ignite', 'extinguish', 'burnedUp', 'ate', 'popped', 'exploded', 'broken', 'unlocked'] as const)
  w.events.on(ev, (p: Record<string, unknown>) => {
    const ent = (p.entity ?? p.food) as { label: string } | undefined;
    log(ev, ent?.label ?? '', p.eater ? `by ${(p.eater as { label: string }).label}` : '');
  });
w.events.on('remove', ({ entity, reason }) => log('remove', entity.label, reason));

/** Spawns a spell ("giant flaming dog") at x,z (dropped from a small height). */
function put(spell: string, x: number, z: number, y = 0.6) {
  const r = parseSpell(spell);
  if (!r.ok) return log('PARSE FAIL', spell, r);
  const g = Math.max(0, w.groundAt(x, z));
  return w.spawn(r.def, { position: { x, y: g + y + 1, z }, adjectives: r.adjectives, label: r.label, silent: true });
}
const at = (t: number, fn: () => void) => setTimeout(fn, t * 1000);
const report = (t: number) =>
  at(t, () => log('ALIVE t=' + w.time.toFixed(1), w.living().map((e) => `${e.label}@(${e.x.toFixed(1)},${e.y.toFixed(1)},${e.z.toFixed(1)})${[...e.tags].filter((x) => ['frozen', 'slippery', 'wet', 'hot'].includes(x)).join('+')}`).join(' | ')));
const view = (p: [number, number, number], t: [number, number, number]) => game.renderer.setView(p, t);

const SCENARIOS: Record<string, () => void> = {
  words() {
    for (const s of ['puppy', 'giant flaming dog', 'tiny golden rocket', 'angry ghostly cow', 'flying saucer', 'hot air balloon', 'ice cream', 'mice', 'very big rainbow cat', 'sticky honey', 'frozen fish', 'treasure chest', 'fast car', 'invisible bomb', '3 glowing stars'])
      { const r = parseSpell(s); log('parse', s, '=>', r.ok ? `${r.label} x${r.count} [${r.adjectives.map((a) => a.id)}]` : `FAIL ${JSON.stringify(r)}`); }
  },
  fire() {
    view([0, 8, 12], [0, 0.5, 0]);
    put('fire', -4, 0); put('box', -3.1, 0);
    put('fire', 0, 0); put('ice', 0.9, 0);
    put('fire', 4, 0); put('snowman', 4.9, 0);
    put('fire', 0, -5); put('tnt', 0.9, -5);
    put('fire', -4, 4); put('frozen dog', -3, 4);
    put('fire', 4, 4); put('balloon', 4.6, 4);
    report(3); report(9); report(14);
  },
  water() {
    view([5, 5, 7], [0, 0, 0]);
    put('water', 0, 0, 0);
    at(0.5, () => { put('boat', 0, 0, 1); put('duck', 0.6, 0.6, 1); put('rock', -0.6, -0.4, 1); put('fish', 2.5, 2.5); put('flaming crate', 0.5, -0.6, 1.5); });
    at(2, () => { put('ice', 2, 0); put('bucket', 2.4, 0.2, 1.5); });
    report(4); report(10);
  },
  animals() {
    view([7, 7, 9], [0, 0, 0]);
    put('cat', -3, 0); put('mouse', 0, 0); put('cheese', 3, 0);
    put('dog', 0, -3); put('bone', 2, -3);
    put('monkey', -3, 3); put('banana', -1, 3);
    report(2); report(6); report(12);
  },
  carry() {
    view([6, 6, 10], [0, 3, 0]);
    put('balloon', 0, 0); put('ball', 0, 0, 0);
    put('2 balloons', 3, 0); put('rocket', -3, 0);
    for (const t of [1, 3, 6, 10, 14]) at(t, () => log('T', w.time.toFixed(1), w.living().map((e) => `${e.label}@(${e.x.toFixed(1)},${e.y.toFixed(1)},${e.z.toFixed(1)}) links=${w.linksOf(e).length}`).join(' | ')));
  },
  boom() {
    view([7, 6, 9], [0, 0.5, 0]);
    put('bomb', 0, 0);
    put('vase', 1, 0); put('crate', -1, 0.3); put('ball', 0.5, 1); put('mug', -0.5, -1); put('dog', 1.5, -1.5);
    put('anvil', 3, 3, 3); put('egg', 3, 3, 0);
    report(1); report(6);
  },
  gadgets() {
    view([8, 7, 10], [0, 1, 0]);
    put('magnet', 0, 0); put('coin', 2, 0); put('key', -2, 0.5); put('robot', 0, 2.5);
    put('fan', -4, -3); put('balloon', -4, -1.5); put('ball', -4, -2);
    put('trampoline', 3, -3); at(1.5, () => put('ball', 3, -3, 2));
    put('rocket', 4, 2);
    put('sticky ball', -1, -3, 2);
    report(3); report(8);
  },
  door() {
    view([5, 4, 7], [0, 1, 0]);
    put('door', 0, 0, 0);
    at(1, () => { const k = put('key', 0, 1.2, 0.3); if (k) k.body.velocity.set(0, 0, -3); });
    report(4);
  },
  climb() {
    view([6, 5, 8], [0, 1.5, -2]);
    w.addStaticBox({ position: [0, 1.25, -3], size: [4, 2.5, 4], color: 'stone', topColor: 'grass' });
    put('hero', 0, 1.5);
    at(0.3, () => { w.spawnById(q.get('with') ?? 'ladder', { position: { x: 0, y: 0, z: -0.75 }, grounded: true, silent: true }); });
    at(1, () => { w.aim = { x: 0, y: 2.5, z: -3.5 }; });
    report(4); report(9); report(14);
  },
  adjectives() {
    view([7, 6, 10], [0, 1, 0]);
    const list = ['giant flaming dog', 'tiny golden rocket', 'frozen cat', 'ghostly cow', 'rainbow ball', 'angry pig', 'sticky box', 'heavy ball', 'bouncy rock', 'flying car', 'glowing crystal', 'metal chair'];
    list.forEach((s, i) => put(s, ((i % 4) - 1.5) * 2.2, (Math.floor(i / 4) - 1) * 2.2));
    report(2); report(6);
  },
  list() {
    view([0, 7, 12], [0, 1, 0]);
    const list = (q.get('list') ?? 'dog').split(';');
    list.forEach((sp, i) => put(sp, ((i % 4) - 1.5) * 3, (Math.floor(i / 4) - 0.5) * 3));
    for (const t of [1, 3, 6, 10]) at(t, () => log('T', w.time.toFixed(1), w.living().map((e) => `${e.label} y=${e.y.toFixed(2)} feet=${(e.y - e.size.y / 2).toFixed(2)} ground=${w.groundAt(e.x, e.z).toFixed(2)} m=${e.body.mass.toFixed(1)}`).join(' | ')));
  },
  gallery() {
    view([0, 9, 16], [0, 1, 0]);
    const ids = (q.get('ids') ?? 'cat,mouse,bird,rabbit,cow,pig,hero,robot').split(',');
    ids.forEach((s, i) => put(s, ((i % 6) - 2.5) * 2, (Math.floor(i / 6) - 1) * 2.4));
  },
};
(SCENARIOS[q.get('s') ?? 'words'] ?? SCENARIOS.words)();
