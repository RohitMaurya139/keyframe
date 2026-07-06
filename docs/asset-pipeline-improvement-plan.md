# KEYFRAME — Asset Collection Pipeline & Template System: Complete Improvement Plan

**Status:** analysis + plan (no code changed). Grounded in a full read of the live pipeline
(`server/src/agents/graph.js`, `server/src/services/*`) and the Three.js engine
(`engine3d-spike/`). All file:line refs are real.

This document covers the eight requested areas:

| # | Requested area | Section |
|---|---|---|
| 1 | Asset Discovery | §3 |
| 2 | Asset Validation | §4 |
| 3 | Asset Placement & Composition | §5 |
| 4 | Template Integration | §6 |
| 5 | Template Library Expansion (50–100) | §8 |
| 6 | Template System Architecture | §7 |
| 7 | Asset-to-Template Matching | §9 |
| 8 | Final Deliverable (root causes + tools + roadmap) | §1, §2, §10, §11 |

---

## 1. Executive summary — the two meta-root-causes

Almost every symptom ("irrelevant assets, missed visual elements, weak template identity,
clutter, sameness") reduces to **two architectural facts**:

### Meta-cause A — Three renderers, the least expressive one is live
- **Live default:** `scene_kit.js` — 2D DOM/CSS/GSAP through HyperFrames. `config.render.engine`
  defaults to `"scenekit"` (`server/src/config.js:240`); `config.llm.useComposer` defaults to
  `false` (`config.js:206-208`).
- **Pack-faithful path (OFF):** `composer.js` injects the **entire `FRAME.md`** + showcase HTML +
  palette/contrast law (`composer.js:96-167`) — the only path that truly expresses a design system.
  Disabled by default.
- **Rich template engine (OFF, asset-blind):** `engine3d-spike/` has 15 premium Three.js templates,
  wired behind `RENDER_ENGINE=three` and gated by `isThreeRenderable()` to **landscape + text-only**
  scenes (`three_render.js:34-39`). It cannot place a single user image/screenshot/logo in most
  templates.

The scene-kit extracts only `colors:` + `fontFamily:` from a `FRAME.md` (`frame_registry.js:148-168`);
~90% of each design system (components, frame treatments, typography ramp, spacing, borders/shadows,
composition rules) is **never read**. Its archetype router (`scene_kit.js:1005-1014`) collapses
`feature/dashboard/workflow/comparison/timeline/testimonial/gallery` → `archText`. So packs differ only
as recolors of the same handful of layouts, and the "template library" the docs advertise
(`docs/template-library.md`) is unreachable in the live path.

### Meta-cause B — the entire pipeline is text/lexical; nothing is visual/semantic
There is **no image understanding** anywhere except one binary vision gate:
- Query building = LLM 3–5 word bag + a 2-word *frequency* anchor; product category, industry and
  brand are unused (brand is actively stripped, `graph.js:282-285`).
- Candidate ranking = bag-of-words tag overlap (`asset_sources/index.js:49-71`), no embeddings, no IDF.
- Provider merge = sequential **first-hit-wins** (`index.js:137-224`) — pixabay always beats a better
  pexels/openverse match that is never fetched.
- Dedup = byte-exact SHA-1 / string-exact URL (`local_db.js:93`, `scene_kit.js:656`); no perceptual hash.
- Asset↔scene binding, asset↔template matching, cross-scene style coherence: **none exist**.
- There is not even an image-processing dependency in `server/package.json` (no `sharp`, `jimp`,
  `node-vibrant`, `sharp-phash`) — all pixel work is ffprobe/ffmpeg + one Gemini vision call.

**The two highest-leverage moves in this whole plan:** (1) decide the renderer and make packs/templates
authoritative end-to-end (fixes A); (2) introduce a **CLIP/SigLIP visual-semantic layer** used for
retrieval, reranking, dedup, matching and consistency (fixes B).

---

## 2. The pivotal decision (make this first)

The plan forks on one choice. **Recommendation: Three.js becomes primary, and we build the asset
layer into it** — consistent with the standing `threejs-primary-render-rule`, and it is the only path
that reaches the "Keyframe/Motion-tier" visual bar. The catch is that the Three.js engine is currently
**asset-blind**, which is exactly the gap this request is about; so "build the asset layer into the 3D
templates" is not optional — it is the center of the work.

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Three.js primary + asset layer** (recommended) | Premium depth/lighting/motion; real template identity; matches the re-platform rule | Must build texture/video-on-plane asset placement, remove landscape-only + text-only gates, GPU render cost | **Recommended** |
| B. Scene-kit primary, deepen it | Asset-capable today; deterministic; cheap CPU render | Ceiling is "nice 2D motion-graphics"; must re-implement all rich archetypes + full token propagation in DOM | Fallback / interim |
| C. Composer (LLM) primary | Full pack fidelity for free | Non-deterministic, slow, reliability cost; still no structured asset placement | No |

**Everything in §3–§4 (discovery + validation) and §9 (matching) is renderer-agnostic and should proceed
regardless of this choice.** §5–§8 (placement + template architecture) are written for Option A with
notes for B.

> Confirm the renderer direction before Phase 3. If the team wants B, the TemplateSpec schema (§7) still
> applies — it just interprets to DOM instead of R3F.

---

## 3. Asset Discovery (Area 1)

### 3.1 How it works today
Active path: `assetPlannerAgent` (`graph.js:150-275`) builds per-scene "needs" → `assetSearchAgent`
(`graph.js:351-440`) → `acquire()` (`asset_sources/index.js:73`). Query = the scriptwriter's 3–5
"concrete visual words" (`script.js:16-20`), or `deriveQuery()` from `visualDirection`
(`graph.js:215-220`), prefixed with a 2-word **frequency** anchor from the brief (`graph.js:292-299`).
Providers: pixabay-api, openverse, pexels, pixabay-scrape, tried **sequentially, first-hit-wins**.

### 3.2 Root causes
1. **Query is ungrounded.** Category / industry / brand never enter it; brand name is stripped
   (`graph.js:282`). The only grounding is a frequency anchor easily dominated by filler words. →
   *irrelevant / off-subject assets.*
2. **First-hit-wins across providers** (`index.js:137-224`). The globally-best image is never chosen. →
   *misses important visual elements.*
3. **Lexical bag-of-words ranking** (`index.js:61-71`) is semantically blind: "AI writing assistant"
   scores 0 against an image tagged "robot, machine"; tagless providers bypass the gate entirely
   (`index.js:157`); pexels' only signal is a usually-empty `alt` (`pexels.js:32`).
4. **Vision gate is binary, fail-open, tiny-budget, off on 2/3 pipelines.** `{fit:true|false}` can't
   *rank*; fail-open returns `true` on any error (`vision_filter.js:60-62`); `VISION_MAX=3` is shared
   across ALL query variants (`index.js:86`); `project_pipeline.js`/`pipeline.js` never pass
   `visionTopic`, so the gate is silently absent there.
5. **No external source for icons / illustrations / logos.** Vectors come only from the local curated
   SVG library behind a strict lexical gate (`curated_library.js:172-257`); the scraper's vector path is
   dead code. Concepts the library lacks degrade to an off-topic photo or a motif.
6. **Uploads pinned but not placed** (`graph.js:308-349`, `sceneId:null`) — never matched to a scene,
   embedded, or used to seed the query.

### 3.3 Target design
Refactor `acquire()` from *sequential first-hit* to **gather → rank → verify**:

```
buildContext()      // per-scene: {sceneIntent, category, industry, brand, templateAssetProfile(§9)}
  → expandQueries() // 3–5 diverse concrete queries (LLM RAG-fusion + YAKE/RAKE salience)
  → gatherParallel()// top-N from EVERY provider concurrently (pixabay/pexels/openverse/unsplash/…)
  → rankBM25()      // cheap lexical first stage over tags (handles sparse alt text)
  → rankCLIP()      // SigLIP/CLIP image↔(query+assetProfile) cosine → the real ranker
  → verifyVisionTopK() // spend the vision budget on the reranked top-K, scored not binary
  → pickBest()
```

### 3.4 Specific tools / libraries / data sources
- **Semantic retrieval & rerank:** CLIP / **SigLIP** image-text cosine via `@xenova/transformers`
  (`Xenova/siglip-base-patch16-224`, `Xenova/clip-vit-base-patch32`) + `onnxruntime-node` in-process,
  or a small Python sidecar (`open_clip`, `sentence-transformers`). This replaces `relevanceScore`
  (`index.js:61`) and the first-hit loop.
- **Lexical first stage:** BM25 (`wink-bm25-text-search` / `okapibm25`) so rare discriminative tags
  outweigh generic ones.
- **Query expansion / salience:** LLM multi-query (RAG-fusion pattern), **YAKE** / **RAKE**
  (`node-rake`) / **KeyBERT** to replace the frequency `topicAnchor` (`graph.js:294`); WordNet via
  `natural` or ConceptNet for synonym breadth.
- **Icons (new provider):** **Iconify API** / `@iconify/json` (200k+ open SVG icons, offline-capable);
  offline fallback sets **Lucide / Heroicons / Tabler**. An icon need must never degrade to a photo.
- **Illustrations:** **unDraw**, **Storyset**, **SVGRepo**, Noun Project / Flaticon.
- **Logos (new provider):** **Brandfetch** / **Logo.dev** / Clearbit Logo API keyed off the project's
  `websiteUrl` (already known) — stop relying on upload-only logos.
- **More stock + diversity:** **Unsplash**, **Wikimedia Commons**, **Coverr / Mixkit** (b-roll). Only
  valuable once paired with cross-provider rerank.
- **Vector index for curated lib / cache / uploads:** precompute CLIP embeddings, store in
  **hnswlib-node** / **sqlite-vec** / **LanceDB**; retrieval becomes nearest-neighbour instead of token
  overlap — big recall win over 2k+ SVGs, and lets uploads be assigned to the nearest scene need
  (fixes `sceneId:null`).

---

## 4. Asset Validation (Area 2)

### 4.1 What exists today
Only real gates: `validateMedia()` = decodable stream + `width>0 && height>0` + file ≥5KB
(`asset_sources/util.js:41-67`); byte-exact dedup (`local_db.js:93`); per-film reuse guard
(`scene_kit.js:644-658`); missing-file strip (`normalize.js:177-191`).

**Absent entirely:** resolution-vs-target floor, aspect-ratio validation, transparency/alpha check,
watermark/stock-overlay detection, perceptual/near-duplicate hashing, aesthetic/sharpness scoring,
cross-scene visual-consistency scoring.

### 4.2 Root causes
1. **Low-quality/blurry assets ship** — only decodable + ≥5KB is checked; a 400px thumbnail passes.
2. **Watermarked assets ship** — zero detection; `pixabay_scrape` can return overlay-branded scrapes.
3. **Stretched / badly-cropped assets** — no aspect check; correction is blind CSS `object-fit:cover`
   center-crop (loses the subject) or a stretch when the LLM omits it (only caught post-render by
   `qa_agent.js:59`).
4. **Near-duplicate reuse** — dedup is byte/URL exact only; the same shot from two providers/queries
   repeats across scenes.
5. **Inconsistent look scene-to-scene** — consistency is imposed only on the deterministic theme/overlay
   tint (`scene_kit.js:855,902`), never on the photos themselves.
6. **Transparency accidents** — alpha is inferred from folder/extension (`curated_library.js:103-108`),
   never measured.

### 4.3 Target design + tools (each lever → the root cause it fixes)
Add **`sharp`** (and keep ffmpeg) and slot these into the existing seams (`util.validateMedia`,
`acquire()`, `local_db.register`, `scene_kit.partitionAssets`):

| Lever | Library / technique | Fixes |
|---|---|---|
| **Resolution floor + smart crop** | `sharp` min-dimension gate tied to target; saliency/entropy crop `sharp().resize({fit:'cover', position: sharp.strategy.attention})` (or ffmpeg `cropdetect`) → write to the exact target box **before** placement | RC1, RC3 |
| **Aspect-ratio guard + enforce object-fit** | compare `w/h` vs job target; auto-inject `object-fit:cover` in `normalize.js` so it's not LLM-dependent | RC3 |
| **Perceptual near-dedup** | `sharp-phash` / `blockhash-core` (pHash/dHash), Hamming-distance ≤ ~10 bits, computed at `local_db.register` and `partitionAssets` | RC4 |
| **Watermark / overlay detection** | extend the existing vision prompt (`vision_filter.js:28-41`) with "reject if a watermark/stock-logo/URL overlay is visible" (rides the call you already pay for); or `sharp` corner-variance heuristic | RC2 |
| **Aesthetic / quality scoring** | **NIMA** aesthetic model, or CLIP "high-quality professional photo" similarity, as a new `assetAesthetic` stage in the same pass as vision relevance | RC1 |
| **Palette extraction + cross-scene coherence** | `node-vibrant` per candidate → distance to active pack/brand palette (`themeFromTokens`, `enrich.js:58-78`); prefer on-palette, penalize scene-to-scene divergence, track chosen palettes in `graph.js:400` | RC5 |
| **Alpha check** | `sharp().metadata().hasAlpha` / ffprobe `pix_fmt`; route true-alpha assets to contained placement only; fix `curated_library.classify` | RC6 |
| **Harden vision budget** | make `VISION_MAX` adaptive by slot importance (hero/full-bleed gets more calls); reconsider fail-open for the highest-visibility slots | RC (gate bypass) |

---

## 5. Asset Placement & Composition (Area 3)

### 5.1 How it works today (scene-kit; the 3D engine differs — see §7)
A thin 4-zone system: `LAYOUTS = ["fullbleed","split-60-40","centered-card","grid-2x2"]`
(`scene_kit.js:418`) with **hardcoded % boxes** (`placeContent`, `:447-460`). Zone is chosen by the LLM
or **index+seed rotation** (`layoutFor`, `:439-443`). Decorative particles are **literally hash-scattered**
(`:263-264`, `:307-308`) — the source of the "randomly placed" look. Hierarchy = a lookup table of
hardcoded font sizes + fixed z-planes (`:519,550,573,610`, `:536-539`). No saliency, no spacing tokens,
no balance pass.

### 5.2 Root causes
1. **Assets are decoupled from the scene they were fetched for.** Agents fetch per `sceneId`
   (`composer.js:199`) but the kit never reads it — Pass 1 greedily drains global pools by fixed
   priority (`scene_kit.js:1103-1129`), so an asset fetched for scene 4 can land in scene 2 or become
   wallpaper. → *no clear purpose per asset.*
2. **Layout/transition/ambient/archetype are modulo-rotated, not content-driven** (`:442`, `:433-434`,
   `:350`). → *arbitrary-looking placement.*
3. **Decorative fields are hash-scattered** (`:263-264`). → *the literal "floating random" look.*
4. **Archetype coverage gap** — rich kinds fall through to bare `archText` (`:1013`). → *thin scenes,
   large empty regions.*
5. **Hierarchy is hardcoded, not focal-aware** — fixed `object-position:top center` (`:694`) crops
   faces/logos/UI focus off.
6. **No spacing/safe-area system**; emptiness patched by dropping a **fixed-position** motif
   (`motifZone:465-470`) that may not sit where the emptiness is.
7. **No orphan/overflow balancing** — montage cols `n<=4?2:3` (`:837`) ragged-wrap 3 and 5; excess stock
   is silently dropped (`:1150`).
8. **Overlap safety is z-order/track-based, not spatial** (`:1058`) — long copy can still crowd a motif;
   it's just hidden behind text.

### 5.3 Target design + tools
- **A. Bind assets to scene + role (highest leverage, low risk).** Read `asset.sceneId`, match to
  `scene.id`, carry an explicit `role` (`hero | supporting | background | logo | montage-tile`) from the
  fetch stage so placement is by *intent*, not pool order.
- **B. Constraint layout instead of % boxes.** Replace `placeContent` with a **Yoga/flexbox** pass
  (Facebook Yoga — the engine Satori uses) or a **Satori-style** JSX→measured-absolute pass with real
  text metrics. In R3F, use **`three-mesh-ui`** flexbox blocks or Yoga-driven positions on groups.
- **C. Deterministic slot system per archetype.** Each archetype = named slots
  (`focal, supporting[], caption, motif, badges[]`) on a **12-column grid with rule-of-thirds /
  golden-ratio anchors** and **spacing tokens** (`space-1..7`) — replacing inline `7%`/`46px` magic
  numbers and the "drop a motif in a corner" hack.
- **D. Saliency-driven focal + crop.** Compute a focal point at fetch time (**smartcrop.js**, `sharp`
  entropy crop, or a face detector) and drive `object-position` + Ken Burns origin from it (today
  hardcoded `:694`, `:399-401`) so logos/faces are never cropped off.
- **E. Visual-hierarchy pass.** One designated focal per scene (largest, forward-z, highest contrast);
  supporting sizes as ratios (modular type scale); enforce min focal area (≥40% frame) and a max
  decoration weight (mirror `composer.js:267`).
- **F. Balance + overflow fitting.** Bin-pack montage to avoid ragged rows (fix `:837`); spawn an extra
  montage/grid scene rather than dropping excess (`:1150`).
- **G. Build the missing archetypes** (see §6/§8) so `feature/dashboard/workflow/comparison` stop
  collapsing to `archText`.

Priority: **A + C + G** remove "no purpose / empty" with least risk; **B + D + F** are the deeper wins
that turn placement from fixed slots into measured, saliency-aware, balanced composition.

---

## 6. Template Integration — why identity is lost (Area 4)

### 6.1 Root causes (server side)
1. **Default renderer reads ~2 fields from a rich design system** — colors + fonts only
   (`frame_registry.js:148-168`, `scene_kit.js:85-169`); components/treatments/typography-ramp/spacing/
   border-shadow/composition-rules discarded.
2. **Archetypes are pack-agnostic** — same geometry+motion for all packs (`:1005-1014`); packs read as
   recolors of one template.
3. **Only 5/10 packs have a signature atom** (`pack_atoms.js:42-68`); the other 5 get a recolored
   generic ground.
4. **`selectAutoPack` is dead in the live wiring.** Intake pre-writes the brief LLM's `suggestedFramePack`
   into `frame_pack` (`project_pipeline.js:139`, `db.js:151`), so `frameSelectorAgent` (`graph.js:100`)
   treats every auto job as an explicit user choice and never runs the tone-family / hash-spread /
   no-recent-repeat logic (`frame_registry.js:84-109`) — reintroducing the midnight-glass monoculture the
   team already tried to fix.
5. **Brand colors *replace* pack accents** (`scene_kit.js:127-139`) — prepended over pack accents, so a
   strong brand palette makes two different packs converge.
6. **Typography identity mostly lost** — only the display *family* survives (if a woff2 is bundled),
   weights/case/tracking hardcoded, "Inter" stripped (`scene_kit.js:149-155`).
7. **Storyboard promises archetypes the renderer drops** (`system_storyboard.md:92` → `archText`);
   `features[]`/`metrics[]` authored by the LLM are never rendered.

### 6.2 Root causes (Three.js engine)
8. **One global ambient for every scene** — `SceneStage` hardwires the same backdrop, particles, orbital
   rings, motion streaks, and identical Bloom+Vignette for all templates (`SceneStage.tsx:26-45`). The
   background, which dominates the frame, is a constant.
9. **One theme per film; 2 packs; brand colors touch only 2 accent slots** (`theme.ts:30-59,107-108`);
   default always `midnight-glass`.
10. **~29 hardcoded `rgba(120,150,255,…)` literals + `#0d1430` + a leftover `"With Flowbase"` string**
    bypass the theme across 14 files — brand/theme overrides can't reach most surfaces.
11. **Camera monoculture** — 10 of the templates all pass `dolly-lateral`.
12. **Director intent discarded** — `scene.animation`, `scene.layout`, `scene.visualMotif`, and
    `scene.transitionOut` are read by **no** renderer file; transitions come from an index cycle
    (`Video.tsx:27`); `beats` honored by only 5/17 scenes.

### 6.3 Fixes (make pack identity authoritative end-to-end)
- **Propagate the full token set:** extend `getPackTokens` (`frame_registry.js:148`) to parse borders,
  shadows, radii, spacing, per-role typography (weight/case/tracking), and component recipes; have
  archetypes read them instead of `font:800`.
- **Per-pack (per-template) skins:** implement each `FRAME.md` treatment as a pack-keyed style module;
  give all 10 packs a signature atom; expand `pack_atoms.js`.
- **Blend, don't replace, brand color** into the pack accent hierarchy (`scene_kit.js:127-139`).
- **Fix auto-selection wiring:** add a `frame_pack_source` flag (or keep `frame_pack` null for auto) so
  `frameSelectorAgent` actually runs `selectAutoPack`.
- **Thread theme tokens through the hardcoded 3D literals**; give each template a distinct camera +
  bloom/vignette + accent; **actually consume** `animation` / `transitionOut` / `layout`.
- **Add a pack-fidelity gate** (extend `cinematic_lint.js` / `qa_agent.js`): assert only pack hexes
  (±brand) used, display font present, signature atom present, flat packs have no gradients,
  kind→archetype match — bounce/repair on mismatch.

---

## 7. Template System Architecture — data-driven (Area 6)

### 7.1 Today
A template = an **imperative React component** (90–130 lines each). The only formal type is `TemplateDef`
(`engine3d-spike/src/engine3d/templates/registry.ts:36-44`) which carries **selection metadata only**
(`keywords`, `kinds`, `purpose`) — **no visual definition**. Visual identity is either bespoke inside each
component or a global constant in `SceneStage`. `selectTemplate()` (keyword scorer) is dead code. Adding
one template touches **4–6 files** and four registries that already drift
(`storyboard.ts` types vs `registry.ts` vs `three_render.js:17 SUPPORTED_KINDS` vs
`system_storyboard.md:36`).

### 7.2 Target: **a template is a validated config, interpreted by one generic renderer**

```ts
// TemplateSpec — validate with zod; this is the whole "look" as data
type TemplateSpec = {
  id: string;
  category: TemplateCategory;              // saas-explainer | ai-demo | fintech | ecommerce | …
  layout: {                               // §5 slot system
    kind: 'split-60-40' | 'grid-2x2' | 'centered' | 'fullbleed' | 'device-hero' | …;
    grid: 12; anchors: 'thirds' | 'golden';
    slots: Slot[];                        // {name, role, box|flex, z-plane, fit}
    spacing: SpacingScale;
  };
  camera: CameraRigId;                    // pushIn | pullBack | orbit | crane | rackFocus | dollyLateral
  transitionIn: SeamStyle; transitionOut: SeamStyle;
  theme: ThemeOverride;                   // accent, ground, panel, line, particleStyle, bloom, vignette
  animation: { preset: AnimPreset; stagger: number; easing: EasingId };
  vfx: PostChain;                         // per-template EffectComposer (Bloom/DoF/CA/Noise) — NOT global
  assetProfile: AssetProfile;             // §9 — drives discovery + matching
  duration: { minSec, maxSec };
};
```

- **One `<TemplateRenderer spec content theme>`** interprets the spec: zones→positioned slots (Yoga),
  `animation.preset`→timings, `camera`→rig, `vfx`→post chain. New templates become new **rows**, not new
  files. Keep the current hand-built scenes as a small set of "premium/bespoke" specs the renderer can
  still dispatch to.
- **Single source of truth:** `registry.ts` owns kinds/keywords/schema; **derive** `SUPPORTED_KINDS`
  and the LLM enum from it (generate the prompt enum) so the four lists can't drift.
- **Centralize identity in theme tokens** (zustand store, not prop-drilled); replace all hardcoded
  literals with `theme.*`; add many packs; `TemplateSpec.theme` shifts each template's ambient so two
  templates in one film look different.
- **Preset libraries** (the recombination surface): animation presets (`word-stagger`, `mask-reveal`,
  `scale-pop`…), camera-rig registry (end the `dolly-lateral` monoculture), transition library (wire
  `scene.transitionOut`), post chains. Optionally **Theatre.js** to author per-template choreography as
  JSON while keeping Remotion frame-driven determinism.
- **Real asset placement as a first-class slot** (Option A): give `Card3D` a texture path (map
  screenshots onto the glass panel via existing `useImageTexture`), add an "asset zone" so
  `dashboard/gallery/url-to-video` composite **actual** user media onto **drei** meshes (`<Image>`,
  `RoundedBox` + map, `MeshTransmissionMaterial` glass, `useVideoTexture` for b-roll) instead of gray-box
  mockups.

### 7.3 What each template must define (matches the request's checklist)
Scene structure · layout rules · animation patterns · transition styles · typography system · asset
placement rules · camera behavior · lighting configuration · visual effects · color theme — **all of
these become fields on `TemplateSpec`**, none hardcoded in a component.

---

## 8. Template Library Expansion — 10 → 50–100 (Area 5)

**You cannot hand-write 100 components.** With the §7 architecture, a template is a config row, so scale
comes from **preset composition**, not code. Strategy:

1. **Define preset banks** — ~6 layouts × ~6 camera rigs × ~8 animation presets × ~10 packs ×
   ~6 post chains. Even a curated subset yields hundreds of distinct, coherent looks.
2. **Author category bundles** (the requested 15 categories). Each category = a constrained preset
   palette + an `assetProfile` (§9):

   | Category | Layout bias | Camera | Motion | Palette / VFX | Asset profile |
   |---|---|---|---|---|---|
   | SaaS Explainer | device-hero, split | pushIn | mask-reveal | clean, cool, low bloom | product screenshots, UI, clean icons |
   | Startup Launch | fullbleed, centered | crane | scale-pop, kinetic | bold, high-contrast, high bloom | bold hero imagery, logo |
   | AI Product Demo | orbit, grid | orbit | word-stagger | dark, neon, glow, particles | holographic, particles, glowing UI |
   | Marketing Promo | split, montage | dollyLateral | slide | vivid, warm | lifestyle photography, product |
   | Social Ad (9:16) | centered, fullbleed | punchIn | scale-pop | punchy | 1 hero asset, big type |
   | Corporate | split-60-40 | rackFocus | subtle fade | muted, minimal VFX | professional icons, clean photography |
   | Finance/Fintech | dashboard, grid | pushIn | counter | deep blue, restrained | charts, data viz, KPI tiles |
   | Healthcare | centered, split | slow dolly | gentle | soft, airy, low contrast | clean/human photography, soft icons |
   | E-commerce | gallery, grid | dollyLateral | card-stack | bright, product-forward | product shots, price/badge tiles |
   | Education | split, timeline | pullBack | reveal | friendly, illustrated | illustrations, diagrams |
   | Technology | grid, device-hero | orbit | data-stream | dark, gridlines | UI, code, abstract tech |
   | Mobile App Showcase | device-hero (phone) | pushIn | app-swipe | vibrant | app screenshots in phone frame |
   | Data Visualization | dashboard | rackFocus | draw-in | neutral + accent | charts, graphs, metrics |
   | Enterprise Software | dashboard, split | subtle | fade | corporate, restrained | dashboards, logos, org imagery |
   | Modern Motion Graphics | fullbleed, shape | crane/orbit | kinetic, morph | expressive, high VFX | abstract shapes, gradients, particles |

3. **Generate + curate:** seed configs programmatically from the preset matrix, render a thumbnail per
   spec, and human-approve into the library (mark `status: ready|beta`). This is how you reach 50–100
   *production-ready* specs quickly without 100 code reviews.
4. **Keep the registry generated** so LLM enum / server SUPPORTED_KINDS / engine dispatch stay in sync as
   the library grows.

---

## 9. Asset-to-Template Matching (Area 7)

**This system does not exist today** — assets are sourced with no knowledge of the chosen template. Build
it as the bridge between §3 and §7:

- Every `TemplateSpec` declares an **`assetProfile`**:
  ```ts
  type AssetProfile = {
    preferKinds: ('photo'|'icon'|'illustration'|'screenshot'|'logo'|'3d'|'abstract')[];
    styleTerms: string[];      // 'holographic','glowing UI','particles' | 'clean','professional','flat'
    paletteBias: 'dark-neon' | 'muted-corporate' | 'warm-vivid' | …;
    negativeTerms: string[];   // e.g. corporate rejects 'neon','glitch'
    aestheticFloor: number;    // higher for hero-heavy templates
  };
  ```
- **Discovery uses it** (§3.3): `styleTerms` augment query expansion; `paletteBias`+`styleTerms` become
  part of the CLIP text embedding the candidates are scored against; `negativeTerms` subtract; `preferKinds`
  routes to the right providers (Iconify for icons, Unsplash for photography, etc.); `aestheticFloor`
  raises the §4 quality gate for that template.
- **Worked examples (the request's cases):**
  - *Futuristic AI template* → `styleTerms:['holographic','glowing interface','particle','neon']`,
    `paletteBias:'dark-neon'`, `preferKinds:['abstract','screenshot','3d']` → CLIP pulls glowing/particle
    imagery, palette-match keeps it dark-neon.
  - *Corporate template* → `styleTerms:['clean','professional','minimal']`, `negativeTerms:['neon','glitch']`,
    `preferKinds:['icon','photo']`, high `aestheticFloor` → clean icons + professional stock, no neon.
  - *Startup launch* → `styleTerms:['bold','energetic','high-impact']`, `paletteBias:'warm-vivid'`,
    prefers a single strong hero → big type over a bold image.
- **Consistency loop:** the chosen assets' extracted palettes (`node-vibrant`, §4) feed back into the
  template's theme accents, so imagery and template reinforce each other instead of clashing.

---

## 10. Root-cause summary (one table)

| Symptom | Primary root cause | Where | Fixed by |
|---|---|---|---|
| Irrelevant / off-subject assets | ungrounded query + lexical-only rank + first-hit-wins | `graph.js:282`, `index.js:61,137` | §3.3 gather→CLIP-rank→verify; §9 profile |
| Misses important visual elements | no cross-provider pooling; no icon/illus/logo sources | `index.js:137`; curated-only vectors | §3.4 parallel gather + Iconify/Brandfetch |
| Duplicate / near-dup assets | byte/URL-exact dedup only | `local_db.js:93` | §4 perceptual hash |
| Stretched / mis-cropped | no aspect check; blind object-fit cover | `util.js:63`, `scene_kit.js:694` | §4 aspect guard + saliency crop |
| Watermarked / low-quality | no detection; ≥5KB is the only "quality" | `util.js:43` | §4 vision-prompt watermark + NIMA/CLIP aesthetic |
| Inconsistent scene-to-scene | no asset palette/style coherence | (absent) | §4 node-vibrant + consistency loop |
| Random / cluttered placement | modulo-rotated layout; hash-scattered decor; no slots | `scene_kit.js:263,442` | §5 slots + Yoga + saliency |
| Assets feel purposeless | asset↔scene binding dropped | `scene_kit.js:1103` | §5A role binding |
| Template style not reflected | scene-kit reads only colors+fonts; archetypes pack-agnostic | `frame_registry.js:148`, `scene_kit.js:1005` | §6 full-token propagation / renderer choice |
| Same-looking videos | selectAutoPack bypassed; global SceneStage; camera monoculture | `graph.js:100`, `SceneStage.tsx:26` | §6 wiring fix + §7 per-template theme/camera |
| Only ~10 templates, hard to scale | imperative components, 4 drifting registries | `registry.ts`, `three_render.js:17` | §7 TemplateSpec + §8 preset bundles |
| No asset↔template awareness | matching system absent | (absent) | §9 assetProfile |

---

## 11. Phased roadmap (sequenced by leverage)

**Phase 0 — Decision + foundations (unblocks everything)**
- Confirm renderer direction (§2). Recommended: Three.js primary + asset layer.
- Add deps: `sharp`, an embeddings runtime (`@xenova/transformers`+`onnxruntime-node` or a Python
  CLIP/SigLIP sidecar), a vector index (`sqlite-vec`/`hnswlib-node`), `node-vibrant`, `sharp-phash`.
- Land the `TemplateSpec` zod schema + a skeleton generic `<TemplateRenderer>`; make `registry.ts` the
  single source of truth and generate `SUPPORTED_KINDS` + the LLM enum from it.

**Phase 1 — Discovery quality (renderer-agnostic; ship first)**
- Refactor `acquire()` → parallel gather → BM25 → CLIP/SigLIP rerank → vision-verify top-K.
- Ground the query: category/industry/brand + multi-query expansion + YAKE/RAKE salience (replace the
  frequency anchor).
- Add providers: **Iconify** (icons), **unDraw/Storyset** (illustrations), **Brandfetch/Logo.dev**
  (logos), **Unsplash** (photography). Wire the dead vector path.
- Embed curated lib / cache / uploads; assign uploads to nearest scene need.

**Phase 2 — Validation (renderer-agnostic)**
- `sharp` resolution floor + aspect guard + saliency smart-crop; enforce `object-fit` in `normalize.js`.
- Perceptual near-dedup; watermark check on the vision call; NIMA/CLIP aesthetic gate.
- `node-vibrant` palette extraction + cross-scene consistency scoring + alpha check.
- Harden the vision budget (adaptive by slot importance; thread `visionTopic` on all paths).

**Phase 3 — Placement (needs renderer decision)**
- Bind asset→scene→role. Slot system + spacing tokens + Yoga/`three-mesh-ui` layout.
- Saliency-driven focal/crop/object-position; hierarchy pass; balance/overflow fitting.
- Build the missing archetypes (`feature/dashboard/workflow/comparison/timeline`) as specs.

**Phase 4 — Template identity + library + matching**
- Full FRAME.md token propagation (or make Three.js primary and thread theme tokens through the 3D
  literals); per-template theme/camera/transition/post; blend (not replace) brand color; fix
  `selectAutoPack` wiring.
- Real asset placement in 3D (textures on planes/Card3D, `useVideoTexture` b-roll).
- Preset banks → category bundles → generate+curate to 50–100 specs (§8).
- `assetProfile` matching (§9) tying discovery to the chosen template.

**Phase 5 — Fidelity loop + live verification**
- Pack/template-fidelity lint + QA gate (bounce/repair on mismatch).
- Live end-to-end runs (currently blocked on KIE quota per the engine doc) with A/B vs the current path.

---

## 12. Benchmark reference (what "production-grade" needs)
- **Keyframe / Motion / Arcade / Superside** differentiate on: strong per-template art direction (distinct
  camera, palette, motion signature per template — our §6/§7 fix), real product media composited into
  premium 3D/device frames (our §7 asset slots), and tight relevance between copy, assets and template
  (our §9 matching).
- **Open-source / technique references to mine:** Remotion (frame-driven determinism) · R3F + drei +
  `@react-three/postprocessing` (already in stack) · Theatre.js (data-driven choreography) · Satori/Yoga
  (measured layout) · smartcrop.js (saliency crop) · CLIP/SigLIP + NIMA (visual-semantic + aesthetic) ·
  Iconify (open icon corpus) · node-vibrant (palette) · sqlite-vec/LanceDB (asset embeddings index).

---

*Prepared from a direct code audit of the live langgraph pipeline and the `engine3d-spike/` engine.
No source files were modified.*
