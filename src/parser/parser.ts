import type { AdjectiveDef } from '../adjectives/types';
import type { ObjectDef } from '../objects/types';
import { fuzzyFind } from './fuzzy';
import { getLexicon } from './lexicon';
import { extractCount, INTENSIFIERS, singularize, tokenize } from './normalize';

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

function lookupNoun(phrase: string): ObjectDef | undefined {
  const { nouns } = getLexicon();
  return nouns.get(phrase) ?? nouns.get(singularize(phrase)) ?? nouns.get(phrase.split(' ').map(singularize).join(' '));
}

/**
 * Parses "[count] [adjectives...] noun". The noun is the longest phrase that
 * matches at the end of the input; everything before it is adjectives.
 */
export function parseSpell(input: string): ParseResult {
  const tokens = tokenize(input);
  if (!tokens.length) return { ok: false, reason: 'empty' };
  const lex = getLexicon();
  const { count, rest } = extractCount(tokens);

  let def: ObjectDef | undefined;
  let nounLen = 0;
  for (let n = Math.min(lex.maxNounWords, rest.length); n >= 1 && !def; n--) {
    def = lookupNoun(rest.slice(-n).join(' '));
    if (def) nounLen = n;
  }

  let correctedFrom: string | undefined;
  if (!def) {
    const word = rest[rest.length - 1];
    const hits = fuzzyFind(singularize(word), lex.nouns.entries(), 6);
    // confident single-typo autocorrect for longer words
    const related = RELATED[singularize(word)] ?? RELATED[word];
    if (!related && hits.length && hits[0].distance === 1 && word.length >= 4 && (hits.length === 1 || hits[1].distance > 1 || hits[1].value === hits[0].value)) {
      def = hits[0].value;
      nounLen = 1;
      correctedFrom = word;
    } else {
      return { ok: false, reason: 'unknown', word, suggestions: suggestNouns(word) };
    }
  }

  const adjTokens = rest.slice(0, rest.length - nounLen);
  const found: AdjectiveDef[] = [];
  const unknown: string[] = [];
  let intensity = 1;
  for (let i = 0; i < adjTokens.length; ) {
    if (INTENSIFIERS.has(adjTokens[i])) {
      intensity++;
      i++;
      continue;
    }
    let matched = false;
    for (let n = Math.min(lex.maxAdjWords, adjTokens.length - i); n >= 1; n--) {
      const a = lex.adjectives.get(adjTokens.slice(i, i + n).join(' '));
      if (a) {
        for (let k = 0; k < Math.min(3, intensity); k++) found.push(a);
        intensity = 1;
        i += n;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const t = adjTokens[i];
      const hit = t.length >= 4 ? fuzzyFind(t, lex.adjectives.entries(), 1)[0] : undefined;
      if (hit && hit.distance === 1) found.push(hit.value);
      else if (t !== 'and') unknown.push(t);
      intensity = 1;
      i++;
    }
  }

  const label = [...new Set(found.map((a) => a.id))].join(' ') + (found.length ? ' ' : '') + def.name;
  return { ok: true, def, adjectives: found, unknownAdjectives: unknown, count, label, correctedFrom };
}

/**
 * Up to `n` known nouns close to an unknown word: hand-picked related words
 * first, then the nearest by edit distance (looser than autocorrect).
 */
export function suggestNouns(word: string, n = 3): string[] {
  const { nouns } = getLexicon();
  const w = singularize(word);
  const related = (RELATED[w] ?? RELATED[word] ?? []).filter((id) => nouns.has(id)).map((id) => nouns.get(id)!.name);
  const near = fuzzyFind(w, nouns.entries(), 12, Math.max(2, Math.ceil(w.length / 2))).map((h) => h.value.name);
  return [...new Set([...related, ...near])].filter((name) => name !== 'hero').slice(0, n);
}

/** Up to `n` known adjectives close to an unknown one. */
export function suggestAdjectives(word: string, n = 3): string[] {
  const { adjectives } = getLexicon();
  const hits = fuzzyFind(word, adjectives.entries(), 12, Math.max(2, Math.ceil(word.length / 2)));
  return [...new Set(hits.map((h) => h.value.id))].slice(0, n);
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
