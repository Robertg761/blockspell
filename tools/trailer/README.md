# Trailer tooling

Everything that made the Hackyard #6 demo video and key art, so it can be re-rendered.
The game is captured **frame by frame** with a virtual clock (so software GL speed doesn't matter),
then cut, titled and scored in Python + ffmpeg. The music and sound effects are synthesized from scratch.

```sh
npm ci --include=dev && npx vite --port 5199 --strictPort &       # dev server
node tools/trailer/capture.mjs --out .render open m-tnt climax   # shots live in shots.mjs (~1.7 s/frame at 1080p)
node tools/trailer/capture-logo.mjs logo-frames 9 24             # the game's voxel logo, transparent PNGs
python3 tools/trailer/music.py score.wav                         # needs numpy + scipy
python3 tools/trailer/compose.py .render logo-frames score.wav trailer.mp4
node tools/trailer/keyart.mjs ka && python3 tools/trailer/keyart-compose.py ka/k.png logo-frames/00110.png keyart
```

`edit.py` is the edit list (shared by the music and the compositor); add `--scale 0.25 --step 12` to `capture.mjs` for quick previews.
