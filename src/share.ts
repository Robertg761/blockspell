/**
 * Shareable Free Play scenes. A scene is the list of spells cast since the island was last cleared, each
 * with the spot it was aimed at, packed into a link's #scene= part: `big red ball@1.2,-0.5;dog@-2,1`.
 * Opening the link replays the casts one after another, so a friend sees the same scene build itself.
 * Everything is in the link: there is no server, so sharing works with no network (and in an installed app).
 */
import { PUBLIC_URL, detectPlatform } from './platform';

export interface SceneCast {
  spell: string;
  x: number;
  z: number;
}

const PREFIX = '#scene=';
export const MAX_SCENE_CASTS = 60;

const round = (n: number) => Math.round(n * 10) / 10;

/** The #hash for a list of casts (the newest MAX_SCENE_CASTS). */
export function encodeScene(casts: readonly SceneCast[]): string {
  return PREFIX + casts.slice(-MAX_SCENE_CASTS).map((c) => `${encodeURIComponent(c.spell)}@${round(c.x)},${round(c.z)}`).join(';');
}

/** Casts from a location hash, or null if it isn't a scene link. Bad parts are skipped. */
export function decodeScene(hash: string): SceneCast[] | null {
  if (!hash.startsWith(PREFIX)) return null;
  const out: SceneCast[] = [];
  for (const part of hash.slice(PREFIX.length).split(';').slice(0, MAX_SCENE_CASTS)) {
    const at = part.lastIndexOf('@');
    if (at < 1) continue;
    let spell = '';
    try { spell = decodeURIComponent(part.slice(0, at)).trim().slice(0, 60); } catch { continue; }
    const [x, z] = part.slice(at + 1).split(',').map(Number);
    if (!spell || !Number.isFinite(x) || !Number.isFinite(z)) continue;
    out.push({ spell, x: Math.max(-40, Math.min(40, x)), z: Math.max(-40, Math.min(40, z)) });
  }
  return out;
}

/** The full link for a scene, based on the page the game is served from. */
export function sceneUrl(casts: readonly SceneCast[]): string {
  // inside the desktop or Android app the address is private (app://, https://localhost): link to the public web game instead
  const base = detectPlatform().native ? PUBLIC_URL : location.href.split('#')[0].split('?')[0];
  return base + encodeScene(casts);
}
