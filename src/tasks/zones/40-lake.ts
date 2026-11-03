import { place } from '../../levels/goals';
import { banner, Decor } from '../decor';
import { defineZone, offset } from '../types';

/**
 * The lake, in zone-local meters: a rounded rectangle of water set into a
 * basin, with a grassy islet in the middle. The water gap around the islet
 * (4.5 m) is too wide to jump.
 */
export const LAKE = {
  /** Center of the lake (and of the islet). */
  x: -2.5,
  z: 0,
  width: 12,
  length: 12.5,
  corner: 3,
  /** Lake bed height (the basin floor). */
  bed: -1.5,
  /** Water surface height, a little below the grass. */
  surface: -0.25,
  islet: { r: 1.5, h: 0.5 },
  /**
   * The dock: a pier from the east shore at `z`, its head (west end) at x = `end`, deck height `top`,
   * and a landing stage along the bank south of it (+z is south), up to z = `stage`.
   */
  dock: { z: -3.5, end: 2, w: 1.5, top: 0.06, stage: -1 },
} as const;

/** Signed distance (m) from the lake's rounded-rectangle shore (negative inside the water). */
export function lakeDist(x: number, z: number): number {
  const hx = LAKE.width / 2 - LAKE.corner, hz = LAKE.length / 2 - LAKE.corner;
  const dx = Math.abs(x - LAKE.x) - hx, dz = Math.abs(z - LAKE.z) - hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - LAKE.corner;
}

/** The basin: sand lake bed, a grassy islet in the middle and a sandy beach around the shore. */
function carve(x: number, z: number): { h: number; top?: string } | null {
  const d = lakeDist(x, z);
  if (d > 0.8) return null;
  if (d > 0) return { h: 0, top: (Math.floor(x * 2) + Math.floor(z * 2)) % 5 === 0 ? 'grass' : 'sand' };
  const r = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (r <= LAKE.islet.r) return { h: LAKE.islet.h, top: r > LAKE.islet.r - 0.5 ? 'sand' : 'grass' };
  return { h: LAKE.bed, top: 'sand' };
}

/**
 * Lily Lake (west): a still lake with a little islet out of reach and a
 * wooden dock on the east shore. The lake is a `pool` level object; things
 * that float bob on it and the hero (who can't swim) is fished out if they
 * fall in. Tasks 13 and 14 (src/tasks/defs) use the islet and the dock.
 */
export default defineZone({
  id: 'lake',
  name: 'Lily Lake',
  order: 4,
  center: [-34, 0, 0],
  island: { seed: 51, radius: 12, flatRadius: 11, hilliness: 0.3, trees: 0, rocks: 3, carve },
  entry: [7, 0, 0],
  setup(world, origin) {
    const at = (x: number, y: number, z: number) => offset(origin, [x, y, z]);
    banner(world, at(6, 0, 1.5), 'collar');
    // the water: its bottom on the lake bed, its top a little below the grass
    const depth = LAKE.surface - LAKE.bed;
    place(world, 'pool', at(LAKE.x, LAKE.bed, LAKE.z), 'lake', {
      exact: true,
      props: { width: LAKE.width, length: LAKE.length, depth, corner: LAKE.corner },
    });
    // a flag on the islet, so it reads as a place to get to
    banner(world, at(LAKE.x - 0.6, LAKE.islet.h, LAKE.z - 0.6), 'flowerYellow');
    // the dock: a plank deck on posts, from the east bank out over the water
    const { dock } = LAKE;
    const bank = LAKE.x + LAKE.width / 2 + 2.25; // the deck runs 2.25 m onto the bank
    const len = bank - dock.end;
    world.addStaticBox({ position: at((bank + dock.end) / 2, dock.top - 0.125, dock.z), size: [len, 0.25, dock.w], color: 'woodDark', topColor: 'wood' });
    for (const dz of [-dock.w / 2 + 0.125, dock.w / 2 - 0.125])
      for (const x of [dock.end + 0.125, dock.end + 1])
        world.addStaticBox({ position: at(x, (LAKE.bed + dock.top - 0.25) / 2, dock.z + dz), size: [0.25, dock.top - 0.25 - LAKE.bed, 0.25], color: 'woodDark' });
    // a landing stage along the bank, south of the pier, half a meter out over the water
    const east = LAKE.x + LAKE.width / 2;
    world.addStaticBox({ position: at(east, dock.top - 0.125, (dock.z + dock.w / 2 + LAKE.dock.stage) / 2), size: [1, 0.25, LAKE.dock.stage - dock.z - dock.w / 2], color: 'woodDark', topColor: 'wood' });
    world.addStaticBox({ position: at(east - 0.375, (LAKE.bed + dock.top - 0.25) / 2, LAKE.dock.stage - 0.125), size: [0.25, dock.top - 0.25 - LAKE.bed, 0.25], color: 'woodDark' });
    // a mooring post at the end of the pier
    world.addStaticBox({ position: at(dock.end + 0.125, dock.top + 0.375, dock.z - dock.w / 2 + 0.125), size: [0.25, 0.75, 0.25], color: 'woodDark', topColor: 'wood' });

    // lakeside scenery: trees and rocks back from the shore, reeds and cattails at the water's edge,
    // lily pads and a few flowers floating on the water (lily pads are flat decor, not solid)
    const d = new Decor(origin);
    d.tree(-9.5, -5, 2.75, 'leafDark').tree(-9, 5.5).tree(5.5, -8, 2.25).tree(7.5, 6.5, 2.5, 'leafDark');
    d.rock(8.5, -4.5, 1).rock(-6.5, -8.75, 0.75).rock(3, 8.75, 1).rock(-10, 1.5, 0.75, 'stoneDark').rock(5.5, 3.5, 0.5);
    d.reeds(4.25, -4).reeds(4.25, 3.5).reeds(-9.25, -2.5).reeds(-8.75, 3).reeds(-5, 7).reeds(-1, -7).reeds(2.75, 6.75).reeds(-6.5, -6.25);
    for (const [x, z] of [[4, -2.75], [-9, -1], [-4, 7], [-3.5, -6.9], [2, 7]]) cattails(d, x, z);
    d.flowers(6.5, -6, 'flowerYellow').flowers(-7.5, 7.5).flowers(7, 3, 'flowerRed').flowers(-8, -6.5, 'flowerYellow');
    d.shrub(9, 2.5).shrub(-3, 9).shrub(6, 8);
    d.build(world);
    // lily pads: a 0.25 m slab just under the surface, lifted 3 cm so their tops show above the water
    const pads = new Decor(offset(origin, [0, LAKE.surface + 0.25 + 0.03, 0]));
    for (const [x, z, s] of [[-6.5, -3.5, 1], [-6, 3.75, 0.75], [-0.5, 3, 0.75], [-1, -3.75, 1], [-5.5, -1.25, 0.5], [1.75, -1.25, 0.5], [-4.5, 4.75, 0.5], [-7, 0.5, 0.75]] as const) {
      pads.box(x, -0.125, z, s, 0.25, s * 0.75, 'leaf');
      if (s >= 0.75) pads.dot(x + 0.125, 0.125, z, 'flowerRed');
    }
    pads.build(world);
  },
});

/** Cattails: tall reeds with brown seed heads. */
function cattails(d: Decor, x: number, z: number): void {
  for (const [dx, dz, h] of [[0, 0, 5], [0.25, 0.25, 4], [-0.25, 0.25, 6]] as const) {
    for (let i = 0; i < h; i++) d.dot(x + dx, 0.125 + i * 0.25, z + dz, 'grassDark');
    d.dot(x + dx, 0.125 + h * 0.25, z + dz, 'woodDark');
  }
}
