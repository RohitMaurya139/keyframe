# Before / After — cinematic-overhaul comparison

Renders the **same storyboard** through the legacy kit and the current cinematic kit,
so you can eyeball exactly what the scene-kit overhaul changed. Left = BEFORE
(`legacy-kit.js`), right = AFTER (`../../src/services/scene_kit.js`).

## Quick start (offline, no API key)

```bash
node server/tools/before-after/compare.js
```

Renders two built-in realistic storyboards (a SaaS tool on `midnight-glass`, a dev CLI
on `noir-spotlight`) through both kits and writes side-by-side PNGs to `out/`.

## Real prompts (uses Gemini)

Generates a storyboard from an actual prompt via the live chain
`brief → script → storyboard`, then renders before/after on model-generated content.
Needs an OpenRouter key in `server/config.json` (`llm.apiKey`).

```bash
node server/tools/before-after/compare.js --prompt "A 12s ad for a habit-tracking app" --pack midnight-glass
```

## Options

| flag | default | meaning |
|---|---|---|
| `--prompt "<text>"` | — | real-prompt mode (LLM); omit for the built-in demos |
| `--pack <name>` | brief's pick / per-demo | frame pack |
| `--duration <sec>` | 10 | target duration (prompt mode) |
| `--orientation <horizontal\|vertical\|square>` | horizontal | |
| `--quality <480p\|720p\|1080p>` | 480p | render size (480p is fastest) |
| `--frames "a,b"` | 24,150 | frame indices for the side-by-side PNGs |
| `--name <label>` | derived | output subfolder label |

## Output

```
out/<name>_before/out.mp4     legacy kit render
out/<name>_after/out.mp4      cinematic kit render
out/<name>_f<N>.png           BEFORE | AFTER side-by-side at frame N
out/<name>_storyboard.json    (prompt mode) the generated storyboard
```

## Notes

- `legacy-kit.js` is a **frozen snapshot** of the pre-overhaul scene-kit, kept only as
  the baseline for this comparison. It is NOT wired into the pipeline — the live engine
  is `src/services/scene_kit.js`.
- Requires `ffmpeg` on PATH for the side-by-side PNGs (the MP4s render without it).
- `out/` is gitignored.
- The lift is largest on packs whose signature differs most from a generic slide
  (e.g. `noir-spotlight`: void + spotlight + grain + vignette). Stills under-sell the
  motion gains (per-scene cameras, varied transitions, kinetic reveals) — watch the MP4s.
