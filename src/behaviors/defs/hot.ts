import { lightFuse } from '../lib/blast';
import { ignite, pop, steam } from '../lib/fire';
import { defineBehavior } from '../types';

/**
 * Heat sources warm up nearby things: flammables ignite, poppables pop,
 * explosives light, frozen things thaw and cold things melt.
 */
export default defineBehavior({
  id: 'hot',
  tags: ['hot'],
  update(e, world, dt) {
    const reach = 0.5 * e.prop('heatRadius', 1);
    for (const o of world.nearby(e.body.position, e.radius + reach + 3)) {
      if (o === e) continue;
      const gap = e.distanceTo(o) - (e.radius + o.radius) * 0.75;
      if (gap > reach) continue;
      if (o.has('poppable')) {
        pop(o, world);
        continue;
      }
      if (o.has('frozen')) {
        o.state.thaw = ((o.state.thaw as number) ?? 0) + dt;
        if ((o.state.thaw as number) > 1.5) {
          o.state.thaw = 0;
          steam(world, o.body.position, Math.max(0.6, o.radius));
          world.removeTag(o, 'frozen');
        }
        continue;
      }
      if (o.has('cold')) o.state.melt = Math.min(1, ((o.state.melt as number) ?? 0) + dt / (o.prop('meltTime', 4) * Math.sqrt(o.scale)));
      if (o.has('explosive') && !o.has('wet')) {
        o.state.heat += dt * 1.5;
        if (o.state.heat >= 1) lightFuse(o, world, (o.state.fuseLeft as number | undefined) ?? 1.2);
      }
      if (o.has('flammable') && !o.state.burning && !o.has('wet')) {
        o.state.heat += dt * 1.1;
        if (o.state.heat >= 1) ignite(o, world);
      }
    }
  },
});
