const ARTICLES = new Set(['a', 'an', 'the', 'some', 'my', 'one', 'of', 'please', 'make', 'spawn', 'summon', 'create', 'give', 'me']);
export const INTENSIFIERS = new Set(['very', 'really', 'super', 'extra', 'so', 'mega']);

const NUMBER_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, couple: 2, few: 3, several: 4, many: 5, lots: 5 };

/** Lowercases, strips punctuation and filler words, and splits into tokens. */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Pulls a leading count ("3 balls", "two dogs") off the token list. */
export function extractCount(tokens: string[]): { count: number; rest: string[] } {
  const rest = [...tokens];
  let count = 1;
  while (rest.length > 1 && ARTICLES.has(rest[0])) rest.shift();
  const first = rest[0];
  if (rest.length > 1 && first) {
    const n = /^\d+$/.test(first) ? parseInt(first, 10) : NUMBER_WORDS[first];
    if (n !== undefined) {
      count = Math.max(1, Math.min(5, n));
      rest.shift();
      if (rest[0] === 'of') rest.shift();
    }
  }
  return { count, rest: rest.filter((t, i) => !(ARTICLES.has(t) && i < rest.length - 1)) };
}

/** Naive English singularization, good enough for nouns in a toy box. */
export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ves')) return word.slice(0, -3) + 'f';
  if (/(ches|shes|sses|xes|zes|oes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}
