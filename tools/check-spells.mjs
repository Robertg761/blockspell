#!/usr/bin/env node
// Spell understanding check. Runs the real parser (through vite's SSR loader, no browser) over:
//   1. the thesaurus itself: every id exists, no word is claimed by two things, and no entry starts with
//      an adjective (that would swallow it: "red apple" must stay a red apple, not become a plain one);
//   2. every object's name and synonyms must parse to that object;
//   3. a table of phrases a player might type, with what each must (or must not) become.
//
// Usage: npm run check-spells
import { createServer } from 'vite';

const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { parseSpell, suggestNouns } = await server.ssrLoadModule('/src/parser/parser.ts');
const { getLexicon } = await server.ssrLoadModule('/src/parser/lexicon.ts');
const { objects } = await server.ssrLoadModule('/src/objects/index.ts');
const { CATEGORIES } = await server.ssrLoadModule('/src/parser/thesaurus.ts');

let failures = 0;
const fail = (msg) => { failures++; console.log('FAIL', msg); };

// ---- 1. thesaurus integrity
const lex = getLexicon();
for (const id of lex.unknownIds) fail(`thesaurus names "${id}", which does not exist`);
for (const c of lex.conflicts) fail(`thesaurus word claimed twice: ${c}`);
// Only size, color, speed and weight words matter: they would be lost ("red apple" -> plain apple). Names of
// kinds that happen to start with one are fine.
const SWALLOWED = new Set(['size', 'color', 'speed', 'weight']);
const OK_LEADING = ['hot dog', 'hot chocolate', 'hot rod', 'light bulb', 'light saber', 'blue jay', 'black bear', 'black hawk', 'golden retriever', 'baby grand', 'fast food', 'tin man'];
for (const table of [lex.aliases, lex.near]) {
  for (const key of table.keys()) {
    const first = key.split(' ')[0];
    const adj = lex.adjectives.get(first);
    if (key.includes(' ') && adj && SWALLOWED.has(adj.category) && !OK_LEADING.some((k) => key.startsWith(k)))
      fail(`"${key}" starts with the adjective "${first}"; list the bare noun and let the adjective apply`);
  }
}
for (const [kind, ids] of Object.entries(CATEGORIES)) {
  for (const id of ids) if (!objects.get(id)) fail(`kind "${kind}" lists missing object ${id}`);
  for (const [name, table] of [['noun', lex.nouns], ['synonym', lex.aliases], ['near match', lex.near]]) if (table.has(kind)) fail(`"${kind}" is a kind word (random pick) but also a ${name} of ${table.get(kind).id}`);
}

// ---- 2. every name and synonym parses to its own object
for (const def of objects.all()) {
  if (def.levelOnly) continue;
  for (const w of [def.id, def.name, ...(def.synonyms ?? [])]) {
    const r = parseSpell(w);
    if (!r.ok || r.def.id !== def.id) {
      const claimedElsewhere = r.ok && lex.nouns.get(w.toLowerCase())?.id === r.def.id;
      if (!claimedElsewhere) fail(`own word "${w}" -> ${r.ok ? r.def.id : r.reason}, wanted ${def.id}`);
    }
  }
}

// ---- 3. phrases
// [phrase, wanted, options]. wanted: an object id, an array of ids (random kinds), or null (must be refused).
// options: tier = 'near' | 'random' | 'typo' | 'exact' (how it matched); adj = adjective ids that must apply; count; noAdj.
const CASES = [
  // the report that started this: "dog food" became a wood plank
  ['dog food', 'bone', { tier: 'exact' }],
  ['dog food please', 'bone'],
  ['a bowl of dog food', 'bone'],
  ['cat food', 'fish'],
  ['rabbit food', 'carrot'],
  ['bird food', 'seed'],
  ['food', CATEGORIES.food, { tier: 'random' }],
  ['wood', 'plank'],
  ['hot dog', 'burger'],
  ['dog', 'dog'],
  ['dog house', 'hut'],
  ['dog bone', 'bone'],
  // plain nouns, plurals, articles, politeness
  ['dog', 'dog'], ['dogs', 'dog'], ['the dog', 'dog'], ['my dog', 'dog'], ['a cat', 'cat'], ['cats', 'cat'], ['mice', 'mouse'], ['knives', 'sword'], ['wolves', 'dog'],
  ['please make me a pizza', 'pizza'], ['can you spawn a balloon', 'balloon'], ['i want a banana', 'banana'], ['give me an apple please', 'apple'], ['summon dragon', 'dragon'],
  ['3 cats', 'cat', { count: 3 }], ['three cats', 'cat', { count: 3 }], ['2 balloons', 'balloon', { count: 2 }], ['a pair of dogs', 'dog', { count: 2 }], ['x3 cat', 'cat', { count: 3 }], ['cat x2', 'cat', { count: 2 }],
  ['a few apples', 'apple', { count: 3 }], ['100 ducks', 'duck', { count: 5 }],
  // synonyms and kinds of things
  ['kitten', 'cat'], ['puppy', 'dog'], ['poodle', 'dog'], ['golden retriever', 'dog'], ['owl', 'bird'], ['parrot', 'bird'], ['shark', 'fish'], ['panda', 'bear'], ['t-bone', 'steak'],
  ['cupcake', 'cake'], ['birthday cake', 'cake'], ['apple pie', 'cake'], ['pepperoni pizza', 'pizza'], ['french fries', 'burger'], ['hamburger', 'burger'], ['sausage', 'steak'],
  ['coffee', 'mug'], ['tea', 'mug'], ['cup of coffee', 'mug'], ['soda', 'bottle'], ['potion', 'bottle'], ['flashlight', 'lantern'], ['street lamp', 'lantern'],
  ['campfire', 'fire'], ['bonfire', 'fire'], ['tree house', 'hut'], ['cottage', 'hut'], ['teepee', 'tent'], ['couch', 'bench'], ['staircase', 'stairs'], ['dynamite', 'tnt'],
  ['sailboat', 'boat'], ['submarine', 'boat'], ['spaceship', 'rocket'], ['jet', 'airplane'], ['blimp', 'hotairballoon'], ['locomotive', 'train'], ['flying saucer', 'ufo'],
  ['ice cream', 'icecream'], ['ice cream cone', 'icecream'], ['icecream', 'icecream'], ['sun flower', 'flower'], ['pick axe', 'pickaxe'], ['fire place', 'fire'], ['sword fish', 'fish'],
  ['sunflower', 'flower'], ['stick of dynamite', 'tnt'], ['bucket of water', 'bucket'], ['glass of water', 'water'], ['slice of pizza', 'pizza'], ['bunch of bananas', 'banana'],
  // near matches: something close, said out loud
  ['horse', 'cow', { tier: 'near' }], ['lion', 'cat', { tier: 'near' }], ['wolf', 'dog', { tier: 'near' }], ['elephant', 'cow', { tier: 'near' }], ['pasta', 'pizza', { tier: 'near' }],
  ['whale', 'fish', { tier: 'near' }], ['guitar', 'piano', { tier: 'near' }], ['pear', 'apple', { tier: 'near' }], ['candy', 'cookie', { tier: 'near' }], ['table', 'bench', { tier: 'near' }],
  ['castle', 'wall', { tier: 'near' }], ['dinosaur', 'dragon', { tier: 'near' }], ['truck', 'car', { tier: 'near' }], ['bicycle', 'skateboard', { tier: 'near' }], ['wizard', 'hero', { tier: 'near' }],
  ['gold', 'coin', { tier: 'near' }], ['orange', 'apple', { tier: 'near' }],
  // kinds
  ['animal', CATEGORIES.animal, { tier: 'random' }], ['a random animal', CATEGORIES.animal, { tier: 'random' }], ['pets', CATEGORIES.pet, { tier: 'random' }], ['dessert', CATEGORIES.dessert, { tier: 'random' }],
  ['vehicle', CATEGORIES.vehicle, { tier: 'random' }], ['weapon', CATEGORIES.weapon, { tier: 'random' }], ['toy', CATEGORIES.toy, { tier: 'random' }], ['snack', CATEGORIES.snack, { tier: 'random' }],
  // adjectives are kept, in any phrasing
  ['big red apple', 'apple', { adj: ['big', 'red'] }], ['red apple', 'apple', { adj: ['red'] }], ['golden key', 'key', { adj: ['golden'] }], ['gold coin', 'coin', { adj: ['golden'] }],
  ['black cat', 'cat', { adj: ['black'] }], ['tiny dragon', 'dragon', { adj: ['tiny'] }], ['giant robot', 'robot', { adj: ['giant'] }], ['flaming sword', 'sword', { adj: ['flaming'] }],
  ['a very very big ball', 'ball', { adj: ['big'] }], ['dark blue car', 'car', { adj: ['blue'], noAdj: ['black', 'light'] }], ['light blue car', 'car', { adj: ['blue'], noAdj: ['light'] }],
  ['sleepy puppy', 'dog', { adj: ['slow'] }], ['maroon ball', 'ball', { adj: ['red'] }], ['chocolate cake', 'cake', { adj: ['brown'] }], ['ice cat', 'cat', { adj: ['frozen'] }],
  ['big and red ball', 'ball', { adj: ['big', 'red'] }], ['red and blue car', 'car', { adj: ['red', 'blue'] }], ['robot dog', 'dog', { adj: ['metal'] }], ['ball red', 'ball', { adj: ['red'] }], ['a cat on fire', 'cat', { adj: ['flaming'] }], ['dog with a hat', 'dog'], ['cat on a skateboard', 'cat'],
  ['cute fluffy bunny', 'rabbit', { noUnknown: true }], ['happy little cloud', 'cloud', { noUnknown: true }], ['a slice of red apple', 'apple', { adj: ['red'], noUnknown: true }],
  ['huge tree', 'tree', { adj: ['giant'] }], ['mini car', 'car', { adj: ['tiny'] }], ['bright red balloon', 'balloon', { adj: ['red'], noAdj: ['glowing'] }],
  // typos are fixed when it is clear what was meant
  ['dgo', 'dog', { tier: 'typo' }], ['dragn', 'dragon', { tier: 'typo' }], ['bannana', 'banana', { tier: 'typo' }], ['pizzza', 'pizza', { tier: 'typo' }], ['cheeze', 'cheese', { tier: 'typo' }],
  ['helicoptor', 'helicopter', { tier: 'typo' }], ['skatboard', 'skateboard', { tier: 'typo' }], ['elefant', 'cow', { tier: 'near' }], ['ballon', 'balloon'], ['trampolene', 'trampoline'],
  ['chainsaww', 'chainsaw'], ['umbrela', 'umbrella'], ['watermelen', 'watermelon'], ['ice creem', 'icecream', { tier: 'typo' }], ['rcoket', 'rocket', { tier: 'typo' }], ['banan', 'banana'],
  ['bigg red ball', 'ball', { adj: ['big', 'red'] }], ['rde ball', 'ball', { adj: ['red'] }],
  // ...and never into something else just because it is one letter away
  ['food', CATEGORIES.food, { tier: 'random' }], ['good', null], ['mood', null], ['hood', null], ['foot', null], ['cook', null], ['bore', null], ['fork', null], ['gale', null],
  ['xyzzy', null], ['asdfgh', null], ['quantum computer', null], ['unicorn', null], ['ghost', null], ['red', null], ['big red', null], ['', null], ['please', null],
];

for (const [phrase, want, opts = {}] of CASES) {
  const r = parseSpell(phrase);
  const show = r.ok ? `${r.label} [${r.def.id}]${r.approxFrom ? ' (near)' : ''}${r.randomFrom ? ' (random)' : ''}${r.correctedFrom ? ' (typo)' : ''}` : r.reason;
  if (want === null) {
    if (r.ok) fail(`"${phrase}" should be refused but became ${show}`);
    continue;
  }
  if (!r.ok) { fail(`"${phrase}" was refused (${r.reason}), wanted ${Array.isArray(want) ? 'one of ' + want.join(', ') : want}`); continue; }
  const ids = Array.isArray(want) ? want : [want];
  if (!ids.includes(r.def.id)) fail(`"${phrase}" became ${show}, wanted ${ids.join(' or ')}`);
  if (opts.tier === 'near' && !r.approxFrom) fail(`"${phrase}" should be a near match (announced), got ${show}`);
  if (opts.tier === 'exact' && (r.approxFrom || r.randomFrom || r.correctedFrom)) fail(`"${phrase}" should be exact, got ${show}`);
  if (opts.tier === 'random' && !r.randomFrom) fail(`"${phrase}" should be a random pick, got ${show}`);
  if (opts.tier === 'typo' && !r.correctedFrom) fail(`"${phrase}" should be a corrected typo, got ${show}`);
  if (opts.count !== undefined && r.count !== opts.count) fail(`"${phrase}" count ${r.count}, wanted ${opts.count}`);
  const have = r.adjectives.map((a) => a.id);
  for (const a of opts.adj ?? []) if (!have.includes(a)) fail(`"${phrase}" lost the adjective ${a} (has ${have.join(', ') || 'none'})`);
  for (const a of opts.noAdj ?? []) if (have.includes(a)) fail(`"${phrase}" should not have the adjective ${a}`);
  if (opts.noUnknown && r.unknownAdjectives.length) fail(`"${phrase}" complained about ${r.unknownAdjectives.join(', ')}`);
}

// refused words still come with useful suggestions
const sugg = parseSpell('unicorn');
if (sugg.ok || !sugg.suggestions.length) fail('"unicorn" should come with suggestions');
if (!suggestNouns('dog collar', 3, ['dog']).includes('dog')) fail('"dog collar" should suggest dog');

await server.close();
console.log(failures ? `\n${failures} problem${failures === 1 ? '' : 's'}` : `ok: thesaurus, ${objects.all().length} objects and ${CASES.length} phrases`);
process.exit(failures ? 1 : 0);
