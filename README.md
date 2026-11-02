# ▣ Blockspell

**Write a word. Make it real.**

Blockspell is a 3D voxel puzzle game that runs in your browser. Type the name of a
thing (*ball*, *dog*, *fire*, *ladder*…), optionally with adjectives (*big red ball*,
*flaming box*, *3 tiny balloons*), and a voxel object pops into a physics world.
Objects carry behavior tags (flammable, hot, wet, bouncy, flies, edible, eats…), so
they interact on their own: fire spreads to wood, dogs chase bones, balloons float
away and pop near flames. Solve each level by summoning the right things.

Built for **Hackyard Yard #6: "Offline"**.

## Works 100% offline

Blockspell makes no network requests at all. There's no CDN, no remote fonts, no
analytics, and no audio or texture files to fetch:

- Every model is generated in code from a small voxel DSL.
- Every sound is synthesized live with the WebAudio API.
- The UI uses your system font stack.
- `three` and `cannon-es` are bundled from npm at build time.

Once you've installed dependencies, it plays fine in airplane mode.

## Running it

Requires Node 18+.

```bash
npm install        # the only step that needs a network connection
npm run dev        # dev server with hot reload
```

Production build:

```bash
npm run build      # type-checks and outputs dist/
npm run preview    # serves dist/ at http://localhost:4173
```

`dist/` is a plain static site with relative paths (`base: './'`), so any static
file server works, from any sub-path. For example:

```bash
cd dist && python3 -m http.server 8080
```

(Browsers won't load ES modules from `file://`, so use a local server rather than
double-clicking `index.html`.)

## How to play

- **Type** a word in the spell bar and press **Enter**. Typing anywhere focuses it,
  and ↑/↓ recall earlier spells.
- **Adjectives** stack (*giant flaming dog*, *tiny golden rocket*, *angry ghostly cow*):
  size (*tiny, small, big, giant*), color (*red, blue, rainbow, golden*…), and magic
  (*flaming, frozen, hot, wet, heavy, light, flying, bouncy, sticky, slippery, ghostly,
  angry, fast, slow, metal, magnetic, explosive, glowing, alive, wooden, tasty*).
  *very* doubles an adjective.
- **Spellbook** (📖 button or **Tab**) lists every word you've discovered, by category.
  Click a word to cast it again. Discoveries are saved locally.
- **The hero** (*hero*, *kid*, *explorer*…) walks to wherever you click and climbs
  ladders, ropes, stairs and trees to reach higher ground.
- **Counts**: *3 balls*, *two dogs* (up to 5).
- **Click the ground** to choose where things appear. **Click an object** to poke it.
- **Drag** to orbit the camera, **scroll** to zoom.
- If Blockspell doesn't know a word, it suggests close matches and autocorrects
  small typos.

## What's in the box

99 objects across creatures, vehicles & flyers, building & gadgets, nature, food and
everyday things, each with a few synonyms (*dog*: puppy, doggo, hound…). Interactions
come from behavior tags (documented in `src/core/tags.ts`), for example:

- fire ignites flammable things, which char and burn away; TNT and bombs explode with
  impulse, shatter fragile things and set off chain reactions
- ice and snowmen melt near heat into puddles; water puts out fires and makes ice slippery;
  rain clouds soak whatever is below them
- balloons carry light things on a string; rockets and jetpacks thrust; fans blow;
  magnets pull metal; trampolines and springs launch; parachutes and umbrellas glide
- animals wander and chase their food (dog → bone, cat → mouse/fish, mouse → cheese,
  rabbit → carrot…), flee predators and fire, and swim or float in water
- heavy things smash fragile ones; keys unlock doors; sharp things pop balloons

## Architecture

```
src/
  main.ts            entry point
  game.ts            wires renderer, world, input, parser, levels and HUD
  core/              engine-agnostic simulation
    world.ts         GameWorld: entities, physics, behavior dispatch, spawn juice, queries
    entity.ts        Entity: mesh + body + tags + state
    spawn.ts         ObjectDef + modifiers -> voxel mesh + cannon-es body
    tags.ts          documented tag list (open string type)
    events.ts        typed event bus (spawn, ignite, ate, popped, ...)
    registry.ts      id registry with import.meta.glob auto-registration
  engine/            rendering & juice
    renderer.ts      three.js scene, ACES tone mapping, soft shadows, fog, OrbitControls
    sky.ts clouds.ts terrain.ts noise.ts   procedural sky, voxel clouds, floating island
    particles.ts     pooled InstancedMesh voxel particles (lit + glowing)
    audio.ts         WebAudio synth sound effects
    fx.ts shake.ts tween.ts marker.ts      juice helpers
  voxel/             voxel DSL (builder), palette, face-culled AO mesher, box decomposition
  objects/defs/      one file per spawnable object      <- add objects here
  adjectives/defs/   adjective modifiers                <- add adjectives here
  behaviors/defs/    per-tag behaviors                  <- add behaviors here
  levels/defs/       puzzle levels                      <- add levels here
  parser/            tokenize -> count -> adjectives + noun -> synonyms, fuzzy suggestions
  ui/                DOM HUD, toasts, styles
```

Dev-only helpers live in `tools/` (served by `npm run dev`, not part of the build):
`tools/gallery.html` renders object models in a grid, `tools/scenario.html` runs scripted
interaction scenarios, and `tools/object-brief.md` describes how to write new objects.

Objects, adjectives, behaviors and levels are discovered automatically: drop a file
into the matching `defs/` folder that default-exports a definition (or an array of
them) and it's registered. You don't need to edit any index file.

### Adding an object

```ts
// src/objects/defs/rock.ts
import { defineObject } from '../types';

export default defineObject({
  id: 'rock',
  name: 'rock',
  synonyms: ['stone', 'boulder'],
  tags: ['heavy'],
  physics: { mass: 20 },
  build(b) {
    b.sphere(4, 3, 4, 4, 'stone');
  },
});
```

### Adding a behavior

```ts
// src/behaviors/defs/sticky.ts
import { defineBehavior } from '../types';

export default defineBehavior({
  id: 'sticky',
  tags: ['sticky'],
  contact(e, other, world) {
    /* ... */
  },
});
```

## License

[MIT](LICENSE) © 2026 Robert Gordon
