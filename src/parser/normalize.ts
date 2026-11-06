/** Politeness and command words at the front of a spell: "please make me a ..." is just "...". */
const LEAD = new Set(
  (
    'a an the some my your one another please pls plz can could would will you u i id d ll want wanna need like love to see have get me us make makes spawn summon ' +
    'create give show cast conjure add bring build generate produce place put drop throw let lets s there be is are it its that this of ' +
    'hey hi hello ok okay yo gimme gonna just maybe try'
  ).split(' '),
);
/** ...and at the back: "a cat please", "a cat now". */
const TRAIL = new Set('please pls plz now here there thanks thank you for me ok okay too also again quickly pronto'.split(' '));
/** Words that start a description *about* the thing ("a dog with a hat", "a cat on a skateboard"). */
export const CONNECTORS = new Set(
  'with that who which wearing holding having carrying eating riding on in at near next under over by from using inside beside behind above below around and then but while'.split(' '),
);
export const INTENSIFIERS = new Set(['very', 'really', 'super', 'extra', 'so', 'mega', 'ultra', 'quite', 'pretty', 'too']);
/** Shades that go in front of a color without changing which color it is ("dark blue" is blue). */
export const SHADES = new Set(['light', 'dark', 'pale', 'deep', 'bright', 'vivid', 'pastel', 'neon', 'baby', 'sky', 'hot', 'royal']);

const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 5, seven: 5, eight: 5, nine: 5, ten: 5, twenty: 5, hundred: 5,
  couple: 2, pair: 2, both: 2, twin: 2, twins: 2, few: 3, several: 4, many: 5, lots: 5, bunch: 4, handful: 4, herd: 4, flock: 4, pack: 4, group: 4, dozen: 5, tons: 5, loads: 5, bunches: 4,
};

/** Lowercases, strips accents and punctuation, and splits into tokens. */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/(\d)\s*x\b|\bx\s*(\d)/g, '$1$2 ')
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** A lexicon key in the same shape as tokenized input ("stick of dynamite" -> "stick dynamite"). */
export function keyOf(phrase: string): string {
  return tokenize(phrase).filter((t) => t !== 'of' && t !== 'a' && t !== 'an' && t !== 'the').join(' ');
}

/** Pulls a leading count ("3 balls", "two dogs") and the command words off the token list. */
export function extractCount(tokens: string[]): { count: number; rest: string[] } {
  const rest = [...tokens];
  let count = 1;
  while (rest.length > 1 && LEAD.has(rest[0])) rest.shift();
  while (rest.length > 1 && TRAIL.has(rest[rest.length - 1])) rest.pop();
  const first = rest[0];
  if (rest.length > 1 && first) {
    const n = /^\d+$/.test(first) ? parseInt(first, 10) : NUMBER_WORDS[first];
    if (n !== undefined) {
      count = Math.max(1, Math.min(5, n));
      rest.shift();
      while (rest.length > 1 && (LEAD.has(rest[0]) || rest[0] === 'of')) rest.shift();
    }
  }
  // "cat x2" / "cat 3": a count at the back
  const lastTok = rest[rest.length - 1];
  if (rest.length > 1 && /^\d+$/.test(lastTok) && count === 1) {
    count = Math.max(1, Math.min(5, parseInt(lastTok, 10)));
    rest.pop();
  }
  return { count, rest: rest.filter((t, i) => !(t === 'of' && i < rest.length - 1)) };
}

const IRREGULAR: Record<string, string> = {
  mice: 'mouse', men: 'man', women: 'woman', children: 'child', people: 'person', feet: 'foot', teeth: 'tooth', geese: 'goose',
  wolves: 'wolf', knives: 'knife', leaves: 'leaf', loaves: 'loaf', shelves: 'shelf', lives: 'life', halves: 'half', calves: 'calf',
  cacti: 'cactus', fungi: 'fungus', oxen: 'ox', dice: 'die', thieves: 'thief', elves: 'elf', dwarves: 'dwarf', hooves: 'hoof',
};

/** Every plausible singular of an English word (the word itself first). */
export function singulars(word: string): string[] {
  const out = [word];
  const add = (w: string) => w.length > 1 && !out.includes(w) && out.push(w);
  if (IRREGULAR[word]) add(IRREGULAR[word]);
  if (word.length <= 3) return out;
  if (word.endsWith('ies')) add(word.slice(0, -3) + 'y');
  if (word.endsWith('ves')) { add(word.slice(0, -3) + 'f'); add(word.slice(0, -3) + 'fe'); }
  if (/(ches|shes|sses|xes|zes|oes)$/.test(word)) add(word.slice(0, -2));
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is')) add(word.slice(0, -1));
  if (word.endsWith('es')) add(word.slice(0, -2));
  return out;
}

/** The most likely singular, for callers that want just one. */
export function singularize(word: string): string {
  return singulars(word)[1] ?? word;
}
