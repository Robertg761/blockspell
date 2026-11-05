// Copies the built game (../dist) into ./app so electron-builder can package it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist');
const out = path.join(here, 'app');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('desktop: ../dist is missing. Run "npm run build" in the repo root first.');
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(dist, out, { recursive: true });
// the service worker is for browsers; the desktop app already ships every file
fs.rmSync(path.join(out, 'sw.js'), { force: true });
console.log('desktop: copied dist/ to desktop/app/');
