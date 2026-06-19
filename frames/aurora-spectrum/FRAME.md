---
version: alpha
name: Aurora Spectrum — Frame
description: >
  A Stripe/Linear/Vercel-tier living-gradient system: deep-space indigo grounds
  lit by large, soft, slowly-drifting multi-stop aurora blobs. Gradient-CLIP
  headlines, frosted 5%-white micro-cards, soft light everywhere, zero hard
  shadow. Inter at 800/900 carries the display; the spectrum carries the soul.
  Premium, modern, quietly alive — depth is light and blur, never a drop shadow.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  ground: "#0B0B14"
  ground-2: "#11101D"
  text: "#F5F7FF"
  muted: "#A6ACC8"
  indigo: "#6E8BFF"
  violet: "#B16CFF"
  magenta: "#FF6FD8"
  cyan: "#4ED7FF"
  mint: "#57F2C2"

typography:
  body:      { fontFamily: "Inter", cqw: 0.9, weight: 400, lineHeight: 1.55, color: "muted" }
  label:     { fontFamily: "Inter", px: 12, weight: 600, tracking: "0.18em", upper: true, color: "muted" }
  card-title:{ fontFamily: "Inter", cqw: 1.25, weight: 700, lineHeight: 1.2, color: "text" }
  heading-md:{ fontFamily: "Inter", cqw: 2.2, weight: 800, lineHeight: 1.1, tracking: "-0.02em" }
  heading-lg:{ fontFamily: "Inter", cqw: 3.4, weight: 800, lineHeight: 1.02, tracking: "-0.025em" }
  heading-xl:{ fontFamily: "Inter", cqw: 4.8, weight: 900, lineHeight: 0.98, tracking: "-0.03em" }
  stat-number:{ fontFamily: "Inter", cqw: 4.0, weight: 800, lineHeight: 1.0, tracking: "-0.03em" }

spacing:
  slide-pad: "3.5cqw"
  gap-md: "1.6cqw"

components:
  aurora-field:
    background: "2-3 large radial blobs of {colors.indigo}/{colors.violet}/{colors.magenta}/{colors.cyan}/{colors.mint} at 22-40% opacity, blur 120px+, over {colors.ground}"
    description: "THE signature: soft drifting spectrum light behind everything. One field per frame; without it the ground reads dead-flat black."
  frost-card:
    backgroundColor: "{colors.text} at 5% opacity"
    border: "1px solid {colors.text} at 8%"
    rounded: "20px"
    backdrop: "blur(24px) saturate(135%)"
    description: "The surface. Content floats on barely-there frosted glass; the aurora glows through it. Never opaque."
  spectrum-text:
    fill: "linear-gradient across 3 spectrum tokens (e.g. {colors.indigo}→{colors.violet}→{colors.magenta}), background-clip: text"
    description: "The accent device: ONE headline (or its key word) wears the gradient. Everything else is {colors.text}."
  glow-pill:
    backgroundColor: "{colors.text} at 6%"
    border: "1px solid {colors.text} at 12%"
    rounded: "9999px"
    typography: "{typography.label}"
    description: "The universal eyebrow — a frosted micro-capsule, often with a {colors.mint} status dot."
  stat-treatment:
    composition: "frost-card + {typography.stat-number} as spectrum-text + {typography.label} caption + a thin 1px spectrum top-rule"
    description: "Numbers glow with the gradient inside frosted glass; the rule samples the same spectrum."
  cta-button:
    background: "linear-gradient {colors.indigo}→{colors.violet} (+ soft {colors.cyan} outer glow)"
    textColor: "{colors.text}"
    rounded: "12px"
    typography: "Inter 700, 0.02em"
    description: "The ONE filled-gradient element — a single CTA in the closer, haloed by soft light."
---

# Aurora Spectrum — Frame

## Overview

Aurora Spectrum is a **living-gradient** design system in the lineage of Stripe, Linear, and Vercel: a near-black indigo void lit from within by large, soft, slowly-shifting bands of spectrum color. The feeling is a premium SaaS landing page at midnight — confident, modern, and quietly alive, as if a borealis were breathing behind frosted glass. Type is **Inter** at 800/900, tight and architectural, so the structure stays sharp while the light stays soft. Failure looks like a harsh neon gradient, a busy rainbow, or a flat dark-mode page with no glow — Aurora is *soft* spectrum, *whispered*, never electric.

**Key characteristics at frame scale:**
- **Deep-space ground** (`{colors.ground}` / `{colors.ground-2}`) lit by an **aurora-field** — the void is never empty.
- **Frosted 5%-white micro-cards** that the aurora glows *through*; content never sits raw on the dark.
- **Gradient-clip text** as the ONE accent — a single headline or key word wears the spectrum.
- **Inter 800/900** display, tight negative tracking; `{colors.text}` for everything that isn't the spectrum moment.
- **Soft light + blur is the entire depth model** — zero hard offset shadows, ever.

## Colors

`{colors.ground}` is the universal canvas; `{colors.ground-2}` for inset wells and the deepest base of the gradient. ALL text is `{colors.text}` (primary) or `{colors.muted}` (body, labels, captions) — those are the only two text colors that are *solid*. The five spectrum hues — `{colors.indigo}`, `{colors.violet}`, `{colors.magenta}`, `{colors.cyan}`, `{colors.mint}` — appear **only** as light: aurora blobs, gradient-clip text, the spectrum top-rule, the CTA fill, and the lone `{colors.mint}` status dot.

**The ONE accent rule:** the spectrum is concentrated into a single moment per frame — one gradient headline OR one gradient stat block OR one gradient CTA, never all three. **Forbidden:** solid-filled spectrum panels, spectrum body text, more than three hues blended in one gradient, and any color that isn't a spectrum token (no warm yellows, no reds outside the magenta lane, no greens outside mint).

**Text color law:** display/headline text is `{colors.text}`, body/labels `{colors.muted}` — the spectrum hues are light only (one gradient-clip moment per frame), never the color of a paragraph, label, or caption. Any text over an image sits on a `frost-card` scrim (light text on the frosted panel), never raw on a busy image.

## Typography

- **Display:** Inter 800/900 only, tight (line-height 0.98–1.1), negative tracking −0.02 to −0.03em, sentence case — fit-to-measure: ≤3 words → `heading-xl`; 4–6 → `heading-lg`; 7+ → `heading-md`. Cap display blocks at ≤ 72cqw.
- **Body:** Inter 400 in `{colors.muted}`. **Labels:** Inter 600 caps, 0.18em tracking, in `{colors.muted}`.
- **Legibility floor:** load-bearing lines ≥ 1.4cqw. **Banned:** italics, all-caps display, gradient on body or label text, any non-Inter face, font weights below 600 on a headline.

## Depth & Surface

- **Light stack:** ground → aurora-field (blurred 120px+, behind everything) → frost-cards → spectrum text/CTA. Light radiates from behind; content floats in front.
- **Surface law:** every content surface is a frost-card — `{colors.text}` at ~5% fill, 1px ~8% border, 20px radius, `backdrop-filter: blur(24px) saturate(135%)`. Never opaque, never bordered heavier than 1px.
- **Ceiling:** **zero hard/offset shadows**; depth is *only* soft glow (large blur radii, low opacity, no offset) + blur. No solid drop shadows, no hard edges of light, no inset bevels.

## Shapes

20px radius on every frost-card; pills (9999px) for eyebrows; 12px on the CTA. Soft, generous corners throughout. The only "circles" are the aurora blobs (edgeless light) and the small `{colors.mint}` status dot.

## Frame Treatments

> Recipe per frame: ground + aurora-field · 1-3 frost-cards · ONE spectrum moment · frosted eyebrow + muted chrome · ~50% open light.

### 1 · Cover  (identity · spectrum heading-xl · left)
Ground + a large 2-3 blob aurora-field drifting upper-right. A `glow-pill` eyebrow over a 2-line `heading-xl` whose **key word is spectrum-text**; muted body lede beneath. ~55% open void. Optional small frost-card wordmark chrome, bottom corner.

### 2 · Feature  (catalog · 3 frost-cards · row)
Three `frost-card`s in a row (stack on 9:16): a small spectrum icon glyph, a `card-title`, and 2-line muted body each. The aurora-field sits low behind the row, glowing through the glass. Headlines stay `{colors.text}` — the gradient lives only in the field here.

### 3 · Stat  (data · spectrum stat-number)
One to three `stat-treatment` cards: huge `stat-number` as **spectrum-text** with a 1px spectrum top-rule and a muted caption. Numbers come from the script — placeholders otherwise.

### 4 · Quote  (quote · single wide frost-card)
A single centered wide `frost-card` holding a `heading-lg` quote in `{colors.text}`; a soft `{colors.violet}`+`{colors.magenta}` aurora blooms behind it; a `glow-pill` carries the attribution. ~60% open.

### 5 · Closing  (closer · the one gradient CTA)
Centered `frost-card`: a `heading-lg` sign-off in `{colors.text}` plus the `cta-button` — the frame's ONLY filled-gradient element — with a soft cyan halo. The aurora-field centers behind, brightest here.

## Composition Rules

### Do
- Light every frame with one aurora-field; let blobs bleed off the edges and overlap softly.
- Float all content on frost-cards; keep ~50% of the lit void visible.
- Spend the spectrum on exactly ONE moment per frame (heading, stat, or CTA).
- Set display in Inter 800/900 fit-to-measure; open regions with a frosted `glow-pill`.

### Don't
- No raw text on the bare ground (chrome pills excepted); no opaque cards; no borders >1px.
- No hard or offset shadows — soft glow + blur only.
- No solid spectrum panels, no gradient body/label text, no >3-hue blends.
- No second spectrum moment in a frame; no warm/off-spectrum colors; no italics or all-caps display.

## Pre-Render Self-Audit

- One Inter 800/900 display moment dominates; exactly ONE spectrum accent (heading OR stat OR CTA).
- Every frame carries a soft aurora-field; the void is lit, never flat black; ~50% open.
- All content floats on frost-cards (5% fill, 1px border, 20px radius, blur) — none opaque.
- Colors: only the nine tokens; spectrum appears as light only; text is `{colors.text}`/`{colors.muted}`.
- Depth: soft glow + blur only — zero hard/offset shadows anywhere.
- Type ≥1.4cqw floor, fit-to-measure, no italics/all-caps display; every numeral traces to the script, else placeholder.
