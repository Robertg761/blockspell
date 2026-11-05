// Deterministic frame-by-frame capture of Blockspell with software GL.
// The page's clock and requestAnimationFrame are virtual: every __tick(ms) advances the game by
// exactly that long, so a frame costs however long it costs and the video still plays at 30 fps.
import { chromium } from 'playwright-core';

export const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium';
export const BASE = process.env.BASE ?? 'http://localhost:5199';

export async function openGame({ width = 1920, height = 1080, query = 'nosw&mute&level=sandbox' } = {}) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(() => {
    let vt = 1000;
    let q = [];
    const realNow = Date.now.bind(Date);
    performance.now = () => vt;
    Date.now = () => realNow() * 0 + 1_700_000_000_000 + vt; // virtual wall clock too
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
    window.__tick = (ms) => { vt += ms; const a = q; q = []; for (const cb of a) cb(vt); };
    // seeded Math.random so a shot looks the same on every run
    let s = 123456789;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  });
  await page.goto(`${BASE}/?${query}`);
  await page.waitForFunction(() => window.__blockspell);
  await page.waitForTimeout(1500);
  return { browser, page };
}
