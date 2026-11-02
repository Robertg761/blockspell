import type { MeshStandardMaterial } from 'three';
import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';

const FLAME_COLORS = ['#fff1a0', '#ffc247', '#ff8a2a', '#ff5a1c'];
type P3 = { x: number; y: number; z: number };

/** Emits rising flame + smoke particles and requests a flickering glow light. */
export function emitFlames(world: GameWorld, e: Entity, dt: number, strength = 1): void {
  const rate = 30 * strength * Math.max(0.6, e.radius);
  let acc = ((e.state.flameAcc as number) ?? 0) + dt * rate;
  const n = Math.floor(acc);
  acc -= n;
  e.state.flameAcc = acc;
  const p = e.body.position;
  const top = p.y + e.size.y * 0.15;
  const sx = e.size.x * 0.35, sz = e.size.z * 0.35;
  for (let i = 0; i < n; i++) {
    world.fx.burst(
      { x: p.x + (Math.random() * 2 - 1) * sx, y: top + Math.random() * e.size.y * 0.2, z: p.z + (Math.random() * 2 - 1) * sz },
      { count: 1, color: FLAME_COLORS, speed: 0.5, up: 1.8 + strength, gravity: -2.5, drag: 1.6, life: 0.55, size: 0.13 * Math.sqrt(strength), glow: true, spread: 0.05 },
    );
    if (Math.random() < 0.12)
      world.fx.burst({ x: p.x, y: top + e.size.y * 0.4, z: p.z }, { count: 1, color: ['#555', '#777', '#666'], speed: 0.3, up: 1.4, gravity: -1, drag: 0.8, life: 1.6, size: 0.18, grow: true });
  }
  world.fx.glow.request({ x: p.x, y: top + 0.4, z: p.z }, '#ff8a3a', 5 * strength * Math.min(2, Math.max(0.8, e.radius)));
}

/** Sets a flammable entity on fire. Returns false if it can't burn right now. */
export function ignite(e: Entity, world: GameWorld): boolean {
  if (!e.alive || e.state.burning || e.state.charred || e.has('wet')) return false;
  e.state.burning = true;
  e.state.heat = 1;
  const total = e.prop('burnTime', 7) * Math.sqrt(e.scale);
  e.state.burnLeft = total;
  e.state.burnTotal = total;
  if (!e.has('hot')) {
    e.state.hotFromBurning = true;
    world.addTag(e, 'hot');
  }
  world.fx.sound('ignite', { volume: 0.7 });
  world.fx.burst(e.body.position, { count: 14, color: FLAME_COLORS, speed: 3, up: 3, gravity: -1, glow: true, life: 0.6, size: 0.12 });
  world.events.emit('ignite', { entity: e });
  return true;
}

export function steam(world: GameWorld, at: P3, size = 1): void {
  world.fx.burst(at, { count: Math.round(22 * size), color: ['#ffffff', '#e8f1f8', '#d6e4ee'], speed: 1.8, up: 2.5, gravity: -2, drag: 2, life: 1.1, size: 0.2 * size, grow: true, spread: 0.3 });
  world.fx.sound('sizzle');
}

/** Puts out a burning entity, or removes an extinguishable heat source (like fire). */
export function extinguish(e: Entity, world: GameWorld): boolean {
  if (!e.alive) return false;
  if (e.state.burning) {
    e.state.burning = false;
    e.state.heat = 0;
    if (e.state.hotFromBurning) {
      e.state.hotFromBurning = false;
      world.removeTag(e, 'hot');
    }
    steam(world, e.body.position, Math.max(0.6, e.radius));
    world.events.emit('extinguish', { entity: e });
    return true;
  }
  if (e.has('hot') && e.prop('extinguishable', 0) > 0) {
    steam(world, e.body.position, Math.max(0.8, e.radius * 1.4));
    world.events.emit('extinguish', { entity: e });
    world.remove(e, 'extinguished');
    return true;
  }
  return false;
}

/** Darkens an entity's lit material toward charcoal (0 = fresh, 1 = fully charred). */
export function setChar(e: Entity, amount: number): void {
  const m = e.materials[0] as MeshStandardMaterial;
  const k = 1 - 0.78 * Math.min(1, Math.max(0, amount));
  m.color.setRGB(k, k * 0.95, k * 0.9);
}

/** Pops a poppable entity with a bang. */
export function pop(e: Entity, world: GameWorld): void {
  if (!e.alive) return;
  const colors = [e.def.burstColor ?? '#ff4f7b', '#ffffff'];
  world.fx.burst(e.body.position, { count: 30, color: colors, speed: 6, up: 1, size: 0.08, life: 0.6 });
  world.fx.sound('balloonPop');
  world.fx.addShake(0.2);
  world.events.emit('popped', { entity: e });
  world.remove(e, 'popped');
}
