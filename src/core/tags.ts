/**
 * Behavior tags. Objects declare tags; behaviors (src/behaviors/defs) run for
 * entities carrying matching tags. `Tag` is an open string type so new
 * modules can introduce tags without editing this file — but please document
 * new tags here so the spellbook stays readable.
 */
export const KNOWN_TAGS = {
  flammable: 'Catches fire near hot things and burns away.',
  floats: 'Bobs on water instead of sinking.',
  flies: 'Generates lift and drifts upward.',
  edible: 'Can be eaten by things that eat.',
  heavy: 'Very massive; lands with a thud and shakes the ground.',
  hot: 'Heats nearby things; ignites flammables.',
  wet: 'Puts out fires and cannot catch fire.',
  bouncy: 'Springs back on impact.',
  climbable: 'Characters can climb it (used by later passes).',
  animal: 'Moves on its own, stays upright, flees danger.',
  eats: 'Seeks out and eats edible things.',
  poppable: 'Pops instantly when touched by something hot.',
} as const;

export type KnownTag = keyof typeof KNOWN_TAGS;
export type Tag = KnownTag | (string & {});
