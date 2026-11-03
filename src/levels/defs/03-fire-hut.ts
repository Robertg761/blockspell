import { defineLevel } from '../types';
import { fireOut, firstWithRole, place, withRole } from '../goals';
import { ignite } from '../../behaviors/lib/fire';

export default defineLevel({
  id: 'fire-hut',
  name: 'Put Out the Fire',
  order: 3,
  description: 'A little hut is on fire, and the flames are spreading!',
  hint: 'Fire hates water. Try something wet, or something that makes rain, or something very cold.',
  hero: [0, 0, 5.5],
  castRange: 6,
  par: 1,
  camera: { position: [5, 5, 11], target: [0, 1.2, -2] },
  spawnPoint: [0, 0, -1],
  terrain: { trees: 0, rocks: 0, shrubs: 16 },
  setup(world) {
    // stone path to the hut
    world.addStaticBox({ position: [0, 0.03, 1.5], size: [1.2, 0.06, 5], style: 'cobble' });
    const hut = place(world, 'hut', [0, 0, -3], 'hut');
    if (hut) {
      ignite(hut, world);
      hut.state.burnLeft = hut.state.burnTotal = 50;
    }
  },
  goal: {
    text: 'Put out the fire before the hut burns down',
    check: (w) => !!firstWithRole(w, 'hut') && fireOut(w, 'hut'),
  },
  fail: (w) => (withRole(w, 'hut').length === 0 ? 'The hut burned down!' : null),
  solutions: [
    { name: 'water', steps: [{ walkTo: [0, 1] }, { cast: 'water', at: [0, -1.4] }], timeout: 8 },
    { name: 'rain cloud', steps: [{ walkTo: [0, 1] }, { cast: 'cloud', at: [0, -2.5] }], timeout: 15 },
    { name: 'bucket', steps: [{ walkTo: [0, 1] }, { cast: 'bucket', at: [0, -1.5] }], timeout: 8 },
    { name: 'snowball', steps: [{ walkTo: [0, 1] }, { cast: 'snowball', at: [0, -1.5] }], timeout: 8 },
    { name: 'ice', steps: [{ walkTo: [0, 1] }, { cast: 'ice', at: [0, -1.5] }], timeout: 8 },
    { name: 'giant snowman', steps: [{ walkTo: [0, 1] }, { cast: 'giant snowman', at: [0, 0] }], timeout: 10 },
  ],
});
