import { defineAdjectives } from '../types';

/** Adjectives that add behaviors (and looks) rather than just size or color. */
export default defineAdjectives([
  {
    id: 'golden',
    synonyms: ['gold', 'gilded', 'gold plated', 'treasure'],
    category: 'color',
    exclusive: true,
    apply: (m) => {
      m.tint = '#f2bd2c';
      m.flags.metalness = 0.85;
      m.flags.roughness = 0.28;
      m.massMul *= 2;
      m.addTags.add('metal');
      m.removeTags.add('flammable');
    },
  },
  {
    id: 'rainbow',
    synonyms: ['colorful', 'colourful', 'multicolored', 'multicoloured', 'prismatic', 'rainbow colored'],
    category: 'color',
    exclusive: true,
    apply: (m) => void m.addTags.add('rainbow'),
  },
  {
    id: 'frozen',
    synonyms: ['icy', 'frosty', 'cold', 'chilly', 'frozen solid', 'iced'],
    category: 'temperature',
    exclusive: true,
    apply: (m) => {
      m.addTags.add('frozen');
      m.addTags.add('cold');
      m.removeTags.add('hot');
      m.removeTags.add('wet');
      m.state.burning = false;
    },
  },
  {
    id: 'ghostly',
    synonyms: ['ghost', 'invisible', 'transparent', 'see through', 'spooky', 'phantom', 'spectral', 'haunted'],
    apply: (m) => void m.addTags.add('ghost'),
  },
  {
    id: 'angry',
    synonyms: ['mad', 'furious', 'grumpy', 'raging', 'evil', 'mean', 'vicious', 'aggressive'],
    apply: (m) => {
      m.addTags.add('angry');
      m.flags.speedMul = ((m.flags.speedMul as number) ?? 1) * 1.4;
    },
  },
  {
    id: 'fast',
    synonyms: ['quick', 'speedy', 'rapid', 'zippy', 'turbo', 'swift', 'hyper'],
    category: 'speed',
    apply: (m) => void (m.flags.speedMul = ((m.flags.speedMul as number) ?? 1) * 2),
  },
  {
    id: 'slow',
    synonyms: ['sluggish', 'lazy', 'sleepy', 'leisurely'],
    category: 'speed',
    apply: (m) => void (m.flags.speedMul = ((m.flags.speedMul as number) ?? 1) * 0.4),
  },
  {
    id: 'sticky',
    synonyms: ['gooey', 'glue', 'gluey', 'slimy', 'adhesive', 'tacky', 'gummy'],
    apply: (m) => {
      m.addTags.add('sticky');
      m.friction = 1;
    },
  },
  {
    id: 'metal',
    synonyms: ['metallic', 'steel', 'chrome', 'robotic', 'tin'],
    category: 'material',
    exclusive: true,
    apply: (m) => {
      m.addTags.add('metal');
      m.removeTags.add('flammable');
      m.removeTags.add('floats');
      m.flags.metalness = 0.8;
      m.flags.roughness = 0.35;
      m.massMul *= 2.5;
      if (!m.tint) m.tint = '#a3adb8';
    },
  },
  {
    id: 'magnetic',
    synonyms: ['magnetized', 'magnetised', 'attractive'],
    apply: (m) => {
      m.addTags.add('magnet');
      m.addTags.add('metal');
      m.removeTags.add('flammable');
    },
  },
  {
    id: 'explosive',
    synonyms: ['exploding', 'volatile', 'booby trapped', 'unstable', 'nuclear'],
    apply: (m) => {
      m.addTags.add('explosive');
      m.state.impactBlast = 5;
    },
  },
  {
    id: 'glowing',
    synonyms: ['glowy', 'shining', 'shiny', 'luminous', 'radiant', 'bright', 'neon', 'sparkly'],
    apply: (m) => {
      m.addTags.add('glows');
      m.state.glowAdjective = true;
    },
  },
  {
    id: 'slippery',
    synonyms: ['greasy', 'oily', 'slick', 'buttery'],
    apply: (m) => void m.addTags.add('slippery'),
  },
  {
    id: 'alive',
    synonyms: ['living', 'animated', 'walking', 'sentient', 'enchanted'],
    apply: (m) => {
      m.addTags.add('animal');
      m.removeTags.add('liquid');
    },
  },
]);
