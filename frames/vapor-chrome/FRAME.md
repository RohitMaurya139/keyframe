---
version: alpha
name: Vapor Chrome — Frame
description: >
  Tasteful Y2K / retro-future for Nova, a creator monetization platform. A deep
  indigo synthwave night with a scrolling perspective-grid horizon, a single glowing
  sun-orb, chrome/gradient-clipped Space Grotesk headlines with a light sweep, and
  neon magenta/teal glow edges. Bold and energetic — but composed, never garish.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script
colors:
  void: "#0D0A2B"
  ground: "#15103F"
  magenta: "#FF2EA6"
  teal: "#2EF2E0"
  violet: "#8A5CFF"
  warm: "#FF7A45"
  chrome: "#EAF0FF"
typography:
  body:       { fontFamily: "Inter", cqw: 0.9, weight: 400, lineHeight: 1.5, color: "chrome" }
  label:      { fontFamily: "Space Grotesk", px: 12, weight: 600, tracking: "0.22em", upper: true }
  heading-md: { fontFamily: "Space Grotesk", cqw: 2.2, weight: 700, lineHeight: 1.1, tracking: "-0.01em" }
  heading-lg: { fontFamily: "Space Grotesk", cqw: 3.4, weight: 700, lineHeight: 1.02, tracking: "-0.02em" }
  heading-xl: { fontFamily: "Space Grotesk", cqw: 4.8, weight: 700, lineHeight: 0.98, tracking: "-0.03em" }
  stat-number:{ fontFamily: "Space Grotesk", cqw: 4.0, weight: 700, lineHeight: 1.0, tracking: "-0.02em" }
spacing:
  slide-pad: "3.5cqw"
  gap-md: "1.6cqw"
components:
  night-ground:
    background: "linear-gradient {colors.void} (top) → {colors.ground} (horizon line ~62%)"
    description: "THE surface — a vertical indigo sky over the horizon. One gradient, two tokens, never flat."
  horizon-grid:
    rule: "1px {colors.magenta} (left) → {colors.teal} (right) gradient lines, CSS-3D perspective, fading to void at the horizon"
    sweep: "animate background-position downward, FINITE (the scroll never loops forever)"
    description: "The signature floor: a vanishing-point neon grid below the horizon line. ONE per frame, lower half only."
  sun-orb:
    background: "radial {colors.warm} core → {colors.magenta} → transparent, sitting ON the horizon line"
    glow: "0 0 120px {colors.magenta} at 30%"
    description: "The retro sun — a single glowing orb half-sunk into the horizon. One per frame; never floats free in the sky."
  chrome-headline:
    fill: "gradient-clip text {colors.chrome} → {colors.teal} → {colors.violet}, with a brighter diagonal sweep band"
    glow: "soft 0 0 30px {colors.violet} at 25%"
    description: "The 3D-looking hero word — gradient background-clipped onto Space Grotesk 700. The ONE chrome moment per frame."
  neon-chip:
    border: "1px {colors.teal} at 70%"
    glow: "0 0 18px {colors.teal} at 30%"
    typography: "{typography.label}"
    description: "The eyebrow/badge — a glowing wide-tracked caps pill in teal. Opens a region; never plain text."
  stat-plate:
    composition: "{typography.stat-number} in gradient-clip {colors.teal}→{colors.chrome} + label + a thin neon underline"
    glow: "0 0 24px {colors.magenta} at 22% beneath the rule"
    description: "Numbers glow on the night with a single neon rule; figures come from the script."
  cta-button:
    background: "gradient {colors.magenta} → {colors.violet}"
    textColor: "{colors.void}"
    rounded: "10px"
    glow: "0 0 40px {colors.magenta} at 40%"
    typography: "Space Grotesk 700, upper, 0.1em"
    description: "The ONE filled neon element — one per video, in the closer. Scanline shimmer optional."
---

# Vapor Chrome — Frame

## Overview

Vapor Chrome is **tasteful Y2K synthwave** for Nova, a creator monetization platform.
The frame is a deep-indigo night: a vertical sky over a glowing perspective grid that
recedes to a vanishing point, with a single retro sun half-sunk on the horizon. The hero
word is **chrome** — a teal→violet→white gradient clipped onto Space Grotesk 700 with a
diagonal sweep, ringed in soft violet glow. Magenta and teal are the neon accents; warm
orange lives only in the sun. The feeling is a 1984 future seen through clean 2026 glass —
**energetic, premium, optimistic**. Failure looks garish: rainbow soup, hard chrome bevels,
a grid filling the whole frame, or neon on every element at once.

## Colors

`{colors.void}` (top sky) and `{colors.ground}` (horizon) form the night gradient — the
universal ground; never a flat fill, never pure black. Text is `{colors.chrome}` (display
+ body); body never goes pure white. **The accent law:** neon = magenta + teal, and only one
of them leads per frame (the other supports). `{colors.violet}` is the chrome-gradient and
glow connective tissue — it bridges, it never headlines alone. `{colors.warm}` is reserved
for the sun-orb core ONLY. Forbidden: greens, true reds, more than two competing neons in a
single focal area, neon as a large flat fill (it belongs in glow, lines, and gradient-clip).

**Text color law:** all body and display text is `{colors.chrome}` (the hero word may wear the one chrome gradient-clip; labels only may be `{colors.teal}`/`{colors.magenta}`) — neon is never paragraph or multi-line text. Any text over an image sits on a dark `{colors.void}`/`{colors.ground}` scrim or band (chrome text on the dark surface), never raw on a busy image.

## Typography

- **Display:** Space Grotesk 700 only, tight (line-height 0.98–1.1), tracking −0.01 to −0.03em — fit-to-measure: ≤3 words → `heading-xl`; 4–6 → `heading-lg`; 7+ → `heading-md`. The hero gets chrome gradient-clip; secondary display stays solid `{colors.chrome}`.
- **Body:** Inter 400 in `{colors.chrome}`. **Labels:** Space Grotesk 600 caps, 0.22em tracking, in `{colors.teal}` or `{colors.magenta}`.
- **Legibility floor:** load-bearing lines ≥ 1.4cqw. Banned: italics, mono, more than one gradient-clip headline per frame, neon body text, bevel/emboss text effects.

## Depth & Surface

- **Depth is glow + perspective**, never bevel or hard shadow. Light comes from the sun-orb and neon edges; the CSS-3D grid supplies real spatial recession on the floor.
- **Layer stack:** night-ground → horizon-grid (3D, lower half) → sun-orb on the horizon → content → chrome-headline + neon glow on top.
- **Surface law:** content sits in open sky above the horizon; the grid + sun own the lower band. **Ceiling:** zero offset/drop shadows, zero glass blur, zero opaque panels, no chrome bevels — chrome lives in the gradient-clip text only.

## Shapes

Radii are soft: 10px on the CTA, pills for chips, 16px for any rare panel. The sun-orb is the
only circle. The horizon-grid is the only hard geometry. No sharp 0-radius corners; no skeuomorphic chrome plates.

## Frame Treatments

> Recipe per frame: night gradient · ONE horizon-grid (lower half) · ONE sun-orb on the line · open sky above for content · ONE chrome or neon focal device · teal/magenta chrome.

1. **Cover** — Deep night, grid receding to a centered vanishing point, sun-orb on the horizon; a neon-chip eyebrow over a 2-line `chrome-headline` (the one gradient-clip moment) in the open sky; CSS-3D perspective tilts the hero subtly toward the viewer. ~55% open.
2. **Feature** — Sky holds 2–3 neon-chip + `heading-md` + body groups (no panels); grid + sun anchor the lower band; the lead feature's chip glows in the leading neon, others recede.
3. **Stat** — One to three `stat-plate`s floating in the sky: big gradient-clip numbers with a single magenta neon rule beneath; grid pulls the eye to the vanishing point. Numbers from the script.
4. **Quote** — A single centered `heading-lg` quote in solid `{colors.chrome}`, sun-orb low behind it as a halo, attribution in a neon-chip; grid faint. ~60% open.
5. **Closing** — Centered sign-off `heading-lg` + the one `cta-button` (gradient magenta→violet, glowing) over a brighter grid; sun-orb dead-center behind as the hero glow, optional scanline shimmer.

## Composition Rules

### Do
- Build every frame on the night gradient with exactly ONE horizon-grid and ONE sun-orb on the line.
- Reserve the chrome gradient-clip for a single hero word per frame; keep secondary display solid `{colors.chrome}`.
- Let ONE neon lead (magenta or teal) and the other support; bridge with violet glow.
- Keep content in the open sky above the horizon; let the grid + sun own the lower band.
- Open regions with a glowing neon-chip; keep glow soft (≤40% strength) so it reads premium.

### Don't
- Don't fill the frame with the grid, float the sun in the sky, or use more than one sun/grid.
- Don't stack two gradient-clip headlines, set neon body text, or use chrome bevels/hard shadows/glass blur.
- Don't introduce greens or true reds; don't let warm escape the sun-orb; don't run three+ neons in one focal area.
- Don't go garish — no rainbow gradients, no neon on every element, no max-strength glow everywhere.

## Pre-Render Self-Audit

- Night gradient ground (two tokens, not flat); exactly ONE horizon-grid (lower half) + ONE sun-orb on the line.
- Exactly one chrome gradient-clip headline; all other display solid `{colors.chrome}`; floor ≥ 1.4cqw.
- One leading neon (magenta or teal), the other supporting; violet only as bridge/glow; warm only in the sun.
- Depth is glow + 3D perspective only — zero drop shadows, zero glass blur, zero chrome bevels.
- Content lives in open sky above the horizon; ~50%+ of the frame breathes; CTA appears once (closer only).
- Every numeral traces to the script, else a `— figure —` / `{metric}` placeholder.
