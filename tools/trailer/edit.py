"""The edit decision list shared by music.py and compose.py. Times in seconds, 24 fps, 120 BPM (one beat = 0.5 s)."""
FPS = 24
BPM = 120

# (shot id, start inside the rendered shot, duration on screen)
CLIPS = [
    ('open', 0, 6),
    ('m-balloons', 0, 1), ('m-rocket', 0, 1), ('m-ufo', 0, 1), ('m-dog', 0, 1), ('m-hotair', 0, 1), ('m-snow', 0, 1),
    ('m-tnt', 0, 2),
    ('title', 0, 4),
    ('world', 0, 4), ('chasm', 0.4, 4), ('hut', 0.6, 3), ('sky', 1.2, 3),
    ('c-demo', 0, 2), ('c-fireworks', 0, 2), ('c-bounce', 0, 2),
    ('climax', 0, 6),
]
BLACK = 1.0          # silence-ish beat after the climax
ENDBG = ('endbg', 0, 8)
