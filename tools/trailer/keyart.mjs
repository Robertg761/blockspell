#!/usr/bin/env node
// Renders candidate backgrounds for the key art: node tools/trailer/keyart.mjs OUT_DIR
import { mkdirSync } from 'node:fs';
import { openGame } from './lib.mjs';
const out = process.argv[2] ?? 'keyart';
mkdirSync(out, { recursive: true });
const { browser, page } = await openGame({ width: 1920, height: 1080, query: 'nosw&mute&level=sandbox' });
await page.addStyleTag({ content: '#app > :not(canvas){display:none!important}' });
await page.evaluate(() => {
  const g = window.__blockspell.game, r = g.renderer;
  r.controls.enableDamping = false; r.controls.minDistance = 0.3; r.controls.maxDistance = 400; r.controls.maxPolarAngle = Math.PI;
  const orig = r.render.bind(r);
  r.render = (...a) => { const c = window.__cam; if (c) { r.baseFov = c.fov; r.camera.position.set(...c.pos); r.controls.target.set(...c.tgt); } return orig(...a); };
  g.setSky('sunset', 0);
  const b = window.__blockspell;
  b.cast('giant golden dragon', [0, 0]);
  b.cast('2 rainbow balloons', [-4, 1]);
  b.cast('giant hotairballoon', [9, -7]);
  g.step(4);
});
const dragon = await page.evaluate(() => { const e = window.__blockspell.state().entities.find((e) => /dragon/.test(e.id + e.label)); return e ? [e.x, e.y, e.z] : null; });
console.log('dragon at', dragon);
const [dx, dy, dz] = dragon ?? [-3, 6, -6];
console.log(await page.evaluate(() => window.__blockspell.state().entities.map((e) => `${e.id}@${e.x.toFixed(1)},${e.y.toFixed(1)},${e.z.toFixed(1)}`).join(' ')));
const views = ['i', 'j', 'k', 'l'].map((name, i) => ({ name, pos: [dx + 2.5, 0.9, dz + 10.5], tgt: [dx - 0.3, dy + 2.3, dz], fov: 54 }));
for (const v of views) {
  await page.evaluate((c) => { window.__cam = c; }, v);
  for (let i = 0; i < 16; i++) await page.evaluate(() => { window.__tick(41.7); document.querySelector('canvas').getContext('webgl2')?.finish(); });
  await page.screenshot({ path: `${out}/${v.name}.png`, type: 'png' });
  console.log('shot', v.name);
}
await browser.close();
