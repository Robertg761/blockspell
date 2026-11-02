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
  | { ok: false; reason: 'unknown'; word: string; suggestions: string[] };

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
    if (hits.length && hits[0].distance === 1 && word.length >= 4 && (hits.length === 1 || hits[1].distance > 1 || hits[1].value === hits[0].value)) {
      def = hits[0].value;
      nounLen = 1;
      correctedFrom = word;
    } else {
      const suggestions = [...new Set(hits.map((h) => h.value.name))].slice(0, 3);
      return { ok: false, reason: 'unknown', word: rest.join(' '), suggestions };
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

/** A few random known words, for "try one of these" hints. */
export function randomWords(n: number): string[] {
  const names = [...new Set([...getLexicon().nouns.values()].map((d) => d.name))];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, n);
}
