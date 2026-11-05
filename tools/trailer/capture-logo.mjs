#!/usr/bin/env node
// node tools/trailer/capture-logo.mjs OUT_DIR [seconds] [fps]  -> transparent PNG frames of the animated logo
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { CHROME, BASE } from './lib.mjs';

const [out = 'logo-frames', seconds = '4', fps = '24'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => {
  let vt = 1000, q = [];
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.__tick = (ms) => { vt += ms; const a = q; q = []; for (const cb of a) cb(vt); };
});
await page.goto(`${BASE}/tools/trailer/logo.html`);
await page.waitForSelector('canvas');
await page.waitForTimeout(500);
const n = Math.round(Number(seconds) * Number(fps));
for (let i = 0; i < n; i++) {
  await page.evaluate((ms) => window.__tick(ms), 1000 / Number(fps));
  await page.screenshot({ path: join(out, `${String(i).padStart(5, '0')}.png`), omitBackground: true });
}
await browser.close();
