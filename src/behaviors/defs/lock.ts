import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { defineBehavior } from '../types';

export function unlock(door: Entity, key: Entity, world: GameWorld): void {
  if (!door.has('locked') || !key.alive) return;
  world.removeTag(door, 'locked');
  door.state.open = true;
  world.fx.sound('chime');
  world.fx.sparkle(key.body.position, ['#fff6a8', '#ffd84a', '#ffffff'], 30);
  world.remove(key, 'used', 'poof');
  // swing open around the left edge (hinge at local -X)
  door.body.collisionResponse = false;
  const hx = door.size.x / 2;
  const v = door.visual;
  world.fx.tweens.add({
    duration: 0.9,
    update: (t) => {
      const a = (1 - (1 - t) ** 3) * Math.PI * 0.55;
      v.rotation.y = a;
      v.position.x = -hx + hx * Math.cos(a);
      v.position.z = -hx * Math.sin(a);
    },
  });
  world.events.emit('unlocked', { entity: door, key });
}

/** Keys open locked things they touch (doors swing open and stop blocking). */
export default [
  defineBehavior({
    id: 'key',
    tags: ['key'],
    update(e, world) {
      const door = world.nearest(e.body.position, e.radius + 3, (o) => o.has('locked'));
      if (door && world.touching(e, door, 0.2)) unlock(door, e, world);
    },
    contact(e, other, world) {
      if (other?.has('locked')) unlock(other, e, world);
    },
  }),
  defineBehavior({ id: 'locked', tags: ['locked'] }),
];
