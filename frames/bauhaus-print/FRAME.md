---
version: alpha
name: Bauhaus Print — Frame
description: >
  A retro risograph Bauhaus poster system: cream paper, two-color overprint, and primary geometric
  shapes — big circles, triangles, squares — as composition anchors. Halftone dot textures, slight
  overprint offset (a shape's duplicate in a second ink, shifted a few px), bold geometric Archivo
  Black type, and thin ink rules. Flat with print texture — no glass, no glow. For "Prism," a
  design-collaboration tool. Voice: playful-academic, confident, graphic.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  cream: "#F3ECD8"
  ink: "#1A1A1A"
  red: "#E2483D"
  blue: "#2B4FB0"
  yellow: "#F2C12E"
  paper-deep: "#E7DEC4"

typography:
  body:      { fontFamily: "Inter", cqw: 0.95, weight: 400, lineHeight: 1.55, color: "ink" }
  body-lede: { fontFamily: "Inter", cqw: 1.15, weight: 500, lineHeight: 1.5, color: "ink" }
  label:     { fontFamily: "Archivo", px: 13, weight: 700, tracking: "0.22em", upper: true }
  kicker:    { fontFamily: "Archivo", px: 13, weight: 600, tracking: "0.34em", upper: true }
  heading-md:{ fontFamily: "Archivo Black", cqw: 2.4, weight: 900, lineHeight: 1.05, tracking: "-0.01em", upper: true }
  heading-lg:{ fontFamily: "Archivo Black", cqw: 3.8, weight: 900, lineHeight: 1.0, tracking: "-0.015em", upper: true }
  heading-xl:{ fontFamily: "Archivo Black", cqw: 6.4, weight: 900, lineHeight: 0.94, tracking: "-0.025em", upper: true }
  stat-number:{ fontFamily: "Archivo Black", cqw: 9.0, weight: 900, lineHeight: 0.9, tracking: "-0.03em" }

spacing:
  slide-pad: "4cqw"
  gap-md: "1.8cqw"
  rule-weight: "0.12cqw"

components:
  paper-ground:
    backgroundColor: "{colors.cream}"
    overlay: "faint {colors.paper-deep} halftone wash at edges"
    rounded: "0"
    description: "The universal flat surface — warm cream, never white, never gray. The ONE rule: nothing floats; everything prints flat onto it with no shadow and no glow."
  geo-anchor:
    fill: "one of {colors.red} / {colors.blue} / {colors.yellow}, flat"
    shape: "circle · equilateral triangle · square — pick ONE per frame"
    size: "32–66% of the frame, bleeding off ≥1 edge"
    description: "The primary geometric composition anchor. The ONE rule: exactly one dominant primitive per frame, and it bleeds off an edge — a contained shape reads as a logo, not a poster."
  overprint-echo:
    fill: "a second ink (e.g. {colors.geo-anchor} is red → echo in {colors.blue})"
    offset: "0.4–0.9cqw on a single diagonal, behind the anchor or type"
    blend: "multiply, ~85% opacity"
    description: "The risograph signature: a duplicate of the shape or headline in a second ink, nudged a few px. The ONE rule: ONE consistent offset vector per frame; multiply blend so overlaps darken like real ink."
  halftone-field:
    backgroundImage: "radial-gradient dot pattern in {colors.ink} (or an ink at 14–22%), 8–14px grid"
    description: "Flat print texture — dot gradients fill a shape, a band, or a corner. The ONE rule: dots scale by region (coarse in big fields, fine as accent); never blur them into a gradient glow."
  ink-rule:
    stroke: "0.12cqw solid {colors.ink} (1px floor)"
    description: "The only line in the system — hairline ink for registration marks, baselines, column splits, footer tops. The ONE rule: hairline only; no thick bars, no boxes-as-borders."
  stat-plate:
    fill: "flat {colors.geo-anchor} with an {colors.overprint-echo}"
    typography: "{typography.stat-number} in {colors.ink} or {colors.cream}"
    rounded: "0"
    description: "A figure printed inside or across a primitive. The ONE rule: the numeral is set in Archivo Black on flat color — never on a halftone field (legibility), never with a shadow."
  cta-block:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    border: "none"
    rounded: "0"
    typography: "{typography.label}"
    description: "A flat ink rectangle, cream label inside, often with a tiny overprint-echo in {colors.red}. The ONE rule: hard rectangle, flat fill, square corners — the click target is graphic, not glossy."
---

# Bauhaus Print — Frame

## Overview

Bauhaus Print is a **risograph poster** system: warm cream paper, two inks overprinting at a slight
misregister, and a single large **primary geometric shape** — circle, triangle, or square — running
the composition. It feels like a screen-printed Bauhaus exhibition poster or a small-press riso zine:
flat, graphic, a little imperfect on purpose. The references are Herbert Bayer, the Hochschule für
Gestaltung, and modern riso studios. The product is **Prism**, a design-collaboration tool, and the
voice is **playful-academic** — confident, opinionated, graphic. Failure looks like a flat corporate
slide: a centered headline, no dominant shape, no overprint offset, white background, soft shadows.
If it could be a default Keynote template, it has failed.

## Colors

Five inks. `{colors.cream}` is the paper ground on **every** frame — warm, never `#FFFFFF`, never
gray. `{colors.ink}` is all body type, all hairline rules, and the CTA fill. The three **process
inks** — `{colors.red}`, `{colors.blue}`, `{colors.yellow}` — are the poster colors: one is the
**dominant** anchor fill, a **second** is the overprint echo, and the third (if used) is a small
accent only. `{colors.paper-deep}` is the faint edge halftone wash — texture, never a fill.
**The ONE accent rule:** two process inks per frame maximum as real area; where they overlap they
**multiply** (red over blue → a muddy plum) — that overlap darkening is the whole point.
**Forbidden:** white grounds, gradients between inks, glow, drop shadows, pastel tints, a fourth
process ink as a major area, and ink-on-ink without multiply (it reads as a sticker, not a print).

**Text color law:** body type is `{colors.ink}`; headlines/numerals are `{colors.ink}` on cream or flat color, or `{colors.cream}` reversed on a flat process-ink primitive — process inks are area, never the color of small text, and never set type on a halftone field. Any text over an image sits on a flat ink/cream/process-ink block (ink-on-light or cream-on-dark), never raw on a busy image.

## Typography

One display face, one text face. **Archivo Black** (weight 900, uppercase, tight negative tracking)
carries every headline and numeral — `heading-md` 2.4cqw → `heading-xl` 6.4cqw → `stat-number`
9cqw. **Inter** carries body and ledes; **Archivo** (700/600, wide-tracked uppercase) carries the
`label` and `kicker` chrome. **Legibility floor:** any load-bearing line ≥ 1.4cqw; px labels are
chrome only. Set headlines **fit-to-measure** — ≤3 words → `heading-xl`, 4–6 → `heading-lg`, 7+ →
`heading-md`; cap the block at ≤ 80cqw. **Banned:** any serif, script, or rounded display face;
sentence-case headlines; untracked labels; light-weight display; and headline type set on a halftone
field (it dies — keep big type on flat ink or flat paper).

## Depth & Surface

There is **no depth.** The system is dead flat — zero box-shadow, zero text-shadow, zero blur, zero
glow, zero gradient (except the radial-gradient that *builds the halftone dots themselves*). The
illusion of layering comes only from **overprint**: the `overprint-echo` (a second-ink duplicate
nudged 0.4–0.9cqw on a fixed diagonal, multiply blend) and from shapes overlapping and darkening.
**The surface law:** everything prints *onto* the cream — nothing floats above it. If an element
needs a shadow to read, the layout is wrong; separate it with a hairline `ink-rule`, an overprint
offset, or plain negative space instead.

## Shapes

- **0 radius — strict.** Squares and rectangles have hard corners; the only curves are the **circle**
  primitive and the dots of the halftone field.
- **Signature shapes:** the three Bauhaus primitives — **circle, equilateral triangle, square** —
  used large and bleeding off-edge. Exactly one primitive dominates per frame; secondary primitives,
  if any, stay small.
- **Registration marks** (tiny ink crosshairs / corner ticks) are an allowed graphic flourish.

## Frame Treatments

1. **Cover** — Cream ground; one huge `geo-anchor` (e.g. a red circle) bleeding off-edge with a blue
   `overprint-echo`; `kicker` + a 2-line Archivo Black `heading-xl` printed on the flat anchor or
   beside it; a hairline `ink-rule` baseline and a corner registration mark.
2. **Feature** — A primitive splits the frame (triangle or square holding one half); flat color on
   one side, cream + body copy on the other; the section title in `heading-lg`, a halftone-field
   corner for texture.
3. **Stat** — A `stat-plate`: a giant `stat-number` (Archivo Black, 9cqw) set in ink on a flat
   process-ink primitive with an overprint echo; a single `label` caption beneath a hairline rule.
4. **Quote** — Centered or left, `heading-md`/`heading-lg` in ink on cream, an oversized overprinted
   primitive (a circle behind, second-ink echo) as the only ornament; attribution in `label`.
5. **Closing** — A flat `cta-block` (ink rectangle, cream label) plus a final primitive bleeding off
   the opposite corner with its overprint echo; product mark "PRISM" in `heading-lg`; registration
   ticks closing the corners.

## Composition Rules

### Do
- Start on **cream**; place **exactly one dominant primitive** (circle/triangle/square) that bleeds
  off ≥1 edge.
- Add **one `overprint-echo`** with a consistent offset vector and multiply blend — the misregister
  is the signature.
- Set display in **Archivo Black uppercase, negative-tracked**; body in Inter; chrome in wide-tracked
  Archivo `label`.
- Keep **two process inks** as real area; let overlaps **darken** via multiply.
- Use **halftone fields** for texture and **hairline ink-rules** as the only lines; lean asymmetric
  and graphic.

### Don't
- No white grounds, no gradients-as-fill, no glow, no drop/text shadows, no rounded corners (save the
  circle + halftone dots).
- No serif/script/rounded display; no sentence-case or untracked headlines; no big type on a halftone
  field.
- No more than two process inks as major area; no ink-over-ink without multiply; no fourth ink block.
- Don't center everything symmetrically or omit the dominant shape — that's the corporate-slide
  failure mode.
- Don't invent figures — render numeral slots as placeholders until the script supplies them.

## Pre-Render Self-Audit

- **Shape** — exactly one dominant primitive (circle/triangle/square) anchors the frame and bleeds
  off an edge.
- **Overprint** — one consistent-vector `overprint-echo` is present; overlaps multiply/darken; no
  shadow or glow anywhere.
- **Color** — cream ground; ≤2 process inks as area; nothing is `#FFFFFF`; no gradients except the
  halftone dots.
- **Type** — Archivo Black uppercase negative-tracked display, Inter body, wide-tracked Archivo
  labels; ≥1.4cqw floor; no big type on halftone.
- **Surface** — dead flat, square corners (only circle + dots curve), hairline `ink-rule` is the only
  line.
- **Fabrication** — every numeral/stat traces to the script, else a `— figure —` placeholder.
