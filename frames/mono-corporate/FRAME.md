---
version: alpha
name: Mono Corporate — Frame (video / frame layer)
description: >
  Clean minimal enterprise system for Ledger, a B2B finance platform. Atoms are sacred —
  near-white paper grounds with a faint 1px grid, generous open whitespace, crisp hairline
  dividers, small IBM Plex Mono caps labels, and ONE saturated deep-blue accent used as a
  single rule, dot, or CTA. Inter display + body, IBM Plex Mono for labels/data. Depth =
  hairline borders + a barely-there shadow; no glow, no gradients-on-text. Voice: precise,
  credible, calm. Composition + frame scale defined here. Motion out of scope.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  paper: "#FFFFFF"
  mist: "#F4F5F7"
  line: "#E2E5EA"
  ink: "#0E1116"
  graphite: "#5B616E"
  accent: "#1E5BFF"

typography:
  # — reading + data ramp —
  body:    { fontFamily: "Inter", cqw: 0.9, weight: 400, lineHeight: 1.6, color: "graphite" }
  body-strong:{ fontFamily: "Inter", cqw: 0.95, weight: 500, lineHeight: 1.55, color: "ink" }
  label:   { fontFamily: "IBM Plex Mono", px: 12, weight: 500, tracking: "0.18em", upper: true, color: "graphite" }
  mono-data:{ fontFamily: "IBM Plex Mono", cqw: 0.85, weight: 400, tracking: "0.01em", color: "graphite" }
  # — display ramp (Inter, tight, slightly negative tracking, sentence case) —
  card-title:{ fontFamily: "Inter", cqw: 1.25, weight: 600, lineHeight: 1.25, color: "ink" }
  heading-md:{ fontFamily: "Inter", cqw: 2.2, weight: 600, lineHeight: 1.15, tracking: "-0.01em", color: "ink" }
  stat-number:{ fontFamily: "Inter", cqw: 4.0, weight: 600, lineHeight: 1.0, tracking: "-0.02em", color: "ink" }
  heading-lg:{ fontFamily: "Inter", cqw: 3.4, weight: 600, lineHeight: 1.05, tracking: "-0.02em", color: "ink" }
  heading-xl:{ fontFamily: "Inter", cqw: 4.8, weight: 700, lineHeight: 1.0, tracking: "-0.025em", color: "ink" }

spacing:
  slide-pad: "4.5cqw"   # generous — whitespace is the brand
  gap-md: "1.6cqw"

components:
  bg-grid:
    backgroundImage: "1px {colors.line} lines, ~96px (5cqw) cells, on {colors.paper} or {colors.mist}"
    opacity: "the line color IS the opacity — faint by design; never darker than {colors.line}"
    description: "THE signature ground texture: a faint blueprint grid. One per frame, edge-to-edge, behind everything. Never grid AND ruled panels competing."
  panel:
    backgroundColor: "{colors.paper}"
    border: "1px solid {colors.line}"
    rounded: "8px (0.42cqw)"
    shadow: "0 1px 2px {colors.ink} at 5%, 0 8px 24px {colors.ink} at 4%"
    description: "THE surface. A crisp hairline card on the grid; the shadow is barely-there. Never two stacked shadow tiers, never a heavy drop."
  mono-label:
    typography: "{typography.label}"
    accentMark: "optional 0.3cqw {colors.accent} dot or 1.2cqw rule preceding the text"
    description: "The universal eyebrow — small mono caps, graphite, often led by the single blue dot/rule. Never a filled pill, never sentence case."
  accent-rule:
    rule: "2px {colors.accent} line (vertical sidebar, underline, or divider), OR a 0.5cqw {colors.accent} dot"
    description: "The ONE saturated device per frame. Marks exactly one focal element: a left rule on a stat, an underline on the key word, a dot on a label. Never two per frame."
  hairline-divider:
    rule: "1px solid {colors.line}, full-width or column-height"
    description: "Crisp thin divider that organizes the grid — between rows, columns, header/body. Always {colors.line}, never {colors.ink}, never the accent."
  stat-block:
    composition: "{typography.stat-number} in {colors.ink} + mono-data delta + {typography.label} caption + a single {colors.accent} left-rule or dot on ONE block"
    description: "Numbers stand in open space or on a panel; only the lead/featured metric earns the blue rule."
  cta-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    border: "none"
    rounded: "8px"
    shadow: "0 2px 8px {colors.accent} at 22%"
    typography: "Inter 600, 0.9cqw, sentence case"
    description: "The ONLY filled-blue element — one per video, in the closer. A secondary ghost button is {colors.ink} text + 1px {colors.line} border, no fill."
---

# Mono Corporate — Frame (video / frame layer)

## Overview

Mono Corporate is a **clean minimal enterprise** system for **Ledger**, a B2B finance
platform — the look of a calm, expensive SaaS that handles other people's money. The feeling
is precision and trust: a near-white paper ground, a **faint 1px grid**, **generous open
whitespace**, hairline dividers, and small **IBM Plex Mono** caps labels. Restraint is the
whole point — exactly **one saturated deep-blue accent** per frame (a rule, a dot, or the
single CTA) against an otherwise neutral ink-on-paper field. References: a Stripe/Linear
press page, a quarterly investor deck, an audited financial statement set in great type.
**Failure looks like** a busy dashboard, multiple accent colors, drop-shadowed glassy cards,
or cramped edge-to-edge text — anything that reads anxious instead of assured.

**Key characteristics at frame scale:**
- **Paper / mist grounds** with a faint 1px `{colors.line}` grid — never pure-white void, never a dark surface.
- **Generous whitespace** — `slide-pad` is a wide 4.5cqw; frames read **≥ 55% open**.
- **Hairline structure** — 1px `{colors.line}` borders + dividers organize; the panel shadow is barely-there.
- **One blue accent** (`{colors.accent}`): a single rule, dot, underline, or the lone filled CTA. Nothing else is saturated.
- **Inter display** (sentence case, 600–700, slightly negative tracking) + **IBM Plex Mono caps** for labels and data.
- **Composed-sparse and aligned** — everything snaps to the grid; crookedness reads as a defect, not a style.

## The Frame

### Frame Craft Bar
Three eyeball tests gate every frame before any structural check:
- **Squint** — one Inter display moment dominates; the **single blue mark** finds exactly one focal point; everything else is ink/graphite on paper.
- **Silence** — frames read **≥ 55% open paper**; whitespace is the product, not a gap to fill. Only the stat/feature grids run moderately dense.
- **Restraint** — exactly ONE accent device per frame; 1px hairlines only; one barely-there shadow tier; nothing tilted, nothing glowing.
- **Reference** — a Stripe/Linear marketing page or a polished investor deck; failure looks like a cluttered fintech dashboard, a neon dark-mode panel, or a borderless flat web grid.

- **Primary:** 1920×1080 (16:9). Display authored in **`cqw`** (`px ÷ 1920 × 100 = cqw`).
- **Vertical:** 1080×1920 (9:16). **Square:** 1080×1080 (1:1).
- **Safe area:** `slide-pad` 4.5cqw; the grid bleeds full-edge, content holds well inside the pad.

**The container law (load-bearing).** Every frame ground sets `container-type: size`; ALL
frame-relative units are `cqw`/`cqh` against it — never `vw`. Radii scale (8px ≈ 0.42cqw); borders stay **1px** at every ratio (2px only for the accent rule).

## Colors

`{colors.paper}` is the default ground; `{colors.mist}` is the alternate ground and the fill for
inset wells/secondary panels. `{colors.line}` is **every** border, divider, and grid line — never
used for text. `{colors.ink}` is display + emphatic text and key numerals; `{colors.graphite}` is
body copy and mono labels. `{colors.accent}` is the **one saturated color**, spent on exactly one
device per frame (rule / dot / underline) and the single filled CTA in the closer. **No second hue —
no greens, reds, ambers, or "positive/negative" colored deltas; signed deltas use ink/graphite with
a + / − glyph, not color.** No gradients anywhere, and never a gradient on text.

**Text color law:** display/emphatic text and key numerals are `{colors.ink}`, body and mono labels `{colors.graphite}` — `{colors.accent}` is the single rule/dot/underline or lone CTA fill, never the color of a paragraph, label, or headline. Any text over an image sits on a `panel` or mist scrim (ink/graphite on the light surface), never raw on a busy image.

## Typography

- **Display:** Inter 600 (700 only at `heading-xl`), **sentence case**, tracking −0.01 to −0.025em, line-height 1.0–1.25 — fit-to-measure: ≤3 words → `heading-xl`; 4–6 → `heading-lg`; 7+ → `heading-md`. Cap display blocks at ≤ 70cqw to protect whitespace.
- **Body:** Inter 400 in `{colors.graphite}` (500 / `{colors.ink}` for lead lines). **Labels & data:** IBM Plex Mono, caps + 0.18em tracking for labels, near-untracked for data, in `{colors.graphite}`.
- **Legibility floor:** load-bearing lines ≥ 1.3cqw. **Banned:** Inter for labels/data (mono owns chrome), mono for body, all-caps Inter display, italics, gradient or accent-colored body text.

## Depth & Surface

- **Surface law:** content lives on `panel` (1px `{colors.line}` border, 8px radius) or directly in open space organized by `hairline-divider`s. The grid sits behind everything; panels sit on the grid; the accent rule sits on the panel.
- **Depth model = hairline + barely-there shadow.** One soft shadow tier only: `0 1px 2px ink/5% , 0 8px 24px ink/4%`. The border does most of the lift; the shadow is almost subliminal.
- **Ceiling:** **no glow**, no colored shadows, no second shadow tier, no shadow heavier than the spec above, no gradients (on text or surface), no blur, no tilt. If in doubt, remove the shadow and keep the border.

## Shapes

8px radius on panels, cards, and the CTA; **6px** on small chips/wells; a true circle only for the
accent **dot** and avatar masks. Corners are gently soft, never sharp-brutalist and never pill-round
on panels. Everything aligns to the grid — no free-floating, no rotation.

## Frame Treatments

> Recipe per frame: paper/mist ground + faint 1px grid · ample whitespace (≥55% open) · hairline panels/dividers · mono caps label to open · ONE blue accent device · ink/graphite type.

### 1 · Cover  (identity · heading-xl · left, lots of air)
Paper ground + faint grid. A `mono-label` (led by the single blue dot) sits above a 1–2 line `heading-xl`; one **accent-rule underline** marks the key word. A short `body` line and a thin `hairline-divider` follow; mono wordmark/pagenum chrome in the bottom corners. ~60% open — the right/lower field stays empty paper.

### 2 · Feature  (catalog · 3 panels · grid)
Three `panel`s in a row (stack on 9:16), each: a mono caps label, a `card-title`, and 2 lines of `body`. The featured/middle panel earns the single **accent left-rule or dot**; the others stay neutral. Even gutters, hairline dividers optional between columns.

### 3 · Stat  (data · stat-number + one blue rule)
One to three `stat-block`s separated by `hairline-divider`s (or on mist panels): huge `stat-number` in ink, a mono `+/−` delta, a mono caps caption. Only the lead metric gets the **2px accent left-rule**. Numbers come from the script — placeholders otherwise.

### 4 · Quote  (quote · single statement, max air)
A centered or left `heading-lg` quote in ink with a **2px accent left-rule** as the only mark; a `mono-label` attribution beneath a `hairline-divider`. No panel needed — let the quote breathe on open paper. ~65% open.

### 5 · Closing  (closer · the one filled-blue moment)
Centered: a `mono-label`, a `heading-lg` sign-off, then the **cta-button** (the video's ONLY filled-blue element) with an optional ghost secondary button beside it. Mist or paper ground, faint grid, a hairline divider above the chrome. Calm and roomy.

## Composition Rules

### Do
- Keep frames **≥ 55% open paper**; let `slide-pad` (4.5cqw) breathe and snap everything to the grid.
- Open every region with a **mono caps label**; lead it with the single blue dot/rule when it's the focal label.
- Spend the **accent on exactly one device** per frame; keep all other structure in 1px `{colors.line}`.
- Set display in **Inter 600–700 sentence case**, fit-to-measure; body in Inter 400 graphite; data in IBM Plex Mono.
- Use **one barely-there shadow tier** on panels; let hairline borders and dividers carry the structure.
- Reserve the **filled blue CTA** for the closer only; the secondary action is a ghost (ink text + line border).

### Don't
- No second saturated color; no colored "positive/negative" deltas; no gradients (especially on text).
- No glow, no heavy/colored/double shadows, no blur, no tilt — nothing that reads anxious or flashy.
- No filled-pill labels, no all-caps Inter display, no mono body, no Inter labels.
- Don't crowd the frame — more than ~4 elements or a packed edge breaks the trust signal.
- Don't put more than one accent device, or paint the grid darker than `{colors.line}`.

## Aspect-Ratio Behavior

| Treatment | 16:9 | 9:16 | 1:1 |
|---|---|---|---|
| Cover | title left, air right | title top, air below | centered, generous margin |
| Feature | 3 across | 3 stacked | 2+1 |
| Stat | 3 across, dividers | stacked, dividers | 2×2 |
| Quote | wide, left rule | tall, left rule | centered |
| Closing | centered CTA | centered, taller | centered |

`slide-pad` holds (and may grow) on the short edge; display clamps to the shorter axis above the
1.3cqw floor; grid cell size scales but stays a faint 1px. Whitespace ratio is preserved on every ratio.

## Approved Entities

The product is **Ledger** (B2B finance platform). No real customers, banks, logos, or partner marks
are defined — render any such mark as a neutral placeholder (a `{colors.line}` rectangle or mono
`{client}` token). The blue accent is never a logo color stand-in for a third party.

## Numerals & Claims (hard rule)

Never invent figures, balances, percentages, or counts. Stat-blocks carry `— figure —` / `{metric}` /
`±N%` placeholders until the script supplies values; signed deltas use a `+`/`−` glyph in ink/graphite,
never color. Mono pagenum/wordmark chrome is decorative.

## Pre-Render Self-Audit

- **Squint** — one Inter display moment dominates; exactly ONE blue device marks the focal point; all else ink/graphite on paper.
- **Silence** — frame reads ≥ 55% open; only stat/feature grids run moderately dense; `slide-pad` honored.
- **Color** — only the six tokens; one accent device + (at most) the closer CTA; no second hue, no colored deltas, no gradients.
- **Type** — Inter 600–700 sentence-case display fit-to-measure, IBM Plex Mono caps labels/data, ≥1.3cqw floor; no mono body, no caps Inter.
- **Depth** — 1px `{colors.line}` borders/dividers + one barely-there shadow tier; no glow, no heavy/colored shadow, no tilt, no blur.
- **Fabrication** — every numeral traces to the script, else a placeholder; no real third-party marks.

## Known Gaps

- **Motion intentionally out of scope** — composition only; the subtle micro-motion (grid fade-in, divider draws, number count-ups) belongs to the composer.
- **Inter + IBM Plex Mono via Google Fonts.** CJK: Noto Sans SC 600 display + Noto Sans Mono CJK for labels — mono tracking tightens; lean on whitespace, hairlines, and the single accent to carry identity.
- **9:16 / 1:1 are guidance** — verify the whitespace ratio, the 1.3cqw floor, and that the grid stays faint.
- The grid, panels, dividers, dot/rule, and CTA are **CSS-only**; no external imagery is required.
