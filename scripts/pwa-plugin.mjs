// Vite plugin: after the build, writes dist/sw.js (scripts/sw-template.js with a hash of the build and the
// list of every emitted file), so the service worker precaches exactly what this build needs.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

export function precachePlugin() {
  let outDir = 'dist';
  return {
    name: 'blockspell-precache',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!fs.existsSync(outDir)) return;
      const files = walk(outDir).filter((f) => f !== 'sw.js').sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(fs.readFileSync(path.join(outDir, f)));
      const version = hash.digest('hex').slice(0, 10);
      // the shell is cached as './' and './index.html'
      const list = ['./', ...files.map((f) => `./${f}`)];
      const src = fs.readFileSync(path.join(here, 'sw-template.js'), 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(list));
      fs.writeFileSync(path.join(outDir, 'sw.js'), src);
    },
  };
}
