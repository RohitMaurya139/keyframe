---
version: alpha
name: Midnight Glass — Frame (video / frame layer)
description: >
  Dark glassmorphism system for premium, technical, nocturnal subjects. Atoms are
  sacred — deep navy grounds, frosted translucent cards with 1px light borders and
  backdrop blur, ONE electric cyan accent (violet strictly subordinate), Space
  Grotesk display + Inter body + JetBrains Mono data, 20px radii, glow-not-shadow
  depth. Composition + frame scale defined here. Motion out of scope.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  midnight: "#0A0F2A"
  abyss: "#060918"
  glasslight: "#FFFFFF"
  frost: "#C7D6F0"
  inklight: "#EAF2FF"
  neon: "#00F0FF"
  violet: "#7A5CFF"

typography:
  # — reading + data ramp —
  body:    { fontFamily: "Inter", cqw: 0.9, weight: 400, lineHeight: 1.55, color: "frost" }
  micro-label:{ fontFamily: "JetBrains Mono", px: 12, weight: 500, tracking: "0.22em", upper: true }
  mono-data:{ fontFamily: "JetBrains Mono", cqw: 0.8, weight: 400, tracking: "0.02em" }
  # — display ramp (Space Grotesk 700, tight, slightly negative tracking) —
  card-title:{ fontFamily: "Space Grotesk", cqw: 1.3, weight: 700, lineHeight: 1.15 }
  heading-md:{ fontFamily: "Space Grotesk", cqw: 2.2, weight: 700, lineHeight: 1.08, tracking: "-0.01em" }
  stat-number:{ fontFamily: "Space Grotesk", cqw: 4.0, weight: 700, lineHeight: 1.0, tracking: "-0.02em" }
  heading-lg:{ fontFamily: "Space Grotesk", cqw: 3.4, weight: 700, lineHeight: 1.02, tracking: "-0.02em" }
  heading-xl:{ fontFamily: "Space Grotesk", cqw: 4.8, weight: 700, lineHeight: 0.98, tracking: "-0.03em" }

spacing:
  slide-pad: "3.5cqw"
  gap-md: "1.6cqw"

components:
  glass-card:
    backgroundColor: "{colors.glasslight} at 6-9% opacity"
    border: "1px solid {colors.glasslight} at 14%"
    rounded: "20px (1.05cqw)"
    backdrop: "blur(20px)"
    description: "THE surface. Content floats on frosted panels, never raw on the ground."
  glass-chip:
    backgroundColor: "{colors.glasslight} at 8%"
    border: "1px solid {colors.glasslight} at 18%"
    rounded: "9999px"
    typography: "{typography.micro-label}"
    description: "The universal eyebrow/badge — mono caps in a frosted pill."
  neon-edge:
    rule: "2px {colors.neon} line or 1px inner border at 60%"
    glow: "0 0 24px {colors.neon} at 25%"
    description: "The accent device: one glowing cyan edge/underline/ring per focal moment."
  glow-orb:
    background: "radial {colors.neon} at 18% -> transparent 65%, or {colors.violet} at 14%"
    size: "30-60% of frame, blurred 60px+, behind the glass layer"
    description: "Atmospheric depth — one cyan orb per frame; violet only as the counter-orb."
  grid-lines:
    rule: "1px {colors.glasslight} at 5-7%, 80-120px grid"
    description: "Faint blueprint grid on the ground; technical, barely-there."
  stat-card:
    composition: "glass-card + {typography.stat-number} in {colors.inklight} + mono-data label + neon-edge underline"
    description: "Numbers live in glass with a glowing cyan rule beneath."
  cta-button:
    backgroundColor: "{colors.neon}"
    textColor: "{colors.abyss}"
    rounded: "12px"
    glow: "0 0 40px {colors.neon} at 35%"
    typography: "Space Grotesk 700, upper, 0.08em"
    description: "The ONLY filled-cyan element — one per video, in the closer."
---

# Midnight Glass — Frame (video / frame layer)

## Overview

Midnight Glass is a **premium dark glassmorphism** system: deep navy space, frosted
translucent panels, and a single electric cyan accent. Depth comes from light —
blurred glow orbs behind glass, soft cyan edges on focal elements — never from hard
shadows. The voice is **Space Grotesk 700** (tight, modern) for every display moment,
**Inter** for reading, and **JetBrains Mono** in wide-tracked caps for labels and data.
The mood is a product keynote at 1 a.m.: confident, technical, quietly expensive.

**Key characteristics at frame scale:**
- **Deep navy grounds** (`{colors.midnight}` / `{colors.abyss}`) with a faint blueprint grid; never pure black.
- **Frosted glass cards** — translucent white fills, 1px light borders, 20px radii, backdrop blur. Content NEVER sits raw on the ground.
- **One cyan accent** (`{colors.neon}`): a glowing edge, an underline, a single filled CTA. `{colors.violet}` exists only as a subordinate counter-glow.
- **Space Grotesk 700** display ramp; **JetBrains Mono caps** chrome; text in `{colors.inklight}` / `{colors.frost}` only.
- **Glow is the depth model** — orbs behind glass, soft neon edges; zero hard offset shadows, zero opaque cards.
- **Composed-sparse** — 2-4 glass elements per frame; crowding kills the night-air feel.

## The Frame

### Frame Craft Bar
- **Squint** — one Space Grotesk display moment dominates; the cyan accent marks exactly ONE focal point.
- **Silence** — frames read ~50% open navy; glass panels cluster, they don't tile the canvas.
- **Restraint** — one neon device per frame; violet never exceeds cyan; borders stay 1px light.
- **Reference** — a premium fintech keynote slide / a sci-fi HUD at rest; failure looks like a cluttered crypto dashboard or a gray "dark mode" web page.

- **Primary:** 1920×1080 (16:9). Display authored in **`cqw`** (`px ÷ 1920 × 100 = cqw`).
- **Vertical:** 1080×1920 (9:16). **Square:** 1080×1080 (1:1).
- **Safe area:** `slide-pad` 3.5cqw; orbs and grid bleed, glass never touches the edge.

**The container law (load-bearing).** Every frame ground sets `container-type: size`;
ALL frame-relative units are `cqw`/`cqh` — never `vw`. Radii scale (20px ≈ 1.05cqw); borders stay 1px.

## Colors

`{colors.midnight}` is the universal ground (`{colors.abyss}` for inset wells and the CTA text).
ALL text is `{colors.inklight}` (display) or `{colors.frost}` (body/labels) — no other text colors.
`{colors.neon}` deploys three ways ONLY: the glow-orb, the neon-edge, and the single cta-button fill.
`{colors.violet}` is strictly atmospheric (counter-orb at low opacity). `{colors.glasslight}` is never
opaque — 5-18% for fills/borders/grid. **No greens, no reds, no warm hues anywhere.**

## Typography

- **Display:** Space Grotesk 700 only, tight line-height (0.98–1.15), tracking −0.01 to −0.03em, sentence case or caps — fit-to-measure: ≤3 words → `heading-xl`; 4–6 → `heading-lg`; 7+ → `heading-md`. Cap blocks at ≤ 75cqw.
- **Body:** Inter 400 in `{colors.frost}`. **Labels/data:** JetBrains Mono caps, 0.18–0.26em tracking, in `{colors.frost}` or `{colors.neon}`.
- **Legibility floor:** load-bearing lines ≥ 1.4cqw. No bold Inter display, no mono body, no italic anywhere.

## Depth & Surface

- **Glow stack:** ground grid → glow-orb(s, blurred 60px+) → glass cards → neon edges. Light from behind, content in front.
- **Glass:** backdrop blur 20px, translucent white fill, 1px light border, 20px radius.
- **Ceiling:** zero offset/hard shadows, zero opaque panels, zero gradients ON text, no border thicker than 2px (and 2px only when neon).

## Shapes

20px radius on every card; pills for chips; the CTA at 12px. No sharp corners, no circles except orbs (which are edgeless light).

## Frame Treatments

> Recipe per frame: navy ground + faint grid · one cyan orb (optional violet counter) · 2-4 glass elements · ONE neon device · mono chrome.

### 1 · Cover  (identity · heading-xl in glass · left)
Ground midnight + grid + large cyan orb upper-right. A wide glass-card holds a glass-chip eyebrow and a 2-line `heading-xl`; a neon-edge underlines the key word. Mono pagenum/wordmark chrome bottom corners. ~55% open space.

### 2 · Feature Glass  (catalog · 3 glass cards · grid)
Three glass-cards in a row (stack on 9:16), each: mono chip, `card-title`, 2-line body. The middle/featured card gets the neon-edge. Orb behind the row, low.

### 3 · Stat Glow  (data · stat-number + neon rule)
One to three stat-cards: huge `stat-number` in inklight, cyan neon-edge rule beneath, mono label. Numbers come from the script — placeholders otherwise.

### 4 · Quote Pane  (quote · single wide glass)
A single centered wide glass-card with a `heading-lg` quote; violet counter-orb lower-left; mono attribution chip. ~60% open.

### 5 · Closing Pane  (closer · the one filled-cyan moment)
Centered glass-card: `heading-lg` sign-off + the cta-button (the video's ONLY filled-cyan element) glowing beneath. Orb dead-center behind.

## Composition Rules

### Do
- Float ALL content on glass; keep the ground visible around panels.
- Spend cyan on exactly one device per frame; let violet whisper behind.
- Set display in Space Grotesk 700 fit-to-measure; open regions with a mono glass-chip.
- Keep the blueprint grid at 5-7% opacity; let orbs bleed off-edge.

### Don't
- No raw text on the navy ground (chips/pagenum chrome excepted).
- No hard shadows, no opaque cards, no second accent hue, no warm colors.
- No bold Inter, no italics, no gradient text, no neon body text.
- Don't tile the frame with glass — 2-4 panels max; don't put orbs IN FRONT of glass.

## Aspect-Ratio Behavior

| Treatment | 16:9 | 9:16 | 1:1 |
|---|---|---|---|
| Cover | glass left, orb right | glass center-top, orb below | centered |
| Feature Glass | 3 across | 3 stacked | 2+1 |
| Stat Glow | 3 across | stacked | 2×2 |
| Quote Pane | wide center | tall center | center |
| Closing | centered | centered | centered |

`slide-pad` holds on the short edge; display clamps to the shorter axis; orb count drops to 1 on tight ratios.

## Numerals & Claims (hard rule)

Never invent figures. Stat-cards carry `— figure —` / `{metric}` placeholders until the script supplies values. Mono chrome numbers are decorative.

## Pre-Render Self-Audit

- One Space Grotesk display moment dominates; ONE cyan device marks the focal point.
- All content on glass (1px light border + blur + 20px radius); ground ~50% visible.
- Colors: only the seven tokens; cyan ≤ one device + one orb; violet subordinate; no warm hues.
- Type: Grotesk 700 display fit-to-measure, mono caps chrome, ≥1.4cqw floor.
- Depth: glow only — zero hard shadows, zero opaque panels.
- Every numeral traces to the script, else placeholder.

## Known Gaps

- **Motion intentionally out of scope** — composition only; orb drift/glass entrances belong to the composer.
- **Space Grotesk + Inter + JetBrains Mono via Google Fonts.** CJK: Noto Sans SC 700 display — the tight tracking drops; lean on glass + glow to carry identity.
- backdrop-filter requires the renderer's Chromium (fine); if blur is unavailable, raise the glass fill to 12% opacity instead.
- All atoms are CSS-only; no external imagery required.
