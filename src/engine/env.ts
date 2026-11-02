import type { Texture } from 'three';

/**
 * Shared procedural environment map (built by the renderer from three's
 * RoomEnvironment — no image files) so metallic/golden things have something
 * to reflect. Null until the renderer has created it.
 */
export let envMap: Texture | null = null;

export function setEnvMap(t: Texture): void {
  envMap = t;
}
