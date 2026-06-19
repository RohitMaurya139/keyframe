---
version: alpha
name: Bloom Illustrated — Frame
description: >
  A warm, friendly, illustration-forward SaaS system: cream paper grounds, big soft
  pastel blobs drifting behind everything, and generously rounded cards (28px+). Simple
  hand-drawn-feel inline-SVG characters and objects — circles and organic paths — carry
  personality; coral is the single confident accent. Bricolage Grotesque is the smiling
  display, Inter the calm body. Gentle, bouncy, human — for "Sprout," a team habit/OKR tracker.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  cream: "#FFF7EE"
  peach: "#FFD9C0"
  coral: "#FF7E6B"
  sky: "#76C7E8"
  leaf: "#7CC576"
  plum: "#6B5BD2"
  ink: "#2B2540"

typography:
  body:      { fontFamily: "Inter", cqw: 0.95, weight: 400, lineHeight: 1.6, color: "ink" }
  body-lede: { fontFamily: "Inter", cqw: 1.2, weight: 500, lineHeight: 1.55, color: "ink" }
  label:     { fontFamily: "Bricolage Grotesque", px: 12, weight: 700, tracking: "0.14em", upper: true, color: "ink" }
  card-title:{ fontFamily: "Bricolage Grotesque", cqw: 1.4, weight: 700, lineHeight: 1.2, color: "ink" }
  heading-md:{ fontFamily: "Bricolage Grotesque", cqw: 2.4, weight: 700, lineHeight: 1.15 }
  heading-lg:{ fontFamily: "Bricolage Grotesque", cqw: 3.6, weight: 800, lineHeight: 1.05 }
  heading-xl:{ fontFamily: "Bricolage Grotesque", cqw: 5.0, weight: 800, lineHeight: 1.0 }
  stat-number:{ fontFamily: "Bricolage Grotesque", cqw: 4.4, weight: 800, lineHeight: 1.0, color: "coral" }

spacing:
  slide-pad: "4cqw"
  gap-md: "1.8cqw"
  card-radius: "28px"

components:
  cream-ground:
    backgroundColor: "{colors.cream}"
    overlay: "1-2 large soft pastel blobs drifting (see blob-field)"
    rounded: "0"
    description: "The universal warm canvas — cream, never pure white, never gray. The ONE rule: it is always lit by at least one soft blob; a bare cream rectangle reads as a blank doc, not a Bloom frame."
  blob-field:
    fill: "1-2 large organic blob shapes in {colors.peach} / {colors.sky} / {colors.leaf} / {colors.plum}, 30-55% opacity, blur 60-100px"
    shape: "rounded organic SVG path (no sharp corners), 40-70% of frame, drifting off ≥1 edge"
    description: "THE atmosphere: big pillowy pastels floating behind content like balloons. The ONE rule: blobs are soft and edgeless (blur + low opacity), never a hard flat shape — they set mood, they don't compete with cards."
  bloom-card:
    backgroundColor: "{colors.cream} lifted (or pure white #FFFFFF) "
    border: "none"
    rounded: "28px"
    shadow: "soft, large-radius, low-opacity {colors.ink} drop shadow (e.g. 0 18px 50px rgba(43,37,64,0.10)) — pillowy, never hard"
    description: "The surface. Content sits on a friendly rounded pillow that floats gently above the blobs. The ONE rule: radius ≥ 28px and the shadow is soft and diffuse — a sharp or tight shadow makes it cold and corporate."
  svg-illustration:
    style: "simple, friendly inline-SVG — circles + organic paths, 2-4 flat pastel fills, rounded line-caps, a {colors.coral} accent and tiny {colors.ink} facial/detail marks"
    subjects: "a sprout/plant, a smiling character, a check/target, drifting leaves or stars — line weight rounded, never thin & technical"
    description: "The personality: a small hand-drawn-feel scene or object per frame. The ONE rule: keep it simple and rounded (think 3-5 shapes, friendly), and let it OVERLAP a card edge or blob so it feels placed in the scene, not pasted in a box."
  accent-pill:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.ink}"
    rounded: "9999px"
    typography: "{typography.label}"
    description: "The universal eyebrow/tag — a soft peach capsule, often with a tiny {colors.coral} or {colors.leaf} dot. The ONE rule: fully rounded (9999px) and pastel-filled; it labels, it never shouts."
  stat-bloom:
    composition: "bloom-card holding a {typography.stat-number} in {colors.coral} + a {typography.label} caption + a small svg-illustration or {colors.leaf} progress arc"
    description: "Numbers grow. A big coral figure on a soft card, paired with a friendly glyph or a rounded progress arc. The ONE rule: the number is coral, the caption is ink — warm, encouraging, never a cold dashboard tile."
  cta-button:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.cream}"
    rounded: "9999px"
    shadow: "soft {colors.coral} glow (0 10px 30px rgba(255,126,107,0.35))"
    typography: "Bricolage Grotesque 700"
    description: "The ONE filled-coral element — a single rounded pill CTA in the closer, with a gentle coral halo. The ONE rule: solid coral lives HERE and nowhere else as a big fill; the button is pill-shaped and softly glowing, inviting a happy tap."
---

# Bloom Illustrated — Frame

## Overview

Bloom Illustrated is a **warm, illustration-forward SaaS** system — the friendly end of the modern product spectrum, where Notion's calm, Duolingo's cheer, and Headspace's softness meet. The feeling is an optimistic onboarding flow on a sunny morning: cream paper, big pillowy pastel blobs drifting behind everything, generously rounded cards, and simple hand-drawn-feel SVG characters that give the product a heartbeat. Type is **Bricolage Grotesque** — a display face with a little smile in it — over calm **Inter** body. The product is **Sprout**, a team habit and OKR tracker, and the voice is **warm, optimistic, human**: it cheers you on. Failure looks like a cold enterprise dashboard — pure-white background, tight square cards, hard shadows, no illustration, no blob, gray everywhere. If it feels like a stern admin panel, it has failed; Bloom should feel like a hug.

## Colors

`{colors.cream}` is the ground on **every** frame — warm, never `#FFFFFF` as a full background, never gray. `{colors.ink}` (a soft warm near-black plum) is **all** text — there is no second text color; legibility and warmth both come from `{colors.ink}` on cream or on cards. The four **pastels** — `{colors.peach}`, `{colors.sky}`, `{colors.leaf}`, `{colors.plum}` — are the soft scene: blob atmosphere, pill fills, illustration fills, and progress arcs. `{colors.coral}` is the **single confident accent**: the one saturated color, reserved for the moment that matters.

**The ONE accent rule:** coral appears as a *real fill* exactly once per frame — the CTA, OR the key stat number, OR one illustration highlight, never all of them. Everything else stays cream/ink with pastel support. **Forbidden:** pure-white full grounds, gray neutrals, dark mode, hard high-contrast color blocking, neon or muddy tones, more than one coral fill per frame, and pastels at full saturation (they must stay soft).

**Text color law:** ALL text is `{colors.ink}` on cream or on a `bloom-card` (there is no second text color); `{colors.coral}` is the one accent fill (the lead stat number, the CTA, or one illustration highlight — once per frame), never a paragraph, label, or full headline, and pastels are never text. Any text over an image/blob sits on a `bloom-card` or clear cream (ink on the light surface), never raw on a busy image or a blurred blob.

## Typography

- **Display:** Bricolage Grotesque only, weights 700/800, friendly and a touch rounded — `card-title` 1.4cqw → `heading-md` 2.4cqw → `heading-lg` 3.6cqw → `heading-xl` 5.0cqw. Sentence case (warm), gentle line-height (1.0–1.2). Fit-to-measure: ≤3 words → `heading-xl`; 4–6 → `heading-lg`; 7+ → `heading-md`. Cap display blocks at ≤ 78cqw.
- **Body:** Inter 400/500 in `{colors.ink}`, line-height 1.55–1.6 for an easy, breathing read. **Labels:** Bricolage Grotesque 700, modest 0.14em tracking, uppercase, inside `accent-pill`s.
- **Legibility floor:** load-bearing lines ≥ 1.4cqw; px labels are chrome only. **Banned:** italics for emphasis, all-caps display headlines, thin weights (<400) on anything load-bearing, condensed/technical sans, serifs, and any text set directly on a blurred blob (give it a card or clear cream).

## Depth & Surface

Depth is **soft and pillowy** — the opposite of flat and the opposite of glassy. The model is a **gentle drop shadow**: every `bloom-card` casts a large-radius, low-opacity, *barely-offset* shadow (e.g. `0 18px 50px rgba(43,37,64,0.10)`) so it floats like a cushion. Behind the cards, the `blob-field` adds blurred pastel atmosphere — depth from *distance and blur*, not from lines. **The surface law:** content lives on `bloom-card`s (or directly on cream with generous air); cards are rounded ≥28px and never hard-edged. **Ceiling:** no tight/dark/hard shadows, no glassmorphism (no frosted blur on cards — that's a different pack), no inset bevels, no neumorphism. If an edge feels sharp, soften the radius or the shadow.

## Shapes

- **Rounded everything — strict.** Cards ≥ 28px radius; buttons and pills fully rounded (9999px); icon containers and inputs ≥ 16px. There are **no** sharp corners on UI surfaces.
- **Signature shapes:** the big soft **blob** (organic, edgeless, drifting) and the **circle** — circles host illustrations, avatars, dots, and progress arcs.
- **Illustrations** are built from circles + organic paths with rounded line-caps; they may overlap card and blob edges to feel placed in the scene.

## Frame Treatments

> Recipe per frame: cream ground + 1-2 soft blobs · 1-3 bloom-cards · ONE coral moment · a friendly SVG illustration · accent-pill chrome · generous air.

1. **Cover** — Cream ground lit by a large `peach`/`sky` `blob-field` drifting upper-right; an `accent-pill` eyebrow over a 2-line Bricolage `heading-xl`; a friendly `svg-illustration` (a sprout or smiling character) overlapping the lower-right, partly off a blob. ~55% open warmth. Coral lives only in the illustration here.
2. **Feature** — Three `bloom-card`s in a row (stack on 9:16), each with a small `svg-illustration` glyph in a pastel circle, a `card-title`, and 2-line Inter body. Blobs glow low behind the row; headlines stay `{colors.ink}`.
3. **Stat** — One to three `stat-bloom` cards: a big coral `stat-number` with a `{colors.leaf}` progress arc or tiny illustration and an ink caption. Numbers come from the script — placeholders otherwise.
4. **Quote** — A single centered wide `bloom-card` holding a Bricolage `heading-lg` quote in `{colors.ink}`; a soft `plum`+`sky` blob blooms behind; a small avatar-circle illustration + `accent-pill` carry the attribution. ~60% open.
5. **Closing** — Centered `bloom-card`: a `heading-lg` sign-off plus the `cta-button` — the frame's ONLY filled-coral element — with a soft coral glow; a celebratory `svg-illustration` (sprout in bloom, drifting leaves) frames it. Brightest blobs center behind.

## Composition Rules

### Do
- Start on **cream** and light every frame with 1-2 soft, blurred pastel blobs drifting off an edge.
- Float content on **rounded `bloom-card`s** (≥28px) with soft pillowy shadows; keep generous air (~50% open).
- Add **one friendly SVG illustration** per frame; let it overlap a card or blob edge to feel placed in the scene.
- Spend **coral once** — CTA, key stat, or one illustration highlight; everything else cream/ink with pastel support.
- Set display in **Bricolage Grotesque sentence case**; body in Inter; chrome in soft `accent-pill`s.

### Don't
- No pure-white full grounds, no gray neutrals, no dark mode, no hard color blocking.
- No sharp corners on cards/buttons; no tight or dark shadows; no glassmorphism, neumorphism, or inset bevels.
- No second coral fill in a frame; no full-saturation pastels; no neon or muddy tones.
- No text on a blurred blob; no all-caps or italic display; no thin/condensed/serif type.
- Don't ship a frame with no illustration and no blob — that's the cold-dashboard failure mode.

## Pre-Render Self-Audit

- **Ground & atmosphere** — cream (never full-white) with 1-2 soft blurred pastel blobs; the frame feels lit and warm, ~50% open.
- **Surface** — content on rounded `bloom-card`s (≥28px radius) with soft, large-radius, low-opacity shadows; nothing sharp or glassy.
- **Illustration** — exactly one simple, friendly SVG scene/object is present and overlaps a card or blob edge.
- **Accent** — coral appears as a real fill exactly once (CTA OR stat OR illustration highlight); pastels stay soft, never full-saturation.
- **Type** — Bricolage Grotesque 700/800 sentence-case display, Inter body, soft pill labels; ≥1.4cqw floor; no text on blobs.
- **Fabrication** — every numeral/stat traces to the script, else a placeholder.
