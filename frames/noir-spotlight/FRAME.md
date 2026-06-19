---
version: alpha
name: Noir Spotlight — Frame
description: >
  Cinematic dark luxury — a product film lit by one theatrical spotlight. Near-black
  void grounds, a single drifting volumetric beam that reveals the hero, deep falloff
  shadows, gold hairline accents, and a film-grain vignette over everything. Fraunces 700
  serif display, Inter body, JetBrains Mono labels. Depth is light, not flat. Motion is
  out of scope (the composer adds drift); this defines the still design system.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  void: "#08080B"
  charcoal: "#14141A"
  smoke: "#2A2A33"
  bone: "#F4F1EA"
  ash: "#9A9AA6"
  gold: "#E8B23A"
  crimson: "#D8443C"

typography:
  # — reading + label ramp —
  body:    { fontFamily: "Inter", cqw: 0.9, weight: 400, lineHeight: 1.55, color: "ash" }
  body-lede:{ fontFamily: "Inter", cqw: 1.05, weight: 400, lineHeight: 1.5, color: "bone" }
  label:   { fontFamily: "JetBrains Mono", px: 12, weight: 500, tracking: "0.30em", upper: true }
  credit:  { fontFamily: "JetBrains Mono", px: 12, weight: 400, tracking: "0.12em", opacity: 0.7 }
  # — display ramp (Fraunces 700, cinematic serif, tight) —
  heading-md:{ fontFamily: "Fraunces", cqw: 2.2, weight: 700, lineHeight: 1.12, tracking: "-0.005em" }
  heading-lg:{ fontFamily: "Fraunces", cqw: 3.4, weight: 700, lineHeight: 1.04, tracking: "-0.012em" }
  heading-xl:{ fontFamily: "Fraunces", cqw: 4.8, weight: 700, lineHeight: 0.98, tracking: "-0.018em" }
  stat-number:{ fontFamily: "Fraunces", cqw: 6.0, weight: 700, lineHeight: 0.96, tracking: "-0.02em" }

spacing:
  slide-pad: "4cqw"
  gap-md: "1.8cqw"

components:
  spotlight-cone:
    background: "radial gradient {colors.bone} at 16–22% opacity core → {colors.gold} at 6% → transparent ~55%, on {colors.void}"
    size: "45–75% of the frame, angled from a top corner toward the hero element"
    description: "THE depth device. One soft volumetric beam reveals the focal element; everything else falls to void. A flat, evenly-lit frame is a failure."
  vignette-grain:
    overlay: "radial dark vignette ({colors.void} 0% → 55% edge) + 2–4% film-grain texture, screen-wide, above all layers"
    description: "Always-on cinematic finish. Every frame wears the vignette + grain; without it the look reads as plain dark-mode."
  label-chip:
    backgroundColor: "transparent"
    border: "1px solid {colors.gold} at 28%"
    rounded: "9999px"
    typography: "{typography.label}"
    textColor: "gold"
    description: "The eyebrow — mono caps in gold, wide-tracked, in a thin gold-hairline pill. The only routine gold text."
  gold-hairline:
    rule: "1px solid {colors.gold} (soft: {colors.gold} at 24%)"
    description: "The accent line — a short underline beneath the key word, a stat rule, a frame edge. The signature gold gesture; 1px only."
  hero-stage:
    backgroundColor: "{colors.charcoal} → {colors.void} falloff, no hard edge"
    border: "none; defined by the spotlight, not a box"
    description: "Where the product/hero sits — caught in the beam, raised by light and a deep falloff shadow beneath, never on a card."
  stat-block:
    composition: "{typography.stat-number} in {colors.bone} + gold-hairline rule + {typography.label} caption"
    description: "Numbers lit large in bone with a single gold rule beneath. Figures come from the script."
  cta-button:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.void}"
    rounded: "6px"
    glow: "0 0 48px {colors.gold} at 22%, deep drop shadow into void"
    typography: "JetBrains Mono 600, upper, 0.16em"
    description: "The ONE filled-gold element — a single warm button in the closer, glowing in its own small beam."
---

# Noir Spotlight — Frame

## Overview

Noir Spotlight is a **cinematic dark-luxury** system — the frame is a darkened theatre and a single soft spotlight reveals the hero. The ground is near-black **void**, never flat gray; depth comes entirely from **light and shadow**: a drifting volumetric beam, deep falloff into black, and a film-grain vignette over the whole frame. The voice is **Fraunces 700** — a high-contrast cinematic serif for every display moment — with **Inter** for reading and **JetBrains Mono** caps for labels and credits. Gold is the lone warm accent, spent on hairlines and one chip; crimson is rarer still. The mood is a luxury product film for "Lumen": confident, hushed, expensive. Failure looks like an evenly-lit dark dashboard or a serif headline with no beam.

**Key characteristics at frame scale:**
- **Void grounds** (`{colors.void}`) with a `{colors.charcoal}` rise inside the beam; never pure flat black, never gray.
- **One spotlight cone** per frame — soft, volumetric, angled from a corner — that reveals exactly one focal element; the rest falls to shadow.
- **Always-on vignette + film grain** above every layer; this is what makes it a *film*, not a dark theme.
- **Fraunces 700** display ramp; **JetBrains Mono caps** chrome; text in `{colors.bone}` (display) / `{colors.ash}` (body) only.
- **Gold is hairlines** — one underline, one chip, one stat rule, one closing button. `{colors.crimson}` only as a rare single mark.
- **Composed-sparse and deep** — 1–3 lit elements; 60%+ of the frame is shadow.

## Colors

`{colors.void}` is the universal ground; `{colors.charcoal}` rises only inside the spotlight; `{colors.smoke}` is for the faintest separators and unlit surfaces. ALL text is `{colors.bone}` (display/lede) or `{colors.ash}` (body/labels) — no other text colors. `{colors.gold}` deploys four ways ONLY: the gold-hairline, the label-chip, the stat rule, and the single cta-button fill — never as body text, never as a fill larger than the button. `{colors.crimson}` is the rare alt: at most one small mark per video (a single underline or dot) and never beside gold in the same focal cluster. **No blues, no greens, no second warm hue, no flat mid-gray fields.**

**Text color law:** display/lede text is `{colors.bone}`, body `{colors.ash}` — `{colors.gold}` is hairlines/chip/CTA only and `{colors.crimson}` a rare single mark, never body or headline text. Any text over an image sits inside the lit spotlight zone (or a `{colors.charcoal}` scrim) — bone text on the dark stage — never raw on a busy image or on the unlit void edge.

## Typography

- **Display:** Fraunces 700 only, tight line-height (0.96–1.12), tracking −0.005 to −0.02em, sentence case — fit-to-measure: ≤3 words → `heading-xl`; 4–6 → `heading-lg`; 7+ → `heading-md`. Cap blocks at ≤ 70cqw; let the beam frame them.
- **Body:** Inter 400 in `{colors.ash}` (lede in `{colors.bone}`). **Labels/credits:** JetBrains Mono caps, 0.12–0.30em tracking, in `{colors.gold}` (chip) or `{colors.ash}` (credits).
- **Legibility floor:** load-bearing lines ≥ 1.4cqw and must sit inside the lit zone — never set bone text on raw void at the frame edge. No bold Inter display, no mono body, no italic display, no all-caps Fraunces.

## Depth & Surface

- **Light stack:** void ground → charcoal rise → spotlight-cone (the reveal) → hero/content → gold hairlines → vignette-grain (always on top). Light comes from one source; content lives where the beam lands.
- **Shadow:** deep falloff — a soft dark pool beneath the hero, edges dissolving into void. This is the *only* shadow; no crisp offset box-shadows.
- **Surface law:** content is revealed by light, not boxed by cards. No raised panels, no borders except the 1px gold hairline.
- **Ceiling:** zero flat evenly-lit frames, zero hard rectangular shadows, zero gradients ON text, no border thicker than 1px, vignette + grain never omitted.

## Shapes

Soft and minimal: 6px radius on the CTA, pill for the label-chip, otherwise no boxes — the spotlight defines edges, not corners. The cone and falloff shadow are edgeless light. No sharp brutalist rectangles, no decorative circles.

## Frame Treatments

> Recipe per frame: void ground · one drifting spotlight-cone · 1–3 lit elements (Fraunces display dominant) · ONE gold hairline gesture · mono chrome · vignette + grain on top.

### 1 · Cover  (identity · heading-xl in the beam)
Void ground; a spotlight-cone angled from the upper-left reveals a centered/left `heading-xl` (the product name "Lumen"). A label-chip eyebrow sits above; a gold-hairline underlines the key word. Mono wordmark + frame-number chrome in opposite corners. ~65% shadow.

### 2 · Feature  (hero revealed in light)
The hero-stage element (product/figure) caught in a corner-angled beam with a deep falloff shadow beneath; a `heading-lg` and short `body` lede sit in the lit zone beside it. One gold-hairline marks the feature line.

### 3 · Stat  (number lit large)
1–3 stat-blocks: huge `stat-number` in bone, a single gold-hairline rule beneath, mono `label` caption. The beam pools on the headline figure. Numbers come from the script — placeholders otherwise.

### 4 · Quote  (a line in the dark)
A single centered `heading-lg` quote inside a tight, low-intensity beam; the rest of the frame near-black. Mono attribution credit below; optional rare `{colors.crimson}` dot as the one alt mark. ~70% shadow.

### 5 · Closing  (the one filled-gold moment)
Centered `heading-lg` sign-off + the cta-button — the video's ONLY filled-gold element — glowing in its own small spotlight. Wordmark credit beneath. Beam dead-center, deepest vignette.

## Composition Rules

### Do
- Light exactly one focal element per frame with the spotlight-cone; let everything else fall to void.
- Set display in Fraunces 700 fit-to-measure, inside the lit zone, on bone.
- Spend gold on one hairline gesture per frame; open the eyebrow with a gold label-chip.
- Keep the vignette + film grain on every frame; let the cone bleed off a corner edge.

### Don't
- No evenly-lit or flat-gray frames; no bone text stranded on raw void at the edges.
- No cards, raised panels, or hard box-shadows — depth is the beam and its falloff only.
- No gold body text, no gold fill larger than the CTA, no crimson beside gold in one cluster.
- No bold Inter, no italic/all-caps Fraunces, no mono body, no second cool accent hue.

## Aspect-Ratio Behavior

| Treatment | 16:9 | 9:16 | 1:1 |
|---|---|---|---|
| Cover | beam upper-left, type left | beam top, type center | centered |
| Feature | hero + text side by side | hero top, text below | stacked |
| Stat | up to 3 across | stacked | 2×2 |
| Quote | wide center | tall center | center |
| Closing | centered | centered | centered |

`slide-pad` holds on the short edge; display clamps to the shorter axis; the beam re-angles so its source stays in a corner; vignette tightens on tall ratios.

## Numerals & Claims (hard rule)

Never invent figures. Stat-blocks carry `— figure —` / `{metric}` placeholders until the script supplies values; mono frame-numbers in chrome are decorative.

## Pre-Render Self-Audit

- One spotlight-cone reveals exactly ONE focal element; ≥60% of the frame falls to void/shadow.
- Vignette + film grain present on top of every layer; no flat or evenly-lit field anywhere.
- Display is Fraunces 700 fit-to-measure on bone, inside the lit zone; body Inter in ash; chrome JetBrains Mono caps.
- Colors: only the seven tokens; gold ≤ one hairline gesture + chip (+ one CTA in the closer); crimson at most one small mark; no cool hues.
- Depth: beam + falloff shadow only — zero cards, zero hard box-shadows, ≤1px gold borders.
- Every numeral traces to the script, else placeholder.

## Known Gaps

- **Motion intentionally out of scope** — composition only; spotlight drift, beam reveals, and grain shimmer belong to the composer.
- **Fraunces + Inter + JetBrains Mono via Google Fonts.** CJK: Noto Serif SC 700 display — high contrast softens; lean on the beam + falloff to carry the cinematic identity.
- The cone/vignette/grain are CSS radial gradients + a tiled noise overlay (or low-opacity SVG turbulence); if grain is unavailable, raise vignette depth instead. No external imagery required for the atoms (the hero element may be supplied by the script).
