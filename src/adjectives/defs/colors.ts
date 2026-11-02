import type { AdjectiveDef } from '../types';

const COLORS: [string, string, string[]][] = [
  ['red', '#e0443e', ['crimson', 'scarlet']],
  ['orange', '#f08a24', []],
  ['yellow', '#f2cf3a', ['lemon']],
  ['green', '#52b848', ['lime']],
  ['blue', '#3d7fe0', ['navy']],
  ['cyan', '#3cc8d8', ['teal', 'turquoise']],
  ['purple', '#9256d6', ['violet', 'lavender']],
  ['pink', '#f07aa8', ['magenta']],
  ['white', '#f2f0ea', []],
  ['black', '#2a2a30', ['dark']],
  ['grey', '#8e8e96', ['gray', 'silver']],
  ['brown', '#8a5a34', []],
];

export default COLORS.map(
  ([id, hex, synonyms]): AdjectiveDef => ({
    id,
    synonyms,
    category: 'color',
    exclusive: true,
    apply: (m) => void (m.tint = hex),
  }),
);
