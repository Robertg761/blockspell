"""HD voxels everywhere: perf numbers (and the screenshots), classic vs HD, prototype vs now.

Usage (needs `npm run build`; serves dist itself on :5310, and a prototype build on :5312 if given):
  /workspace/venv-pw/bin/python tools/hd2-perf.py out.json [--proto /tmp/dist-proto] [--shots]

Modes: `off` and `on` are this build with ?hd=0 / ?hd=1 (headless Chrome renders in software, so HD
has to be forced on). `proto-off` / `proto-on` are the prototype build (HD only in Ember Village).
Per mode: load time, then two views (the hub overview and Ember Village, the prototype's view):
rAF frame times, draw calls and triangles (full frame with the shadow pass, and the scene pass alone),
unique geometry bytes in the scene; then a spawn test: 20 casts near the hero after warmup, each timed
on the main thread (JS) plus how much longer the next render takes than the baseline render.
"""
import json
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SPELLS = ['tree', 'rock', 'bush', 'hut', 'crate', 'barrel', 'car', 'dog', 'ball', 'balloon', 'cat', 'cow',
          'snowman', 'rocket', 'torch', 'chair', 'apple', 'boat', 'big red tree', 'blue dog']

VIEW = """([at, off]) => {
  const g = window.blockspell, api = window.__blockspell;
  api.teleport(at);
  g.step(0.5);
  const h = g.world.hero;
  g.renderer.setView([h.x + off[0], h.y + off[1], h.z + off[2]], [h.x, h.y + 0.4, h.z]);
  return [h.x, h.y, h.z];
}"""

MEASURE = """async (secs) => {
  const g = window.blockspell, gl = g.renderer.gl;
  await new Promise((r) => setTimeout(r, 1500));
  const times = [];
  await new Promise((resolve) => {
    let last = performance.now(); const end = last + secs * 1000;
    const tick = (now) => { times.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
  gl.info.autoReset = false;
  gl.info.reset(); window.__blockspell.render();
  const full = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
  gl.info.reset(); gl.render(g.renderer.scene, g.renderer.camera);
  const scene = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
  gl.info.autoReset = true;
  const bytes = (geo) => { let n = geo.index ? geo.index.array.byteLength : 0; for (const k in geo.attributes) n += geo.attributes[k].array.byteLength; return n; };
  const seen = new Set(); let all = 0, drawn = 0, tris = 0;
  const vis = new Set();
  g.renderer.scene.traverseVisible((o) => { if (o.isMesh) vis.add(o.geometry); });
  g.renderer.scene.traverse((o) => {
    if (!o.isMesh || seen.has(o.geometry)) return;
    seen.add(o.geometry); const b = bytes(o.geometry); all += b;
    if (vis.has(o.geometry)) { drawn += b; tris += o.geometry.index ? o.geometry.index.count / 3 : 0; }
  });
  times.shift(); times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { frames: times.length, avgMs: +avg.toFixed(1), medianMs: +times[times.length >> 1].toFixed(1), maxMs: +times[times.length - 1].toFixed(1),
    full, scene, geometry: { unique: seen.size, bytes: all, visibleBytes: drawn, visibleTriangles: tris, glGeometries: gl.info.memory.geometries },
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
}"""

SPAWN = """(spells) => {
  const g = window.blockspell, api = window.__blockspell, w = g.world, h = w.hero;
  const ctx = g.renderer.gl.getContext(), px = new Uint8Array(4);
  // readPixels waits for the GPU process, so the render time is real
  const render = () => { const t = performance.now(); api.render(); ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); return performance.now() - t; };
  const step = () => { const t = performance.now(); g.step(1 / 60); return performance.now() - t; };
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  const baseRender = med([render(), render(), render()]);
  const baseStep = med([step(), step(), step(), step(), step()]);
  const out = [];
  spells.forEach((s, i) => {
    const a = (i / spells.length) * Math.PI * 2, r = 3 + (i % 3) * 1.2;
    const before = w.living().length;
    const t0 = performance.now();
    api.cast(s, [h.x + Math.cos(a) * r, h.z + Math.sin(a) * r]);
    g.step(1 / 60); // the cast spawns on the next tick
    const js = performance.now() - t0 - baseStep;
    const rd = render();
    out.push({ spell: s, spawned: w.living().length - before, jsMs: +js.toFixed(1), renderMs: +rd.toFixed(1), extraRenderMs: +(rd - baseRender).toFixed(1) });
  });
  return { baseRenderMs: +baseRender.toFixed(1), baseStepMs: +baseStep.toFixed(1), spawns: out, worstJsMs: Math.max(...out.map((o) => o.jsMs)), worstExtraRenderMs: Math.max(...out.map((o) => o.extraRenderMs)) };
}"""

HUB = ([0, 0, 2], [10, 9, 14])
EMBER = ([34, 0, 3.5], [7, 6.5, 9])


def wait_hd(page, limit=120):
    t0 = time.time()
    while time.time() - t0 < limit:
        n = page.evaluate('window.__blockspell.hdPending ? window.__blockspell.hdPending() : 0')
        if n == 0:
            return time.time() - t0
        time.sleep(0.25)
    return None


def run(p, base, hd, shots=False):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    t0 = time.time()
    page.goto(f'{base}/?level=world&mute&hd={hd}')
    page.wait_for_function('window.__blockspell && window.blockspell && window.blockspell.world.hero', timeout=180000)
    res = {'loadS': round(time.time() - t0, 2)}
    res['hdReadyS'] = wait_hd(page)
    if res['hdReadyS'] is not None:
        res['hdReadyS'] = round(res['hdReadyS'] + res['loadS'], 2)
    res['hd'] = page.evaluate('window.__blockspell.hd()')
    page.add_style_tag(content='.tutorial-tip { display: none !important; }')
    for name, (at, off) in (('hub', HUB), ('ember', EMBER)):
        page.evaluate(VIEW, [at, off])
        wait_hd(page, 60)
        res[name] = page.evaluate(MEASURE, 5)
        if shots and name == 'hub':
            page.screenshot(path='/workspace/bs-hd2-hub.png')
    page.evaluate(VIEW, [HUB[0], [6, 5, 9]])
    page.evaluate('window.blockspell.step(0.5)')
    # warm up the cast path (parser, first spawn) with a word that is not in the list
    page.evaluate("() => { window.__blockspell.cast('mug', [0, 6]); window.blockspell.step(0.3); }")
    res['spawn'] = page.evaluate(SPAWN, SPELLS)
    # the same again: now every mesh is in the cache (and the GPU has seen the materials)
    page.evaluate("() => { window.__blockspell.resetZone(); window.blockspell.step(0.5); }")
    wait_hd(page, 60)
    res['spawn2'] = page.evaluate(SPAWN, SPELLS)
    res['hdAfter'] = page.evaluate('window.__blockspell.hd()')
    res['errors'] = errors
    browser.close()
    return res


def serve(port, out_dir=None):
    cmd = ['npx', 'vite', 'preview', '--port', str(port), '--strictPort']
    if out_dir:
        cmd += ['--outDir', out_dir]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    time.sleep(2.5)
    return proc


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else None
    proto = sys.argv[sys.argv.index('--proto') + 1] if '--proto' in sys.argv else None
    shots = '--shots' in sys.argv
    modes = sys.argv[sys.argv.index('--modes') + 1].split(',') if '--modes' in sys.argv else ['proto-off', 'proto-on', 'off', 'on']
    procs = [serve(5310)]
    if proto:
        procs.append(serve(5312, proto))
    out = {}
    try:
        with sync_playwright() as p:
            for m in modes:
                proto_mode = m.startswith('proto-')
                if proto_mode and not proto:
                    continue
                base = 'http://localhost:5312' if proto_mode else 'http://localhost:5310'
                out[m] = run(p, base, 1 if m.endswith('on') else 0, shots and m == 'on')
                print(m, 'done', file=sys.stderr, flush=True)
    finally:
        import os
        import signal
        for pr in procs:
            os.killpg(pr.pid, signal.SIGTERM)
    js = json.dumps(out, indent=1)
    print(js)
    if out_path:
        open(out_path, 'w').write(js)


if __name__ == '__main__':
    main()
