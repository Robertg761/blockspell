# Writing a Blockspell level

A level is one file in `src/levels/defs/NN-id.ts` default-exporting `defineLevel({...})`
(see `src/levels/types.ts` for every field). It is auto-registered.

## Building the layout
- `terrain`: island overrides (`{ flatRadius, hilliness, trees, rocks, seed }`), or `null` for no
  island at all (build floating platforms from static boxes over the sky void).
  The default island is flat within ~9 m of the origin at y = 0, hilly beyond.
- `world.addStaticBox({ position: [cx, cy, cz], size: [sx, sy, sz], color, topColor })`: static
  voxel blocks (center + size, 0.25 m voxels). Palette keys: see `src/voxel/palette.ts`
  (e.g. 'stone', 'grass', 'dirt', 'wood', 'woodDark', 'sand', 'snow').
- `place(world, 'dog', [x, y, z], 'pup')` (from `../goals`) spawns an object with its base at y,
  silently, and marks it with a role (+ pins it so the entity cap never removes it).
  Tweak it afterwards: `world.removeTag(e, 'flies')`, `e.state.burnLeft = 999`, `world.addTag(...)`.
- Events: `world.on('ate' | 'ignite' | 'extinguish' | 'burnedUp' | 'popped' | 'remove' | ..., fn)`
  (`src/core/events.ts`), cleaned up on level change. Scratch state: `world.flags`.

## The hero and the player
- `hero: [x, y, z]` spawns the keyboard hero (feet position). WASD/arrows move (camera-relative),
  Space jumps (~1.25 m), holding W/Space while overlapping a `climbable` (ladder, rope, stairs,
  tree) climbs it, and at the top it hops over the lip. Walking into a knee-high (< ~0.5 m) step
  hops onto it. It stands on anything solid. Falls below `killY` (default -6) respawn it at start.
  Tuning: `HERO` in `src/behaviors/defs/controlled.ts`.
- The player casts at the aim marker (click a surface). `castRange` limits casts to N m from the
  hero, so the puzzle can't be skipped by summoning things next to the goal.
- Objects with `orient` line up with the caster→aim direction: bridge/plank/log/ramp span
  toward the aim (ramp rises toward it), stairs rise away from the hero, ladders face the hero.
- Sizes (scale 1): hero 0.78×1.24×0.46 (mass 30), ladder 0.9×2.6, stairs 1.4w×1.5h×2.5d,
  plank 2.2 long, bridge 3.2 long, box 0.8³. Size adjectives: tiny 0.4, small 0.65, big 1.6,
  giant 2.4 (×scale); "very" doubles. Probe more with `tools/check-levels.sh "probe=giant plank;bridge"`.

## Goal, stars, failure
- `goal: { text: 'One-line goal', check: (w) => boolean }`. Helpers in `src/levels/goals.ts`:
  `heroTouches`, `heroInside`, `heroStandingAbove`, `restingBelow`, `fireOut`, `watchFed`/`fed`,
  `holdFor(seconds, cond)`, `withRole`.
- `par`: spells for 3 stars (each successful cast counts once: "giant balloon" = 1).
- `fail: (w) => string | null` shows a "try again" toast (e.g. the hut burned down).

## Solutions (required)
`solutions: [{ name, steps, timeout? }]` with steps:
`{ cast: 'giant plank', at: [x, z] }` (or `[x, y, z]` to aim at a raised surface),
`{ wait: s }`, `{ walkTo: [x, z], jump?, up?, timeout? }`, `{ hold: { dir: [x, z], up?, jump? }, for: s }`,
`{ poke: 'ball', near?: [x, z] }`. They run exactly like a player would (castRange applies).

Verify with the dev server running (`npx vite --port 5199 --strictPort`):
`tools/check-levels.sh "level=<id>&dump"` → PASS/FAIL per solution + final entity state, and
`/tmp/levels.png` (screenshot of the last state; use a unique copy if others run checks too).
Screenshot a live state: `google-chrome --headless=new --no-sandbox --use-angle=swiftshader
--enable-unsafe-swiftshader --window-size=1200,750 --virtual-time-budget=4000 --screenshot=/tmp/x.png
"http://localhost:5199/?level=<id>&t=1"` (also `&spawn=ladder&at=x,z`, `&solve=0`, `&cam=x,y,z,tx,ty,tz`).

`tools/example-level.ts.txt` is a tiny working example.
