#!/usr/bin/env node
// Headless PWA check: serves ./dist with `vite preview`, drives the system Chrome (software WebGL) and verifies
// that Blockspell is installable and really works with no network:
//   1. the web app manifest is valid and its icons load
//   2. the service worker registers, activates and caches every file listed in dist/
//   3. with the network switched off the page is reloaded (several query strings) and the game boots, renders
//      and a spell can be cast; no request leaves the page
//   4. a fresh build changes the cache version (so old caches are replaced)
// Usage: npm run build && npm run check-pwa
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';
const CHROME_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let failures = 0;
const fail = (m) => { failures++; console.log(`FAIL  ${m}`); };
const pass = (m) => console.log(`PASS  ${m}`);
const check = (ok, good, bad) => (ok ? pass(good) : fail(bad));

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function main() {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'sw.js'))) { console.error('check-pwa: dist/sw.js is missing. Run "npm run build" first.'); return 2; }
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(path.join(root, 'node_modules', '.bin', 'vite'), ['preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore', detached: process.platform !== 'win32' });
  const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGKILL'); } };
  process.on('exit', stop);
  let browser;
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/')).ok) break; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 200)); }
    const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8'));
    check(manifest.display === 'standalone' && manifest.start_url && manifest.name, 'manifest has name, start_url and a standalone display', 'manifest is incomplete');
    const sizes = new Set(manifest.icons.map((i) => i.sizes));
    check(sizes.has('192x192') && sizes.has('512x512') && manifest.icons.some((i) => i.purpose === 'maskable'), 'manifest has 192, 512 and maskable icons', 'manifest icons are incomplete');
    for (const icon of manifest.icons) check(fs.existsSync(path.join(dist, icon.src)), `icon ${icon.src} exists`, `icon ${icon.src} is missing from dist/`);

    const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    const listed = JSON.parse(/const FILES = (\[.*\]);/.exec(sw)?.[1] ?? '[]');
    const onDisk = [];
    const walk = (d) => fs.readdirSync(d).forEach((n) => { const f = path.join(d, n); fs.statSync(f).isDirectory() ? walk(f) : onDisk.push(path.relative(dist, f).split(path.sep).join('/')); });
    walk(dist);
    const missing = onDisk.filter((f) => f !== 'sw.js' && !listed.includes('./' + f));
    check(!missing.length && listed.length > 4, `sw.js precaches all ${listed.length - 1} files in dist/`, `sw.js does not list: ${missing.join(', ')}`);

    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: CHROME_ARGS });
    const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    const external = [];
    context.on('request', (r) => { if (!r.url().startsWith(origin + '/') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
    const errors = [];
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(origin + '/?mute');
    await page.waitForFunction(() => !!window.__blockspell);
    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      await new Promise((r) => { if (navigator.serviceWorker.controller) r(); else navigator.serviceWorker.addEventListener('controllerchange', () => r()); });
      const keys = await caches.keys();
      const cache = await caches.open(keys[0]);
      return { scope: reg.scope, caches: keys, cached: (await cache.keys()).length };
    });
    check(swState.caches.length === 1 && swState.cached === listed.length, `service worker active, cache ${swState.caches[0]} holds ${swState.cached} entries`, `unexpected service worker state ${JSON.stringify(swState)} (expected ${listed.length} entries)`);
    const href = await page.evaluate(() => document.querySelector('link[rel=manifest]')?.href);
    check(href === origin + '/manifest.webmanifest', 'index.html links the manifest', `manifest link is ${href}`);
    const line = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 400)); return document.querySelector('.pwa-line')?.textContent ?? ''; });
    check(/offline/i.test(line), `title screen says: "${line}"`, `title screen has no offline note (got "${line}")`);

    // offline: reload the shell under a few URLs
    await context.setOffline(true);
    for (const q of ['/', '/?mute', '/?level=world&mute&nobloom']) {
      await page.goto(origin + q);
      await page.waitForFunction(() => !!window.__blockspell, null, { timeout: 15000 });
      await page.waitForTimeout(700);
      const ok = await page.evaluate(() => {
        const api = window.__blockspell;
        api.load('sandbox');
        api.cast('big red ball', [0, 0]);
        api.step(1.5);
        api.render();
        const s = api.state();
        return { onLine: navigator.onLine, entities: s.entities?.length ?? s.entities ?? 0, canvas: !!document.querySelector('canvas') };
      });
      check(ok.canvas && !ok.onLine && ok.entities > 0, `offline reload of ${q} boots and casts a spell`, `offline reload of ${q} failed: ${JSON.stringify(ok)}`);
    }
    await context.setOffline(false);
    check(!external.length, 'no request left the origin', `external requests: ${external.join(', ')}`);
    check(!errors.length, 'no console errors', `console errors: ${errors.join(' | ')}`);
  } catch (e) {
    fail(`check crashed: ${e?.stack ?? e}`);
  } finally {
    await browser?.close().catch(() => {});
    stop();
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nall pwa checks passed');
  return failures ? 1 : 0;
}
main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
