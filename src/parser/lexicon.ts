import { adjectives } from '../adjectives';
import type { AdjectiveDef } from '../adjectives/types';
import { objects } from '../objects';
import type { ObjectDef } from '../objects/types';
import { keyOf } from './normalize';
import { ADJECTIVE_WORDS, CATEGORIES, NEAR, SYNONYMS } from './thesaurus';

/** Phrase → definition lookup tables, built from the registries and the thesaurus. */
export interface Lexicon {
  /** Each object's own names and synonyms. These are what autocomplete offers. */
  nouns: Map<string, ObjectDef>;
  /** Thesaurus synonyms (a poodle is a dog): the spell lands silently. */
  aliases: Map<string, ObjectDef>;
  /** Thesaurus near matches (a horse is a lot like a cow): the spell lands and says so. */
  near: Map<string, ObjectDef>;
  /** Generic kind words ("food"): a random member lands. */
  categories: Map<string, ObjectDef[]>;
  adjectives: Map<string, AdjectiveDef>;
  /** Thesaurus adjective words (maroon is red). */
  adjAliases: Map<string, AdjectiveDef>;
  maxNounWords: number;
  maxAdjWords: number;
  /** Words the thesaurus lists for two different things, for the spell check tool. */
  conflicts: string[];
  /** Thesaurus object ids that match no object, for the spell check tool. */
  unknownIds: string[];
}

let cached: Lexicon | null = null;

const split = (list: string) => list.split(',').map(keyOf).filter(Boolean);

export function getLexicon(): Lexicon {
  if (cached) return cached;
  const nouns = new Map<string, ObjectDef>();
  const aliases = new Map<string, ObjectDef>();
  const near = new Map<string, ObjectDef>();
  const categories = new Map<string, ObjectDef[]>();
  const adjs = new Map<string, AdjectiveDef>();
  const adjAliases = new Map<string, AdjectiveDef>();
  const conflicts: string[] = [];
  const unknownIds: string[] = [];
  let maxNounWords = 1, maxAdjWords = 1;
  const words = (k: string) => k.split(' ').length;

  for (const def of objects.all()) {
    if (def.levelOnly) continue;
    for (const w of [def.id, def.name, ...(def.synonyms ?? [])]) {
      // the word as written (autocomplete shows "t-bone", "bucket of water") and as typed spells are
      // normalized ("t bone", "bucket water")
      for (const k of new Set([w.toLowerCase().trim(), keyOf(w)])) {
        if (nouns.has(k) && nouns.get(k) !== def) console.warn(`[blockspell] noun "${k}" claimed by ${nouns.get(k)!.id} and ${def.id}`);
        nouns.set(k, def);
        maxNounWords = Math.max(maxNounWords, words(k));
      }
    }
  }
  const spellable = new Map([...nouns.values()].map((d) => [d.id, d]));

  const fill = (table: Record<string, string>, into: Map<string, ObjectDef>, claimedBy: Map<string, ObjectDef>[]) => {
    for (const [id, list] of Object.entries(table)) {
      const def = spellable.get(id);
      if (!def) { unknownIds.push(id); continue; }
      for (const k of split(list)) {
        const other = claimedBy.find((m) => m.has(k))?.get(k) ?? into.get(k);
        if (other && other !== def) { conflicts.push(`"${k}" is ${other.id} and ${id}`); continue; }
        into.set(k, def);
        maxNounWords = Math.max(maxNounWords, words(k));
      }
    }
  };
  fill(SYNONYMS, aliases, [nouns]);
  fill(NEAR, near, [nouns, aliases]);

  for (const [word, ids] of Object.entries(CATEGORIES)) {
    const defs = ids.map((id) => spellable.get(id)).filter((d): d is ObjectDef => !!d);
    if (defs.length) categories.set(keyOf(word), defs);
  }

  for (const a of adjectives.all()) {
    for (const w of [a.id, ...(a.synonyms ?? [])]) {
      const k = keyOf(w);
      adjs.set(k, a);
      maxAdjWords = Math.max(maxAdjWords, words(k));
    }
  }
  const byId = new Map(adjectives.all().map((a) => [a.id, a]));
  for (const [id, list] of Object.entries(ADJECTIVE_WORDS)) {
    const a = byId.get(id);
    if (!a) { unknownIds.push(`adjective ${id}`); continue; }
    for (const k of split(list)) {
      if (adjs.has(k) || adjAliases.has(k)) continue;
      adjAliases.set(k, a);
      maxAdjWords = Math.max(maxAdjWords, words(k));
    }
  }
  cached = { nouns, aliases, near, categories, adjectives: adjs, adjAliases, maxNounWords, maxAdjWords, conflicts, unknownIds };
  return cached;
}
