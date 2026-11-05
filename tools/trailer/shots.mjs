// Shot list for the Blockspell trailer. Times are seconds at 24 fps; camera in meters.
const sm = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, k) => a + (b - a) * k;
const v3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

/** Smooth camera path through keys [{u, pos, tgt, fov}] with a little handheld wobble. */
function path(keys, { shake = 0.02 } = {}) {
  return (t, u) => {
    let i = 0;
    while (i < keys.length - 2 && u > keys[i + 1].u) i++;
    const a = keys[i], b = keys[i + 1];
    const k = sm(Math.min(1, Math.max(0, (u - a.u) / (b.u - a.u))));
    const w = (f, p) => Math.sin(t * f + p);
    const jx = shake * (w(1.3, 0) + 0.5 * w(3.1, 1)), jy = shake * (w(1.7, 2) + 0.5 * w(2.9, 3)), jz = shake * w(1.1, 4);
    const pos = v3(a.pos, b.pos, k);
    return {
      pos: [pos[0] + jx, pos[1] + jy, pos[2] + jz],
      tgt: v3(a.tgt, b.tgt, k),
      fov: lerp(a.fov ?? 50, b.fov ?? 50, k),
    };
  };
}

/** Orbit around c: radius r0→r1, height h0→h1, angle a0→a1 (degrees), looking at c + look. */
function orbit({ c, r0, r1 = r0, h0, h1 = h0, a0, a1, look = [0, 1, 0], fov = 50, shake = 0.015 }) {
  return (t, u) => {
    const k = sm(u);
    const a = (lerp(a0, a1, k) * Math.PI) / 180, r = lerp(r0, r1, k), h = lerp(h0, h1, k);
    const w = (f, p) => Math.sin(t * f + p);
    return {
      pos: [c[0] + Math.sin(a) * r + shake * w(1.3, 0), c[1] + h + shake * w(1.7, 2), c[2] + Math.cos(a) * r + shake * w(1.1, 4)],
      tgt: [c[0] + look[0], c[1] + look[1], c[2] + look[2]],
      fov,
    };
  };
}

const sky = (name, weather = 'clear') => async (page) => {
  await page.evaluate(([n, w]) => { const g = window.__blockspell.game; g.setSky(n, 0); g.setWeather(w); }, [name, weather]);
};
const cast = (spell, at) => async (page) => { await page.evaluate(([s, a]) => window.__blockspell.cast(s, a), [spell, at]); };
const speed = (k) => async (page) => { await page.evaluate((k) => { window.__blockspell.game.timeScale = k; }, k); };


const at = (t, run) => ({ t, run });
const slow = (pairs) => (t) => { let k = 1; for (const [tt, v] of pairs) if (t >= tt) k = v; return k; };
const seq = (...fns) => async (page) => { for (const f of fns) await f(page); };
const step = (s) => async (page) => { await page.evaluate((s) => window.__blockspell.game.step(s), s); };
/** Sets the sky, casts [spell, [x, z]] pairs, then lets the summons run for `warm` seconds so frame 0 is mid-spell. */
const stage = (skyName, casts, warm = 0.3, weather = 'clear') => seq(sky(skyName, weather), ...casts.map(([s, a]) => cast(s, a)), step(warm));

export const SHOTS = [
  // ---- cold open: night, empty island, a word is typed ----
  {
    id: 'open2', seconds: 5, prompt: true, warm: 4,
    init: sky('night'),
    cam: path([
      { u: 0, pos: [8, 1.1, 10], tgt: [0, 2.6, 0], fov: 44 },
      { u: 0.55, pos: [5.5, 1.2, 7.5], tgt: [0, 2.6, 0], fov: 46 },
      { u: 1, pos: [4.2, 1.8, 7], tgt: [-1, 4.5, -1], fov: 52 },
    ]),
    track: { id: 'dragon', from: 3.1, weight: 0.9 },
    typing: { text: 'giant golden dragon', start: 0.45, end: 2.25, enter: 2.8 },
  },

  // ---- spell montage: one cast per shot, caught mid-summon ----
  { id: 'm-balloons', seconds: 1, init: stage('sunset', [['3 rainbow balloons', [0, 0]]]),
    cam: path([{ u: 0, pos: [3, 0.6, 5], tgt: [0, 2, 0], fov: 60 }, { u: 1, pos: [2.2, 0.7, 4.2], tgt: [0, 4, 0], fov: 56 }]) },
  { id: 'm-rocket', seconds: 1, init: stage('sunset', [['flaming red rocket', [0, 0]]], 0.2),
    cam: path([{ u: 0, pos: [3.5, 0.7, 5], tgt: [0, 1.5, 0], fov: 60 }, { u: 1, pos: [3.5, 1.2, 5], tgt: [0, 6, 0], fov: 55 }]) },
  { id: 'm-ufo', seconds: 1, init: stage('night', [['giant ufo', [0, 0]]]),
    cam: path([{ u: 0, pos: [-5, 0.8, 7], tgt: [0, 1.8, 0], fov: 55 }, { u: 1, pos: [-3.5, 1.0, 6.2], tgt: [0, 2.6, 0], fov: 55 }]) },
  { id: 'm-tnt', seconds: 2, init: stage('sunset', [['flaming giant tnt', [0, 0]]], 1.25),
    speed: (t, since) => (since === null ? 1 : since < 0.9 ? 0.2 : 0.2 + (since - 0.9) * 0.4),
    cam: path([{ u: 0, pos: [6, 1.2, 8], tgt: [0, 1.2, 0], fov: 50 }, { u: 1, pos: [4.5, 1.8, 6.5], tgt: [0, 2, 0], fov: 46 }]) },
  { id: 'm-dog', seconds: 1, init: stage('day', [['big dog', [-2, 0]], ['3 bones', [1.5, 0.5]]]),
    cam: path([{ u: 0, pos: [0, 1.0, 6], tgt: [0, 0.8, 0], fov: 50 }, { u: 1, pos: [1.5, 1.2, 5], tgt: [0, 0.8, 0], fov: 50 }]) },
  { id: 'm-crystal', seconds: 1.25, init: stage('night', [['giant crystal', [0, 0]]]),
    cam: path([{ u: 0, pos: [3, 0.4, 7], tgt: [0, 2.5, 0], fov: 55 }, { u: 1, pos: [1.5, 0.5, 6], tgt: [0, 3, 0], fov: 55 }]) },
  { id: 'm-hotair', seconds: 1, init: stage('dawn', [['giant hotairballoon', [0, 0]]]),
    cam: path([{ u: 0, pos: [4, 0.7, 8], tgt: [0, 3, 0], fov: 55 }, { u: 1, pos: [3, 0.9, 7], tgt: [0, 4.5, 0], fov: 55 }]) },
  { id: 'm-snow', seconds: 1, init: stage('dawn', [['giant snowman', [0, 0]]], 0.3, 'snow'),
    events: [at(0.2, cast('fire', [1.6, 0.5]))],
    cam: path([{ u: 0, pos: [4, 1.2, 6], tgt: [0, 1.8, 0], fov: 50 }, { u: 1, pos: [3, 1.2, 5], tgt: [0, 2, 0], fov: 50 }]) },

  // ---- the world ----
  {
    id: 'world', seconds: 4, query: 'nosw&mute&level=world', init: sky('sunset'),
    cam: path([{ u: 0, pos: [-4, 2.2, 12], tgt: [0, 2.5, -10], fov: 55 }, { u: 1, pos: [8, 16, 0], tgt: [34, 1, 0], fov: 55 }]),
  },
  {
    id: 'title', seconds: 4, query: 'nosw&mute&level=world', init: sky('sunset'),
    cam: path([{ u: 0, pos: [-6, 4, 14], tgt: [8, 3, -8], fov: 50 }, { u: 1, pos: [-14, 9, 30], tgt: [10, 2, -10], fov: 55 }]),
  },

  // ---- puzzles, solved live by the game's own solution runner ----
  {
    id: 'chasm', seconds: 4.6, query: 'nosw&mute&level=2&solve=0', init: sky('sunset'),
    cam: path([{ u: 0, pos: [-9, 2.2, 8], tgt: [-3, 0.5, 0], fov: 50 }, { u: 0.5, pos: [-2, 3, 9], tgt: [0, 0.5, 0], fov: 50 }, { u: 1, pos: [6, 2.5, 7], tgt: [5, 1, 0], fov: 50 }]),
  },
  {
    id: 'hut', seconds: 3.8, query: 'nosw&mute&level=3&solve=1', init: sky('night'),
    cam: orbit({ c: [0, 0, -1], r0: 11, r1: 8, h0: 2.5, h1: 4, a0: 25, a1: -25, look: [0, 1.5, 0], fov: 50 }),
  },
  {
    id: 'sky', seconds: 4.5, query: 'nosw&mute&level=5&solve=2', init: sky('dawn'),
    cam: path([{ u: 0, pos: [5, 1.2, 4], tgt: [0, 2.5, -2], fov: 50 }, { u: 1, pos: [4, 4, 2], tgt: [0, 7, -4], fov: 52 }]),
  },

  // ---- chaos ----
  {
    id: 'c-demo', seconds: 2, init: seq(sky('night', 'rain'), cast('wall', [0, -1]), cast('3 crates', [0, 1.2]), cast('flaming tnt', [0.3, 0.2]), step(0.85)),
    speed: (t, since) => (since === null ? 1 : since < 1 ? 0.15 : Math.min(1, 0.15 + (since - 1) * 0.5)),
    cam: path([{ u: 0, pos: [7, 1.0, 5], tgt: [0, 1.5, 0], fov: 50 }, { u: 1, pos: [4.5, 2.2, 6.5], tgt: [0, 2, 0], fov: 55 }]),
  },
  {
    id: 'c-fireworks', seconds: 2, init: seq(sky('night'), cast('flaming red rocket', [-2.4, 0]), step(0.4), cast('flaming blue rocket', [0, 0.8]), step(0.4), cast('flaming golden rocket', [2.4, 0])),
    cam: path([{ u: 0, pos: [0, 0.8, 9], tgt: [0, 6, 0], fov: 65 }, { u: 1, pos: [0, 1.2, 8], tgt: [0, 12, 0], fov: 70 }]),
  },
  {
    id: 'c-inferno', seconds: 3.5, init: seq(sky('night'), cast('tree', [-3, -1]), cast('tree', [3.2, -1.5]), cast('hut', [0, -2.5]), cast('haystack', [0, 2]), step(1.0), cast('fire', [0, 1.5]), step(1.2)),
    cam: orbit({ c: [0, 0, 0], r0: 13, r1: 10, h0: 1.8, h1: 3, a0: -35, a1: 25, look: [0, 1.5, 0], fov: 52 }),
  },
  {
    id: 'c-bounce', seconds: 2, init: stage('dawn', [['trampoline', [0, 0]], ['4 bouncy rainbow balls', [0, 0]]], 0.8),
    cam: orbit({ c: [0, 0, 0], r0: 6, r1: 5, h0: 1.2, h1: 2.2, a0: 20, a1: 70, look: [0, 1.6, 0], fov: 50 }),
  },
  {
    id: 'climax', seconds: 6, init: seq(sky('sunset'), cast('giant bomb', [0, 0]), cast('3 flaming giant tnt', [0, 2.5]), step(0.9)),
    speed: (t, since) => (since === null ? 1 : since < 0.15 ? 0.08 : since < 1.2 ? 0.2 : Math.min(0.7, 0.2 + (since - 1.2) * 0.25)),
    cam: path([{ u: 0, pos: [10, 1.4, 9], tgt: [0, 1.4, 0], fov: 46 }, { u: 0.4, pos: [9, 2.2, 11], tgt: [0, 2.5, 0], fov: 48 }, { u: 1, pos: [4, 9, 18], tgt: [0, 4, 0], fov: 55 }], { shake: 0.02 }),
  },
  {
    id: 'endbg', seconds: 8, init: seq(sky('night'), cast('flaming red rocket', [-6, -5]), step(0.2), cast('flaming blue rocket', [5, -6]), step(1.2), cast('flaming golden rocket', [0, -7])),
    events: [at(2.5, cast('flaming rainbow rocket', [-3, -6])), at(4, cast('flaming blue rocket', [3, -5])), at(5.2, cast('flaming red rocket', [0, -8]))],
    cam: path([{ u: 0, pos: [0, 1.3, 9], tgt: [0, 7, -6], fov: 55 }, { u: 1, pos: [0, 1.8, 8], tgt: [0, 9, -6], fov: 55 }], { shake: 0.008 }),
  },
  // ---- v2: longer montage shots (1.5 s), summon visible from frame 0 ----
  { id: 'n-balloons', seconds: 1.5, init: stage('day', [['3 rainbow balloons', [0, 0]]], 0.15),
    cam: path([{ u: 0, pos: [3.2, 0.7, 5.5], tgt: [0, 2.2, 0], fov: 58 }, { u: 1, pos: [2.4, 0.9, 4.6], tgt: [0, 4.2, 0], fov: 56 }]) },
  { id: 'n-dog', seconds: 1.5, init: stage('day', [['big dog', [-2, 0]], ['3 bones', [1.5, 0.5]]], 0.1),
    cam: path([{ u: 0, pos: [0, 1.0, 6.5], tgt: [-0.5, 0.9, 0], fov: 50 }, { u: 1, pos: [1.8, 1.2, 5.2], tgt: [0, 0.9, 0], fov: 50 }]) },
  { id: 'n-hotair', seconds: 1.5, init: stage('dawn', [['giant hot air balloon', [0, 0]]], 0.05),
    cam: path([{ u: 0, pos: [4.5, 0.7, 8.5], tgt: [0, 3, 0], fov: 55 }, { u: 1, pos: [3.2, 1.0, 7.2], tgt: [0, 4.8, 0], fov: 55 }]) },
  { id: 'n-snow', seconds: 1.5, init: stage('dawn', [['giant snowman', [0, 0]]], 0.1, 'snow'),
    events: [at(0.3, cast('fire', [1.6, 0.5]))],
    cam: path([{ u: 0, pos: [4.2, 1.2, 6.2], tgt: [0, 1.8, 0], fov: 50 }, { u: 1, pos: [3.2, 1.3, 5.2], tgt: [0, 2, 0], fov: 50 }]) },

  // ---- v2: one puzzle (the chasm), three answers; the world holds still on the problem first ----
  { id: 'p-bridge', seconds: 3.5, query: 'nosw&mute&level=2&solve=0', init: sky('sunset'),
    speed: (t) => (t < 0.7 ? 0 : 1.5),
    cam: path([{ u: 0, pos: [-1, 3.0, 14], tgt: [0, 0.6, 0], fov: 52 }, { u: 1, pos: [0.5, 2.6, 12.5], tgt: [1, 0.8, 0], fov: 52 }]) },
  { id: 'p-tramp', seconds: 3, query: 'nosw&mute&level=2&solve=2', init: sky('sunset'),
    speed: (t) => (t < 0.5 ? 0 : 1.6),
    cam: path([{ u: 0, pos: [-1, 3.0, 14], tgt: [0, 1.4, 0], fov: 55 }, { u: 1, pos: [0.5, 2.6, 12.5], tgt: [1, 1.6, 0], fov: 55 }]) },
  { id: 'p-plank', seconds: 2.5, query: 'nosw&mute&level=2&solve=1', init: sky('sunset'),
    speed: (t) => (t < 0.4 ? 0 : 1.7),
    cam: path([{ u: 0, pos: [-1, 3.0, 14], tgt: [0, 0.6, 0], fov: 52 }, { u: 1, pos: [0.5, 2.6, 12.5], tgt: [1, 0.8, 0], fov: 52 }]) },
];
