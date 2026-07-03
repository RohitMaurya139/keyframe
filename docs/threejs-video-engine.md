# KEYFRAME → Three.js Video Engine (architecture + roadmap)

Reference spec for re-platforming the cinematic renderer onto Three.js while keeping the
existing LLM/orchestrator/storyboard layer unchanged. See memory `threejs-primary-render-rule`.

## Hard constraint (read first)
Real WebGL does NOT render in the pinned HyperFrames 0.6.120 frame-capture engine (it froze:
the capturer seeks a paused GSAP timeline and never drives a WebGL canvas per frame). Therefore
Three.js is a **new render pipeline**, not a HyperFrames layer. Determinism is regained by
driving every transform from a **frame number**, never a wall clock.

## Phase 0 — PROVEN (2026-07-02)
Spike in `engine3d-spike/` renders a real 3D hook scene (280 instanced particles, bloom-lit
wireframe core, frame-driven camera dolly, in-3D MSDF headline) to MP4 on CPU. Results:
- **Real WebGL renders** on `--gl=angle` (SwiftShader, no GPU) — the exact thing that froze HyperFrames.
- **Byte-for-byte deterministic**: two independent renders → identical whole-file MD5 (both the
  particle/bloom scene AND the MSDF-text scene). Determinism holds through troika's SDF atlas.
- **CPU render time**: ~27s (no text) / ~35s (with MSDF text) for 90 frames @720p (~0.3–0.4 s/frame).
- Gotchas learned: Remotion easing is `Easing.sin` (not `sine`); load fonts with
  `preloadFont` imported from **`troika-three-text`** (NOT exported by drei 9.114) inside a
  Remotion `delayRender()`/`continueRender()` gate in the Remotion tree (NOT per-`<Text>` onSync
  inside the R3F reconciler — that never cleared). Reference a bundled TTF via `staticFile()`;
  woff2 won't parse in troika — ship OFL TTF (Space Grotesk/Inter downloaded to public/fonts).

## Phase 1 — DONE (2026-07-02)
Real modular `engine3d/` under `engine3d-spike/src/` reading the storyboard contract
(`storyboard.ts`, shape-identical to scene_kit's JSON). Hook archetype fully ported and
verified: per-word measured layout + staggered reveal, continuous horizontal gradient-fill
across accent words, depth camera rig, orbital-ring depth plane, instanced particles, bloom.
Byte-for-byte deterministic (identical whole-file md5 across 2 renders), ~23s CPU for 105
frames @720p. Structure built: core/{frame,theme,camera,lighting}, materials/gradientText,
components/{KineticText,ParticleField,OrbitalRings,Backdrop,Kicker}, scenes/HookScene,
Video.tsx (storyboard→Sequences, kind→component switch), Root.tsx (calculateMetadata from
storyboard). KEY LESSON (cost 2 failed renders): Remotion `delayRender()` MUST run in the
Remotion tree, NOT inside `<ThreeCanvas>` (R3F reconciler) — so measure word widths / preload
fonts in the SCENE component and pass results DOWN as props to canvas children. Gradient-fill
on MSDF works by handing `<Text material={...}>` a MeshBasicMaterial whose onBeforeCompile
bakes the gradient extents as GLSL LITERALS (world-X) — no runtime uniforms → survives troika's
material derivation. Next: port Stat/Cta/Text/Screenshot/Terminal archetypes into the switch;
transitions layer on Sequence overlaps; then wire server (storyboard→props.json→remotion render).

## Phase 1b — multi-scene film DONE (2026-07-02)
Ported Stat / Text-bullet / Cta archetypes + a shared `SceneStage` (backdrop, lights, camera
rig, orbital rings, particle field, post). `Video.tsx` dispatches by `kind` and adds entrance
transitions (fade+settle over the OVERLAP) so scenes cross-dissolve. Full 4-scene 14s film
(hook→stat→bullet→cta) renders in ~51s CPU (420 frames @720p). Fixed accent detection to locate
the emphasis phrase ANYWHERE in the headline (was prefix-only → gradient landed on wrong words).
DETERMINISM FINDING: default render (concurrency=2) is NOT byte-identical — most frames match but
scene-OVERLAP frames (two ThreeCanvases compositing across parallel render tabs) vary slightly
(PSNR avg ~40dB). `--concurrency=1` → byte-identical md5. So determinism is a render KNOB, not a
logic bug: render single-concurrency for reproducible/cacheable output, or accept tiny
transition-frame variance for faster parallel renders. Components now: components/SceneStage +
scenes/{Hook,Stat,Text,Cta}. Still TODO: ScreenshotHero/Terminal/Split (need the asset layer),
true 3D flip/cube/door transitions (rotate scene groups), then server wiring.

## Phase 1c — WIRED INTO THE PIPELINE (2026-07-02)
`renderEngine: "three"` is live behind a flag. `config.render.engine` ("scenekit" default |
"three", via RENDER_ENGINE env). New `server/src/services/three_render.js`: `isThreeRenderable`
(all scene kinds in hook/stat/chart/cta/bullet/caption/quote + landscape), `toEngineStoryboard`
(internal storyboard → engine3d contract, near-identity), `renderThree` (writes jobDir/props.json,
spawns `npx remotion render Film --props --gl=angle --concurrency=1` in engine3d-spike/, publishes
via the shared `publishRenderedMp4` extracted from renderer.js). `graph.js` compositionAgent
branches to renderThree at the top when engine==="three" && renderable, else falls through to the
scene-kit; returns the SAME `{videoPath,videoUrl}` visual so downstream audio-mux/DB is unchanged.
VERIFIED: (1) real autopilot job with engine=three correctly GATED to scene-kit because the LLM
storyboard contained an asset scene ("renderEngine=three but storyboard has asset scenes — using
scene-kit"); (2) direct server-side renderThree with a text-only storyboard spawned remotion from
Node (shell:true + quoted space-laden paths) and PUBLISHED public/videos/threewire.mp4 (6.5MB, 50s
incl. first bundle), visually correct (hook + 2X stat + cta). Gotcha: engine3d ThreeCanvas must read
dims from `useVideoConfig()` (not hardcoded) so job 1080p works; Root reads width/height/fps from props.
Next: port ScreenshotHero/Terminal/Split (needs asset textures/video-on-plane) so asset storyboards
also render in three; true 3D flip/cube/door transitions.

## Phase 2 — density + transitions + depth (2026-07-03, partial)
Attack on "empty/low-density/abrupt/flat" complaints. Implemented in engine3d-spike:
- **Transition system** (`engine3d/transitions/index.tsx`): directional `<Transition>` — push-left/right/
  up/down, zoom-through, rotate-3d, parallax — with a real OVERLAP (bumped OVERLAP to 0.8s in Video.tsx)
  so the outgoing scene's EXIT and incoming scene's ENTRANCE play together. NEVER a hard cut. Seam styles
  cycle (SEAM_CYCLE) per boundary. Frame-driven → deterministic. VERIFIED (hook→stat push-left: hook slides
  left+fades while stat enters from right, both visible).
- **Dense Feature-Grid template** (`scenes/FeatureGridScene.tsx`, kind "feature"/"dashboard"): kicker +
  gradient headline + supporting paragraph + 4 glass feature cards (icon-first, alternating-direction reveal)
  + metrics row (counter animation). ~80% occupancy, strong hierarchy. Content is a crisp DOM layer
  (useDomFonts registers Space Grotesk/Inter as FontFaces via delayRender) over the 3D SceneStage. VERIFIED
  render looks Linear/Vercel-tier.
- **Depth**: `core/depth.ts` DEPTH z-layers; ParticleField upgraded to a nearest-neighbour CONNECTING-LINE
  constellation (dots + lineSegments, drift as one group) on the particle depth plane — much richer bg.
- **Pipeline wiring**: three_render toEngineStoryboard now converts a bullet/caption scene WITH bullets →
  "feature" (paragraph=subtext, features=bullets) so real prompt-videos get the dense template; carries
  paragraph/features/metrics fields; SUPPORTED_KINDS += feature/dashboard.
Cards are DOM-over-3D (not 3D meshes).

DENSIFICATION (2026-07-03): every core scene now carries a secondary info block (composition rule)
via `components/DomBlocks.tsx` (ChipsRow / MiniMetrics / SupportLine, DOM over the 3D scene, KFDisplay/
KFBody fonts via useDomFonts): HookScene += feature chips row; StatScene += supporting mini-metrics row
(GOTCHA: had to lift the 3D number/label/sub UP — number y .45→.78, label →-.05, sub →-.62 — so the DOM
metrics row at the bottom doesn't collide with the 3D sub); CtaScene += trust chips. Verified in render:
Hook/Stat/Cta now fill the frame, no collisions. STORYBOARD LLM taught (system_storyboard.md): added
`kind: "feature"`, and optional `paragraph` / `features[]{title,desc}` / `metrics[]{value,suffix,label}`
per scene + a "Fill the frame (content density)" rule. storyboard.js validate() is LENIENT (passes unknown
fields through); three_render carries them; engine renders them; scene-kit TOLERATES a "feature" kind
(defaults to text, verified no throw). NOT yet verified with a live pipeline run (LLM output is
nondeterministic + ~10min) — engine fills with fallback content when the LLM omits the fields, so videos
are dense regardless. particles have lines but no data-streams/light-streaks; DOM cards not 3D meshes.

ALL 5 MOTION TEMPLATES now implemented (2026-07-03): T1 Hero=HookScene, T2 Dashboard=DashboardScene
(glass panel slides in from left + growing bar chart + metric rows + KPIs + glow — VERIFIED premium),
T3 Feature=FeatureGridScene, T4 Comparison=ComparisonScene (old-way ✗ card vs product ✓ card with accent
glow + forward depth-layer + VS divider + payoff metric — VERIFIED), T5 CTA=CtaScene. New kinds
"dashboard"/"comparison" wired: Video switch, three_render SUPPORTED_KINDS, storyboard prompt enum +
density rule (LLM can now choose them once the KIE key resets). scene-kit tolerates both (defaults to
text, verified). LIVE LLM verification still BLOCKED: KIE Gemini key hit its DAILY quota (error 433) —
retry when it resets. Remaining: card-stack/portal/morph transitions, data-stream/light-streak particle
modes, port DOM cards → 3D meshes.

## Chosen stack
- **Renderer host:** Remotion + `@remotion/three` (`<ThreeCanvas>`) + React-Three-Fiber v9 (React 19).
- **Determinism rule:** animate from Remotion `useCurrentFrame()`; NEVER R3F `useFrame()` (clock).
- **Helpers:** @react-three/drei, @react-three/postprocessing (EffectComposer: Bloom, DoF, Vignette,
  ChromaticAberration, Noise), troika-three-text / drei `<Text>` (MSDF crisp type), Theatre.js
  (optional visual keyframing), GSAP only for build-time value calc (not the runtime clock).
- **Render:** `npx remotion render` on a GPU worker (headless Chrome WebGL = SwiftShader/CPU without
  a GPU → budget a GPU box or accept slow CPU renders). FFmpeg stays the audio/mux layer.
- **Future:** Three r171+ `WebGPURenderer` (`three/webgpu`) + TSL node materials + compute-shader
  particles (1M+); adopt once the R3F/Remotion path is proven.

## Folder structure
```
engine3d/
  index.tsx                 # Remotion Root: registers <Composition>s from storyboard
  Video.tsx                 # maps storyboard.scenes[] -> <Sequence><Scene/></Sequence>
  core/
    frame.ts                # frame<->sec, easing curves, seeded RNG (deterministic)
    theme.ts                # pack -> palette/fonts/atoms (port deriveTheme)
    camera.ts               # camera rigs: pushIn, dolly, orbit, cam3D-equivalent
    lighting.ts             # per-pack light rigs (key/fill/rim, env)
  scenes/                   # ONE component per archetype (mirror scene_kit archetypes)
    HookScene.tsx  StatScene.tsx  CtaScene.tsx  TextScene.tsx
    ScreenshotHeroScene.tsx  TerminalScene.tsx  SplitScene.tsx
    LogoRevealScene.tsx  ProductRevealScene.tsx  AssetMontageScene.tsx
  components/               # reusable 3D primitives
    KineticText.tsx         # word/char stagger, mask, blur-sharp (MSDF text)
    DeviceFrame.tsx         # browser/phone chrome holding a screenshot/video texture
    Typewriter.tsx          # deterministic char reveal from frame
    ParticleField.tsx       # instanced constellation/bokeh backdrop
    OrbitalRings.tsx        # dotted ring arcs
    DepthPlanes.tsx         # parallax layers at different Z
    Backdrop.tsx            # gradient/glow ground, pack-aware
  transitions/
    index.ts                # cube, flip3d, door, wipe, scale-through, slide (frame-driven)
  materials/                # shader/node materials (glass, grain, gradient-map, duotone)
  post/                     # EffectComposer presets per pack
  assets/                   # loaders: texture (screenshot/logo), video texture, gltf
```

## Storyboard contract (UNCHANGED)
The LLM keeps emitting the same JSON (kind, headline, emphasis, subtext, bullets, animation,
layout, beats[], transitionOut, visualMotif, brandColors). The engine maps `kind -> Scene
component`, `animation -> KineticText mode`, `beats[].at -> frame`, `transitionOut -> transition`,
`brandColors -> theme accents`, `layout -> camera+placement`. This keeps brief/script/storyboard/
asset-planning/vision-gate/audio layers untouched.

## Animation pipeline
storyboard.json -> Video.tsx builds <Sequence durationInFrames> per scene (with OVERLAP frames on
seams for transitions) -> each Scene reads useCurrentFrame() -> interpolate()/spring() drive text,
camera, particles, materials -> transition layer cross-animates leaving+entering scene on the
overlap -> deterministic.

## Render pipeline
POST /projects -> (existing) brief/script/storyboard/assets/audio -> write props.json ->
`remotion render engine3d props.json out.mp4 --gl=angle` on GPU worker -> ffmpeg mux VO+SFX+music
(existing audio_mix) -> publish. Add a 2-attempt watchdog like renderer.js.

## Asset management
- Screenshots/logos -> THREE.TextureLoader -> mapped onto DeviceFrame/plane (colorSpace=SRGB).
- Stock/user video b-roll -> Remotion `useVideoTexture()` (frame-synced) on a plane behind content.
- Keep the existing vision-gate (on-topic) + user-upload pinning BEFORE the engine — unchanged.
- Preload/parse via drei `useTexture`/`Preload all`; cache decoded textures per render.

## Performance
Instancing/BatchedMesh for particles; MSDF text (no per-frame layout); powerPreference high,
antialias off + post AA (SMAA); disable post on cheap scenes; render targets reused; textures
pow2 + KTX2/basis; frustum/opacity cull off-screen scenes; cap particle counts by pack; on WebGPU
move particles to compute. Determinism > 60fps (offline render), so favor quality settings.

## Roadmap (incremental, ship per phase)
0. Spike: Remotion+@remotion/three renders ONE deterministic scene to MP4 on the worker. Prove
   frame-driven determinism (render twice, diff frames == identical).
1. Core: frame/theme/camera/lighting + Backdrop + KineticText (port hook headline). Ship HookScene
   behind a flag; A/B against current CSS hook.
2. Port archetypes 1:1 (Stat, Cta, Text, ScreenshotHero, Terminal, Split, Logo/Product reveal).
3. Transitions layer (cube/flip3d/door/wipe/scale-through) on Sequence overlaps.
4. Particles/OrbitalRings/DepthPlanes + post (Bloom/DoF/Vignette/grain) per pack.
5. Wire orchestrator: storyboard->props.json->remotion render; keep audio_mix + vision gate.
6. Router flag renderEngine: "scenekit" | "three"; migrate packs one at a time; measure render
   time/cost on GPU worker; make "three" default when at parity.
7. WebGPU/TSL upgrade for particle-heavy packs.
