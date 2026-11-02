import { adjectives } from '../adjectives';
import type { AdjectiveDef } from '../adjectives/types';
import { objects } from '../objects';
import type { ObjectDef } from '../objects/types';

/** Phrase → definition lookup tables, built from the registries. */
export interface Lexicon {
  nouns: Map<string, ObjectDef>;
  adjectives: Map<string, AdjectiveDef>;
  maxNounWords: number;
  maxAdjWords: number;
}

let cached: Lexicon | null = null;

export function getLexicon(): Lexicon {
  if (cached) return cached;
  const nouns = new Map<string, ObjectDef>();
  const adjs = new Map<string, AdjectiveDef>();
  let maxNounWords = 1, maxAdjWords = 1;
  for (const def of objects.all()) {
    for (const w of [def.id, def.name, ...(def.synonyms ?? [])]) {
      const k = w.toLowerCase().trim();
      if (nouns.has(k) && nouns.get(k) !== def) console.warn(`[blockspell] noun "${k}" claimed by ${nouns.get(k)!.id} and ${def.id}`);
      nouns.set(k, def);
      maxNounWords = Math.max(maxNounWords, k.split(' ').length);
    }
  }
  for (const a of adjectives.all()) {
    for (const w of [a.id, ...(a.synonyms ?? [])]) {
      const k = w.toLowerCase().trim();
      adjs.set(k, a);
      maxAdjWords = Math.max(maxAdjWords, k.split(' ').length);
    }
  }
  cached = { nouns, adjectives: adjs, maxNounWords, maxAdjWords };
  return cached;
}
