#!/usr/bin/env node
// Renders trailer shots to JPEG frames, one deterministic frame at a time.
//   node tools/trailer/capture.mjs [--scale 1] [--out DIR] [--step N] [--fps 24] shotId [shotId ...]
// Needs the dev server (npx vite --port 5199 --strictPort). --scale 0.25 --step 12 makes quick previews.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openGame } from './lib.mjs';
import { SHOTS } from './shots.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const scale = Number(opt('scale', 1));
const out = opt('out', 'trailer-frames');
const step = Number(opt('step', 1));
const FPS = Number(opt('fps', 24));
const only = argv.length ? argv : SHOTS.map((s) => s.id);

const CSS = `
#app > :not(canvas):not(.hud-bottom){display:none!important}
.hud-bottom .help, .hud-bottom .word-chips, .hud-bottom .hotbar, .suggest, .spell-ghost{display:none!important}
.spell-input::placeholder{color:transparent!important}
body.prompt-off .hud-bottom{display:none!important}
.hud-bottom{transform:translateX(-50%) scale(1.7)!important;transform-origin:50% 100%;bottom:40px!important}
`;

for (const id of only) {
  const shot = SHOTS.find((s) => s.id === id);
  if (!shot) throw new Error(`no shot ${id}`);
  const W = Math.round(1920 * scale), H = Math.round(1080 * scale);
  const { browser, page } = await openGame({ width: W, height: H, query: shot.query ?? 'nosw&mute&level=sandbox' });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.addStyleTag({ content: CSS });
  await page.evaluate((promptOn) => {
    document.body.classList.toggle('prompt-off', !promptOn);
    const g = window.__blockspell.game;
    const r = g.renderer;
    r.controls.enableDamping = false;
    r.controls.minDistance = 0.3;
    r.controls.maxDistance = 400;
    r.controls.maxPolarAngle = Math.PI;
    r.controls.autoRotate = false;
    window.__blasts = [];
    g.world.events.on('exploded', () => window.__blasts.push(performance.now()));
    const orig = r.render.bind(r);
    r.render = (...a) => {
      const c = window.__cam;
      if (c) {
        r.baseFov = c.fov ?? r.baseFov;
        r.camera.position.set(...c.pos);
        r.controls.target.set(...c.tgt);
      }
      return orig(...a);
    };
  }, !!shot.prompt);
  if (shot.init) await shot.init(page);
  if (shot.warm) await page.evaluate((s) => window.__blockspell.game.step(s), shot.warm);

  const dir = join(out, id);
  mkdirSync(dir, { recursive: true });
  const n = Math.round(shot.seconds * FPS);
  const events = [...(shot.events ?? [])].sort((a, b) => a.t - b.t);
  let ev = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i += 1) {
    const t = i / FPS;
    const u = t / shot.seconds;
    while (ev < events.length && events[ev].t <= t) await events[ev++].run(page, t);
    if (shot.typing) await typeFrame(page, shot.typing, t);
    if (shot.speed) {
      const since = await page.evaluate(() => (window.__blasts.length ? (performance.now() - window.__blasts[0]) / 1000 : null));
      const k = shot.speed(t, since);
      await page.evaluate((k) => { window.__blockspell.game.timeScale = k; }, k);
    }
    if (shot.cam) {
      const c = shot.cam(t, u);
      if (shot.track && t >= shot.track.from - 0.6) {
        const p = await page.evaluate((id) => { const e = window.__blockspell.state().entities.find((e) => e.id === id); return e ? [e.x, e.y, e.z] : null; }, shot.track.id);
        if (p) {
          const k = Math.min(1, (t - shot.track.from + 0.6) / 0.6), w = shot.track.weight * k * k * (3 - 2 * k);
          c.tgt = c.tgt.map((v, i) => v + (p[i] - v) * w);
        }
      }
      await page.evaluate((c) => { window.__cam = c; }, c);
    }
    await page.evaluate((ms) => window.__tick(ms), 1000 / FPS);
    if (i % step === 0) {
      await page.screenshot({ path: join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
    } else {
      // keep the GPU queue short without paying for a screenshot
      await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); gl?.finish(); });
    }
    if (i % 24 === 0) console.log(`${id}: ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ id, frames: n, fps: FPS, step }));
}

async function typeFrame(page, typing, t) {
  const { text, start, end, enter } = typing;
  if (t < start) return;
  const k = Math.min(1, (t - start) / (end - start));
  const len = Math.round(k * text.length);
  await page.evaluate(([text, len]) => {
    const input = document.querySelector('.spell-input');
    if (document.activeElement !== input) input.focus();
    const want = text.slice(0, len);
    if (input.value !== want) { input.value = want; input.dispatchEvent(new Event('input', { bubbles: true })); }
  }, [text, len]);
  if (enter !== undefined && t >= enter && !typing._done) {
    typing._done = true;
    await page.keyboard.press('Enter');
  }
}
