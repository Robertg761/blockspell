"""HD voxels prototype: screenshots and perf numbers, HD off vs on.

Usage (needs `npm run build` and `npx vite preview --port 5310 --strictPort` running):
  /workspace/venv-pw/bin/python tools/hd-perf.py [out.json]
Writes /workspace/bs-hd-before.png, /workspace/bs-hd-after.png, /workspace/bs-hd-objects.png.
"""
import json
import sys

from playwright.sync_api import sync_playwright

URL = 'http://localhost:5310/?level=world&mute&hd={hd}'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
OBJECTS = ['hut', 'bush', 'tree', 'rock', 'crate', 'barrel', 'car', 'ice', 'bucket', 'fire']
HERO = [34, 0, 3.5]  # the Save the hut start, looking north at the village

SETUP = """() => {
  const g = window.blockspell, api = window.__blockspell;
  api.teleport(%s);
  g.step(0.5);
  const h = g.world.hero;
  g.renderer.setView([h.x + 7, h.y + 6.5, h.z + 9], [h.x, h.y + 0.4, h.z]);
  return api.state().hero;
}""" % json.dumps(HERO)

MEASURE = """async (secs) => {
  const g = window.blockspell, gl = g.renderer.gl;
  // frame times from rAF over `secs` seconds (after a short warm-up)
  await new Promise((r) => setTimeout(r, 1000));
  const times = [];
  await new Promise((resolve) => {
    let last = performance.now(); const end = last + secs * 1000;
    const tick = (now) => { times.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
  // draw calls / triangles: one full frame (shadow pass + scene) and the scene pass alone
  gl.info.autoReset = false;
  gl.info.reset(); window.__blockspell.render();
  const full = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
  gl.info.reset(); gl.render(g.renderer.scene, g.renderer.camera);
  const scene = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
  gl.info.autoReset = true;
  // the zone's own meshes (terrain, decor, statics) within the Ember region
  const zone = { meshes: 0, triangles: 0, bytes: 0, hdMeshes: 0 };
  const bytes = (geo) => { let n = geo.index ? geo.index.array.byteLength : 0; for (const k in geo.attributes) n += geo.attributes[k].array.byteLength; return n; };
  g.renderer.scene.updateMatrixWorld(true);
  g.renderer.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.index || !['terrain', 'terrain-decor', 'decor', 'static'].includes(o.name)) return;
    o.geometry.computeBoundingSphere();
    const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
    if (Math.hypot(c.x - 34, c.z) > 15) return;
    zone.meshes++; zone.triangles += o.geometry.index.count / 3; zone.bytes += bytes(o.geometry);
    if (o.geometry.userData.hd) zone.hdMeshes++;
  });
  times.shift();
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { frames: times.length, avgMs: +avg.toFixed(1), medianMs: +times[times.length >> 1].toFixed(1), full, scene, zone, hd: window.__blockspell.hd() };
}"""

OBJS = """(ids) => {
  const g = window.blockspell, w = g.world, h = w.hero;
  const out = {};
  const bytes = (geo) => { let n = geo.index ? geo.index.array.byteLength : 0; for (const k in geo.attributes) n += geo.attributes[k].array.byteLength; return n; };
  const meas = (e, ms) => {
    let tri = 0, b = 0;
    e.visual.traverse((o) => { if (o.isMesh && o.geometry.index) { tri += o.geometry.index.count / 3; b += bytes(o.geometry); } });
    return { triangles: tri, bytes: b, buildMs: +ms.toFixed(1) };
  };
  out.hero = meas(h, 0);
  // a row of objects around the hero, each spawned on the ground, facing the camera
  const xs = { hut: -5.5, bush: -4.8, tree: 3.8, rock: 2.9, crate: 1.3, barrel: -1.5, car: -3.3, ice: 1.1, bucket: -0.9, fire: 4.6 };
  const zs = { hut: -6, bush: -1.2, tree: -3, rock: -0.8, crate: -1, barrel: -0.9, car: 1.2, ice: 1.9, bucket: 1.9, fire: 1.6 };
  for (const id of ids) {
    const t0 = performance.now();
    const e = w.spawnById(id, { position: { x: h.x + xs[id], y: 0, z: h.z + zs[id] }, grounded: true, silent: true, yaw: 0 });
    const ms = performance.now() - t0;
    if (e) out[id] = meas(e, ms);
  }
  g.step(0.3);
  g.renderer.setView([h.x + 0.2, h.y + 2.6, h.z + 6.5], [h.x, h.y + 0.4, h.z]);
  return out;
}"""


def run(p, hd, shot=None, objects_shot=None):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    t0 = page.evaluate('performance.now()')
    page.goto(URL.format(hd=hd))
    page.wait_for_function('window.__blockspell && window.blockspell && window.blockspell.world.hero', timeout=120000)
    load_ms = page.evaluate('performance.now()')
    page.evaluate(SETUP)
    res = page.evaluate(MEASURE, 8)
    res['loadMs'] = round(load_ms)
    if shot:
        page.screenshot(path=shot)
    if objects_shot:
        res['objects'] = page.evaluate(OBJS, OBJECTS)
        page.add_style_tag(content='.tutorial-tip { display: none !important; }')
        page.wait_for_timeout(1500)
        page.screenshot(path=objects_shot)
    res['errors'] = errors
    browser.close()
    return res


def main():
    out = {}
    with sync_playwright() as p:
        out['off'] = run(p, 0, '/workspace/bs-hd-before.png', '/tmp/bs-hd-objects-off.png')
        out['on'] = run(p, 1, '/workspace/bs-hd-after.png', '/workspace/bs-hd-objects.png')
    js = json.dumps(out, indent=1)
    print(js)
    if len(sys.argv) > 1:
        open(sys.argv[1], 'w').write(js)


if __name__ == '__main__':
    main()
