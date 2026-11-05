"""The edit decision list shared by music.py and compose.py. Times in seconds, 24 fps, 120 BPM (one beat = 0.5 s)."""
FPS = 24
BPM = 120

# (shot id, start inside the rendered shot, duration on screen)
CLIPS = [
    ('open2', 0, 5),
    ('n-balloons', 0, 1.5), ('n-dog', 0, 1.5), ('n-hotair', 0, 1.5), ('n-snow', 0, 1.5),
    ('m-tnt', 0, 2),
    ('title', 0, 3.5),
    ('world', 0, 3),
    ('p-bridge', 0, 3.5), ('p-tramp', 0, 3), ('p-plank', 0, 2.5),
    ('c-demo', 0, 2), ('c-fireworks', 0, 2), ('c-bounce', 0, 2),
    ('climax2', 0.4, 3.3),
]
BLACK = 0.6          # beat of black after the climax
ENDBG = ('endbg', 0, 7.5)

# Where each clip starts on the timeline (computed, so everything downstream follows the cut).
MARK = {}
_t = 0.0
for _s, _o, _d in CLIPS:
    MARK[_s] = _t; _t += _d
CLIMAX_END = _t
MARK['end'] = _t + BLACK
TOTAL = MARK['end'] + ENDBG[2]
MARK['enter'] = 2.8      # Enter pressed in the cold open (matches shots.mjs)
MARK['montage'] = MARK['n-balloons']
MARK['n-tnt'] = MARK['m-tnt']
