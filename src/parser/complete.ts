import { getLexicon } from './lexicon';

export interface Completion {
  /** The whole spell bar text after accepting this suggestion. */
  text: string;
  /** What was completed ("hot air balloon"). */
  word: string;
  kind: 'noun' | 'adjective';
  /** The object or adjective id, for "new word" marks. */
  id: string;
  /** Characters of `word` the player already typed. */
  typed: number;
}

/**
 * Word completions for what's in the spell bar: the last word (or last few words, for things like
 * "hot air balloon") is matched as a prefix against every noun and adjective the parser knows. Nouns
 * come first and finish the spell; adjectives end with a space so the player can keep writing. After a
 * lone adjective ("big ") it suggests a few nouns. `known` marks nouns the player already discovered;
 * undiscovered ones are offered ahead of the rest, so completion doubles as discovery.
 */
export function complete(text: string, known: (nounId: string) => boolean = () => true, max = 6): Completion[] {
  if (!text.trim()) return [];
  const lex = getLexicon();
  const lower = text.toLowerCase();
  const trailingSpace = /\s$/.test(lower);
  const tokens = lower.split(/\s+/).filter(Boolean);
  const out: Completion[] = [];
  const seen = new Set<string>();
  const rank = (name: string, id: string, w: string) => (known(id) ? 1000 : 0) + (name === w ? 0 : 50) + name.length;

  const headOf = (n: number) => {
    // the text before the last n words, exactly as typed
    let rest = text.trimEnd();
    for (let i = 0; i < n; i++) rest = rest.replace(/\s*\S+$/, '');
    return rest ? rest + ' ' : '';
  };

  if (trailingSpace) {
    // "big " -> a few things to write next, but only when no noun is there yet
    const last = tokens[tokens.length - 1];
    if (!lex.adjectives.has(last) || lex.nouns.has(last)) return [];
    const picks = [...new Map([...lex.nouns.values()].filter((d) => !d.tags.includes('player')).map((d) => [d.id, d])).values()]
      .map((d) => ({ d, score: (known(d.id) ? 1000 : 0) + Math.random() * 400 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
    return picks.map(({ d }) => ({ text: text + d.name, word: d.name, kind: 'noun' as const, id: d.id, typed: 0 }));
  }

  const maxWords = Math.max(lex.maxNounWords, lex.maxAdjWords);
  for (let n = Math.min(maxWords, tokens.length); n >= 1; n--) {
    const phrase = tokens.slice(-n).join(' ');
    if (!/[a-z]/.test(tokens[tokens.length - 1])) break; // a bare count ("3") has nothing to complete yet
    const head = headOf(n);
    const nouns: Completion[] = [];
    const nounIds = new Set<string>();
    for (const [key, def] of lex.nouns) {
      if (def.tags.includes('player') || !key.startsWith(phrase) || key === phrase || nounIds.has(def.id)) continue;
      nounIds.add(def.id);
      nouns.push({ text: head + key, word: key, kind: 'noun', id: def.id, typed: phrase.length });
    }
    nouns.sort((a, b) => rank(a.word, a.id, phrase) - rank(b.word, b.id, phrase));
    const adjs: Completion[] = [];
    const adjIds = new Set<string>();
    for (const [key, adj] of lex.adjectives) {
      if (!key.startsWith(phrase) || key === phrase || adjIds.has(adj.id)) continue;
      adjIds.add(adj.id);
      adjs.push({ text: head + key + ' ', word: key, kind: 'adjective', id: adj.id, typed: phrase.length });
    }
    adjs.sort((a, b) => a.word.length - b.word.length);
    const all = [...nouns.slice(0, max - Math.min(2, adjs.length)), ...adjs.slice(0, 2)].slice(0, max);
    for (const c of all) if (!seen.has(c.text)) { seen.add(c.text); out.push(c); }
    if (out.length) break; // the longest phrase with matches wins
  }
  return out.slice(0, max);
}
