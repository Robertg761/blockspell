import { defineLevel } from '../types';

export default defineLevel({
  id: 'sandbox',
  name: 'Free Play',
  order: 0,
  description: 'An island all to yourself. Write anything you can think of.',
  hint: 'Try "big red ball", "flaming box", or "3 balloons".',
  camera: { position: [9, 8, 14], target: [0, 1, 0] },
  spawnPoint: [0, 0, 0],
  setup() {},
});
