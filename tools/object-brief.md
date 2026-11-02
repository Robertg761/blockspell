# Writing Blockspell objects (brief for contributors)

Blockspell is a browser voxel sandbox: the player types a word ("giant flaming dog")
and a voxel object spawns into a cannon-es physics world. Objects are pure data +
a procedural voxel model. Interactions come from **behavior tags**, which are
implemented centrally in `src/behaviors/defs/` — you only choose tags and props.

Never use the word "Scribblenauts" anywhere. Everything is offline: no URLs, no
assets, no network. Models are built in code.

## Read first

- `src/objects/types.ts` — `ObjectDef`, `PartDef`, `ObjectPhysics`, `ObjectCategory`
- `src/core/tags.ts` — the tag vocabulary (`KNOWN_TAGS`) and the props each tag reads
- `src/voxel/builder.ts` — the voxel DSL (`box`, `ellipsoid`, `sphere`, `cylinderY`, `layers`, `paint`, `mirrorX`)
- `src/voxel/palette.ts` — shared color keys and `definePalette`
- Examples: `src/objects/defs/dog.ts`, `fire.ts`, `balloon.ts`, `ladder.ts`
- Sound names: `SoundName` in `src/engine/audio.ts`

## File format

Write **only your assigned file**. It default-exports an array:

```ts
import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

definePalette({
  catFur: '#9a9aa3',                                 // prefix keys with your category/object
  ufoLight: { color: '#7dffb0', emissive: true },    // emissive = glows, unlit
});

export default [
  defineObject({
    id: 'cat',                       // unique, lowercase; also a summon word
    name: 'cat',                     // display name
    synonyms: ['kitty', 'kitten', 'feline'],   // 2-5+ lowercase singular words/phrases
    category: 'animals',
    blurb: 'Chases mice and fish. Lands on its feet.',  // short, hints at interactions
    tags: ['animal', 'eats'],
    diet: ['mouse', 'fish'],         // only for eaters: object ids or tags
    voice: 'meow',
    spawnSound: 'meow',
    tintKeys: ['catFur', 'catFurDark'],  // keys recolored by color adjectives ("blue cat")
    burstColor: '#9a9aa3',
    voxelSize: 0.08,
    physics: { mass: 4, shape: 'auto', maxBoxes: 4, uprightOnly: true, friction: 0.3 },
    props: { speed: 2.6, sight: 12 },
    build(b, rng) { /* voxels */ },
  }),
  // ...
];
```

## Modeling rules

- Y is up, the object's **front faces +Z**. Coordinates are integer voxels; `box` bounds are inclusive.
- `voxelSize` (default 0.1 m) × voxel extents = world size. Aim for plausible game sizes:
  small items 0.2–0.5 m, animals 0.4–1.5 m, vehicles 1.5–3 m, trees/structures up to ~4 m.
  Keep models ≤ ~40 voxels on any axis and ≤ ~6000 voxels.
- Make every object **instantly recognizable** from a 3/4 view: exaggerated silhouettes,
  2–3 tones per material (base/dark/light), eyes on animals (`eye` + `eyeShine`), small details.
  Use `rng` for small per-spawn variation (spots, knots) if you like.
- Prefer existing palette keys (wood, woodDark, metal, stone, leaf, bark, fur…); add new ones with
  `definePalette` (prefixed names) or use `'#rrggbb'` strings inline.
- `tintKeys` = the "main color" keys (so "red car" repaints the body, not the tires/windows).
- Physics: `mass` in kg (keep between 0.05 and 80 for solver stability; scale-adjusted automatically),
  `shape: 'auto'` (box decomposition, `maxBoxes` 2–10), `'box'` or `'sphere'`. Animals:
  `uprightOnly: true`. Things that must stay put (trees, walls, pools, doors): `anchored: true`.
- Animated bits (rotors, fan blades, wheels, flags): use `parts` and spin them in `update`:

```ts
parts: [{ name: 'rotor', pivot: [4, 14, 4], build(b) { b.box(-6, 14, 3, 14, 14, 4, 'black'); } }],
update(e, _world, dt) { e.parts.get('rotor')!.rotation.y += dt * 25; },
```

  `pivot` is in voxel-corner coordinates (the center of voxel (x,y,z) is x+.5,y+.5,z+.5).
  `update` is for cosmetics only (spinning, flicker, bobbing `e.mesh`/`e.visual`); gameplay comes from tags.
  For flames you may call `emitFlames(world, e, dt, strength)` from `src/behaviors/lib/fire.ts`.

## Tags and props

Use only tags listed in `KNOWN_TAGS` (`src/core/tags.ts`). Numeric tuning goes in `props`
with the names given there (e.g. `{ burnTime: 6 }`, `{ lift: 1.4, ceiling: 5 }`, `{ thrust: 2.5, fuel: 4 }`).
Don't write behavior logic yourself — just tag. `debris: ['plank']` spawns objects when this breaks.

## Words

- Synonyms must not collide with other objects' ids/synonyms (the planned id list is in your task),
  and must not be adjective words: tiny small big huge giant large little mini, any color word,
  heavy light flying floating bouncy wet flaming burning fiery hot cold wooden tasty golden gold
  frozen icy ghostly ghost invisible rainbow angry fast quick sticky metal metallic magnetic glowing
  shiny explosive slippery slow.
- Multi-word synonyms are fine ("hot air balloon", "ice cream").

## Verify

1. `npx tsc --noEmit` — fix errors in **your** file; ignore errors in files you don't own.
2. Screenshot your models (dev server on port 5199 — start it with
   `npx vite --port 5199 --strictPort &` if `curl -s localhost:5199 >/dev/null` fails):
   `tools/shot.sh "file=<yourfile>" /tmp/<yourfile>.png` then view the PNG.
   Also try `&view=front`, `&view=side`, `&ids=a,b`, and `&adj=red` to check tinting.
   Iterate until each object reads clearly at a glance.
3. Don't run `git` commands and don't edit any other file.
4. Reply with one line per object: `id — synonyms — tags — props` and anything notable.
