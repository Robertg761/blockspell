// Launches the desktop app (electron . , or a packaged binary via APP_BIN) and checks the game boots: window title, a WebGL canvas,
// and a spell can be cast. Usage: (cd .. && npm run build) && npm run prepare-app && xvfb-run -a node smoke.mjs
import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = await electron.launch({
  executablePath: process.env.APP_BIN ?? path.join(here, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron'),
  args: process.env.APP_BIN ? ['--no-sandbox'] : [here, '--no-sandbox'],
  env: { ...process.env, BLOCKSPELL_SOFTWARE_GL: '1' },
});
let ok = true;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) ok = false; };
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.waitForSelector('canvas', { timeout: 30000 });
  check(page.url().startsWith('app://blockspell/'), `served from ${page.url()}`);
  check((await page.title()) === 'Blockspell', 'window title is Blockspell');
  await page.waitForSelector('.demo-btn', { timeout: 20000 });
  check((await page.locator('.install-btn, .get-app-link').count()) === 0, 'no download prompt inside the desktop app');
  await page.click('.freeplay-btn');
  await page.waitForTimeout(1500);
  const input = page.locator('input[type=text], input:not([type])').first();
  await input.fill('big red ball');
  await input.press('Enter');
  await page.waitForTimeout(1500);
  check(errors.length === 0, errors.length ? `page errors: ${errors.join('; ')}` : 'no page errors');
  await page.screenshot({ path: path.join(here, 'smoke.png') });
} catch (e) {
  console.log('FAIL ', e.message);
  ok = false;
}
await app.close();
process.exit(ok ? 0 : 1);
