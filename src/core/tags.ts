/**
 * Behavior tags. Objects declare tags; behaviors (src/behaviors/defs) run for
 * entities carrying matching tags. `Tag` is an open string type so new
 * modules can introduce tags without editing this file — but please document
 * new tags here so the spellbook stays readable.
 */
export const KNOWN_TAGS = {
  // props in [brackets] are read from ObjectDef.props
  flammable: 'Catches fire near hot things, chars and burns away to ash. [burnTime=7]',
  floats: 'Bobs on water instead of sinking.',
  flies: 'Generates lift and hovers/drifts up to a ceiling height. [lift=1.25 (×gravity), ceiling=8]',
  edible: 'Can be eaten by things that eat.',
  heavy: 'Very massive; lands with a thud, shakes the ground and smashes fragile things.',
  hot: 'Heats nearby things: ignites flammables, melts cold things. [heatRadius=1, extinguishable=0|1]',
  wet: 'Puts out fires, cannot burn, makes cold things slippery.',
  bouncy: 'Springs back on impact.',
  climbable: 'Characters (animals, the hero) can climb it.',
  animal: 'Moves on its own, stays upright, flees danger and predators. [speed=2, sight=10]',
  eats: 'Seeks out and eats food (ObjectDef.diet, default: edible).',
  poppable: 'Pops instantly when touched by something hot or sharp.',
  fragile: 'Shatters when hit hard or by something heavy. [breakSpeed=6]',
  metal: 'Pulled by magnets; never burns.',
  magnet: 'Pulls metal things toward itself. [magnetRange=6, magnetForce=30]',
  explosive: 'Explodes when ignited, after a fuse, or on hard impact. [fuse=0 (s, 0 = only when lit), blastRadius=4, blastForce=14, impactBlast=0 (m/s, 0 = off)]',
  thrust: 'Rocket thrust along its local +Y axis while fuel lasts. [thrust=2.2 (×gravity), fuel=4 (s)]',
  wind: 'Blows things in front of it (local +Z). [windForce=14, windRange=6]',
  vehicle: 'Drives forward (local +Z) on the ground, or across water if it floats. [speed=4]',
  carrier: 'Grabs light things it touches and carries them (balloons). [carryMass=3]',
  launcher: 'Launches things that land on it straight up (trampoline, spring). [launch=10 (m/s)]',
  glider: 'Falls slowly, like a parachute. [fallSpeed=1.5]',
  cold: 'Melts near hot things; freezes water it touches. [meltTime=4]',
  slippery: 'Almost no friction.',
  glows: 'Casts light around it. [glow=4] (color: ObjectDef.burstColor)',
  sharp: 'Pops poppable things it touches.',
  sticky: 'Sticks to whatever it touches.',
  frozen: 'Frozen solid: cannot move until thawed by heat.',
  ghost: 'Translucent and passes through other objects.',
  angry: 'Charges at the nearest thing and rams it.',
  rainbow: 'Shimmers with every color.',
  liquid: 'A body of water: floats `floats` things, soaks and extinguishes what enters it.',
  rains: 'Rains on whatever is below, soaking it and putting out fires.',
  key: 'Unlocks `locked` things it touches.',
  locked: 'Opens when touched by a key.',
  player: 'A summoned hero: walks to where you click and climbs climbable things.',
  controlled: 'The level hero: moved with WASD/arrows + Space, climbs climbables, stands on anything.',
} as const;

export type KnownTag = keyof typeof KNOWN_TAGS;
export type Tag = KnownTag | (string & {});
