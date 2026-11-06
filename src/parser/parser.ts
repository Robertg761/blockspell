import type { AdjectiveDef } from '../adjectives/types';
import type { ObjectDef } from '../objects/types';
import { objects } from '../objects';
import { correctTypo, typoCost, typoLimit } from './fuzzy';
import { getLexicon } from './lexicon';
import { CONNECTORS, extractCount, INTENSIFIERS, SHADES, singulars, tokenize } from './normalize';
import { FLUFF } from './thesaurus';

export type ParseResult =
  | {
      ok: true;
      def: ObjectDef;
      adjectives: AdjectiveDef[];
      /** Adjective words we didn't recognise (the object still spawns). */
      unknownAdjectives: string[];
      count: number;
      /** Human-readable label, e.g. "big red ball". */
      label: string;
      /** Set when the noun was auto-corrected from a typo. */
      correctedFrom?: string;
      /** Set when Blockspell has no model of this word and `def` is the closest thing it has ("horse" -> cow). */
      approxFrom?: string;
      /** Set when the word names a whole kind ("food") and `def` is a random member of it. */
      randomFrom?: string;
      /** Other things named in the spell that were left out, because a spell conjures one kind of thing. */
      ignoredNouns: string[];
    }
  | { ok: false; reason: 'empty' }
  /** `word` is the unknown noun; `suggestions` are up to 3 close or related known nouns. */
  | { ok: false; reason: 'unknown'; word: string; suggestions: string[] };

/**
 * Common words Blockspell has no model for, mapped to the closest things it
 * does know. Only consulted when the word itself is unknown.
 */
const RELATED: Record<string, string[]> = {
  dinosaur: ['dragon', 'turtle', 'frog'],
  lizard: ['dragon', 'frog', 'turtle'],
  snake: ['rope', 'frog', 'fish'],
  horse: ['cow', 'sheep', 'car'],
  unicorn: ['dragon', 'cow', 'star'],
  monster: ['dragon', 'bear', 'robot'],
  house: ['hut', 'wall', 'door'],
  castle: ['wall', 'hut', 'stairs'],
  tower: ['ladder', 'wall', 'stairs'],
  table: ['chair', 'crate', 'box'],
  bed: ['pillow', 'chair', 'crate'],
  ship: ['boat', 'rocket', 'ufo'],
  bike: ['skateboard', 'car', 'train'],
  bicycle: ['skateboard', 'car', 'train'],
  lamp: ['torch', 'candle', 'sun'],
  light: ['torch', 'candle', 'sun'],
  gun: ['sword', 'hammer', 'bomb'],
  knife: ['sword', 'hammer', 'key'],
  shield: ['door', 'wall', 'crate'],
  wizard: ['book', 'star', 'candle'],
  ghost: ['cloud', 'pillow', 'balloon'],
  moon: ['sun', 'star', 'rock'],
  planet: ['ball', 'sun', 'star'],
  river: ['water', 'bridge', 'boat'],
  lake: ['water', 'boat', 'fish'],
  mountain: ['rock', 'stairs', 'ramp'],
  hill: ['ramp', 'rock', 'stairs'],
  gold: ['coin', 'key', 'star'],
  money: ['coin', 'gift', 'key'],
  sandwich: ['bread', 'burger', 'cheese'],
  milk: ['mug', 'bottle', 'cow'],
};

type Tier = 'noun' | 'alias' | 'near' | 'category';
interface Hit {
  def: ObjectDef;
  tier: Tier;
  /** The category word, when the def is a random pick. */
  random?: string;
}

interface Index {
  /** Every known key (nouns, aliases, near, kinds), for typo correction. */
  entries: [string, Hit][];
  /** The same keys with the spaces taken out ("fireplace" matches "fire place"). */
  squashed: Map<string, Hit>;
  /** Words that appear in names, synonyms and blurbs, for "did you mean" hints. */
  words: Map<string, ObjectDef[]>;
}

let index: Index | null = null;
function getIndex(): Index {
  if (index) return index;
  const lex = getLexicon();
  const entries: [string, Hit][] = [];
  const squashed = new Map<string, Hit>();
  const add = (key: string, hit: Hit) => {
    entries.push([key, hit]);
    const sq = key.replace(/ /g, '');
    if (!squashed.has(sq)) squashed.set(sq, hit);
  };
  for (const [k, def] of lex.nouns) add(k, { def, tier: 'noun' });
  for (const [k, def] of lex.aliases) add(k, { def, tier: 'alias' });
  for (const [k, def] of lex.near) add(k, { def, tier: 'near' });
  for (const [k, defs] of lex.categories) add(k, { def: defs[0], tier: 'category', random: k });
  const words = new Map<string, ObjectDef[]>();
  const stop = new Set(['the', 'and', 'with', 'for', 'that', 'this', 'your', 'you', 'it', 'is', 'to', 'of', 'in', 'on', 'a', 'an', 'at', 'up', 'can', 'press']);
  for (const def of objects.all()) {
    if (def.levelOnly || def.tags.includes('player')) continue;
    const text = [def.id, def.name, ...(def.synonyms ?? [])].join(' ') + ' ' + (def.blurb ?? '');
    for (const w of new Set(tokenize(text))) {
      if (w.length < 3 || stop.has(w)) continue;
      for (const f of singulars(w)) (words.get(f) ?? words.set(f, []).get(f)!).push(def);
    }
  }
  index = { entries, squashed, words };
  return index;
}

/** Looks a word or phrase up, trying plural forms of its last word and spacing differences. */
function lookupSpan(words: string[]): Hit | undefined {
  const lex = getLexicon();
  const last = words[words.length - 1];
  const head = words.slice(0, -1);
  // most certain meaning first: "glasses" is a drinking glass (a synonym) before it is eyeglasses (a near match)
  const forms = singulars(last).map((form) => [...head, form].join(' '));
  for (const key of forms) {
    const noun = lex.nouns.get(key);
    if (noun) return { def: noun, tier: 'noun' };
  }
  for (const key of forms) {
    const alias = lex.aliases.get(key);
    if (alias) return { def: alias, tier: 'alias' };
  }
  for (const key of forms) {
    const near = lex.near.get(key);
    if (near) return { def: near, tier: 'near' };
  }
  for (const key of forms) {
    const kind = lex.categories.get(key);
    if (kind) return { def: kind[Math.floor(Math.random() * kind.length)], tier: 'category', random: key };
  }
  if (words.length > 1) {
    const { squashed } = getIndex();
    for (const form of singulars(last)) {
      const hit = squashed.get(head.join('') + form);
      if (hit) return hit.tier === 'category' ? lookupSpan([hit.random!]) : hit;
    }
  }
  return undefined;
}

/** The longest phrase ending at `end` that names something. */
function resolveHead(rest: string[], end: number, maxWords: number): { hit: Hit; len: number } | undefined {
  for (let n = Math.min(maxWords, end); n >= 1; n--) {
    const hit = lookupSpan(rest.slice(end - n, end));
    if (hit) return { hit, len: n };
  }
  return undefined;
}

const sameDef = (a: Hit, b: Hit) => a.def === b.def;

/**
 * Typo correction for a phrase. One word: any known key. Several: the other words must be exactly
 * right and one word a clear slip ("ice creem"), so "big red" is never read as a misspelled "big tree".
 */
function correctSpan(span: string[], entries: [string, Hit][]) {
  if (span.length === 1) return correctTypo(span[0], entries, sameDef) ?? correctTypo(singulars(span[0])[1] ?? span[0], entries, sameDef);
  for (let p = span.length - 1; p >= 0; p--) {
    const pool: [string, Hit][] = [];
    for (const [key, hit] of entries) {
      const words = key.split(' ');
      if (words.length === span.length && words.every((w, i) => i === p || w === span[i])) pool.push([words[p], hit]);
    }
    const typo = correctTypo(span[p], pool, sameDef);
    if (typo) return typo;
  }
  return null;
}

const SKIP = new Set(['and', 'or', 'but', 'also', 'is', 'a', 'an', 'the', 'its', 'very']);

function adjectiveAt(tokens: string[], i: number): { adj: AdjectiveDef; len: number } | undefined {
  const lex = getLexicon();
  for (let n = Math.min(lex.maxAdjWords, tokens.length - i); n >= 1; n--) {
    const phrase = tokens.slice(i, i + n).join(' ');
    const adj = lex.adjectives.get(phrase) ?? lex.adjAliases.get(phrase);
    if (adj) return { adj, len: n };
  }
  return undefined;
}

const isFluff = (t: string) => singulars(t).some((f) => FLUFF.has(f));

/** True for a word that can sit after the noun without being part of it ("ball red", "pizza slices"). */
function isAdjLike(t: string): boolean {
  return INTENSIFIERS.has(t) || SKIP.has(t) || isFluff(t) || !!adjectiveAt([t], 0);
}

function readAdjectives(tokens: string[], silent: boolean) {
  const found: AdjectiveDef[] = [];
  const unknown: string[] = [];
  const nouns: string[] = [];
  const lex = getLexicon();
  const adjEntries = [...lex.adjectives, ...lex.adjAliases];
  let intensity = 1;
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    if (INTENSIFIERS.has(t)) { intensity++; i++; continue; }
    if (SKIP.has(t) || CONNECTORS.has(t)) { i++; continue; }
    // "dark blue", "light green": the shade doesn't change which color it is
    if (SHADES.has(t)) {
      const next = adjectiveAt(tokens, i + 1);
      if (next?.adj.category === 'color') { i++; continue; }
    }
    const hit = adjectiveAt(tokens, i);
    if (hit) {
      for (let k = 0; k < Math.min(3, intensity); k++) found.push(hit.adj);
      intensity = 1;
      i += hit.len;
      continue;
    }
    intensity = 1;
    if (isFluff(t)) { i++; continue; }
    const noun = lookupSpan([t]);
    if (noun && noun.tier !== 'category') { nouns.push(t); i++; continue; }
    const typo = t.length >= 3 ? correctTypo(t, adjEntries) : null;
    if (typo) found.push(typo.value);
    else if (!silent) unknown.push(t);
    i++;
  }
  return { found, unknown, nouns };
}

/**
 * Parses "[count] [adjectives...] noun". The noun is the longest phrase that matches at the end of the
 * input; everything before it is adjectives. How a noun is matched, most certain first:
 *  1. a thing's own name or synonym ("kitten"), plurals and spacing included;
 *  2. a thesaurus synonym ("poodle", "dog food"): same result;
 *  3. a near match ("horse" -> cow), flagged so the player is told;
 *  4. a kind word ("food"): a random member, flagged;
 *  5. a typo of any of those, only when it is clearly a slip and clearly one word.
 * Anything else is "unknown", with suggestions. Wrong answers are worse than none.
 */
export function parseSpell(input: string): ParseResult {
  const tokens = tokenize(input);
  if (!tokens.length) return { ok: false, reason: 'empty' };
  const lex = getLexicon();
  const { count, rest: all } = extractCount(tokens);

  // "a dog with a hat", "a cat on fire": the thing comes first, the rest only describes it
  let rest = all;
  let tail: string[] = [];
  // (so is a verb after the thing: "a dragon breathing fire")
  const cut = all.findIndex((t, i) => i > 0 && (CONNECTORS.has(t) || (t.length >= 5 && t.endsWith('ing') && !adjectiveAt([t], 0) && !!resolveHead(all, i, lex.maxNounWords))));
  if (cut > 0) { rest = all.slice(0, cut); tail = all.slice(cut); }

  let found: { hit: Hit; len: number } | undefined;
  let end = rest.length;
  for (; end >= 1; end--) {
    found = resolveHead(rest, end, lex.maxNounWords);
    if (found || !isAdjLike(rest[end - 1])) break;
  }

  let correctedFrom: string | undefined;
  if (!found) {
    end = rest.length;
    const { entries } = getIndex();
    for (let n = Math.min(lex.maxNounWords, rest.length); n >= 1 && !found; n--) {
      const span = rest.slice(-n);
      const typo = correctSpan(span, entries);
      if (!typo) continue;
      const hit = typo.value.tier === 'category' ? lookupSpan([typo.value.random!])! : typo.value;
      found = { hit, len: n };
      correctedFrom = span.join(' ');
    }
  }
  if (!found) {
    const word = rest[rest.length - 1] ?? all[all.length - 1];
    const others = rest.slice(0, -1);
    return { ok: false, reason: 'unknown', word, suggestions: suggestNouns(word, 3, others) };
  }

  const { hit, len } = found;
  const adjTokens = [...rest.slice(0, end - len), ...rest.slice(end)];
  const front = readAdjectives(adjTokens, false);
  const back = tail.length ? readAdjectives(tail, true) : { found: [], unknown: [], nouns: [] };
  const adjectives = [...front.found, ...back.found];
  const label = [...new Set(adjectives.map((a) => a.id))].join(' ') + (adjectives.length ? ' ' : '') + hit.def.name;
  return {
    ok: true,
    def: hit.def,
    adjectives,
    unknownAdjectives: front.unknown,
    count,
    label,
    correctedFrom,
    approxFrom: hit.tier === 'near' ? rest.slice(end - len, end).join(' ') : undefined,
    randomFrom: hit.tier === 'category' ? hit.random : undefined,
    ignoredNouns: [...front.nouns, ...back.nouns].filter((t) => lookupSpan([t])?.def !== hit.def),
  };
}

/**
 * Up to `n` known nouns close to an unknown word: hand-picked related words first, then things named
 * alongside it ("dog collar" -> dog), then the nearest by spelling, then things whose description
 * mentions the word.
 */
export function suggestNouns(word: string, n = 3, around: string[] = []): string[] {
  const { nouns } = getLexicon();
  const forms = singulars(word);
  const related = forms.flatMap((f) => RELATED[f] ?? []).filter((id) => nouns.has(id)).map((id) => nouns.get(id)!.name);
  const named = around.map((t) => lookupSpan([t])).filter((h): h is Hit => !!h && h.tier !== 'category').map((h) => h.def.name);
  // spelled somewhat alike (looser than a typo fix, since the player picks): nearest first
  const q = forms[forms.length - 1];
  const near = getIndex()
    .entries.map(([k, h]) => ({ name: h.def.name, cost: typoCost(q, k) }))
    .filter((c) => c.cost <= typoLimit(q.length))
    .sort((a, b) => a.cost - b.cost)
    .map((c) => c.name);
  const { words } = getIndex();
  const mentions = forms.flatMap((f) => words.get(f) ?? []).map((d) => d.name);
  return [...new Set([...related, ...named, ...near, ...mentions])].filter((name) => name !== 'hero').slice(0, n);
}

/** Up to `n` known adjectives close to an unknown one. */
export function suggestAdjectives(word: string, n = 3): string[] {
  const { adjectives, adjAliases } = getLexicon();
  const hits = [...adjectives, ...adjAliases]
    .map(([key, adj]) => ({ adj, cost: typoCost(word, key) }))
    .filter((h) => h.cost <= Math.max(1.5, word.length / 2.5))
    .sort((a, b) => a.cost - b.cost);
  return [...new Set(hits.map((h) => h.adj.id))].slice(0, n);
}

/** A few random known words, for "try one of these" hints. */
export function randomWords(n: number): string[] {
  const names = [...new Set([...getLexicon().nouns.values()].filter((d) => !d.tags.includes('player')).map((d) => d.name))];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, n);
}
