import { defineAdjectives } from '../types';

export default defineAdjectives([
  { id: 'tiny', synonyms: ['teeny', 'mini', 'miniature', 'itty bitty', 'microscopic'], category: 'size', apply: (m) => void (m.scale *= 0.4) },
  { id: 'small', synonyms: ['little', 'smol', 'short', 'baby', 'wee'], category: 'size', apply: (m) => void (m.scale *= 0.65) },
  { id: 'big', synonyms: ['large', 'tall', 'long', 'great', 'jumbo'], category: 'size', apply: (m) => void (m.scale *= 1.6) },
  { id: 'huge', synonyms: ['giant', 'gigantic', 'enormous', 'massive', 'colossal', 'humongous', 'mega', 'titanic'], category: 'size', apply: (m) => void (m.scale *= 2.4) },
]);
