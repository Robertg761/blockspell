#!/usr/bin/env node
// Offline check: scans a built site (default ./dist) for external http(s):// URLs.
//
//   FETCHED  (fails, exit 1): the URL would be requested at runtime, e.g. <img src>, <link href>,
//            <script src>, CSS url()/@import, fetch()/import()/new URL()/XMLHttpRequest.open()/
//            WebSocket/EventSource/importScripts/sendBeacon/new Worker/.load(), `.src = "..."`,
//            setAttribute('src', ...), manifest/JSON `src`. Protocol-relative //host/... counts too.
//   HARMLESS (listed, ignored): XML/SVG/XHTML namespaces, URLs in comments (license headers),
//            documentation links inside messages, <a href> navigation links, schema ids, other
//            string literals that are not in a fetch-like position.
//
// It classifies by context (a small JS tokenizer finds strings/comments), so it is pragmatic,
// not a proof: a URL stored in a variable and fetched far away can slip through.
//
// Usage: node scripts/check-offline.mjs [--dir <path>] [--quiet]   (or: npm run check-offline)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const dir = path.resolve(opt('--dir', 'dist'));
const quiet = args.includes('--quiet');
const EXT = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.svg', '.json', '.webmanifest']);

if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error(`check-offline: "${dir}" does not exist.\nRun "npm run build" first (or pass --dir <path>).`);
  process.exit(2);
}

const fetched = [];
const harmless = [];
const URL_RE = /(?:https?|wss?):\/\/[^\s"'`<>\\)\]}]+/g;
const trimUrl = (u) => u.replace(/[.,;:!?]+$/, '');
const isNamespace = (u) => /^https?:\/\/(www\.)?w3\.org\//i.test(u) || /^https?:\/\/(www\.)?(purl\.org|xmlns\.com|schemas\.xmlsoap\.org|ns\.adobe\.com|inkscape\.org\/namespaces|sodipodi\.sourceforge\.net)\b/i.test(u);

function lineOf(text, idx) {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < idx; i = text.indexOf('\n', i + 1)) n++;
  return n;
}
function snippet(text, idx, len = 0) {
  const s = text.slice(Math.max(0, idx - 50), idx + len + 50).replace(/\s+/g, ' ').trim();
  return s.length > 150 ? s.slice(0, 150) + '…' : s;
}
function add(list, file, text, idx, url, why) {
  list.push({ file, line: lineOf(text, idx), url, why, ctx: snippet(text, idx, url.length) });
}

// ------------------------------------------------------------------ CSS
function scanCss(file, css, base = 0, whole = css) {
  const cmt = [];
  css.replace(/\/\*[\s\S]*?\*\//g, (m, i) => { cmt.push([i, i + m.length]); return m; });
  const inComment = (i) => cmt.some(([a, b]) => i >= a && i < b);
  const seen = new Set();
  const fetchedRe = /url\(\s*(["']?)((?:https?:)?\/\/[^"')\s]+)\1\s*\)|@import\s+(?:url\(\s*)?(["'])((?:https?:)?\/\/[^"']+)\3/gi;
  for (const m of css.matchAll(fetchedRe)) {
    if (inComment(m.index)) continue;
    const url = m[2] || m[4];
    seen.add(m.index + m[0].indexOf(url));
    add(fetched, file, whole, base + m.index, url, m[0].startsWith('@') ? 'CSS @import' : 'CSS url()');
  }
  for (const m of css.matchAll(URL_RE)) {
    if (seen.has(m.index)) continue;
    const url = trimUrl(m[0]);
    add(harmless, file, whole, base + m.index, url, inComment(m.index) ? 'CSS comment' : isNamespace(url) ? 'namespace' : 'CSS string/other (not loaded)');
  }
}

// ------------------------------------------------------------------ JS
// Minimal tokenizer: finds string / template / comment tokens, skipping regex literals.
function tokenizeJs(src) {
  const toks = [];
  let i = 0, lastSig = '', lastWord = '';
  const REGEX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', '+', '-', '*', '%', '<', '>', '~', '^', '}']);
  const KW = new Set(['return', 'typeof', 'case', 'delete', 'void', 'throw', 'in', 'of', 'else', 'do', 'yield', 'await', 'instanceof', 'new']);
  function code(stopAtBrace) {
    let depth = 0;
    while (i < src.length) {
      const c = src[i], n = src[i + 1];
      if (c === '/' && n === '/') { const s = i; while (i < src.length && src[i] !== '\n') i++; toks.push({ type: 'comment', start: s, value: src.slice(s, i) }); continue; }
      if (c === '/' && n === '*') { const s = i; const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; toks.push({ type: 'comment', start: s, value: src.slice(s, i) }); continue; }
      if (c === '"' || c === "'") {
        const s = i++; while (i < src.length && src[i] !== c && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
        i++; toks.push({ type: 'string', start: s, end: i, value: src.slice(s + 1, i - 1) }); lastSig = c; lastWord = ''; continue;
      }
      if (c === '`') {
        const s = i++; let val = '';
        while (i < src.length && src[i] !== '`') {
          if (src[i] === '\\') { val += src.slice(i, i + 2); i += 2; }
          else if (src[i] === '$' && src[i + 1] === '{') { i += 2; val += '\u0000'; code(true); }
          else val += src[i++];
        }
        i++; toks.push({ type: 'template', start: s, end: i, value: val }); lastSig = '`'; lastWord = ''; continue;
      }
      if (c === '/' && (REGEX_AFTER.has(lastSig) || KW.has(lastWord)) && lastSig !== '}') {
        i++; let cls = false;
        while (i < src.length && src[i] !== '\n' && (cls || src[i] !== '/')) { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; }
        i++; while (/[a-z]/i.test(src[i] ?? '')) i++;
        lastSig = ')'; lastWord = ''; continue;
      }
      if (stopAtBrace) { if (c === '{') depth++; else if (c === '}') { if (depth === 0) { i++; return; } depth--; } }
      if (/[\w$]/.test(c)) { const s = i; while (i < src.length && /[\w$]/.test(src[i])) i++; lastWord = src.slice(s, i); lastSig = 'w'; continue; }
      if (!/\s/.test(c)) { lastSig = c; lastWord = ''; }
      i++;
    }
  }
  code(false);
  return toks;
}

const FETCH_FNS = new Set(['fetch', 'importScripts', 'sendBeacon', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'Request', 'URL', 'import', 'Audio', 'load', 'loadAsync', 'loadScript', 'XMLHttpRequest']);
const SRC_ATTRS = /^(src|srcset|poster|data|href|xlink:href)$/i;

/** What fetch-like call/assignment (if any) directly precedes position `start` in `src`? */
function fetchContext(src, start, end) {
  const pre = src.slice(Math.max(0, start - 400), start).replace(/\s+$/, '');
  // unclosed call: ident( ... arg, <here>
  let depth = 0, j = pre.length - 1;
  for (; j >= 0; j--) {
    const ch = pre[j];
    if (ch === ')' || ch === ']' || ch === '}') depth++;
    else if (ch === '(' || ch === '[' || ch === '{') { if (depth === 0) break; depth--; }
    else if (ch === ';' && depth === 0) { j = -1; break; }
  }
  if (j >= 0 && pre[j] === '(') {
    const before = pre.slice(0, j).replace(/\s+$/, '');
    const callee = /([\w$]+)$/.exec(before)?.[1];
    const argsBefore = pre.slice(j + 1);
    const argIdx = (argsBefore.match(/,/g) || []).length;
    if (callee) {
      if (callee === 'open' && /\.\s*open$/.test(before) && argIdx === 1) return 'XMLHttpRequest.open()';
      if (callee === 'setAttribute' && argIdx === 1 && SRC_ATTRS.test((/["'`]([\w:-]+)["'`]\s*,\s*$/.exec(argsBefore) || [])[1] || '')) return `setAttribute(${/["'`]([\w:-]+)["'`]/.exec(argsBefore)[1]})`;
      if (FETCH_FNS.has(callee) && (argIdx === 0 || callee === 'URL')) return `${callee}()`;
      if (/^(load|loadAsync)$/.test(callee) && argIdx === 0) return `${callee}()`;
    }
    if (/\bimport\s*$/.test(before)) return 'import()';
  }
  if (/\b(?:from|import)\s*$/.test(pre)) return 'import statement';
  const asg = /([\w$.]+)\s*=\s*$/.exec(pre);
  if (asg && /(?:^|\.)(src|srcset|poster|action|data)$/i.test(asg[1])) return `.${asg[1].split('.').pop()} =`;
  if (asg && /\.href$/.test(asg[1]) && !/location\.href$/.test(asg[1])) return '.href =';
  if (/\b(src|url|srcset|poster)\s*:\s*$/.test(pre)) return `${/(\w+)\s*:\s*$/.exec(pre)[1]}: property`;
  // variable indirection: x = "http..."; ... fetch(x)
  if (asg && /^[\w$]+$/.test(asg[1])) {
    const after = src.slice(end, end + 500);
    const re = new RegExp(`\\b(?:${[...FETCH_FNS].join('|')})\\s*\\(\\s*${asg[1].replace(/\$/g, '\\$')}\\b`);
    if (re.test(after)) return `variable "${asg[1]}" passed to a fetch-like call`;
  }
  return null;
}

function scanJs(file, src, base = 0, whole = src) {
  for (const t of tokenizeJs(src)) {
    const where = base + t.start;
    if (t.type === 'comment') {
      for (const m of t.value.matchAll(URL_RE)) add(harmless, file, whole, where + m.index, trimUrl(m[0]), 'comment');
      continue;
    }
    const v = t.value;
    // protocol-relative whole-string URL in a fetch position
    const rel = /^\/\/[\w-]+(?:\.[\w-]+)+(?:[/?#:]|$)/.test(v);
    if (rel) {
      const ctx = fetchContext(src, t.start, t.end);
      if (ctx) add(fetched, file, whole, where, v, `${ctx} (protocol-relative)`);
      continue;
    }
    for (const m of v.matchAll(URL_RE)) {
      const url = trimUrl(m[0]);
      const at = where + 1 + m.index;
      if (isNamespace(url)) { add(harmless, file, whole, at, url, 'namespace'); continue; }
      const whole1 = v.trim() === url; // the string is just the URL
      let ctx = whole1 ? fetchContext(src, t.start, t.end) : null;
      if (!ctx) {
        // URL inside an HTML/CSS snippet: <img src="http...">, url(http...)
        const before = v.slice(Math.max(0, m.index - 80), m.index);
        const attr = /<(\w+)[^>]*?\s([\w:-]+)\s*=\s*["']?$/.exec(before);
        if (attr && SRC_ATTRS.test(attr[2]) && !(/^a$/i.test(attr[1]) || /^area$/i.test(attr[1]))) ctx = `<${attr[1]} ${attr[2]}> in string`;
        else if (/url\(\s*["']?$/i.test(before) || /@import\s+["']?$/i.test(before)) ctx = 'CSS url() in string';
      }
      if (ctx) add(fetched, file, whole, at, url, ctx);
      else add(harmless, file, whole, at, url, whole1 ? 'string literal, not in a fetch position' : 'documentation/message text');
    }
  }
}

// ------------------------------------------------------------------ HTML / SVG
const FETCH_TAG_ATTRS = {
  script: ['src'], img: ['src', 'srcset'], source: ['src', 'srcset'], video: ['src', 'poster'], audio: ['src'], track: ['src'],
  iframe: ['src'], frame: ['src'], embed: ['src'], input: ['src'], object: ['data'], link: ['href', 'imagesrcset'],
  image: ['href', 'xlink:href', 'src'], use: ['href', 'xlink:href'], feimage: ['href', 'xlink:href'], pattern: ['href', 'xlink:href'],
  mask: ['href', 'xlink:href'], filter: ['href', 'xlink:href'], lineargradient: ['href', 'xlink:href'], radialgradient: ['href', 'xlink:href'],
  textpath: ['href', 'xlink:href'], body: ['background'], td: ['background'], th: ['background'],
};
function scanHtml(file, html) {
  // comments
  const skip = [];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\?xml[^>]*\?>/gi)) {
    skip.push([m.index, m.index + m[0].length]);
    for (const u of m[0].matchAll(URL_RE)) add(harmless, file, html, m.index + u.index, trimUrl(u[0]), m[0].startsWith('<!--') ? 'HTML comment' : 'doctype/xml declaration');
  }
  const inSkip = (i) => skip.some(([a, b]) => i >= a && i < b);
  const tagRe = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>=\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
  const taken = new Set();
  for (const m of html.matchAll(tagRe)) {
    if (inSkip(m.index)) continue;
    const tag = m[1].toLowerCase();
    const attrRe = /([^\s"'>=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    const attrsStart = m.index + m[0].indexOf(m[2]);
    for (const a of m[2].matchAll(attrRe)) {
      const name = a[1].toLowerCase();
      const val = a[2] ?? a[3] ?? a[4];
      if (val === undefined) continue;
      const valIdx = attrsStart + a.index + a[0].lastIndexOf(val);
      const urls = name.endsWith('srcset') ? val.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean) : [val.trim()];
      const loads = (FETCH_TAG_ATTRS[tag] ?? []).includes(name) || (name === 'src') || (name === 'poster') || (name === 'srcset');
      for (const u of urls) {
        if (!/^(?:https?:)?\/\//i.test(u)) {
          // style="background:url(http://..)" etc.
          continue;
        }
        taken.add(valIdx);
        if (loads) add(fetched, file, html, valIdx, u, `<${tag} ${name}>`);
        else add(harmless, file, html, valIdx, u, name.startsWith('xmlns') ? 'namespace' : `<${tag} ${name}> (navigation link / not loaded)`);
      }
    }
    // inline style attr with url()
    for (const s of m[2].matchAll(/style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) scanCss(file, s[1] ?? s[2] ?? '', m.index, html);
  }
  // inline <script> / <style> bodies
  const covered = [];
  for (const m of html.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const bodyIdx = m.index + m[0].indexOf('>') + 1;
    covered.push([bodyIdx, bodyIdx + m[3].length]);
    if (!m[3].trim()) continue;
    if (m[1].toLowerCase() === 'style') scanCss(file, m[3], bodyIdx, html);
    else if (!/type\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/(?:template|html))/i.test(m[2])) scanJs(file, m[3], bodyIdx, html);
    else for (const u of m[3].matchAll(URL_RE)) add(harmless, file, html, bodyIdx + u.index, trimUrl(u[0]), 'data block (JSON-LD / template)');
  }
  // anything else (text content, xmlns on svg root handled above, unknown spots)
  const known = new Set([...fetched, ...harmless].filter((x) => x.file === file).map((x) => `${x.line}|${x.url}`));
  for (const m of html.matchAll(URL_RE)) {
    if (inSkip(m.index) || taken.has(m.index) || covered.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const url = trimUrl(m[0]);
    if (known.has(`${lineOf(html, m.index)}|${url}`)) continue;
    add(harmless, file, html, m.index, url, isNamespace(url) ? 'namespace' : 'text content / other attribute');
  }
}

// ------------------------------------------------------------------ JSON / manifest
function scanJson(file, text) {
  let data;
  try { data = JSON.parse(text); } catch { for (const m of text.matchAll(URL_RE)) add(harmless, file, text, m.index, trimUrl(m[0]), 'unparseable JSON'); return; }
  const isManifest = file.endsWith('.webmanifest');
  const walk = (v, key) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/(?:https?:)?\/\/[^\s"'<>]+/g)) {
        if (!/^(https?:)?\/\/[\w-]+(\.[\w-]+)+/.test(m[0])) continue;
        const url = trimUrl(m[0]);
        const idx = Math.max(0, text.indexOf(url));
        const loads = /^(src|srcset|href|poster)$/i.test(key) || (isManifest && /^(url|icon|start_url)$/i.test(key) && false);
        if (isNamespace(url)) add(harmless, file, text, idx, url, 'namespace');
        else if (loads) add(fetched, file, text, idx, url, `JSON "${key}"`);
        else add(harmless, file, text, idx, url, /^\$(schema|id)$/.test(key) ? 'schema identifier' : `JSON "${key}" (metadata, not loaded)`);
      }
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(data, '');
}

// ------------------------------------------------------------------ run
function* files(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (EXT.has(path.extname(e.name).toLowerCase())) yield p;
  }
}
let count = 0;
for (const p of files(dir)) {
  count++;
  const rel = path.relative(process.cwd(), p) || p;
  const text = fs.readFileSync(p, 'utf8');
  switch (path.extname(p).toLowerCase()) {
    case '.css': scanCss(rel, text); break;
    case '.js': case '.mjs': case '.cjs': scanJs(rel, text); break;
    case '.json': case '.webmanifest': scanJson(rel, text); break;
    default: scanHtml(rel, text);
  }
}

const fmt = (x) => `  ${x.file}:${x.line}  ${x.url}\n      [${x.why}]  …${x.ctx}…`;
console.log(`check-offline: scanned ${count} file(s) in ${dir}`);
if (harmless.length && !quiet) {
  console.log(`\nHarmless URLs (ignored, ${harmless.length}):`);
  for (const x of harmless) console.log(`  ${x.file}:${x.line}  ${x.url}  [${x.why}]`);
}
if (fetched.length) {
  console.error(`\nFETCHED external URLs (would hit the network at runtime):`);
  for (const x of fetched) console.error(fmt(x));
}
console.log(`\n${fetched.length} fetched (fail) / ${harmless.length} harmless (listed)`);
if (fetched.length) {
  console.error('FAIL: the build is not fully offline.');
  process.exit(1);
}
console.log('OK: no external resources are fetched.');
