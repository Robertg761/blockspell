import { defineLevel } from '../types';

export default defineLevel({
  id: 'good-boy',
  name: 'Good Boy',
  order: 1,
  description: 'This pup is stuck up on a ledge and very hungry.',
  hint: 'Dogs love something chewy. Click the ledge to choose where it appears.',
  camera: { position: [7, 7, 9], target: [0, 1.5, -2] },
  spawnPoint: [3, 0, 2],
  setup(world) {
    world.addStaticBox({ position: [0, 1.25, -3], size: [4, 2.5, 4], color: 'stone', topColor: 'grass' });
    world.spawnById('dog', { position: { x: 0, y: 2.5, z: -3 }, grounded: true, silent: true, yaw: 0.6 });
    world.on('ate', ({ eater }) => {
      if (eater.def.id === 'dog') world.flags.fed = true;
    });
  },
  goal: { text: 'Feed the dog', check: (w) => w.flags.fed === true },
});
