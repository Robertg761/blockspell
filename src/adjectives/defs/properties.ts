import { defineAdjectives } from '../types';

export default defineAdjectives([
  {
    id: 'heavy',
    synonyms: ['weighty', 'dense', 'iron', 'lead', 'chonky', 'fat'],
    category: 'weight',
    exclusive: true,
    apply: (m) => {
      m.massMul *= 6;
      m.addTags.add('heavy');
      m.removeTags.add('flies');
    },
  },
  {
    id: 'light',
    synonyms: ['lightweight', 'feathery', 'weightless'],
    category: 'weight',
    exclusive: true,
    apply: (m) => {
      m.massMul *= 0.25;
      m.removeTags.add('heavy');
    },
  },
  {
    id: 'flying',
    synonyms: ['floating', 'hovering', 'levitating', 'winged', 'airborne'],
    apply: (m) => {
      m.addTags.add('flies');
      m.removeTags.add('heavy');
    },
  },
  {
    id: 'bouncy',
    synonyms: ['springy', 'rubber', 'rubbery', 'elastic', 'boingy'],
    apply: (m) => {
      m.addTags.add('bouncy');
      m.restitution = 0.88;
    },
  },
  {
    id: 'wet',
    synonyms: ['soaked', 'soggy', 'damp', 'watery', 'drenched'],
    category: 'temperature',
    exclusive: true,
    apply: (m) => {
      m.addTags.add('wet');
      m.state.burning = false;
    },
  },
  {
    id: 'flaming',
    synonyms: ['burning', 'fiery', 'blazing', 'on fire', 'lit'],
    category: 'temperature',
    exclusive: true,
    apply: (m) => {
      m.addTags.add('flammable');
      m.removeTags.add('wet');
      m.state.burning = true;
    },
  },
  {
    id: 'hot',
    synonyms: ['warm', 'scorching', 'toasty', 'molten'],
    category: 'temperature',
    exclusive: true,
    apply: (m) => {
      m.addTags.add('hot');
      m.removeTags.add('wet');
      if (!m.tint) m.tint = '#ff7a3c';
    },
  },
  {
    id: 'wooden',
    synonyms: ['wood'],
    category: 'material',
    exclusive: true,
    apply: (m) => {
      m.addTags.add('flammable');
      m.addTags.add('floats');
      if (!m.tint) m.tint = '#b07a43';
    },
  },
  {
    id: 'tasty',
    synonyms: ['edible', 'delicious', 'yummy', 'tasty looking'],
    apply: (m) => void m.addTags.add('edible'),
  },
]);
