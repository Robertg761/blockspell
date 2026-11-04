#!/usr/bin/env node
// Renders public/icon.svg to the PNG icons the web app manifest needs (192, 512, a maskable 512 with
// extra safe-zone padding, and a 180 apple-touch-icon). Uses the system Chrome through playwright-core.
// Usage: node tools/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

async function render(name, size, padding = 0) {
  const inner = size - padding * 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:#4a8fe0"><div style="width:${size}px;height:${size}px;padding:${padding}px;box-sizing:border-box">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></div></body>`,
  );
  await page.screenshot({ path: path.join(pub, name), omitBackground: false });
  console.log('wrote', name);
}

await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('icon-maskable-512.png', 512, 64);
await render('apple-touch-icon.png', 180);
await browser.close();
