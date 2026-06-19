---
version: alpha
name: Kinetic Bold — Frame
description: >
  A kinetic-typography poster system for Pulse, a marketing-analytics app. Type IS the visual:
  enormous Anton words fill the frame, scenes hard-cut between near-black and off-white grounds,
  and each scene carries exactly one electric accent. Punchy, loud, rhythmic — no decoration but
  color blocks, a marker-highlight sweep, and one accent shape. The proof number is HUGE.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  ink: "#0B0B0B"
  paper: "#FAFAFA"
  red: "#FF3D2E"
  yellow: "#FFE600"
  mint: "#00E0A4"
  blue: "#2D7CFF"

typography:
  body:      { fontFamily: "Inter", cqw: 0.95, weight: 500, lineHeight: 1.45, color: "ink" }
  body-loud: { fontFamily: "Inter", cqw: 1.2, weight: 700, lineHeight: 1.3 }
  label:     { fontFamily: "Inter", px: 13, weight: 700, tracking: "0.22em", upper: true }
  kicker:    { fontFamily: "Inter", px: 14, weight: 800, tracking: "0.16em", upper: true }
  heading-md:{ fontFamily: "Anton", cqw: 6.0, weight: 400, lineHeight: 0.92, tracking: "-0.01em", upper: true }
  heading-lg:{ fontFamily: "Anton", cqw: 10.0, weight: 400, lineHeight: 0.86, tracking: "-0.015em", upper: true }
  heading-xl:{ fontFamily: "Anton", cqw: 16.0, weight: 400, lineHeight: 0.82, tracking: "-0.02em", upper: true }
  word-jumbo:{ fontFamily: "Anton", cqw: 24.0, weight: 400, lineHeight: 0.80, tracking: "-0.03em", upper: true }
  stat-number:{ fontFamily: "Anton", cqw: 30.0, weight: 400, lineHeight: 0.78, tracking: "-0.035em", upper: true }

spacing:
  slide-pad: "4cqw"
  gap-md: "1.4cqw"

components:
  ground-flip:
    backgroundColor: "{colors.ink} OR {colors.paper}"
    textColor: "the opposite ground (paper on ink, ink on paper)"
    rounded: "0"
    description: "The full-bleed scene surface. Consecutive frames FLIP ink↔paper — the flip is the rhythm; never two same-ground frames in a row."
  color-block:
    backgroundColor: "one of {colors.red} {colors.yellow} {colors.mint} {colors.blue}"
    rounded: "0"
    border: "none"
    description: "A hard-edged colored panel (full third / half / wiping band). The scene's accent lives here. One accent hue per scene — no gradients, no blends."
  kicker-tag:
    backgroundColor: "transparent OR the scene accent"
    textColor: "current ground-contrast OR {colors.ink} on a colored block"
    typography: "{typography.kicker}"
    rounded: "0"
    description: "The tiny loud eyebrow above a giant word. The ONLY small type allowed to sit near the display — keep it one short line."
  marker-sweep:
    backgroundColor: "the scene accent (often {colors.yellow})"
    rounded: "0"
    transform: "rotate(-1.5°), hand-drawn skew optional"
    description: "A highlighter swipe sitting BEHIND one key word — never the whole headline. Slightly taller than the cap-height, slightly off-square ends."
  accent-shape:
    backgroundColor: "the scene accent"
    rounded: "0 (rectangle/arrow/underline bar) — circle only as the lone exception"
    description: "The one non-type, non-block decoration per frame: a bold underline bar, a chunky arrow, a single dot, or a corner wedge. Never more than one."
  stat-slab:
    textColor: "the scene accent OR ground-contrast"
    typography: "{typography.stat-number}"
    rounded: "0"
    description: "The HUGE proof number — fills 60–90% of the frame height. The single loudest moment in the deck. One number, one unit, nothing else competing."
  button-cta:
    backgroundColor: "the scene accent"
    textColor: "{colors.ink}"
    rounded: "0"
    border: "none"
    typography: "Inter 800 uppercase 0.06em"
    description: "Hard-edged solid CTA block. Lives on the closing frame; accent fill, ink label, square corners."
---

# Kinetic Bold — Frame

## Overview

Kinetic Bold is a **kinetic-typography poster** system: the type is not on the design, the type **is** the design. Every frame is an enormous Anton word (or two) filling the canvas, hard-cut against either a near-black or off-white ground. The feeling is a hype reel — loud, rhythmic, confident — built for Pulse, a marketing-analytics app whose whole pitch is "see the signal, now." References: title-card sequences, kinetic lyric videos, protest-poster typography, a Saul Bass main title cranked to maximum. Failure looks like a tasteful slide deck: small centered headings, soft shadows, multiple colors per frame, or a stock photo. If it's quiet, it's wrong.

## Colors

Six tokens, two roles. **`{colors.ink}` and `{colors.paper}`** are the two grounds — every frame is one or the other, and consecutive frames **FLIP** between them (the ground flip is the deck's heartbeat). On ink the type is paper; on paper the type is ink. The four electrics — **`{colors.red}` `{colors.yellow}` `{colors.mint}` `{colors.blue}`** — are scene accents: **exactly ONE per frame**, deployed as a color-block, a marker-sweep, the stat number, or the accent shape. The accent never blends with another accent and never appears as body text. Forbidden: gradients, more than one accent per scene, gray middle-tones, accent-on-accent, and any color that isn't one of these six.

**Text color law:** type is the ground's opposite — `{colors.paper}` on an ink ground, `{colors.ink}` on a paper ground (and `{colors.ink}` on a colored block) — for maximum contrast. The accent colors a single swept word, the stat number, or the CTA, never a paragraph or a full headline. Any text over an image sits on a flat `color-block`/ground band (ink-on-light or paper-on-dark), never raw on a busy image.

## Typography

Two faces, two jobs. **Anton** (weight 400 — its single weight is the bold) carries every headline, word, and number, **uppercase, negative-tracked, tight line-height** from `heading-md` 6cqw to `stat-number` 30cqw. **Inter** carries the only small type: a one-line `body`/`body-loud` support line and the wide-tracked uppercase `label`/`kicker`. The display IS the layout — set it to overflow-bleed off the edges if a word demands it.

- **Legibility floor:** the support line ≥ **1.2cqw**; kicker/label in px are chrome only. The display has no ceiling — bigger is the brand.
- **Fit-to-fill (not fit-to-measure):** size the word to **fill the frame width**. 1 word → `word-jumbo`/`stat-number`; 2 words stacked → `heading-xl`; 3–4 words → `heading-lg`; a full loud line → `heading-md`. Let descenders/edges bleed.
- **Anton is the only display; Inter is the only support.** No second display face, no lowercase display, no untracked display, no script/serif anywhere, no Inter above `body-loud`.

## Depth & Surface

**Flat. Zero elevation.** Depth comes from **scale contrast and the ground flip**, never from shadow or blur. The only "layers" are hard-edged: a color-block over the ground, a marker-sweep behind a word, the giant word over everything.

- **No box-shadow, no text-shadow, no blur, no gradient, no glow.**
- Contrast is delivered by the 16:1+ size jump between display and support, and by the ink↔paper cut.
- The marker-sweep sits *behind* the word at the same z-conversation — it reads as highlighter, not a card.

## Shapes

- **0 radius everywhere.** Hard rectangular corners are the law. Color-blocks, sweeps, bars, wedges, CTAs — all square.
- Signature shapes: the **wiping color-block** (a colored panel that owns a third/half of the frame), the **marker-sweep** behind a key word, and **one accent shape** (underline bar / chunky arrow / corner wedge). A single solid **dot/circle** is the only permitted round form, used at most once.

## Frame Treatments

> Recipe per frame: pick a ground, FLIP from the previous frame, choose ONE accent hue, make type the visual, add at most one accent shape, keep it loud.

### 1 · Cover  (identity · move: word fills the frame · hard ground)
**Ground** ink (or paper). **Composes** kicker-tag, a 2-word `heading-xl` stack, one marker-sweep behind the punch word, accent shape. **Focal** the brand word HUGE, edge-bleeding; a marker-sweep highlights the second word. **Chrome** a one-line kicker above. **Accent** one hue (Pulse default: `{colors.mint}` or `{colors.red}`). **Silence** none — the word owns the frame. **Density** loud.

### 2 · Feature / Statement  (message · move: color-block wipe · split)
**Ground** opposite of cover. **Composes** color-block (owns a third/half), `heading-lg` line, body support, accent shape. **Focal** a loud 3–4 word line, with the color-block wiping in from one edge. **Chrome** label + one body-loud line on the open side. **Accent** the block's hue. **Density** loud.

### 3 · Stat / Proof  (data · move: the HUGE number · centered)
**Ground** flip. **Composes** stat-slab, a unit/label, kicker-tag. **Focal** ONE colossal `stat-number` (60–90% frame height) in the scene accent, with a tiny Inter label naming the metric. **Chrome** kicker above, one body line below. **Accent** the number's hue. **Silence** the number is the silence — nothing competes. **Density** maximal on the digit, empty elsewhere.

### 4 · Quote / Voice  (quote · move: word-stagger lines · left)
**Ground** flip. **Composes** `heading-md` quote set in 2–4 staggered lines, marker-sweep on the key word, attribution label. **Focal** the quote as kinetic stacked lines (each line its own baseline punch). **Chrome** an Inter label attribution. **Accent** one hue on the swept word only. **Density** medium-loud.

### 5 · Closing / CTA  (closer · move: command word + solid CTA · centered)
**Ground** flip (often back to ink). **Composes** a 1–2 word command `heading-xl` ("GET PULSE"), button-cta block, accent shape (arrow/underline). **Focal** the command word, the solid accent CTA block beneath it. **Chrome** a one-line URL/handle in label. **Accent** the CTA's hue. **Density** loud, decisive.

## Composition Rules

### Do
- Make **type the visual** — one or two enormous Anton words fill every frame, set to bleed off edges.
- **FLIP the ground** ink↔paper between consecutive frames; the alternation is the rhythm.
- Pick **exactly one accent hue per scene** and deploy it as a block, a sweep, the number, or one shape.
- Put a **marker-sweep behind ONE key word** (not the whole headline); use **one accent shape** max per frame.
- Make the **proof number HUGE** — the stat fills the frame and is the loudest moment in the deck.
- Keep corners **square**, everything **flat**, support type to **one short Inter line**.

### Don't
- Don't go quiet — no small centered headings, no polite whitespace as the point, no stock photo.
- Don't use **two accents in one frame**, gradients, gray mid-tones, or accent-on-accent.
- Don't add shadows, blur, glow, rounded corners, or any third font.
- Don't repeat a ground twice in a row; don't let Inter compete in size with Anton.
- Don't sweep-highlight a whole line, and don't stack more than one accent shape.

## Pre-Render Self-Audit

- **Type-as-visual** — at least one Anton word fills/bleeds the frame; the word IS the layout, not a caption.
- **Ground flip** — this frame's ground is the opposite of the previous frame's (ink↔paper).
- **One accent** — exactly one electric hue present (red/yellow/mint/blue); no second accent, no gradient, no gray.
- **Flatness** — zero shadow/blur/glow/gradient; all corners square (only one optional solid dot is round).
- **Hierarchy** — Anton display dwarfs the single Inter support line (≥1.2cqw); kicker/label are px chrome only.
- **Proof is huge** — any stat frame renders ONE colossal number; numerals trace to the script, else `— figure —` / `N×`.
