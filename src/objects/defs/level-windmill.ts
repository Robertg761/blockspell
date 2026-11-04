import type { Entity } from '../../core/entity';
import type { VoxelBuilder } from '../../voxel/builder';
import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

const hooked = new WeakSet<object>();

definePalette({
  millWall: '#d9c7a0',
  millWallDark: '#bda676',
  millRoof: '#b5473a',
  millRoofDark: '#8f352c',
  millSail: '#f4efe2',
  millSailDark: '#d6cdb6',
  millBeam: '#6b4a2e',
});

// voxel layout (0.1 m voxels): a round-ish tower 16 wide, hub on the front (+Z) face
const W = 16;
const D = 16;
const HUB: [number, number, number] = [8, 24, D + 1];
const ARM = 13;

/** One sail arm pointing along +Y from the hub, rotated k quarter turns about the hub (z axis). */
function sail(b: VoxelBuilder, k: number): void {
  const [hx, hy, hz] = HUB;
  const put = (u: number, v: number, c: string) => {
    // (u, v): across and along the arm; turn by k quarter turns
    let x = u, y = v;
    for (let i = 0; i < k; i++) [x, y] = [-y, x];
    b.set(hx + x, hy + y, hz, c);
    b.set(hx + x, hy + y, hz + 1, c);
  };
  for (let v = 1; v <= ARM; v++) for (const u of [-1, 0]) put(u, v, 'millBeam');
  for (let v = 4; v <= ARM; v++) for (let u = 1; u <= 4; u++) put(u, v, v % 3 === 0 ? 'millSailDark' : 'millSail');
}

/**
 * A little windmill (a level object). The sails turn when a fan blows on them, when something fast flies
 * past, or when a blast goes off close by. Once they have spun for a while it counts as `spun`.
 */
export default defineObject({
  id: 'windmill',
  name: 'windmill',
  levelOnly: true,
  category: 'structures',
  tags: [],
  burstColor: '#f4efe2',
  voxelSize: 0.1,
  physics: { anchored: true, mass: 0, shape: 'box', friction: 0.6 },
  props: { sailRadius: 1.5 },
  parts: [
    {
      name: 'sails',
      pivot: [HUB[0] - 0.5, HUB[1] + 0.5, HUB[2] + 1],
      build(b) {
        b.box(HUB[0] - 1, HUB[1] - 1, HUB[2] - 1, HUB[0], HUB[1], HUB[2] + 1, 'millBeam');
        for (let k = 0; k < 4; k++) sail(b, k);
      },
    },
  ],
  build(b) {
    b.box(0, 0, 0, W - 1, 1, D - 1, 'stoneDark');
    // tapering tower, two voxel courses alternating light and dark
    for (let y = 2; y < 33; y++) {
      const inset = Math.floor((y - 2) / 11);
      b.box(inset, y, inset, W - 1 - inset, y, D - 1 - inset, Math.floor(y / 2) % 2 ? 'millWall' : 'millWallDark');
    }
    // door and window
    b.box(6, 2, D - 1, 9, 10, D - 1, 'millBeam');
    b.box(7, 16, D - 3, 8, 19, D - 3, 'millBeam');
    // cap
    for (let i = 0; i < 6; i++) b.box(2 + i, 33 + i, 2 + i, W - 3 - i, 33 + i, D - 3 - i, i % 2 ? 'millRoofDark' : 'millRoof');
  },
  onSpawn(e, world) {
    e.state.spin = 0;
    e.state.spinTime = 0;
    // a blast close by gives the sails a hard shove (one persistent listener per world, so zone resets don't pile up subscriptions)
    if (!hooked.has(world)) {
      hooked.add(world);
      world.events.on('exploded', ({ at }) => {
        for (const m of world.entities) {
          if (!m.alive || m.def.id !== 'windmill') continue;
          if (Math.hypot(at.x - m.x, at.z - m.z) < 6.5 && Math.abs(at.y - m.y) < 5) m.state.spin = Math.max(m.state.spin as number, 15);
        }
      });
    }
  },
  update(e, world, dt) {
    const sails = e.parts.get('sails');
    if (!sails) return;
    // where the hub is in the world (front is local +Z, which is yawed with the entity)
    const yaw = 2 * Math.atan2(e.body.quaternion.y, e.body.quaternion.w);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const hub = { x: e.x + fx * (e.size.z / 2 + 0.1), y: e.y - e.size.y / 2 + HUB[1] * 0.1, z: e.z + fz * (e.size.z / 2 + 0.1) };
    const reach = e.prop('sailRadius', 1.3);
    let drive = 0;
    for (const o of world.nearby(hub, 9) as Entity[]) {
      if (o === e || o.state.role === 'windmill' || o.has('frozen')) continue;
      if (o.has('wind')) {
        // a fan: is the hub inside its cone?
        const q = o.body.quaternion;
        const dx = hub.x - o.x, dy = hub.y - o.y, dz = hub.z - o.z;
        // local +Z in world space
        const wx = 2 * (q.x * q.z + q.w * q.y), wy = 2 * (q.y * q.z - q.w * q.x), wz = 1 - 2 * (q.x * q.x + q.y * q.y);
        const along = dx * wx + dy * wy + dz * wz;
        const range = o.prop('windRange', 6) * Math.sqrt(o.scale);
        if (along <= 0 || along > range + 1) continue;
        const lat = Math.hypot(dx - wx * along, dy - wy * along, dz - wz * along);
        if (lat <= o.radius * 0.8 + along * 0.3 + reach) drive = Math.max(drive, 7 * (1 - (along / (range + 1)) * 0.5));
      } else if (o.body.mass > 0 && o !== world.hero) {
        // something fast flying past the sails
        const d = Math.hypot(o.x - hub.x, o.y - hub.y, o.z - hub.z);
        if (d < reach + o.radius && o.body.velocity.length() > 3.5) e.state.spin = Math.max(e.state.spin as number, 12);
      }
    }
    let spin = e.state.spin as number;
    spin += (drive - spin) * Math.min(1, dt * (drive > spin ? 1.6 : 0.7));
    e.state.spin = spin;
    if (spin > 3) e.state.spinTime = (e.state.spinTime as number) + dt;
    if ((e.state.spinTime as number) >= 1.2 && !e.state.spun) {
      e.state.spun = true;
      world.fx.sound('chime', { pitch: 1.3 });
      world.fx.sparkle({ x: hub.x, y: hub.y + 1.6, z: hub.z }, ['#fff6a8', '#ffffff', '#f4efe2'], 18);
    }
    sails.rotation.z -= spin * dt * 0.5;
    if (spin > 1 && Math.random() < dt * 8) world.fx.burst({ x: hub.x + (Math.random() - 0.5) * 2, y: hub.y + (Math.random() - 0.5) * 2, z: hub.z + 0.3 }, { count: 1, color: ['#ffffff', '#e6f3ff'], speed: 0.3, up: 0, gravity: 0, drag: 0.3, size: 0.04, life: 0.6, spread: 0 });
  },
});
