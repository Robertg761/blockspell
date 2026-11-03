#!/usr/bin/env node
// Headless task check: serves ./dist with `vite preview` on a free port, drives the system Chrome
// (software WebGL) with playwright-core and checks, in one fresh browser profile:
//
//   1. __blockspell.solveAll(): every level and task solution, the 3 distinct ways and zone reset
//      checks per task, the idle check per zone and the zone reset leak check.
//   2. __blockspell.solveAll({ seeds: [1, 2, 3] }): every task solution once per seed.
//   3. Offline: the network is switched off (context.setOffline) and a task is completed for real
//      through the world, with frames rendering, while any request attempt counts as a failure.
//   4. Persistence: back online, the page is reloaded (there is no service worker, so a reload needs
//      the local server), Explore is clicked, J opens the Journal and the task must show as done.
//
// Every non-localhost request is blocked and reported. Any FAIL, console error, page error, blocked or
// failed request exits non-zero. The preview server is always stopped.
//
// HD voxels: headless Chrome renders in software, so the game picks the coarse look on its own. Force a
// mode with BLOCKSPELL_HD=1 (or 0) or --hd=1 (or --hd=0); it is passed to the page as ?hd=.
//
// Usage: npm run build && npm run check-tasks   (or: node scripts/check-tasks.mjs [--no-seeds] [--hd=1])
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';
const CHROME_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const HD = args.find((a) => a.startsWith('--hd='))?.slice(5) ?? process.env.BLOCKSPELL_HD;
const HDQ = HD !== undefined && HD !== '' ? `&hd=${encodeURIComponent(HD)}` : '';
const TASK = 'cross-gap'; // completed for real in the offline and reload steps

const problems = [];
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`FAIL  ${msg}`);
};
const pass = (msg) => console.log(`PASS  ${msg}`);

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, child, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`vite preview exited early (code ${child.exitCode})`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`vite preview did not answer at ${url} within ${ms / 1000} s`);
}

function report(results, label) {
  for (const r of results) {
    const name = `${label}${r.level ? `level ${r.level}` : `task ${r.task}`}: ${r.solution}${r.seed !== undefined ? ` [seed ${r.seed}]` : ''}`;
    if (r.pass) pass(`${name} (${r.time} s)`);
    else {
      fail(`${name}: ${r.error ?? 'failed'}`);
      for (const line of r.log ?? []) console.log(`        ${line}`);
    }
  }
}

async function main() {
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('check-tasks: dist/index.html is missing. Run "npm run build" first.');
    return 2;
  }
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const vite = path.join(root, 'node_modules', '.bin', 'vite');
  const server = spawn(vite, ['preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  const stopServer = () => {
    if (server.exitCode !== null || server.killed) return;
    try {
      if (process.platform !== 'win32') process.kill(-server.pid, 'SIGTERM');
      else server.kill('SIGTERM');
    } catch {
      server.kill('SIGKILL');
    }
  };
  const onSignal = () => {
    stopServer();
    process.exit(130);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  process.on('exit', stopServer);

  let browser;
  try {
    await waitForServer(origin + '/', server);
    console.log(`serving dist at ${origin}`);
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: CHROME_ARGS });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let offline = false;
    await context.route('**/*', (route) => {
      const url = route.request().url();
      const local = url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:');
      if (!local) {
        problems.push(`blocked external request: ${url}`);
        return route.abort();
      }
      if (offline) problems.push(`request while offline: ${url}`);
      return route.continue();
    });
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));

    await page.goto(origin + '/?mute' + HDQ);
    await page.waitForFunction(() => !!window.__blockspell);
    await page.waitForTimeout(1000);
    const hd = await page.evaluate(() => window.__blockspell.hd());
    console.log(`HD voxels: ${hd.enabled ? 'on' : 'off'} (${hd.reason}; ${hd.gpu || 'unknown GPU'})`);
    if (HD !== undefined && HD !== '' && hd.enabled !== (HD !== '0' && HD !== 'off')) fail(`HD voxels should be ${HD === '0' ? 'off' : 'on'} here`);

    // 1 and 2: every scripted solution and check
    let t = Date.now();
    report(await page.evaluate(() => window.__blockspell.solveAll()), '');
    console.log(`solveAll: ${((Date.now() - t) / 1000).toFixed(1)} s`);
    if (!args.includes('--no-seeds')) {
      t = Date.now();
      const seeded = await page.evaluate(() => window.__blockspell.solveAll({ seeds: [1, 2, 3] }));
      report(seeded, 'seeded run, ');
      console.log(`seeded solveAll: ${((Date.now() - t) / 1000).toFixed(1)} s`);
    }

    // 3: offline play. The save starts empty in this fresh profile (solveAll restores it).
    const before = await page.evaluate((id) => JSON.parse(localStorage.getItem('blockspell.world.v1') ?? '{}').tasks?.[id] ?? null, TASK);
    if (before) fail(`the save already has ${TASK} before the offline step`);
    offline = true;
    await context.setOffline(true);
    const res = await page.evaluate((id) => {
      const api = window.__blockspell;
      api.load('world');
      const r = api.playTask(id, 0);
      return { pass: r.pass, error: r.error, saved: JSON.parse(localStorage.getItem('blockspell.world.v1') ?? '{}').tasks?.[id] ?? null };
    }, TASK);
    await page.waitForTimeout(1500); // let real frames render with the network off
    const online = await page.evaluate(() => navigator.onLine);
    if (res.pass && res.saved && !online) pass(`offline: completed ${TASK} with the network off (navigator.onLine = false), saved ${JSON.stringify(res.saved.ways)}`);
    else fail(`offline: ${TASK} not completed or not saved with the network off: ${JSON.stringify(res)} onLine=${online}`);
    await context.setOffline(false);
    offline = false;

    // 4: reload, Explore, Journal shows it done
    await page.goto(origin + '/?mute' + HDQ);
    await page.waitForFunction(() => !!window.__blockspell);
    await page.click('.explore-btn');
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyJ');
    await page.waitForSelector('.journal');
    const rows = await page.$$eval('.journal-task', (els) =>
      els.map((e) => ({ title: e.querySelector('.journal-title')?.textContent, done: e.classList.contains('done'), ways: e.querySelector('.journal-ways')?.textContent })),
    );
    const title = await page.evaluate((id) => window.__blockspell.tasks().find((x) => x.id === id)?.title, TASK);
    const row = rows.find((r) => r.title === title);
    if (row?.done && row.ways === 'ways found: 1') pass(`reload: the Journal shows "${title}" done (${row.ways})`);
    else fail(`reload: the Journal does not show "${title}" done: ${JSON.stringify(row ?? rows)}`);
    const others = rows.filter((r) => r.title !== title && r.done);
    if (others.length) fail(`reload: other tasks show done: ${others.map((r) => r.title).join(', ')}`);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(300);
    if (await page.isVisible('.journal')) fail('J did not close the Journal');
  } catch (e) {
    fail(`check crashed: ${e?.stack ?? e}`);
    if (serverLog) console.log(serverLog);
  } finally {
    await browser?.close().catch(() => {});
    stopServer();
  }

  for (const p of problems) fail(p);
  console.log(failures ? `\n${failures} failure(s)` : '\nall task checks passed');
  return failures ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
