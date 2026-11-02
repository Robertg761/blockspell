import { defineObject } from '../types';

export default defineObject({
  id: 'balloon',
  name: 'balloon',
  synonyms: ['party balloon', 'helium balloon', 'baloon', 'ballon'],
  category: 'items',
  blurb: 'Floats up, up, and away. Keep it away from fire!',
  tags: ['flies', 'poppable'],
  tintKeys: ['balloon', 'balloonShine'],
  burstColor: '#ff4f7b',
  spawnSound: 'squeak',
  physics: { mass: 0.08, shape: 'auto', maxBoxes: 5, linearDamping: 0.6, angularDamping: 0.9, restitution: 0.4 },
  props: { lift: 1.3, ceiling: 7 },
  build(b) {
    const cx = 3.5, cz = 3.5;
    b.ellipsoid(cx, 13, cz, 3.6, 4.4, 3.6, 'balloon');
    b.ellipsoid(cx - 1.4, 14.6, cz + 2, 0.9, 1.3, 0.9, 'balloonShine');
    b.box(3, 8, 3, 4, 8, 4, 'balloon'); // knot
    for (let y = 0; y < 8; y++) b.set(3 + (y % 4 === 1 ? 1 : 0), y, 3, 'string');
  },
});
