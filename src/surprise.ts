/**
 * "Surprise me": short staged scenes for Free Play. Each one casts a few spells a beat apart
 * so the things already in the world react to each other (a cat chases a mouse that is after
 * the cheese, TNT meets a wall...). Positions are meters from the island's center.
 */
export interface Vignette {
  id: string;
  name: string;
  /** One line shown with the scene's name. */
  blurb: string;
  steps: { spell: string; at: [number, number]; delay: number }[];
}

export const VIGNETTES: Vignette[] = [
  {
    id: 'pup-party', name: 'Pup party', blurb: 'One dog, one bone, and a lot of balloons.',
    steps: [
      { spell: 'dog', at: [-2.5, 0.5], delay: 0 },
      { spell: '3 rainbow balloons', at: [1.5, -1.5], delay: 0.5 },
      { spell: 'bone', at: [2.2, 1], delay: 1.3 },
      { spell: 'bone', at: [-0.5, -2], delay: 3.2 },
    ],
  },
  {
    id: 'chase', name: 'Cheese chase', blurb: 'The cat wants the mouse. The mouse wants the cheese.',
    steps: [
      { spell: 'cheese', at: [2.5, 0], delay: 0 },
      { spell: 'mouse', at: [-0.5, 0.5], delay: 0.6 },
      { spell: 'cat', at: [-3, -0.5], delay: 1.4 },
    ],
  },
  {
    id: 'fireworks', name: 'Fireworks night', blurb: 'Three rockets, three colors.',
    steps: [
      { spell: 'red rocket', at: [-2.4, 0], delay: 0 },
      { spell: 'blue rocket', at: [0, 0.8], delay: 0.5 },
      { spell: 'golden rocket', at: [2.4, 0], delay: 1 },
    ],
  },
  {
    id: 'snow-day', name: 'Snow day', blurb: 'A giant snowman meets a campfire.',
    steps: [
      { spell: 'giant snowman', at: [-0.8, 0], delay: 0 },
      { spell: 'fire', at: [1.8, 0.4], delay: 1.5 },
      { spell: 'cloud', at: [0.5, 0], delay: 4 },
    ],
  },
  {
    id: 'demolition', name: 'Demolition crew', blurb: 'A wall, a stack of crates, and a little TNT.',
    steps: [
      { spell: 'wall', at: [0, -1], delay: 0 },
      { spell: '3 crates', at: [0, 1.2], delay: 0.6 },
      { spell: 'flaming tnt', at: [0.3, 0.2], delay: 1.8 },
    ],
  },
  {
    id: 'bounce', name: 'Bounce house', blurb: 'Bouncy rainbow balls on a trampoline.',
    steps: [
      { spell: 'trampoline', at: [0, 0], delay: 0 },
      { spell: '4 bouncy rainbow balls', at: [0, 0], delay: 0.7 },
    ],
  },
  {
    id: 'magnet', name: 'Magnet mess', blurb: 'Metal things have opinions about magnets.',
    steps: [
      { spell: '4 metal balls', at: [0, 0], delay: 0 },
      { spell: 'magnet', at: [3, 0.5], delay: 1.2 },
    ],
  },
];

let last = '';

/** A random scene, never the one just played. */
export function pickVignette(): Vignette {
  const pool = VIGNETTES.filter((v) => v.id !== last);
  const v = pool[Math.floor(Math.random() * pool.length)];
  last = v.id;
  return v;
}
