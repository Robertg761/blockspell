# ▣ Blockspell

**Write a word. Make it real.**

Blockspell is a 3D voxel puzzle game that runs in your browser. Type the name of a
thing (*ball*, *dog*, *fire*, *ladder*…), optionally with adjectives (*big red ball*,
*flaming box*, *3 tiny balloons*), and a voxel object pops into a physics world.
Objects carry behavior tags (flammable, hot, wet, bouncy, flies, edible, eats…), so
they interact on their own: fire spreads to wood, dogs chase bones, balloons float
away and pop near flames. Solve each level by summoning the right things.

Built for **Hackyard Yard #6: "Offline"**.

## How to play

Pick a level from the title screen (**▶ Play** continues where you left off, **☰ Levels**
shows every level with your saved stars). Each level has a one-line goal. Summon things to
reach it, using as few spells as you can.

| Key / action | What it does |
| --- | --- |
| **WASD** / **arrows** | Walk (relative to the camera) |
| **Space** | Jump. Walking into knee-high steps hops onto them |
| **W** (or Space) next to a ladder, rope, tree or stairs | Climb. At the top you hop over the edge |
| **Enter** (or **T**, **/**) | Open the spell bar. Type a spell and press Enter to cast it. Esc closes it |
| **Click the ground** | Choose where the next spell appears (the glowing marker) |
| **E** near an object | Grab it: light things go overhead, heavy ones are dragged. **E** again sets it down |
| **F** while carrying | Throw it the way you're facing |
| **Q** while carrying | Turn it 45° before you set it down |
| **Click an object** | Poke it |
| **Drag / scroll** | Orbit / zoom the camera, which follows the hero |
| **R** or ↺ | Restart the level |
| **Tab** or 📖 | Spellbook of discovered words |
| ♪ | Mute music and sound (remembered) |

In **Free Play** there's no hero, so typing anywhere goes straight to the spell bar, and
your pointer is the hand: drag a thing to move it, let go to drop it, and flick to throw it.
It hovers over whatever is under the pointer, so you can stack things too. On
touch screens, hero levels show a joystick with Jump and Climb buttons, plus Grab, Throw
and Turn when they apply. Tips about the controls pop up the first time you need them.

**Carrying things.** Walk up to almost anything you've cast and a prompt names it, with a
ring under what **E** would grab. Things up to 16 kg (a box, a dog, a plank, a bridge) go
over your head, and heavier loads slow you down more. While you carry one, the ring shows
where it will land, so you can stack it on something or stand a ladder up against a ledge.
You can carry things up ladders too. Things up to 45 kg (stairs, a ramp, a rock) are
dragged: you pull or push them along the ground, slowly and without jumping. Animals and
engines over 16 kg won't be dragged, and anything heavier is too heavy to move. A low
ceiling knocks a carried thing out of your hands, and thrown things hit as hard as they
fly, so a thrown crystal shatters. Ghostly things can't be held.

**Stars.** Every successful cast counts as one spell, however many words it has:
"ladder", "giant plank" and "3 tiny balloons" are 1 spell each, and spells that fail to
cast (unknown words, out of range) are free. Solve a level within its *par* for ★★★, or
within twice par for ★★. The HUD counter, the end-of-level summary and the stars all use
this same count. Your best result per level is saved in `localStorage`. Some levels limit how far from the hero you can cast, so you
can't simply summon the answer next to the goal.

### Spells

`[count] [adjectives…] noun`, for example *ladder*, *giant plank*, *3 tiny balloons*,
*very big flaming dog*.

- **Size:** *tiny, small, big, giant*. *very* doubles an adjective.
- **Color:** *red, blue, green, golden, rainbow…*
- **Magic:** *flaming, frozen, hot, wet, heavy, light, flying, bouncy, sticky, slippery,
  ghostly, angry, fast, slow, metal, magnetic, explosive, glowing, alive, wooden, tasty*
- **Counts:** *3 balls*, *two dogs* (up to 5)
- Unknown words get close-match suggestions, and small typos are autocorrected.

Some favourite words: *ladder, stairs, ramp, bridge, plank, trampoline, spring, rope,
balloon, hot air balloon, rocket, jetpack, fan, magnet, bomb, tnt, water, cloud, ice,
snowman, bucket, fire, torch, bone, steak, cheese, dog, cat, mouse, robot, hut, tree, star*.
Objects with a direction line up with your aim: bridges and planks span from the hero
toward the marker, ramps rise toward it, and stairs climb away from you.

## Levels (and some ways to solve them)

Every level has several solutions. Those listed here are scripted in the level file and
replayed by the headless checker (see *Development*).

1. **Star on the Cliff.** Bring the star down from a 2.5 m cliff (par 1).
   *ladder* (climb it, then walk into the star) · *stairs* (walk up, jump onto the ledge) ·
   *bomb* cast on the ledge. Unscripted ideas: a *boulder* or *giant ball* dropped on top.
2. **Cross the Chasm.** Get to the flag across a 4 m gap between floating cliffs (par 2).
   *big bridge* or *giant plank* aimed into the gap · *trampoline* or *spring* at the edge,
   then jump on it to bounce across.
3. **Put Out the Fire.** The hut is burning and you have about 50 s (par 1).
   Walk up the path, then *water* · *cloud* (rain) · *bucket* · *snowball* · *ice* ·
   *giant snowman*.
4. **Feed the Pup.** A hungry dog sits in a tall pen, and your magic only reaches 1.8 m (par 2).
   Get on top of the wall or into the pen, then cast a *bone* (or *steak*, *burger*…):
   *ladder* + *bone* · *stairs* + *bone* · *trampoline* + *bone* · *big box* + *box* + *bone*.
5. **Sky Island.** Reach the island floating 3.6 m up (par 2).
   *trampoline* · *giant ramp* · *big ladder* · *giant stairs*.

## Works 100% offline

Blockspell makes no network requests at all. There's no CDN, no remote fonts, no
analytics, and no audio, texture or model files to fetch:

- Every model, including the title logo, is generated in code from a small voxel DSL.
- Every sound effect and the music loop are synthesized live with the WebAudio API.
- The UI uses your system font stack.
- `three` (including the bloom post-processing from `three/examples`) and `cannon-es` are
  bundled from npm at build time.

Once you've installed dependencies, it plays fine in airplane mode. To check a build:

```bash
npm run build
npm run check-offline   # scans dist/ for external URLs that would be fetched at runtime
```

`check-offline` fails (exit 1) on any http(s) or protocol-relative URL in a fetching
position: HTML/SVG resource attributes, CSS `url()`/`@import`, and JS `fetch`,
`import()`, `new URL`, `WebSocket`, `Worker`, `.src =` and similar. Harmless strings such
as XML namespaces, license comments and doc links are listed but don't fail the check.
Use `--dir <path>` to scan another folder.

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

## Development and automation

`window.__blockspell` is available in every build (see `src/debug.ts`):
`load(n)`, `cast('giant balloon', [x, z])`, `step(seconds)` (synchronous simulation),
`render()`, `state()`, `run(steps)`, `solve(level, i)` and `solveAll()`. Solutions can tap
the hero's action keys with `{ press: 'grab' | 'toss' | 'turn' }`.

URL flags for screenshots:

- `?level=2` skips the title. It takes an order number or an id.
- `&spawn=giant%20balloon` casts a spell. Repeat it, or separate spells with `;`.
- `&at=x,z` sets where to cast.
- `&t=2` simulates 2 s before the first frame.
- `&solve=0` plays solution #0 live.
- `&cam=x,y,z,tx,ty,tz` sets the camera position and target.
- `&mute`, `&nobloom` and `&notips` turn off sound, bloom and the control tips.
- `&hd=1` / `&hd=0` forces HD voxels on or off (see below).
- `&anim=full`, `&anim=lite` or `&anim=off` sets the voxel animations' quality (see below).
- `?levels` opens level select.

HD voxels: every voxel model is drawn with 4x finer, detailed voxels (bevels, mortar,
wood grain, grass blades...) while physics keeps the coarse model. It is on by default
and turns itself off on software rendering or a weak GPU; the HD button (top right) or
the Journal's Graphics button switches it, and the choice is saved. Headless Chrome
renders in software, so automation that wants HD must force it with `&hd=1`
(`BLOCKSPELL_HD=1 npm run check-tasks` does). `__blockspell.hd()` shows the setting,
the geometry cache and the build workers.

Voxel animations: a cast object assembles itself, with its voxels flying in and snapping
into place bottom-up, then a rim flash, sparkle ring, light pulse and squash-and-stretch pop.
A change to an existing object (freezing, thawing, getting wet, catching fire, rainbow,
glowing...) sweeps across it voxel by voxel: a shimmering wave with the new look behind it
and a small bounce. Things that get used up, burn away, melt or are eaten dissolve: their
voxels break off, scatter and shrink away in a puff. It all runs on the GPU (a per-cell
shader patch on every object's materials, plus instanced cubes moved in the vertex shader),
looks the same with HD on or off, and is visual only: physics and game state change at
once, as before. Software rendering, weak GPUs, `prefers-reduced-motion` and a slow frame
rate get a shorter `lite` version without the flying voxels. `__blockspell.anim()` shows
the setting; `BLOCKSPELL_ANIM=full npm run check-tasks` runs the checks with the full version.

Dev-only pages (served by `npm run dev`, not part of the build):

- `tools/levels.html` replays every level solution headlessly and logs PASS/FAIL.
  From the shell, run `tools/check-levels.sh` or `tools/check-levels.sh "level=chasm&dump"`
  with the dev server on port 5199.
- `tools/gallery.html` renders object models in a grid.
- `tools/scenario.html` runs scripted interaction scenarios.
- `tools/fx.html` previews the win celebration.

Guides: `tools/level-brief.md` for writing levels and `tools/object-brief.md` for objects.

## What's in the box

100 spellbook words (plus the hero) across creatures, vehicles & flyers, building &
gadgets, nature, food and everyday things, each with a few synonyms (*dog*: puppy, doggo,
hound…). Interactions come from behavior tags (documented in `src/core/tags.ts`), for example:

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
  main.ts            entry point (title screen or ?level= query flags)
  game.ts            wires renderer, world, input, parser, levels and HUD; tick/step, win flow, camera follow
  debug.ts           window.__blockspell automation hook + URL query flags
  core/              engine-agnostic simulation
    world.ts         GameWorld: entities, physics, behavior dispatch, spawn juice, queries
    entity.ts        Entity: mesh + body + tags + state
    spawn.ts         ObjectDef + modifiers -> voxel mesh + cannon-es body
    tags.ts          documented tag list (open string type)
    events.ts        typed event bus (spawn, ignite, ate, popped, ...)
    registry.ts      id registry with import.meta.glob auto-registration
  engine/            rendering & juice
    renderer.ts      three.js scene, bloom post-processing, ACES tone mapping, soft shadows, fog, OrbitControls
    sky.ts clouds.ts terrain.ts noise.ts   procedural sky, voxel clouds, floating island
    particles.ts     pooled InstancedMesh voxel particles (lit + glowing)
    audio.ts         WebAudio synth sound effects
    music.ts         generative music loop on a lookahead scheduler
    fx.ts shake.ts tween.ts marker.ts      juice helpers
    voxanim.ts       GPU voxel animations: spawn assembly, change sweep, dissolve
  voxel/             voxel DSL (builder), palette, face-culled AO mesher, box decomposition,
                     HD voxels (hd-core.ts meshing in a worker, hd.ts cache, LOD and setting)
  objects/defs/      one file per spawnable object      <- add objects here
  adjectives/defs/   adjective modifiers                <- add adjectives here
  behaviors/defs/    per-tag behaviors                  <- add behaviors here
  levels/            goals.ts (goal helpers), progress.ts (localStorage stars), solve.ts (solution replay)
  levels/defs/       puzzle levels                      <- add levels here (see tools/level-brief.md)
  parser/            tokenize -> count -> adjectives + noun -> synonyms, fuzzy suggestions
  ui/                DOM HUD, level select, toasts, spellbook, tutorial tips, touch controls, voxel logo
```

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

The keyboard hero is the `hero` object retagged with `controlled`
(`src/behaviors/defs/controlled.ts`). Grabbing, carrying and throwing live in
`src/behaviors/defs/carry.ts` and `src/behaviors/lib/carry.ts`.

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
