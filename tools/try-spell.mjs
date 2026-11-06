// Try a few spells: node tools/try-spell.mjs "dog food" "a big red horse"
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { parseSpell } = await server.ssrLoadModule('/src/parser/parser.ts');
for (const p of process.argv.slice(2)) {
  const r = parseSpell(p);
  const tag = r.ok ? [r.approxFrom && `near: ${r.approxFrom}`, r.randomFrom && `random ${r.randomFrom}`, r.correctedFrom && `typo: ${r.correctedFrom}`, r.unknownAdjectives.length && `unknown: ${r.unknownAdjectives}`, r.ignoredNouns.length && `left out: ${r.ignoredNouns}`].filter(Boolean).join(', ') : '';
  console.log(JSON.stringify(p), '->', r.ok ? `${r.count > 1 ? r.count + ' x ' : ''}${r.label} ${tag && '(' + tag + ')'}` : `refused (${r.reason}) ${r.word ?? ''} -> try: ${r.suggestions ?? ''}`);
}
await server.close();
