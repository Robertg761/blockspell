import { defineLevel } from '../types';

export default defineLevel({
  id: 'campfire',
  name: 'Campfire',
  order: 2,
  description: 'Night is coming and the camp needs warmth. Light the wood pile!',
  hint: 'Something hot near something flammable…',
  camera: { position: [-6, 6, 9], target: [0, 0.8, 0] },
  spawnPoint: [2.5, 0, 2.5],
  setup(world) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      const e = world.spawnById('plank', {
        position: { x: Math.cos(a) * 0.15, y: i * 0.21, z: Math.sin(a) * 0.15 },
        grounded: true,
        silent: true,
        yaw: a,
      });
      if (e) e.state.woodPile = true;
    }
    for (const [x, z] of [[-2.2, -1], [2.2, -1.2], [0, 2.4]]) world.addStaticBox({ position: [x, 0.25, z], size: [1, 0.5, 0.5], color: 'woodDark', topColor: 'wood' });
    world.on('ignite', ({ entity }) => {
      if (entity.state.woodPile) world.flags.lit = true;
    });
  },
  goal: { text: 'Set the wood pile on fire', check: (w) => w.flags.lit === true },
});
