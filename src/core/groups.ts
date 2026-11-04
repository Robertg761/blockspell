/** Collision filter groups: terrain/statics, regular objects, ghosts (collide with terrain only), things in the hero's hands (never hit the hero). */
export const GROUP = { STATIC: 1, ENTITY: 2, GHOST: 4, HELD: 8 } as const;
