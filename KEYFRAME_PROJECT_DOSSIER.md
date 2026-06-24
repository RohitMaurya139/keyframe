# KEYFRAME — Project Dossier

> A complete reference for the KEYFRAME multi-modal AI video studio: architecture, generation flow, key subsystems, the diagnosis of the "white slideshow" problem, the work done to fix it, and the full project memory.
>
> **Generated:** 2026-06-19 · **Repo:** `C:\MERN\Internshit website\KEYFRAME` · **Branch:** `main`
>
> ⚠️ Some details are synthesized from point-in-time memory notes (dated below). Where a fact may have drifted (model names, config values in the gitignored `config.json`), it is flagged. Verify against current code before treating as gospel.

---

## 1. What KEYFRAME is

KEYFRAME is a **multi-modal AI video studio**: paste a prompt and/or a website URL (and/or upload a reference video) → it researches the input, drafts a script you can edit, then generates a fully animated, narrated, music-scored MP4 (with `.srt` captions).

- Built per an 8-phase plan (repo `PLAN.md`, 2026-06-12). **All 8 phases complete.**
- **Monorepo:**
  - `server/` — Node 22 backend (Express, port **8080**). All generation logic.
  - `web/` — React + Vite SPA (the "Solstice" UI). Posts to `/api/projects`.
  - `frames/` — design-system "frame packs" (each a `FRAME.md` + preview video).
  - `server/asset_library/` — ~9,872 curated local assets (gitignored).
  - `server/showcase/` — persistent hand-authored reference compositions (NOT swept by the janitor).
  - `server/jobs/` — per-job working dirs (swept by the janitor; **not durable**).
  - `server/public/videos/` — rendered MP4s + thumbnails + `.srt`, served at `/videos/*`.

The output engine is **HyperFrames** — compositions are single-file HTML documents (GSAP timeline + inline SVG/CSS, optional Three.js) that a headless-Chrome renderer seeks frame-by-frame and encodes to MP4 via ffmpeg.

---

## 2. High-level architecture

### Two generation runners

| Runner | Entry | Trigger | Shape |
|---|---|---|---|
| **Classic pipeline** | `services/pipeline.js` → `runJob()` | `POST /api/generate` (legacy/text) | 4-tier degradation ladder |
| **Project pipeline** | `services/project_pipeline.js` → `runIntake()` + `runProduction()` | `POST /api/projects` (the live web UI) | Two-act: intake → **script review pause** → production |
| **Agent graph** | `agents/graph.js` → `runProductionGraph()` | replaces `runProduction` when `config.orchestrator === "langgraph"` | 12-agent LangGraph |

`server.js` wires it: `enqueueProduction(jobId)` calls `runProductionGraph` when `config.orchestrator === "langgraph"`, else `projectPipeline.runProduction`. **The web app posts only to `/api/projects`**, so the LangGraph path is the *live* path; `/api/generate` is effectively dead UI-wise.

### The two-act project flow

```
Act 1  runIntake():     intent → [ingest website/video] → brief → draft script → PAUSE (script_review)
                                                                        │ user edits VO / durations / asset queries in the Script Room
Act 2  runProduction():  approved script → storyboard → assets + audio (parallel) → compose → gate → render → mix → done
        (or runProductionGraph in langgraph mode)
```

### The 12-agent LangGraph (`agents/graph.js`)

```
START → frame_selector ─┬→ storyboard_agent → scene_planner ┐
                        ├→ asset_planner → asset_search       ├→ (join) → composition → animation(audit) → timeline → qa_agent
                        └→ voice_agent ───────────────────────┘                                               │
                                                                          repair ←── (conditional: QA fail, ≤N laps) ←┘
```

- **frame_selector** — resolves the design-system pack (`job.frame_pack || brief.suggestedFramePack || "auto"`).
- **storyboard / scene_planner** — scene list with `kind`/`start`/`duration`/`emphasis`.
- **asset_planner / asset_search** — plan + fetch images/vectors/videos (curated library first).
- **voice_agent** — per-scene TTS (VO), SFX, music.
- **composition** — calls `attemptLlmComposition` (the composer LLM + gate). On failure → `buildFallback`.
- **animation** — deterministic timeline audit (warnings only).
- **timeline** — render (if needed), captions/SRT, audio mix.
- **qa_agent** — vision review of the *rendered* frames; blocker/minor verdict; ≤ N repair laps.

LangGraph rules learned the hard way: node names must not collide with state-channel names (hence `_agent` suffixes); `addEdge([a,b], target)` is a join barrier.

---

## 3. The composition gate (why videos succeed or fall back)

After the composer LLM emits HTML, `pipeline.js gateComposition()` runs **three checks** in order. Any hard failure (after repair laps) → the deterministic fallback ships instead.

1. **`normalizeComposition()`** (`normalize.js`) — deterministic safe rewrites BEFORE linting:
   - `stripExternalFonts` — removes Google Fonts `<link>`/`@import` and `-apple-system` (lint forbids them).
   - `normalizeFontFamilies` — forces **every** `font-family` to the system stack `Inter, "Segoe UI", system-ui, …` (renderer can't load webfonts; a pack font like "Bricolage Grotesque" has no `@font-face` → lint error). **Consequence:** there is no lint-safe monospace font; terminal "mono" looks are faked structurally with `white-space:pre` + `letter-spacing` + `tabular-nums`.
   - `ensureClipClass` — adds `class="clip"` to any timed element missing it.
   - `reflowTrackOverlaps` — greedy interval-coloring in DOM order: reassigns each clip the lowest track with no time overlap. Fixes the **`overlapping_clips_same_track`** error that ~every model trips (stacking bg+scrim+content on one track) — historically the #1 cause of fallbacks.
2. **`hyperframes lint`** (`validator.js runLint`) — static structural lint. Gates on **exit code 0**. Diagnostics print to STDOUT.
3. **`runtimeCheck`** (`runtime_check.js`) — serves the job dir over localhost, loads in headless Chromium, fails on any `pageerror` or if `window.__timelines["vid"]` never registers. **Catches blank videos that static lint can't** (e.g. a script that throws before timeline registration — the classic `this.target()` bug).
4. **`hyperframes inspect`** (`validator.js runInspect`) — SPATIAL occlusion audit (`--at-transitions --tolerance 4`). Parses STDOUT JSON, gates only on `severity==='error'` (code `text_occluded`); `content_overlap`/`container_overflow` are warnings (ignored). **Inspect-only failures are SHIPPED on the final lap** ("a real comp beats the bland fallback") — so inspect errors do *not* cause a fallback.

**Key lint rules the composer must satisfy** (from `system_composer.md`):
- Every `.clip` has `id` + `data-start`/`data-duration`/`data-track-index`. *(Nested `.clip`s are allowed — verified this session: nesting does NOT fail lint.)*
- Clips sharing a track must have disjoint time windows.
- Only `opacity:0` as a CSS hidden state — never bake `transform`/`clip-path` (GSAP composes with them → element stuck offscreen). All from-states live in `gsap.fromTo`.
- Never animate `display`/`visibility` on a `.clip` (`gsap_animates_clip_element`).
- No `repeat:-1` (breaks deterministic capture) — use finite counts.
- Every faded-out element needs a matching hard kill (`tl.set(sel,{opacity:0}, boundary)`).
- One paused timeline registered as `window.__timelines["vid"] = tl`.
- `<img>`/`<video>` `src` must match `availableAssets`.

---

## 4. Asset acquisition (`asset_sources/`)

`acquire({query, fallbackQueries, type, orientation, kindPref, excludeIds})` order of attack:

1. **Curated local library** (`curated_library.js`) — `server/asset_library/`, ~**9,872** files (photo 6,206 / vector 2,197 / illustration 1,469), keyword+topic indexed in `index.json`. Checked FIRST. `kindPref:"vector"` is a HARD restrict (only `.svg`); photo/illustration prefs are soft. Re-index: `node -e "require('./src/services/asset_sources/curated_library').buildIndex()"`.
2. **Fetch cache** (`local_db.js`) — previously downloaded assets.
3. **Web providers** — pixabay (API) → openverse → pexels → pixabay_scrape. `MEDIA_PROVIDER` env promotes one to the front. Video needs a keyed provider, else downgrades to a still image.

**Website screenshots** (`ingest/website.js`) — drives cached Chrome via puppeteer-core to capture the homepage hero + 2 deeper sections + the OG image + dominant brand colors. These real screenshots are pinned as **hero assets** (browser-frame treatment) on the project/URL flow. *Only* the URL flow gets screenshots; plain text generation does not.

---

## 5. Frame packs (design systems)

10 packs in `frames/`: `blockframe`, `biennale-yellow`, `midnight-glass`, `aurora-spectrum`, `noir-spotlight`, `bauhaus-print`, `mono-corporate`, `kinetic-bold`, `vapor-chrome`, `bloom-illustrated`. Each has `FRAME.md` (YAML tokens + prose rules) and a preview video/poster under `server/public/frames/<pack>/`.

The selected pack's `FRAME.md` is injected **verbatim** into the composer system prompt as the authoritative design system ("atoms sacred, composition free"). `frame_registry.getPackTokens()` parses the exact hex/font tokens to append a machine-derived **HARD PALETTE LAW** (concrete allowed colors) to the prompt — prose alone wasn't enough on mid-tier models.

> **Note on `bloom-illustrated`:** it's a warm **cream/pastel** system designed for "Sprout," a habit tracker. Its ground is intentionally near-white (`#FFF7EE`). Selecting it for an Amazon video produces a cream background — which is itself part of the "white background" problem (see §7).

---

## 6. Audio

- **TTS/VO** — per-scene narration via OpenRouter chat-completions with audio modality (`config.audio.ttsModel`, e.g. `openai/gpt-audio`), pcm16 → ffmpeg mp3. `vo_fit` re-times/rewrites lines that overrun their scene.
- **Music** — Freesound (`audio_sources.fetchMusic`, filter `duration:[20 TO 180] tag:music`).
- **Mix** (`audio_mix.js`) — music is **faded** (afade in/out) and **ducked** under VO via `sidechaincompress` (VO clips tagged `kind:'vo'`). VO clips + SFX ride the mixer's per-offset mechanism.
- Windows gotcha: the just-rendered MP4 can stay locked; `mixAudioIntoVideo` uses `replaceFile()` (retry rename → copy-over-delete) so audio isn't silently dropped (EPERM).

---

## 7. ⭐ The "white slideshow" diagnosis (2026-06-19 session)

**User report:** *"why is it using same white screen background and same images same assets in every video?? I gave it the URL of the Amazon website but it didn't give me a single image of the Amazon app, and the video it's generating is worse than a slideshow."*

### Root cause (proven by evidence)

Two of the user's actual rendered jobs were inspected on disk (`ryhc6pgtws` = the Amazon one, `de8rzjkuab`). **Both were the deterministic `buildAssetFallback` Ken-Burns slideshow — NOT the premium AI composition.** `ryhc6pgtws` even retained `index.llm-attempt.html` — the rich composition the AI *did* author (browser frames, the Amazon screenshots, full palette) — which was rejected by the gate and overwritten by the slideshow.

**Conclusion:** the composer authors premium HTML, it **fails the gate**, and the pipeline **falls back to the slideshow every time.** That single fact explains every symptom:

| Symptom | Cause |
|---|---|
| Same white/cream background | Fallback ground = the frame pack's lightest token (`#FFF7EE`/`#FFFDF5`). Compounded by `bloom-illustrated` being a cream pack. |
| "Worse than a slideshow" | It *is* the slideshow fallback — images fading in/out. The cinematic composer output never rendered. |
| No Amazon imagery | Real screenshots *were* captured but the slideshow flashes them full-bleed/cropped ~1.7s each, intermixed with generic stock. The "amazon logo" slides were generic stock, not the real logo. |
| Same images/assets every video | `acquire()` always returned the curated library's top hit (`hits[0]`) for a given query → identical files across videos. |

### What was *ruled out* (tested, not guessed)
- **Nested `.clip` elements are NOT a lint error.** A controlled minimal fixture with a clip nested inside a clip lints clean (0 errors). The original attempt fell back for a *different* gate failure (most likely a runtime script throw, or `cqw`-unit / inline-transform issues). The exact cause is unconfirmable because the janitor deleted that job dir mid-session.
- The fallback was correctly *receiving* the assets (it's a real slideshow of them) — the problem is that it's a fallback at all, plus its flat cream styling.

---

## 8. ⭐ Work done this session

### Phase A — Premium Amazon showcase (DONE, gate-passed, rendered)
- **Location:** `server/showcase/amazon-premium/` (`index.html` + `meta.json` + `assets/images/site_0..2.png`).
- **Rendered MP4:** `server/public/videos/amazon-premium-showcase.mp4` → viewable at **`/videos/amazon-premium-showcase.mp4`** (20s, 1280×720, H.264).
- **Verified:** `hyperframes lint` **0 errors** · `hyperframes inspect` **0 errors** · valid JS · rendered clean in 35s. Frames visually confirmed premium.
- **Design (fixes every complaint at the source):**
  - Deep **Amazon squid-ink ground + orange accent** (real brand palette) — not white.
  - Real Amazon screenshots as **browser-framed heroes** (~60% of frame, camera-explored).
  - **5 distinct archetypes:** Hero Reveal → Feature Spotlight (callout chips) → Data (animated counters 75%/₹49/30M+) → Category grid → CTA.
  - 3-layer parallax depth, camera push-ins/pans, dense animated SVG vectors, single seek-safe caption node, scenes sequential (no cross-scene occlusion).
- **Purpose:** the quality bar + a golden few-shot example for the generator; proof the constraints are satisfiable.

### Phase B — Generator hardening (in progress)
- ✅ **Asset diversity fix** — `asset_sources/index.js`: `acquire()` now samples among the **top-4** curated matches instead of always `hits[0]`. Kills "same images every video." Tested (module loads; curated returns 8 distinct hits for common queries).
- ✅ **New OpenRouter key** installed in `server/.env` (`OPENROUTER_API_KEY`).
- ⏳ **Remaining (ready on user's go):**
  1. Inject the showcase as a **golden few-shot example** (via `composer.js`, not the user-edited `system_composer.md`) — highest-leverage reliability lever.
  2. **Fallback upgrade** — brand-dark ground + browser-framed screenshots so even the safety net isn't a white slideshow.
  3. **Brand-aware frame selection** — use the `brandColors` already extracted by `ingest/website.js` (currently ignored) so Amazon stops getting the cream pack. Biggest fix for "white background."

> **All server-side changes require a server RESTART** — config + code are loaded once at boot.

---

## 9. Operational notes

### Secrets — `server/.env` (gitignored)
Rotate keys here only (no code/config edits). `config.js` loads it at module top via `process.loadEnvFile()`, then **re-applies real shell exports** (a shell `OPENROUTER_API_KEY` overrides the file). Keys present: `OPENROUTER_API_KEY`, `KIE_API_KEY`, `RAPIDAPI_KEY` (code path removed 2026-06-17), `PIXABAY_API_KEY`, `FREESOUND_TOKEN`, `MEDIA_PROVIDER=pixabay-api`.

### LLM provider chain (`services/openrouter.js chat()`)
`KIE Gemini` (only if `config.llm.primary` + `KIE_API_KEY`; per memory KIE is **exhausted** → fails fast) → **OpenRouter primary** (`modelForStage(stage)` / `config.llm.model`) → **OpenRouter secondary** (`config.llm.modelFallback`). `checkBudget()` blocks jobs when the key's spend is exhausted (≈ daily-cap keys). The **composer stage** runs on `config.json llm.stageModels.composer` — which has cycled (opus-4.8 → gemini-2.5-pro → nemotron → … ; `config.json` is gitignored so it changes without git trace). OpenRouter pre-charges against `max_tokens` → set per-stage caps.

### Windows quirks
- **spawn EINVAL:** Node ≥18.20 throws `EINVAL` spawning `.cmd` (e.g. `npx.cmd`) without `shell:true` (CVE-2024-27980). `validator.js`/`renderer.js` use `shell: WINDOWS`. With `shell:true`, hard-kill the tree via `taskkill /PID <pid> /T /F`.
- **FFmpeg** via `winget install Gyan.FFmpeg`; background shells must refresh PATH before `node server.js`.
- HyperFrames CLI: `npx --yes hyperframes …` (render quality flags: `draft|standard|high`).

### Useful commands
```bash
# Lint / inspect / render any composition dir (cwd = the dir with index.html + meta.json + assets/)
npx --yes hyperframes lint
npx --yes hyperframes inspect --json --at-transitions --tolerance 4 .
npx --yes hyperframes render --output renders/out.mp4 --quality high

# Re-index the curated asset library (from server/)
node -e "require('./src/services/asset_sources/curated_library').buildIndex()"

# View the premium showcase (server running on :8080)
#   http://localhost:8080/videos/amazon-premium-showcase.mp4
```

### Key file map
| Concern | File |
|---|---|
| Classic 4-tier pipeline | `server/src/services/pipeline.js` |
| Project two-act flow | `server/src/services/project_pipeline.js` |
| 12-agent graph (live path) | `server/src/agents/graph.js` |
| Composer (LLM → HTML) | `server/src/services/composer.js` + `prompts/system_composer.md` |
| Deterministic fallback | `server/src/services/fallback.js` |
| Safe rewrites pre-lint | `server/src/services/normalize.js` |
| Lint + spatial inspect | `server/src/services/validator.js` |
| Runtime smoke check | `server/src/services/runtime_check.js` |
| Asset acquire | `server/src/services/asset_sources/index.js` (+ `curated_library.js`) |
| Website ingest | `server/src/services/ingest/website.js` |
| Render → MP4 | `server/src/services/renderer.js` |
| Audio mix | `server/src/services/audio_mix.js` |
| Frame packs | `frames/<pack>/FRAME.md` + `services/frame_registry.js` |
| Config + env load | `server/src/config.js` (+ `server/.env`, `server/config.json`) |
| Server entry / queue | `server/server.js` |

---

## 10. Known open risks
- **Composer reliability** — the composer's premium output still fails the gate often → fallback. The golden-example injection (Phase B #1) is the main mitigation.
- **Daily key cap** — OpenRouter daily spend caps 402 the opus composer/TTS until reset.
- **Janitor deletes `jobs/`** — manual job dirs are swept; use `server/showcase/` for durable artifacts.
- **Frame/brand mismatch** — pack selection ignores extracted brand colors.
- Minor: SPA has no history-fallback (deep-link refresh 404s); QA stage has no budget signal.

---

# Appendix — Full project memory (verbatim)

> These are the persisted memory notes (`~/.claude/.../memory/`). Each is a point-in-time observation with its own date; newer notes supersede older ones where they conflict.

## A. keyframe-project-state (project, ~6 days old)
KEYFRAME is a multi-modal AI video studio built per an 8-phase plan (repo `PLAN.md`, 2026-06-12). Monorepo: `server/` (Node 22 backend, port 8080), `web/` (Phase 6), `frames/` (design-system packs). ALL 8 PHASES COMPLETE as of 2026-06-12. Definition of done met via headless-Chrome E2E on the production build (pasted nodejs.org → understanding → edited scene-1 VO → approved → MP4+SRT; STT confirms the UI-edited line). Multi-agent architecture validated end-to-end: production runs through a LangGraph StateGraph (`agents/graph.js`; `config.orchestrator langgraph|classic`) — frame_selector fans out [storyboard→scene_planner], [asset_planner→asset_search], [voice]; join → composition → animation audit → timeline → QA agent (vision review of rendered frames, one repair lap). Hard-won: hyperframes render quality flag is `draft|standard|high`; GSAP composes xPercent with existing CSS transforms — never bake transform/clip-path hidden states (only `opacity:0`); OpenRouter pre-charges affordability against `max_tokens`; gpt-audio TTS needs $0.50 min balance. Keys in `server/config.json` (gitignored). Local asset DB checked FIRST, web providers as fallback. `keyframe-studio/` (port 8090) is a separate user prototype — leave untouched.

## B. keyframe-windows-quirks (project, ~7 days old)
Running the HyperFrames pipeline on Windows 11 (Node 22.20.0) requires: **spawn EINVAL fix** — Node ≥18.20 throws EINVAL spawning `.cmd` without `shell:true` (CVE-2024-27980); fixed in `validator.js`/`renderer.js` with `shell: WINDOWS`; with shell:true the watchdog kills the shell not the npx tree → use `taskkill /PID <pid> /T /F`. **FFmpeg** via `winget install Gyan.FFmpeg`; background shells must refresh PATH before `node server.js`. HyperFrames CLI works via `npx --yes hyperframes` (0.6.93 verified). `fs.statfsSync` unavailable on Windows — health.js handles null.

## C. keyframe-solstice-theme (project, ~7 days old)
On 2026-06-12 the user supplied `hello.zip` ("solstice-port"); the dark-studio UI identity was replaced by **Solstice**: light colorful glass, Bricolage Grotesque display, coral primary (#ff6b57), six pastel department accents, and a fixed `<SolsticeSky/>` where the workflow drives time of day — create=dawn, script=noon, theater=golden hour, **premiere=always midnight** (`.solstice-night` flips ink/dim/panel/line tokens). **How to apply:** styling relies on semantic tokens (`text-ink`, `bg-panel`, `border-line`, `text-accent`) + css recipes `glass-card`, `btn-solstice`, `chip`, `inset-field` + keyframes; new UI work uses these, never hard-coded colors. The user actively uses the app (gallery has their own videos) — treat the running server + `jobs.json` as live user data.

## D. keyframe-showcase-reference (reference, ~4 days old)
A flagship, lint-clean, fully-rendered reference composition lives at `server/jobs/keyframe-showcase/` (`script.json` + `index.html` + `meta.json` + `renders/out.mp4` + `_validate.mjs` + `README.md`) — a 33s/1920×1080/30fps launch film, self-contained (GSAP + procedural Three.js + inline SVG/CSS). Use as the quality bar / few-shot example. **Gotcha:** `npx hyperframes lint` raises `missing_three_script` as an ERROR for the ESM `import * as THREE from ".../+esm"` pattern the prompt documents — the linter requires a CLASSIC UMD `<script src=".../three.min.js">` tag. Expected lint *warnings* (not errors): `gsap_studio_edit_blocked` (the mandatory `window.__timelines["vid"]` registration), `google_fonts_import`, `composition_file_too_large`. The render engine dispatches `hf-seek` on every seek — drive a Three `<canvas>` from a `hf-seek` listener, NOT a GSAP `onUpdate` (`tl.seek()` suppresses those).

## E. keyframe-composition-fallback-fragility (project, ~2 days old)
In the multi-agent path, `compositionAgent`'s catch ships the deterministic `buildFallback` whenever `attemptLlmComposition` throws for ANY reason; the error was only `console.warn`'d. 2026-06-16: an uncommitted "cinematic" gate caused every run to fall through to the bare fallback ("no image, no assets, no animations") — proven the model output was fine (the discarded `index.llm-attempt.html` passed lint + rendered standalone). Reverted to `40e6742`. 2026-06-17: recurred ("only sound, no images") on `xd6iiplb5i`: composer (cheap `gemini-2.5-flash-lite`) produced a rich comp that PASSED quickCheck but FAILED `hyperframes lint` (37 errors, dominated by `overlapping_clips_same_track`), then the repair regenerated from scratch and dropped `window.__timelines["vid"]` → threw → procedural fallback. Fixes shipped: **asset-aware fallback** (`buildAssetFallback` — Ken-Burns slideshow of REAL images + logo outro + captions, lint-clean + runtime-clean); **font contradiction removed** (system-font stack + `normalize.js stripExternalFonts`); **repair hardened** (MUST-KEEP block); **lint errors logged**. 2026-06-17 (later) REAL FIX: the composer was running on `gemini-2.5-flash-lite` (config.json untracked, model changes silently) → can't pass the lint on ANY hyperframes version → fallback every time. Fix: route composer to a top-tier model (`config.json llm.stageModels.composer = anthropic/claude-opus-4.8`); verified end-to-end (6/6 assets incl 2 vectors, 66 tweens, 0 lint errors, runtime ok). **REQUIRES SERVER RESTART.**

## F. keyframe-runtime-blank-video (project, ~3 days old)
A composition can pass quickCheck + hyperframes lint (both static/regex) and still render a **completely blank video** if its GSAP `<script>` throws at runtime: the throw happens before `window.__timelines["vid"] = tl`, the timeline never registers, every `opacity:0` entrance stays hidden. Real instance: the composer emitted `this.target()[0].getTotalLength()` — `this.target()` is not a GSAP method → throws. Correct signature is `function(index, element, targets)` — read element from the 2nd arg. Fix: `services/runtime_check.js runtimeCheck(jobDir)` serves the dir over ephemeral localhost, loads in headless Chromium, fails on any `pageerror` or missing `window.__timelines["vid"]`; never hard-fails on missing chromium. Wired into `composeWithLintRepair` after lint; one repair lap then escalate. `system_composer.md` got a RUNTIME SAFETY rule.

## G. keyframe-template-gallery-assets (project, ~3 days old)
Built 2026-06-16. "Template styles" == frame packs. 10 packs in `frames/`. Each has `FRAME.md` + a rendered preview video/poster at `server/public/frames/<pack>/`. `/api/frames` returns per-pack metadata. Web `CreateScreen.jsx` renders a hover/scroll-autoplay preview gallery; "Auto / Surprise me" → `framePack:"auto"` → brief's `suggestedFramePack`. **Curated asset library** (~2.7 GB, gitignored `server/asset_library/`, ~9.8k files): `curated_library.js buildIndex()` writes `index.json` (topic+keyword tokens); `search({query,type,kindPref,excludeIds,limit})` with a strong relevance gate; `materialize()` keeps the real ext. Wired as the #1 source in `acquire()` before cache + web providers. `assetSearchAgent` passes `kindPref` from `need.role` and a shared `excludeIds` Set. Re-index: `node -e "require('./src/services/asset_sources/curated_library').buildIndex()"`.

## H. keyframe-frontend-skill-preference (feedback, ~2 days old)
On KEYFRAME, whenever work touches the frontend (`web/`, React screens, `index.css`, Solstice theme, frame-pack visuals), proactively invoke the relevant frontend & UI/UX skills (frontend-design, ui-ux-pro-max, refactoring-ui, etc.) WITHOUT being asked. **Why:** user said (2026-06-17) "use all the required frontend and ui ux skills that you think is required without even i am telling you." Don't over-invoke on pure backend tasks. Honor the Solstice tokens/glass recipes.

## I. keyframe-env-secrets-rapidgemini (project, ~2 days old)
Secrets load from gitignored `server/.env` (template `.env.example`). `config.js` calls `process.loadEnvFile()` at module top, then re-applies real shell exports (shell wins). LLM chain (`openrouter.js chat()`): KIE Gemini (optional primary, only when `config.llm.primary` + `KIE_API_KEY`) → OpenRouter primary (`config.llm.model`) → OpenRouter secondary (`config.llm.modelFallback`). A caller can force a model via `chat({model})`, bypassing KIE. **RapidAPI Gemini was REMOVED 2026-06-17** (config block, env override, dispatch branch all deleted). Env vars wired in `config.js build()`: `OPENROUTER_API_KEY`, `KIE_API_KEY`, `PIXABAY_API_KEY`, `FREESOUND_TOKEN`, `MEDIA_PROVIDER` (promotes a provider to front of the order).

## J. keyframe-terminal-typing-tech (project, ~2 days old)
Added 2026-06-17: tech/IT topics get a terminal/code-editor window typing a command char-by-char with a blinking caret. Implemented in two SYSTEM PROMPTS only (`system_storyboard.md` detects tech → emits one `animation:"typewriter"` scene; `system_composer.md` has the full lint+runtime+seek-safe GSAP snippet). **Gotcha:** there is NO lint-safe monospace font — `normalize.js normalizeFontFamilies()` rewrites every `font-family` (even bare `monospace`) to the sans stack. So the "mono" look is faked structurally with `white-space:pre` + `letter-spacing:0.08em` + `font-variant-numeric:tabular-nums`. **Seek-safety:** the renderer scrubs the paused timeline both directions; per-line tweens leave stale text on backward scrub → use ONE master-time proxy tween whose single `onUpdate` recomputes every line via `slice(0, charsAt(...))`; carets one-per-line, finite repeat+yoyo `steps(1)`, scene-start `opacity:0` resets. Window chrome uses ACTIVE pack tokens (no macOS dots, no `#1e1e1e`).

## K. keyframe-vector-gap (project, dated 2026-06-17→18)
Audit 2026-06-17: videos use images/videos well but **vectors were effectively absent** despite the prompt demanding ≥6 SVG per scene. Three failure modes: (1) composer doesn't author SVG even on a clean success — `quickCheck()` never *required* `<svg>`; (2) fallback strips 100% of vectors (image-only slideshow); (3) curated 2,197-svg library never used (asset planner only requested background/inset roles; scoring soft-biased photos). **Fixes (2026-06-17→18):** `composer.js` `MIN_VECTOR_PRIMITIVES=6` — `quickCheck()` rejects <1 `<svg>` or <6 primitives (counted inside `<svg>…</svg>`), skipped on repair passes; `fallback.js vectorVfxLayer()` adds an always-on animated SVG layer; `assetPlannerAgent` vector gap-fill (derived `role:"icon"` need) + own slice budget; `curated_library.js` `kindPref:"vector"` HARD restrict. **Composer model history** (`config.json stageModels.composer`): opus-4.8 → gemini-2.5-pro → nemotron-3-ultra → … (config untracked, changes silently). **Two runners:** `/api/generate` → `pipeline.runJob` (dead UI-wise); project/website → `graph.js runProductionGraph` (the live path). `normalize.js reflowTrackOverlaps()` added — deterministic fix for the systemic `overlapping_clips_same_track`. REQUIRES SERVER RESTART.

## L. keyframe-flow-audit-fixes (project, 2026-06-18)
Multi-agent audit of the live path (`/api/projects` → `graph.js`). **Overlap:** the gate ran only lint + runtimeCheck, never `hyperframes inspect` (spatial). Added `validator.js runInspect` (parse STDOUT JSON, gate on `severity==='error'`/`text_occluded`); `pipeline.js gateComposition` ships inspect-only failures on the final lap; decorative overlays use `data-layout-allow-occlusion`; `qa_agent.js` BLOCKER #7 collision; `system_composer.md` constraint #16 (flex/grid+gap). **Audio:** `ttsModel` → `openai/gpt-audio`; `pickVoice` rewritten to real `AUDIO_VOICES`; delivery `instructions` a spoken direction. **Music:** `audio_mix.js` faded + ducked via `sidechaincompress` (VO `kind:'vo'`); `fetchMusic` filter `tag:music`; `defaultMusicVolume` 0.15→0.22. **FLAGSHIP SHOWCASE** (persistent): `server/showcase/flagship/index.html` — 19s/1280×720 KEYFRAME promo, real screenshot + 3 photos + 4 svg + 3 illustrations + 5 SVG layers + counting stat + 62 tweens, passes lint+runtime+inspect; rendered → `public/videos/flagship.mp4`. **gemini "lazy stop":** `gemini-2.5-flash` intermittently returns 200-OK with truncated JSON → `openrouter.js callOnce` now validates completions and throws `retryable=true`; `script.js` attempt-2 escalates to `gemini-2.5-pro`.

## M. keyframe-distilled-composer-procedure (project, 2026-06-19)
To let a CHEAP composer model match a thinking model, the strong-model "thinking" was distilled into an explicit recipe in `system_composer.md`. **Phase 1 shipped:** new `## COMPOSITION DECISION PROCEDURE` (STEP 0→11 + fast path): kind→archetype lookup, one-track-per-scene rule, camera-move-per-archetype table, screenshot sizing table (≥52%), cadence offsets, decoration caps, mechanical self-verify mirroring `quickCheck`; compressed the PREMIUM LAW prose to an 8-line checklist. `config.json llm.temperatureByStage.composer: 0.2`. `composer.js quickCheck`: reject `repeat:-1` early; missing `window.__timelines["vid"]` → "output was CUT OFF, make it SHORTER" hint. **Phase 2 (NOT built):** `archetype` enum into `system_storyboard.md`; a `system_planner.md` cheap pre-pass emitting per-scene JSON + pure-JS `plan_validate.js`; harden `parseEnvelope`; add paste templates + a `flagship_product_golden.html` browser-frame fixture. QA vision lap (blockers #7–#10) stays the net for rendered-pixel failures.
