# KEYFRAME Template Library + Motion Engine — status

The video pipeline is now **Template-Library-driven**: the AI Director picks a scene `kind`, the
renderer resolves it to a professionally-built template via `engine3d/templates/registry.ts`
(`componentForKind`). No scene is composed from scratch. `selectTemplate(text)` maps free text →
template id (keyword-scored) for director/testing use.

Pipeline: User Input → AI Analysis → Script → **Scene kind (Director)** → **Template (registry)** →
Content Injection (scene fields) → Three.js Scene Builder (scene component) → Motion Engine
(transitions + camera + particles) → Remotion render → MP4.

## The 15-template library (status)
| # | Template | id | Status | Component |
|---|----------|----|--------|-----------|
| 1 | Hero Reveal | `hero` | ✅ ready | HookScene (+ LogoReveal for logo) |
| 2 | URL → Video | `url-to-video` | ✅ ready | UrlToVideoScene (browser + scan + section extraction) |
| 3 | Prompt → Video | `prompt-to-video` | ✅ ready | PromptToVideoScene (terminal typing + pipeline assembly) |
| 4 | Asset Showcase | `asset-showcase` | ✅ ready | ImageHeroScene / LogoRevealScene |
| 5 | Feature Showcase | `feature` | ✅ ready | Feature3DScene (3D cards) · FeatureGridScene (`feature-dom`) |
| 6 | Dashboard Showcase | `dashboard` | ✅ ready | DashboardScene |
| 7 | Production Workflow | `workflow` | ✅ ready | WorkflowScene (nodes + flow + pulse) |
| 8 | AI Production Studio | `ai-studio` | ✅ ready | AiStudioScene (agent ring + pulse) |
| 9 | Before vs After | `before-after` | ✅ ready | ComparisonScene |
| 10 | Statistics | `stat` | ✅ ready | StatScene |
| 11 | Timeline Story | `timeline` | ✅ ready | TimelineScene (playhead + event cards) |
| 12 | Testimonial | `testimonial` | ✅ ready | TestimonialScene (quotes + star rating) |
| 13 | Comparison Grid | `comparison` | ✅ ready | ComparisonScene |
| 14 | Showcase Gallery | `gallery` | ✅ ready | GalleryScene (floating video carousel) |
| 15 | Final CTA | `cta` | ✅ ready | CtaScene |

**ALL 15 templates now have dedicated production components** (verified on render). Each is
registered with id + keywords so the AI Director can target it, and resolves via `componentForKind`.

## Motion Engine (implemented)
- **Entrance/Exit + Transitions** (`engine3d/transitions/index.tsx`) — all 10: slide L/R/T/B, zoom-through,
  rotate-3d, parallax, card-stack, portal, morph. Every seam OVERLAPs 0.8s (outgoing exit + incoming
  entrance together) → never a hard cut.
- **Camera presets** (`engine3d/core/camera.tsx`) — hook-push (dolly-in), pull-back (dolly-out),
  punch-in, dolly-lateral (truck/parallax). Frame-driven.
- **Particles** (`ParticleField` + `MotionStreaks`) — floating dots, connecting lines, vertical
  data-streams, diagonal light-streaks. On depth layers.
- **Depth** (`core/depth.ts`) — background/particles/shapes/cards/text/foreground Z-planes; camera
  moves through them for real parallax.
- **Content density** — every scene carries hero + supporting copy + secondary block (chips / metrics /
  cards) targeting 70–85% occupancy; `DomBlocks` + per-template layouts.

## Roadmap (polish, not gaps)
All 15 templates are built. Future polish: port more DOM content to 3D meshes; true infinite-scroll
carousel for Gallery; per-template camera character; and the one live LLM-as-Director run (blocked
on the KIE key's daily quota).

## Live-verify pending
The storyboard LLM now knows the Director role + all kinds (system_storyboard.md), but a live
end-to-end run is blocked by the KIE Gemini key's daily quota — retry when it resets.
