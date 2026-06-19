# KEYFRAME Showcase — flagship reference film

A hand-authored, flagship-grade KEYFRAME launch film, built to the **upgraded
cinematic composition doctrine** (`src/prompts/system_composer.md`) and used as the
quality bar for what the composition engine should produce.

It lives **outside `jobs/`** so the disk janitor (which prunes `jobs/<id>/` after 1h)
won't delete it.

## Files / how to view

| File | What |
|------|------|
| `index.html` | The single-file HyperFrames composition (33s, 1920×1080, 9 scenes). |
| `meta.json`  | `{ compositionId:"vid", width:1920, height:1080, fps:30, duration:33 }` |
| `renders/out.mp4` | The rendered film. |
| `../public/showcase.mp4` | Same film, **served** — open `http://localhost:8080/showcase.mp4`. |

## Reproduce / verify

```sh
# from this directory
npx --yes hyperframes lint                                   # 0 errors expected
npx --yes hyperframes render --output renders/out.mp4 --quality high --workers 1
```

It is verified to pass **all three gates with zero errors**:
- the real `npx hyperframes lint` (deterministic contract),
- the static **cinematicCheck** (`src/services/cinematic_lint.js`) — motion density,
  kinetic typography, reactive motion, gradient, glass/glow, per-scene camera, ambient,
- the headless geometric **safeAreaCheck** — all content inside the 90%×85% box.

## Design

- "Solstice" sun→moon palette (warm gold → cool violet on deep ink), signature gradient text.
- Self-contained: no external image/video assets. One procedural Three.js depth layer
  (constellation points + wireframe icosahedron, seek-driven, degrades gracefully offline),
  animated gradient/bokeh ambient, glassmorphism panels, glows, light sweeps.
- Story arc: blank page → "could it direct itself?" → KEYFRAME reveal → write → 12-agent
  compose → deterministic render → proof (12 / 1080p / 100%) → "no editor, just words" → CTA.
- Every scene: five layers (ambient + depth + focal + supporting + foreground accent), a
  per-scene **camera push-in on the backdrop** (so content never breaches the safe area),
  kinetic typography, and a reactive beat (counters, node-graph draw, frame-strip playhead).
