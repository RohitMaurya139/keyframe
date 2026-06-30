// DETERMINISTIC SCENE-KIT — builds a complete, lint-valid, showcase-grade
// HyperFrames composition from a storyboard WITHOUT asking the LLM to freehand
// layout/motion. The kit OWNS structure + motion (guaranteed by code, so the
// budget model can never produce an overlapping/truncated mess); the PACK owns
// STYLE (colors/fonts/atoms, re-skinned per pack — flat packs get NO gradients);
// the AGENTS own CONTENT (copy, archetype choice, asset/screenshot selection,
// carried on the storyboard). This is the codification of the two hand-authored
// reference films (flagship, amazon-premium) into reusable, parameterized scenes.
//
// Entry: buildComposition({ storyboard, dims, framePack, assets, captionCues })
//        -> { indexHtml, metaJson }   (the same envelope the LLM composer returns)
//
// NOTE: this is the FOUNDATION (helpers + theme + background + hook/stat/cta +
// generic text). Screenshot-hero, split-diagram, asset-grid, terminal, and the
// full per-pack skinning table are filled in from the scenekit-design pass.

const frameRegistry = require("./frame_registry");
const { themeFromTokens } = require("./enrich");
const packAtoms = require("./pack_atoms");
const { buildMotif } = require("./scene_motifs");

// SINGLE-quoted family names — these are embedded in double-quoted style="..."
// attributes, so a double quote here would terminate the attribute early and kill
// every font-size/color after it (CSS accepts single quotes for family names).
const SAFE_FONTS = "Inter, 'Segoe UI', system-ui, Roboto, Helvetica, Arial, sans-serif";

// Packs that are FLAT by design (no gradients / glows — solid color + hard edges).
// The scenekit-design pass produces the authoritative per-pack table; this is a
// safe default so the kit never paints gradients onto a neo-brutalist/print pack.
const FLAT_PACKS = new Set([
  "blockframe", "bauhaus-print", "biennale-yellow", "kinetic-bold", "noir-spotlight",
]);
// Flat packs default to a LIGHT ground, but some flat packs are flat-yet-DARK by
// design (their FRAME.md ground is a void). These keep the dark base so their
// signature atoms (spotlight/grain/vignette) read on the void they were authored for.
const DARK_FLAT_PACKS = new Set(["noir-spotlight"]);

// Seconds a scene clip lingers past its nominal end so its exit overlaps the next
// scene's entrance (continuous scene-to-scene transitions, not hard cuts).
const OVERLAP = 0.45;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return 128;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

// Derive the scene THEME from the chosen pack (authoritative) or, when no pack is
// bound, the storyboard's own palette. Returns the knobs every archetype re-skins.
function deriveTheme(framePack, storyboard) {
  const tokens = framePack && framePack !== "auto" ? frameRegistry.getPackTokens(framePack) : null;
  const pal = (storyboard && storyboard.palette) || {};
  let ground, ink, accents, fonts;

  if (tokens) {
    const t = themeFromTokens(tokens);
    const colorVals = Object.values(tokens.colors || {});
    const flat = FLAT_PACKS.has(framePack);
    const darkFlat = DARK_FLAT_PACKS.has(framePack);
    // Flat packs sit on their lightest/offwhite ground; cinematic packs (and flat-yet-
    // dark packs like noir) on their darkest. Pick ground by the pack's character.
    ground = (flat && !darkFlat) ? (t.lightBase || "#FFFDF5") : (t.darkBase || "#0B1020");
    ink = lum(ground) > 140 ? "#15140F" : "#F6F4EE";
    accents = (t.accents && t.accents.length ? t.accents : colorVals).slice(0, 4);
    fonts = (tokens.fonts && tokens.fonts.length) ? tokens.fonts : ["Inter"];
  } else {
    ground = pal.background && /^#/.test(pal.background) ? pal.background : "#0B1020";
    ink = pal.text || (lum(ground) > 140 ? "#15140F" : "#F6F4EE");
    accents = [pal.accent, pal.primary].filter(Boolean);
    if (!accents.length) accents = ["#7CC4FF", "#FF7DB4", "#FFC878"];
    fonts = [(storyboard && storyboard.fontFamily) || "Inter"];
  }
  const isDark = lum(ground) < 140;
  const flat = framePack && FLAT_PACKS.has(framePack);
  // Drop any "accent" whose luminance sits too close to the ground (packs often
  // include a near-black/near-white base among their tokens) — otherwise an accent
  // word or gradient fades into the background. Backfill with safe brights so we
  // always have ≥2 visible accents.
  const safeBright = isDark ? ["#7CC4FF", "#FF7DB4", "#FFC878", "#8BE0A4"] : ["#3B5BFF", "#E2563C", "#1E9E5A", "#C9A227"];
  accents = accents.filter((a) => Math.abs(lum(a) - lum(ground)) > 55);
  for (const c of safeBright) { if (accents.length >= 2) break; if (!accents.includes(c)) accents.push(c); }
  accents = accents.slice(0, 4);
  // Force maximum text contrast against the ground (the storyboard's text hex is
  // often a mid-tone that reads as muddy).
  ink = isDark ? "#FFFFFF" : "#14130E";
  // Only fonts the offline renderer can auto-resolve may appear in CSS — a pack's
  // display font (e.g. "Space Grotesk") would fall back anyway and trips lint, so
  // (matching the composer's normalize) we render on the safe stack and express
  // the pack's type identity through weight / case / tracking instead.
  const RESOLVABLE = new Set(["inter", "roboto", "arial", "helvetica", "georgia", "system-ui"]);
  const lead = fonts.filter((f) => RESOLVABLE.has(String(f).toLowerCase().trim()));
  return {
    ground, ink, accents,
    accent: accents[0],
    accent2: accents[1] || accents[0],
    fontStack: lead.length ? `${lead.map((f) => `'${f}'`).join(", ")}, ${SAFE_FONTS}` : SAFE_FONTS,
    isDark,
    gradients: !flat,          // flat packs: solid fills + hard borders only
    dim: isDark ? "rgba(255,255,255,0.62)" : "rgba(20,18,12,0.62)",
    line: isDark ? "rgba(255,255,255,0.14)" : "rgba(20,18,12,0.14)",
    panel: isDark ? "rgba(255,255,255,0.05)" : "rgba(20,18,12,0.04)",
  };
}

// The GSAP helper functions — emitted ONCE. They mechanically satisfy the five
// most error-prone lint rules (camera, word-stagger, counter, exit-kill, finite
// repeats) so every archetype stays clean with almost no per-scene code.
function emitHelpers(D) {
  return [
    `var tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });`,
    `var D = ${D};`,
    `function reps(c){ return Math.max(0, Math.floor(D/c)-1); }`,
    `function sreps(span,c){ return Math.max(0, Math.floor(span/c)-1); }`,
    `function wordsIn(sel,at,stg){ tl.fromTo(sel,{yPercent:80,opacity:0,filter:"blur(8px)"},{yPercent:0,opacity:1,filter:"blur(0px)",duration:0.62,stagger:stg||0.08,ease:"power3.out"},at); }`,
    // reveal(id, at, mode, stg) — the headline-entrance VOCABULARY. Branches on the
    // storyboard's per-scene `animation` so adjacent scenes read differently. Word
    // modes animate the .kfw spans (now inline-block, so transforms apply); the two
    // container modes (mask-reveal, ken-burns-text) animate the whole .kfhead. All
    // use fromTo so the hidden start needs no gsap.set (lint: CSS-only initial hide).
    `function reveal(id,at,mode,stg){var w="#"+id+" .kfw";var h="#"+id+" .kfhead";`
      + `if(mode==="mask-reveal"){tl.fromTo(h,{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:0.85,ease:"power4.out"},at);tl.fromTo(w,{opacity:0},{opacity:1,duration:0.4,stagger:stg||0.04},at);return;}`
      + `if(mode==="ken-burns-text"){tl.fromTo(h,{opacity:0,scale:1.09,transformOrigin:"50% 50%"},{opacity:1,scale:1,duration:1.0,ease:"sine.out"},at);return;}`
      + `if(mode==="scale-pop"){tl.fromTo(w,{opacity:0,scale:0.55,transformOrigin:"50% 100%"},{opacity:1,scale:1,duration:0.6,stagger:stg||0.06,ease:"back.out(2)"},at);return;}`
      + `if(mode==="slide-up"){tl.fromTo(w,{opacity:0,yPercent:115},{opacity:1,yPercent:0,duration:0.6,stagger:stg||0.07,ease:"power3.out"},at);return;}`
      + `if(mode==="slide-left"){tl.fromTo(w,{opacity:0,xPercent:45},{opacity:1,xPercent:0,duration:0.6,stagger:stg||0.07,ease:"power3.out"},at);return;}`
      + `if(mode==="blur-sharp"){tl.fromTo(w,{opacity:0,filter:"blur(16px)"},{opacity:1,filter:"blur(0px)",duration:0.72,stagger:stg||0.05,ease:"power2.out"},at);return;}`
      + `tl.fromTo(w,{yPercent:90,opacity:0,filter:"blur(8px)"},{yPercent:0,opacity:1,filter:"blur(0px)",duration:0.62,stagger:stg||0.08,ease:"power3.out"},at);}`,
    `function pushIn(sel,at,dur,from,to){ tl.fromTo(sel,{scale:from},{scale:to,duration:dur,ease:"none"},at); }`,
    // cam(sel, at, dur, from, to, org) — a slow continuous CAMERA move (a filmic
    // dolly). SCALE-ONLY on purpose: a centered box keeps its translateY(-50%) via
    // GSAP preserving the untweened transform; animating x/yPercent here would wipe
    // that centering. Each archetype passes a different from→to + transform-origin
    // so adjacent scenes never share the same camera language.
    `function cam(sel,at,dur,from,to,org){ tl.fromTo(sel,{scale:from},{scale:to,duration:dur,ease:"none",transformOrigin:org||"50% 50%"},at); }`,
    `function countUp(id,to,at,dur,fmt){ var o={v:0}; tl.to(o,{v:to,duration:dur,ease:"power2.out",snap:{v:1},onUpdate:function(){var el=document.getElementById(id);if(el)el.textContent=fmt(Math.round(o.v));}},at); }`,
    // typeLine — types `txt` into #id character-by-character (deterministic: an index
    // proxy + snap + onUpdate writing the substring, no per-char tweens, no randomness).
    `function typeLine(id,txt,at,dur){ var o={i:0}; tl.to(o,{i:txt.length,duration:dur,ease:"none",snap:{i:1},onUpdate:function(){var el=document.getElementById(id);if(el)el.textContent=txt.slice(0,Math.round(o.i));}},at); }`,
    `function exitScene(sel,at,end){ tl.to(sel,{opacity:0,duration:0.3,ease:"power2.in"},at); tl.set(sel,{opacity:0},end); }`,
    // xout(sel, at, end, mode) — the scene EXIT vocabulary (drives transitionOut).
    // immediateRender:false on the clip-path/scale exits so the "from" never clips
    // the scene from t=0; tl.set at `end` guarantees the clip is gone before the
    // next scene (track-disjoint, so a residual would otherwise linger).
    // NOTE: `wipe` deliberately uses a scaleX collapse, NOT clip-path. A clip-path
    // on the full-frame scene clip makes the occlusion inspector mis-read the
    // clipped-away text as "hidden beneath the background" (a false positive at the
    // transition instant). scaleX+opacity reads as a clean sweep-out and is honest
    // to the inspector (the element is shrinking + fading, not occluded).
    `function xout(sel,at,end,mode){if(mode==="none")return;`
      + `if(mode==="slide-left"){tl.to(sel,{xPercent:-9,opacity:0,duration:0.45,ease:"power2.in"},at);tl.set(sel,{opacity:0},end);return;}`
      + `if(mode==="wipe"){tl.to(sel,{scaleX:0,opacity:0,duration:0.45,ease:"power3.inOut",transformOrigin:"100% 50%"},at);tl.set(sel,{opacity:0},end);return;}`
      + `if(mode==="scale-through"){tl.to(sel,{scale:1.12,opacity:0,duration:0.5,ease:"power2.in",transformOrigin:"50% 50%"},at);tl.set(sel,{opacity:0},end);return;}`
      + `if(mode==="hard-cut"){tl.set(sel,{opacity:0},end);return;}`
      + `tl.to(sel,{opacity:0,duration:0.3,ease:"power2.in"},at);tl.set(sel,{opacity:0},end);}`,
  ].join("\n");
}

// Background depth stack — persistent, tracks 0–3, full duration, never exits.
// Gradient/glow for cinematic packs; solid ground + an authored particle field +
// (for flat packs) a hard-edged dot or rule motif instead of blurred gradients.
function buildBackground(theme, dims, D, framePack, seed) {
  const { ground, accent, accent2, gradients } = theme;
  const W = dims.width, H = dims.height;
  const sd = seed || 0;
  const groundCss = gradients
    ? `background:radial-gradient(120% 95% at 50% -8%, ${mix(ground, "#ffffff", theme.isDark ? 0.10 : 0.04)}, ${ground} 55%, ${mix(ground, "#000000", theme.isDark ? 0.35 : 0.06)});`
    : `background:${ground};`;
  const parts = [];
  parts.push(`<div class="clip" data-start="0" data-duration="${D}" data-track-index="0" style="${groundCss}"></div>`);

  // glow layer — ONLY for gradient packs (flat packs stay flat)
  if (gradients) {
    parts.push(`<div id="kfbgGlow" class="clip" data-start="0" data-duration="${D}" data-track-index="1" data-layout-allow-occlusion style="background:radial-gradient(38% 46% at 22% 28%, ${rgba(accent, 0.20)}, transparent 70%), radial-gradient(34% 42% at 82% 72%, ${rgba(accent2, 0.14)}, transparent 72%); filter:blur(8px);"></div>`);
  }

  // PACK SIGNATURE — the design system's defining background atom (spotlight cone /
  // sun-bloom / behind-glass bloom). Occupies the low track band [4..6], behind all
  // scene content. Sparse packs (noir/biennale) ask to quiet the generic ambient.
  const sig = packAtoms.background(framePack, theme, dims, D, 4);
  for (const h of sig.html) parts.push(h);
  const reduceAmbient = sig.reduceAmbient;

  // ambient particle field (authored — drifts on a finite-repeat tween)
  const N = reduceAmbient ? 5 : 12;
  const circ = [];
  for (let i = 0; i < N; i++) {
    const cx = Math.round(((i * 97 + 60 + sd) % 100) / 100 * W);
    const cy = Math.round(((i * 53 + 40 + sd * 7) % 100) / 100 * H);
    const r = 2 + (i % 4);
    const col = [accent, accent2, theme.ink][i % 3];
    const op = (0.28 + (i % 5) * 0.05).toFixed(2);
    circ.push(`<circle class="kfdust${i}" cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="${op}"/>`);
  }
  parts.push(`<div class="clip" data-start="0" data-duration="${D}" data-track-index="2" data-layout-allow-occlusion><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;">${circ.join("")}</svg></div>`);

  // grid / rule motif (masked for gradient packs; faint solid for flat packs).
  // Skipped on signature packs — their atom (spotlight/bloom) IS the depth motif and
  // a grid on top would clutter the deliberate sparseness.
  if (!reduceAmbient) {
    const gridCol = rgba(theme.ink, gradients ? 0.04 : 0.06);
    const mask = gradients ? "-webkit-mask-image:radial-gradient(80% 80% at 50% 45%,#000 35%,transparent 90%);mask-image:radial-gradient(80% 80% at 50% 45%,#000 35%,transparent 90%);" : "";
    parts.push(`<div class="clip" data-start="0" data-duration="${D}" data-track-index="3" data-layout-allow-occlusion style="background-image:linear-gradient(${gridCol} 1px,transparent 1px),linear-gradient(90deg,${gridCol} 1px,transparent 1px);background-size:46px 46px;${mask}"></div>`);
  }

  const script = [];
  for (const sc of sig.script) script.push(sc);
  if (gradients) script.push(`tl.fromTo("#kfbgGlow",{xPercent:-4,yPercent:-3,scale:1},{xPercent:4,yPercent:3,scale:1.07,duration:10,ease:"sine.inOut",yoyo:true,repeat:reps(10)},0);`);
  script.push(`for(var i=0;i<${N};i++){var pd=7+(i%5);tl.to(".kfdust"+i,{attr:{cy:"-="+(40+(i%4)*18)},x:(i%2?12:-12),duration:pd,ease:"sine.inOut",yoyo:true,repeat:reps(pd)},0);}`);
  return { html: parts.join("\n  "), script: script.join("\n") };
}

// ---- color utils -------------------------------------------------------------
function hexToRgb(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return [124, 124, 124]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(hex, with_, t) { const a = hexToRgb(hex), b = hexToRgb(with_); const c = a.map((v, i) => Math.round(v + (b[i] - v) * t)); return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`; }

// A tiny stable string hash → a per-video seed so the ambient particle field is
// laid out differently for different titles/packs instead of being byte-identical
// on every render (build-time only; keeps the runtime script deterministic).
function strSeed(s) {
  let h = 2166136261;
  const str = String(s || "keyframe");
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h % 997;
}

// ---- asset treatment ---------------------------------------------------------
// kenBurns(i) — a DETERMINISTIC but per-asset-VARIED Ken Burns (scale + pan + anchor)
// so b-roll stops looking like the same fixed 1.0→1.12 push on every image. Seeded by
// the asset's slot index, resolved to literal numbers at build time (no runtime rand).
function kenBurns(i) {
  // pan stays ≤2% so the ≥6% scale overscan always covers it (no edge gap); scale
  // zooms IN (from < to, both ≥1.06) for a live, dynamic push that never under-fills.
  const pans = [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5], [0, -2], [-2, 0]];
  const origins = ["50% 50%", "34% 40%", "66% 40%", "46% 62%"];
  const p = pans[i % pans.length];
  return { from: r(1.06 + (i % 3) * 0.02), to: r(1.12 + (i % 2) * 0.02), dx: p[0], dy: p[1], origin: origins[i % origins.length] };
}
// photoGrade(theme) — a palette TINT layer composited over a stock photo so free
// Pixabay/Openverse imagery takes on the active pack's colour story instead of
// clashing with it. Soft-light on dark grounds (lifts toward the accents), multiply
// on light grounds (deepens into them). Skipped for screenshots/vectors (kept true).
function photoGrade(theme) {
  const blend = theme.isDark ? "soft-light" : "multiply";
  return `<div style="position:absolute;inset:0;background:linear-gradient(130deg, ${rgba(theme.accent, 0.38)}, ${rgba(theme.accent2 || theme.accent, 0.22)} 60%, ${rgba(theme.ground, 0.30)});mix-blend-mode:${blend};pointer-events:none;"></div>`;
}

// ---- per-scene INTENT (the storyboard fields the kit used to ignore) ----------
// The storyboard authors a distinct `animation`, `layout`, `transitionOut` and
// timed `beats` per scene. These sanitize that intent into safe enums + anchors
// the archetypes execute, so the LLM's direction actually reaches the screen.
const ANIMS = new Set(["word-stagger", "mask-reveal", "blur-sharp", "scale-pop", "slide-up", "slide-left", "ken-burns-text", "typewriter"]);
const TRANS = new Set(["fade", "slide-left", "wipe", "scale-through", "hard-cut", "none"]);
const LAYOUTS = ["fullbleed", "split-60-40", "centered-card", "grid-2x2"];

function revealMode(scene) {
  const a = String((scene && scene.animation) || "").toLowerCase().trim();
  if (a === "typewriter") return "word-stagger"; // no terminal archetype yet → clean stagger
  return ANIMS.has(a) ? a : "word-stagger";
}
function transOut(scene, isLast) {
  if (isLast) return "none";
  const t = String((scene && scene.transitionOut) || "").toLowerCase().trim();
  return TRANS.has(t) ? t : "fade";
}
// Honor the storyboard's layout; if it's missing/invalid the kit ROTATES by index
// so adjacent scenes never share a zone map (variety is what reads as "produced").
function layoutFor(scene, i) {
  const l = String((scene && scene.layout) || "").toLowerCase().trim();
  if (LAYOUTS.includes(l)) return l;
  return LAYOUTS[i % LAYOUTS.length];
}

// placeContent(layout, dims) → outer content-box position + alignment. THIS is what
// breaks the "every scene is a centered card at top:50%" monotony.
function placeContent(layout, dims) {
  const land = dims.width >= dims.height;
  switch (layout) {
    case "fullbleed":
      return { box: `position:absolute;left:7%;right:7%;bottom:12%;`, align: "left", split: false };
    case "split-60-40":
      return { box: `position:absolute;left:7%;${land ? "width:54%;" : "right:7%;"}top:50%;transform:translateY(-50%);`, align: "left", split: land };
    case "grid-2x2":
      return { box: `position:absolute;left:7%;right:7%;top:50%;transform:translateY(-50%);`, align: "left", split: false };
    case "centered-card":
    default:
      return { box: `position:absolute;left:8%;right:8%;top:50%;transform:translateY(-50%);`, align: "center", split: false };
  }
}

// motifZone(layout, dims, track) → the OPEN region of a text scene where a
// visualMotif vector can live without colliding with the copy. Behind the text
// (its own low track) + allow-occlusion, so the headline always wins any overlap.
function motifZone(layout, dims, track) {
  const W = dims.width, H = dims.height, land = W >= H;
  if (land && layout === "split-60-40") return { x: W * 0.60, y: H * 0.26, w: W * 0.33, h: H * 0.5, track };
  if (land) return { x: W * 0.50, y: H * 0.05, w: W * 0.42, h: H * 0.26, track }; // top-right, kept high to clear the copy
  return { x: W * 0.16, y: H * 0.07, w: W * 0.68, h: H * 0.22, track };           // vertical/square: upper band
}
// Attach a visualMotif vector to a text scene when nothing else fills the frame
// (no b-roll behind, no foreground asset). Returns {html, script} or null.
function maybeMotif(scene, ctx) {
  if (ctx.bgAsset || ctx.asset || ctx.assets) return null;
  return buildMotif({ visualMotif: scene.visualMotif, theme: ctx.theme, id: ctx.id, box: motifZone(ctx.layout, ctx.dims, ctx.bgTrack), T: ctx.T, L: ctx.clipDur });
}

// sceneTiming(scene, T, L) → entrance + exit anchors.
//   headAt — content enters almost IMMEDIATELY (≤0.2s). The old version anchored to
//     the LLM's first beat (up to 0.5s) which, with the exit finishing ~0.35s before
//     the boundary, left a near-empty GAP at every scene seam that read as stutter.
//   exitAt — held to just before the boundary; the scene clip lingers `overlap`
//     seconds past its end (see buildComposition) so the exit STRADDLES the seam and
//     cross-fades/pushes into the next scene's entrance instead of cutting to black.
function sceneTiming(scene, T, L) {
  const beats = (Array.isArray(scene && scene.beats) ? scene.beats : [])
    .filter((b) => b && typeof b.at === "number" && isFinite(b.at) && b.at >= 0 && b.at < L)
    .sort((a, b) => a.at - b.at);
  const headAt = beats.length ? r(T + Math.min(beats[0].at, 0.2)) : r(T + 0.12);
  const exitAt = r(T + L - 0.1);
  return { headAt, exitAt, beats };
}

// ---- archetypes --------------------------------------------------------------
// Each archetype is a pure function: (scene, ctx) -> { html, script } where the
// scene clip(s) live on ctx.track..ctx.track+K and animate within [T, T+L].
// They re-skin from ctx.theme; structure + motion are fixed.

// split a headline into <span class="kfw"> words, marking the emphasis word(s) as
// the single gradient/accent word.
function headlineSpans(headline, emphasis, theme) {
  const words = String(headline || "").trim().split(/\s+/).filter(Boolean);
  const emph = String(emphasis || "").trim().toLowerCase();
  return words.map((w) => {
    const isEmph = emph && emph.split(/\s+/).includes(w.toLowerCase().replace(/[.,!?]/g, ""));
    const cls = isEmph ? "kfw kfacc" : "kfw";
    return `<span class="${cls}">${esc(w)}</span>`;
  }).join(" ");
}

function archHook(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const place = placeContent(ctx.layout, dims);
  const center = place.align === "center";
  const ctr = center ? "margin-left:auto;margin-right:auto;" : "";
  const accentText = theme.gradients
    ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};`
    : `color:${theme.accent};`;
  const big = dims.width >= dims.height ? 92 : 66;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const kAt = r(Math.max(T + 0.1, headAt - 0.15)), subAt = r(headAt + 0.6), uAt = r(headAt + 0.7);
  const camOrg = ctx.layout === "fullbleed" ? "50% 100%" : "50% 50%";
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;">
  <div id="${id}c" style="${place.box}${center ? "text-align:center;" : ""}">
    <span id="${id}k" style="opacity:0;display:inline-flex;align-items:center;gap:10px;padding:8px 16px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 15px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:8px;height:8px;border-radius:50%;background:${theme.accent};"></span>${esc(ctx.kicker || "KEYFRAME")}</span>
    <h1 class="kfhead" style="margin-top:18px;font:800 ${big}px/0.99 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:${center ? "18ch" : "14ch"};${ctr}"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h1>
    ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:16px;font:500 ${Math.round(big * 0.3)}px/1.45 ${cssFont(theme)};color:${theme.dim};max-width:42ch;${ctr}">${esc(scene.subtext)}</p>` : ""}
    <div id="${id}u" style="margin-top:20px;width:${Math.round(big * 3)}px;max-width:42%;height:5px;border-radius:3px;background:linear-gradient(90deg,${theme.accent},${theme.accent2});transform:scaleX(0);transform-origin:left center;${ctr}"></div>
  </div>
</div>`;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam("#${id}c",${T},${r(ctx.clipDur)},1.0,1.055,"${camOrg}");`,
    `tl.fromTo("#${id}k",{opacity:0,y:14},{opacity:1,y:0,duration:0.5},${kAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.09);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:20},{opacity:1,y:0,duration:0.55},${subAt});` : "",
    `tl.fromTo("#${id}u",{scaleX:0},{scaleX:1,duration:0.7,ease:"power3.inOut"},${uAt});`,
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  const motif = maybeMotif(scene, ctx);
  return motif ? { html: `${html}\n${motif.html}`, script: `${s}\n${motif.script}` } : { html, script: s };
}

function archStat(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  // derive a number from the headline/emphasis, else a default
  const num = pickNumber(scene) || { value: 95, suffix: "%" };
  const big = dims.width >= dims.height ? 128 : 92;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;display:flex;align-items:center;justify-content:center;">
  <div class="kfstage" style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;padding:0 8%;width:100%;">
    <div id="${id}n" style="font:800 ${big}px/1 ${cssFont(theme)};letter-spacing:-0.04em;color:${theme.accent};">0${esc(num.suffix || "")}</div>
    <div class="kfhead" style="font:700 ${Math.round(big * 0.26)}px/1.15 ${cssFont(theme)};color:${theme.ink};max-width:18ch;"><style>#${id} .kfacc{color:${theme.accent2};}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</div>
    ${scene.subtext ? `<div id="${id}s" style="opacity:0;font:500 ${Math.round(big * 0.18)}px/1.4 ${cssFont(theme)};color:${theme.dim};max-width:40ch;">${esc(scene.subtext)}</div>` : ""}
  </div>
</div>`;
  const fmt = num.suffix === "%" ? `function(v){return v+"%";}` : (num.prefix ? `function(v){return ${JSON.stringify(num.prefix)}+v.toLocaleString();}` : `function(v){return v.toLocaleString()+${JSON.stringify(num.suffix || "")};}`);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam("#${id} .kfstage",${T},${r(ctx.clipDur)},1.0,1.08,"50% 50%");`,
    `countUp("${id}n",${num.value},${r(headAt)},${r(Math.min(1.6, L - 1))},${fmt});`,
    `reveal("${id}",${r(headAt + 0.15)},"${ctx.mode}",0.07);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:16},{opacity:1,y:0,duration:0.5},${r(headAt + 0.6)});` : "",
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

function archCta(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const big = dims.width >= dims.height ? 78 : 60;
  const btnBg = theme.gradients ? `linear-gradient(180deg,${theme.accent2 || theme.accent},${theme.accent})` : theme.accent;
  const btnInk = lum(theme.accent) > 150 ? "#15140F" : "#FFFFFF";
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;">
  ${theme.gradients ? `<div id="${id}g" class="clip" data-layout-allow-occlusion style="position:absolute;left:50%;top:46%;width:46%;height:60%;transform:translate(-50%,-50%);border-radius:50%;filter:blur(54px);background:radial-gradient(circle,${rgba(theme.accent, 0.30)},transparent 66%);"></div>` : ""}
  <div id="${id}c" style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center;padding:0 8%;">
    <h2 class="kfhead" style="font:800 ${big}px/1.02 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:16ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    ${scene.subtext ? `<div id="${id}b" style="opacity:0;display:inline-flex;align-items:center;gap:11px;padding:16px 36px;border-radius:9999px;background:${btnBg};color:${btnInk};font:800 ${Math.round(big * 0.34)}px/1 ${cssFont(theme)};">${esc(scene.subtext)} <span style="width:11px;height:11px;border-right:3px solid ${btnInk};border-top:3px solid ${btnInk};transform:rotate(45deg);display:inline-block;"></span></div>` : ""}
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const gAt = r(Math.max(T + 0.05, headAt - 0.2)), btnAt = r(headAt + 0.6), pulseAt = r(headAt + 1.2);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam("#${id}c",${T},${r(ctx.clipDur)},1.07,1.0,"50% 50%");`,
    theme.gradients ? `tl.fromTo("#${id}g",{opacity:0,scale:0.85},{opacity:1,scale:1,duration:0.8},${gAt});` : "",
    `reveal("${id}",${headAt},"${ctx.mode}",0.08);`,
    scene.subtext ? `tl.fromTo("#${id}b",{opacity:0,scale:0.85,y:16},{opacity:1,scale:1,y:0,duration:0.6,ease:"back.out(1.7)"},${btnAt});` : "",
    scene.subtext ? `tl.to("#${id}b",{scale:1.04,duration:0.8,ease:"sine.inOut",yoyo:true,repeat:sreps(${r(L - 1)},1.6)},${pulseAt});` : "",
    // last scene: trans="none" → xout holds to D; otherwise the authored transition.
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  const motif = maybeMotif(scene, ctx);
  return motif ? { html: `${html}\n${motif.html}`, script: `${s}\n${motif.script}` } : { html, script: s };
}

// Generic text scene (bullet/quote/caption/shape-motion) — kicker + headline +
// sub, with a side accent rule. A safe, dense default until per-kind archetypes
// (asset-grid, split-diagram, terminal) are added from the design pass.
function archText(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const place = placeContent(ctx.layout, dims);
  const center = place.align === "center";
  const ctr = center ? "margin-left:auto;margin-right:auto;" : "";
  const big = dims.width >= dims.height ? 68 : 52;
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const bullets = Array.isArray(scene.bullets) ? scene.bullets.filter(Boolean).slice(0, 3) : [];
  const camOrg = ctx.layout === "fullbleed" ? "50% 100%" : (place.split ? "0% 50%" : "50% 50%");
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;">
  <div id="${id}c" style="${place.box}${center ? "text-align:center;" : ""}">
    <div id="${id}u" style="width:54px;height:5px;border-radius:3px;background:linear-gradient(90deg,${theme.accent},${theme.accent2});margin-bottom:22px;transform:scaleX(0);transform-origin:left center;${center ? "margin-left:auto;margin-right:auto;" : ""}"></div>
    <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:20ch;${ctr}"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:14px;font:500 ${Math.round(big * 0.36)}px/1.45 ${cssFont(theme)};color:${theme.dim};max-width:44ch;${ctr}">${esc(scene.subtext)}</p>` : ""}
    ${bullets.length ? `<div id="${id}bl" style="margin-top:20px;display:flex;flex-direction:column;gap:10px;${center ? "align-items:center;" : ""}">${bullets.map((b) => `<div class="kfbl" style="opacity:0;display:flex;align-items:center;gap:12px;font:600 ${Math.round(big * 0.3)}px/1.2 ${cssFont(theme)};color:${theme.ink};"><span style="width:9px;height:9px;border-radius:2px;background:${theme.accent};"></span>${esc(b)}</div>`).join("")}</div>` : ""}
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const uAt = r(Math.max(T + 0.05, headAt - 0.2)), subAt = r(headAt + 0.55), blAt = r(headAt + 0.7);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam("#${id}c",${T},${r(ctx.clipDur)},1.0,1.05,"${camOrg}");`,
    `tl.fromTo("#${id}u",{scaleX:0},{scaleX:1,duration:0.5,ease:"power3.inOut"},${uAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.07);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:18},{opacity:1,y:0,duration:0.5},${subAt});` : "",
    bullets.length ? `tl.fromTo("#${id} .kfbl",{opacity:0,x:-18},{opacity:1,x:0,duration:0.45,stagger:0.12,ease:"power2.out"},${blAt});` : "",
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  // Bullets already fill the frame; a motif is for the bare headline+sub case.
  const motif = bullets.length ? null : maybeMotif(scene, ctx);
  return motif ? { html: `${html}\n${motif.html}`, script: `${s}\n${motif.script}` } : { html, script: s };
}

// Partition the fetched assets into the kinds the kit places differently:
// website screenshots (device-framed hero), vectors/illustrations (drawn-in side
// art or grids), and photos (scrimmed full-bleed). Paths are relative to jobDir.
function partitionAssets(assets) {
  const screenshots = [], vectors = [], photos = [];
  const seen = new Set();
  for (const a of (assets || [])) {
    if (!a || !a.path) continue;
    // Skip VIDEO assets — the kit renders <img> only, so a video file in an <img>
    // is a broken frame. Drop it (a clean image-based render beats a broken tile;
    // proper <video> b-roll is a future enhancement). Detect by type or extension.
    if (a.type === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(a.path)) continue;
    // DE-DUPLICATE by source URL: the same stock image is often fetched for several
    // scene needs and saved as 3.jpg / 4.jpg / 8.jpg (distinct paths, identical
    // picture), which made montages show the same photo 3×. Key on sourceUrl, fall
    // back to path. This is the fix for the "duplicate tile" defect.
    const key = String(a.sourceUrl || a.path).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const s = `${a.source || ""} ${a.style || ""} ${a.alt || ""}`.toLowerCase();
    if (a.source === "website" || /screenshot|webpage|web page|landing|\bsite\b/.test(s)) screenshots.push(a);
    else if (/\.svg($|\?)/i.test(a.path) || /vector|illustration|icon|line.?art|graphic/.test(s)) vectors.push(a);
    else photos.push(a);
  }
  return { screenshots, vectors, photos };
}

// SCREENSHOT-HERO — the user's real website screenshot in a per-pack device frame
// (rounded glass chrome for cinematic packs; a hard-bordered card with an offset
// solid shadow for flat packs), with side copy and a slow Ken-Burns scroll inside
// the frame (the reactive beat). Landscape = side-by-side; portrait = stacked.
function archScreenshotHero(scene, ctx) {
  const { theme, id, T, L, track, dims, asset } = ctx;
  const land = dims.width >= dims.height;
  const flat = !theme.gradients;
  const chrome = flat
    ? `background:${theme.ground};border:3px solid ${theme.ink};border-radius:14px;box-shadow:10px 10px 0 ${theme.accent};`
    : `background:${mix(theme.ground, "#ffffff", 0.06)};border:1px solid ${theme.line};border-radius:16px;box-shadow:0 40px 90px rgba(0,0,0,0.5);`;
  const barBg = flat ? mix(theme.ground, theme.ink, 0.06) : rgba("#ffffff", 0.05);
  const big = land ? 56 : 46;
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const dots = ["#FF5F57", "#FEBC2E", "#28C840"].map((c) => `<span style="width:11px;height:11px;border-radius:50%;background:${flat ? theme.ink : c};display:inline-block;"></span>`).join("");
  const frameW = land ? "52%" : "84%";
  const frameWrap = land
    ? `position:absolute;left:5%;top:50%;transform:translateY(-50%);width:${frameW};`
    : `position:absolute;left:8%;right:8%;top:8%;width:84%;`;
  const copyWrap = land
    ? `position:absolute;right:5%;top:50%;transform:translateY(-50%);width:34%;`
    : `position:absolute;left:8%;right:8%;bottom:8%;width:84%;text-align:center;`;
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;">
  <div id="${id}fr" class="kfstage" style="${frameWrap}${chrome}overflow:hidden;">
    <div style="height:42px;display:flex;align-items:center;gap:9px;padding:0 16px;background:${barBg};border-bottom:1px solid ${theme.line};">${dots}<span style="margin-left:12px;flex:1;max-width:340px;height:22px;border-radius:9999px;background:${rgba(theme.ink, 0.08)};"></span></div>
    <div style="position:relative;width:100%;height:${land ? Math.round(dims.height * 0.62) : Math.round(dims.height * 0.42)}px;overflow:hidden;"><img id="${id}img" src="${esc(asset.path)}" alt="${esc(asset.alt || "screenshot")}" style="position:absolute;top:0;left:0;width:100%;height:auto;min-height:100%;object-fit:cover;object-position:top center;"></div>
  </div>
  <div style="${copyWrap}">
    <span id="${id}k" style="opacity:0;display:inline-flex;align-items:center;gap:9px;padding:7px 15px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 13px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:7px;height:7px;border-radius:50%;background:${theme.accent};"></span>${esc(ctx.kicker || "Live")}</span>
    <h2 class="kfhead" style="margin-top:14px;font:800 ${big}px/1.05 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:13px;font:500 ${Math.round(big * 0.42)}px/1.45 ${cssFont(theme)};color:${theme.dim};">${esc(scene.subtext)}</p>` : ""}
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const frAt = r(Math.max(T + 0.05, headAt - 0.35)), kAt = r(Math.max(T + 0.1, headAt - 0.15)), subAt = r(headAt + 0.45);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `tl.fromTo("#${id}fr",{opacity:0,yPercent:6,rotationX:12,transformPerspective:1200,transformOrigin:"50% 100%"},{opacity:1,yPercent:0,rotationX:0,duration:0.85,ease:"expo.out"},${frAt});`,
    `tl.fromTo("#${id}img",{y:0},{y:function(i,el){var h=el.scrollHeight-el.clientHeight;return -(h>0?Math.min(h,el.clientHeight*0.5):0);},duration:${r(L - 0.6)},ease:"sine.inOut"},${r(frAt + 0.3)});`,
    `tl.fromTo("#${id}k",{opacity:0,y:12},{opacity:1,y:0,duration:0.5},${kAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.08);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:14},{opacity:1,y:0,duration:0.5},${subAt});` : "",
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

// SPLIT-VECTOR — headline on one side, a vector/illustration on the other that
// floats/draws in. The reactive beat is the art's entrance + a gentle float.
function archSplitVector(scene, ctx) {
  const { theme, id, T, L, track, dims, asset } = ctx;
  const land = dims.width >= dims.height;
  const big = land ? 64 : 50;
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const dir = land ? "row" : "column";
  const artGlow = theme.gradients ? `filter:drop-shadow(0 18px 40px ${rgba(theme.accent, 0.35)});` : "";
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;display:flex;align-items:center;justify-content:center;">
  <div class="kfstage" style="display:flex;flex-direction:${dir};align-items:center;gap:${land ? 56 : 28}px;width:100%;padding:0 7%;">
    <div style="flex:1;">
      <div id="${id}u" style="width:54px;height:5px;border-radius:3px;background:linear-gradient(90deg,${theme.accent},${theme.accent2});margin-bottom:20px;transform:scaleX(0);transform-origin:left center;"></div>
      <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
      ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:14px;font:500 ${Math.round(big * 0.4)}px/1.45 ${cssFont(theme)};color:${theme.dim};">${esc(scene.subtext)}</p>` : ""}
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;"><img id="${id}art" src="${esc(asset.path)}" alt="${esc(asset.alt || "")}" style="width:100%;max-width:${land ? "44%" : "60%"};height:auto;max-height:${Math.round(dims.height * (land ? 0.6 : 0.34))}px;object-fit:contain;${artGlow}"></div>
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const uAt = r(Math.max(T + 0.05, headAt - 0.2)), subAt = r(headAt + 0.5), artAt = r(Math.max(T + 0.1, headAt - 0.05));
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `tl.fromTo("#${id}u",{scaleX:0},{scaleX:1,duration:0.5,ease:"power3.inOut"},${uAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.07);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:16},{opacity:1,y:0,duration:0.5},${subAt});` : "",
    `tl.fromTo("#${id}art",{opacity:0,scale:0.82,y:24},{opacity:1,scale:1,y:0,duration:0.7,ease:"back.out(1.5)"},${artAt});`,
    `tl.to("#${id}art",{y:"-=14",duration:1.6,ease:"sine.inOut",yoyo:true,repeat:sreps(${r(L - 0.8)},1.6)},${r(headAt + 0.8)});`,
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

// ASSET MONTAGE — a tiled grid of 3–6 real assets (extra screenshots, curated
// vectors, photos) that pop in on a stagger under a headline. This is the
// work-horse that surfaces the bulk of the fetched pool the single-feature
// archetypes (hero / split) leave unused.
function archAssetMontage(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const items = (ctx.assets || []).slice(0, 6);
  const n = items.length || 1;
  const land = dims.width >= dims.height;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  const big = land ? 54 : 44;
  const flat = !theme.gradients;
  const accentText = theme.gradients
    ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};`
    : `color:${theme.accent};`;
  const tileChrome = flat
    ? `border:3px solid ${theme.ink};box-shadow:6px 6px 0 ${theme.accent};`
    : `border:1px solid ${theme.line};box-shadow:0 22px 50px rgba(0,0,0,0.45);`;
  const tileH = Math.round(dims.height * (land ? 0.2 : 0.15));
  const tiles = items.map((a) => {
    const meta = `${a.source || ""} ${a.style || ""} ${a.alt || ""}`.toLowerCase();
    const isVec = /\.svg($|\?)/i.test(a.path) || /vector|illustration|icon|line.?art|graphic/.test(meta);
    const fit = isVec ? "contain" : "cover";
    const pad = isVec ? `background:${rgba(theme.ink, theme.isDark ? 0.06 : 0.04)};padding:14px;` : "";
    // Photo tiles get the palette grade so a grid of stock reads as one set in the
    // pack's colour story; vectors/icons stay true (a tint would muddy line art).
    const grade = isVec ? "" : photoGrade(theme);
    return `<div class="kftile" style="position:relative;opacity:0;overflow:hidden;border-radius:${flat ? 8 : 14}px;${tileChrome}${pad}height:${tileH}px;display:flex;align-items:center;justify-content:center;"><img src="${esc(a.path)}" alt="${esc(a.alt || "")}" style="width:100%;height:100%;object-fit:${fit};display:block;">${grade}</div>`;
  }).join("");
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;">
  <div style="position:absolute;left:6%;right:6%;top:50%;transform:translateY(-50%);">
    <div id="${id}u" style="width:54px;height:5px;border-radius:3px;background:linear-gradient(90deg,${theme.accent},${theme.accent2});margin-bottom:18px;transform:scaleX(0);transform-origin:left center;"></div>
    <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:22ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    <div id="${id}g" style="margin-top:22px;display:grid;grid-template-columns:repeat(${cols},1fr);gap:${land ? 18 : 12}px;">${tiles}</div>
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const uAt = r(Math.max(T + 0.05, headAt - 0.2)), tileAt = r(headAt + 0.3);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `tl.fromTo("#${id}u",{scaleX:0},{scaleX:1,duration:0.5,ease:"power3.inOut"},${uAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.06);`,
    `tl.fromTo("#${id} .kftile",{opacity:0,scale:0.82,y:26},{opacity:1,scale:1,y:0,duration:0.55,stagger:0.1,ease:"back.out(1.5)"},${tileAt});`,
    `tl.to("#${id} .kftile",{y:"-=8",duration:1.8,ease:"sine.inOut",yoyo:true,stagger:0.12,repeat:sreps(${r(L - 1.2)},1.8)},${r(tileAt + 0.95)});`,
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

// SCRIM B-ROLL — a leftover photo as a full-bleed, darkened, slowly-scaling
// background behind a scene that carries no foreground asset. The scrim gradient
// guarantees text contrast; data-layout-allow-occlusion keeps occlusion lint
// calm (the scene's text clip is meant to sit over it). Cinematic packs only.
function scrimBg(asset, ctx) {
  const { theme, id, T, L } = ctx;
  if (!asset) return null;
  const g = theme.ground;
  const scrim = `linear-gradient(180deg, ${rgba(g, 0.55)} 0%, ${rgba(g, 0.74)} 55%, ${rgba(g, 0.9)} 100%)`;
  const seed = (parseInt(String(id).replace(/\D/g, ""), 10) || 0);
  const kb = kenBurns(seed);
  // photo (bottom) → palette grade (tints stock to the pack) → scrim (text contrast)
  const html = `<div id="${id}bg" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${ctx.bgTrack}" data-layout-allow-occlusion style="opacity:0;overflow:hidden;"><img id="${id}bgi" src="${esc(asset.path)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">${photoGrade(theme)}<div style="position:absolute;inset:0;background:${scrim};"></div></div>`;
  const s = [
    `tl.fromTo("#${id}bg",{opacity:0},{opacity:1,duration:0.6},${r(T)});`,
    `tl.fromTo("#${id}bgi",{scale:${kb.from},xPercent:0,yPercent:0},{scale:${kb.to},xPercent:${kb.dx},yPercent:${kb.dy},duration:${r(ctx.clipDur)},ease:"none",transformOrigin:"${kb.origin}"},${r(T)});`,
    ctx.isLast ? "" : `tl.to("#${id}bg",{opacity:0,duration:0.35,ease:"power2.in"},${r(T + L - 0.1)});`,
  ].join("\n");
  return { html, script: s };
}

// Pull up to `max` assets for a montage, round-robin across kinds for variety.
function takeMontage(pools, max) {
  const out = [];
  const order = [pools.screenshots, pools.vectors, pools.photos];
  let progressed = true;
  while (out.length < max && progressed) {
    progressed = false;
    for (const arr of order) {
      if (out.length < max && arr.length) { out.push(arr.shift()); progressed = true; }
    }
  }
  return out;
}

function cssFont(theme) { return theme.fontStack; }
function r(n) { return Math.round(n * 100) / 100; }

function pickNumber(scene) {
  const hay = `${scene.headline || ""} ${scene.emphasis || ""} ${scene.subtext || ""}`;
  const m = /([₹$€£]?)\s?(\d[\d,]*)\s?([%x+]|M|K|B|hrs?|hours?|days?)?/i.exec(hay);
  if (!m) return null;
  const value = clamp(parseInt(m[2].replace(/,/g, ""), 10) || 0, 0, 9_999_999);
  if (!value) return null;
  return { value, prefix: m[1] || "", suffix: (m[3] || "").replace(/hours?|hrs?/i, "") };
}

// TERMINAL — a real shell/editor window with the command(s) typed character by
// character + a blinking caret. This is what a storyboard `animation:"typewriter"`
// scene (mandated for tech/IT topics) was supposed to be; without it the command
// rendered as a plain centered line of text and the "show real code" beat was lost.
function archTerminal(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const land = dims.width >= dims.height;
  const flat = !theme.gradients;
  const lines = [scene.headline, scene.subtext, ...(Array.isArray(scene.bullets) ? scene.bullets : [])]
    .map((x) => String(x == null ? "" : x).trim()).filter(Boolean).slice(0, 4);
  if (!lines.length) lines.push("$ run --help");
  const mono = "'JetBrains Mono','Fira Code','Cascadia Code',ui-monospace,Menlo,Consolas,monospace";
  const fs = land ? 30 : 23;
  const winW = land ? "72%" : "88%";
  const chrome = flat
    ? `background:${mix(theme.ground, theme.ink, 0.05)};border:3px solid ${theme.ink};box-shadow:12px 12px 0 ${theme.accent};`
    : `background:${mix(theme.ground, "#000000", 0.28)};border:1px solid ${theme.line};box-shadow:0 40px 90px rgba(0,0,0,0.5);`;
  const dots = ["#FF5F57", "#FEBC2E", "#28C840"].map((c) => `<span style="width:13px;height:13px;border-radius:50%;background:${flat ? theme.ink : c};display:inline-block;"></span>`).join("");
  const caret = `<span id="${id}car" style="display:inline-block;width:${Math.round(fs * 0.5)}px;height:${Math.round(fs * 1.0)}px;background:${theme.accent};vertical-align:text-bottom;margin-left:4px;"></span>`;
  const lineEls = lines.map((ln, i) =>
    `<div style="display:flex;align-items:baseline;gap:11px;margin-top:${i ? 14 : 0}px;"><span style="color:${theme.accent};flex:none;">${i === 0 ? "$" : "›"}</span><span id="${id}t${i}" style="color:${theme.ink};white-space:pre-wrap;word-break:break-word;"></span>${i === lines.length - 1 ? caret : ""}</div>`
  ).join("");
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;">
  <div id="${id}fr" class="kfstage" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${winW};border-radius:14px;${chrome}overflow:hidden;font:600 ${fs}px/1.5 ${mono};">
    <div style="height:46px;display:flex;align-items:center;gap:10px;padding:0 18px;background:${rgba(theme.ink, flat ? 0.05 : 0.08)};border-bottom:1px solid ${theme.line};">${dots}<span style="margin-left:12px;color:${theme.dim};font:600 ${Math.round(fs * 0.5)}px/1 ${mono};letter-spacing:.05em;">bash — keyframe</span></div>
    <div style="padding:30px 32px;min-height:${Math.round(dims.height * (land ? 0.22 : 0.18))}px;">${lineEls}</div>
  </div>
</div>`;
  const end = ctx.clipEnd;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `tl.fromTo("#${id}fr",{opacity:0,scale:0.95,yPercent:3},{opacity:1,scale:1,yPercent:0,duration:0.5,ease:"expo.out"},${r(T + 0.1)});`,
  ];
  let cursor = T + 0.55;
  lines.forEach((ln, i) => {
    const dur = Math.max(0.4, Math.min(2.0, ln.length * 0.045));
    s.push(`typeLine("${id}t${i}",${JSON.stringify(ln)},${r(cursor)},${r(dur)});`);
    cursor += dur + 0.25;
  });
  s.push(`tl.to("#${id}car",{opacity:0,duration:0.5,ease:"steps(1)",yoyo:true,repeat:sreps(${r(L - 0.6)},0.5)},${r(T + 0.6)});`);
  s.push(`xout("#${id}",${r(T + L - 0.1)},${end},"${ctx.trans}");`);
  return { html, script: s.join("\n") };
}

// Map a storyboard scene.kind to an archetype builder.
function archetypeFor(scene, idx, total) {
  const k = (scene.kind || "").toLowerCase();
  if (idx === 0 || k === "hook" || k === "title") return archHook;
  if (idx === total - 1 || k === "cta") return archCta;
  // A typewriter scene (mandated for tech topics) → a real terminal window.
  if (String(scene.animation || "").toLowerCase() === "typewriter") return archTerminal;
  if (k === "chart" || k === "countdown") return archStat;
  if (pickNumber(scene)) return archStat;        // any scene with a strong number
  return archText;                                // bullet / quote / caption / shape-motion
}

// Seek-safe caption track (one node, recomputed each frame — never one clip/line).
function buildCaptions(captionCues, dims, D, theme, track) {
  const cues = Array.isArray(captionCues) ? captionCues.filter((c) => c && c.text) : [];
  if (!cues.length) return null;
  const data = JSON.stringify(cues.map((c) => [r(c.start || 0), r(c.end || (c.start || 0) + 2), String(c.text)]));
  const html = `<div class="clip" data-start="0" data-duration="${D}" data-track-index="${track}"><div id="kfcap" style="position:absolute;left:50%;bottom:5%;transform:translateX(-50%);max-width:76%;text-align:center;padding:11px 22px;border-radius:12px;background:${rgba(theme.isDark ? "#080c12" : "#0c0c0c", 0.72)};border:1px solid ${rgba("#ffffff", 0.10)};color:#F4F7FA;font:600 ${Math.round(dims.height * 0.034)}px/1.3 ${cssFont(theme)};opacity:0;"></div></div>`;
  const script = `var kfcd=${data};var kfcp={t:0};tl.to(kfcp,{t:${D},duration:${D},ease:"none",onUpdate:function(){var el=document.getElementById("kfcap");if(!el)return;var n=kfcp.t,a=null;for(var k=0;k<kfcd.length;k++){if(n>=kfcd[k][0]&&n<kfcd[k][1]){a=kfcd[k];break;}}if(a){if(el.textContent!==a[2])el.textContent=a[2];el.style.opacity="1";}else el.style.opacity="0";}},0);`;
  return { html, script };
}

// MAIN ENTRY — assemble the full composition.
function buildComposition({ storyboard, dims, framePack, assets, captionCues } = {}) {
  const sb = storyboard || {};
  const scenes = Array.isArray(sb.scenes) && sb.scenes.length ? sb.scenes : [{ id: "s1", start: 0, duration: dims.fps ? 4 : 4, kind: "hook", headline: sb.title || "KEYFRAME" }];
  const D = r(sb.durationSec || scenes.reduce((a, s) => a + (s.duration || 0), 0) || 12);
  const theme = deriveTheme(framePack, sb);
  const W = dims.width, H = dims.height;

  const seed = strSeed((sb.title || "") + "|" + (framePack || ""));
  const bg = buildBackground(theme, dims, D, framePack, seed);
  const bodyHtml = [bg.html];
  const scriptLines = [emitHelpers(D), bg.script];

  // ---- ASSET WEAVING ---------------------------------------------------------
  // The agents fetch a POOL of candidate assets (often 8–15); the single-feature
  // archetypes alone consume only 1–2 and the rest are dropped. To actually
  // surface the pool we weave in three tiers, ordered by credibility:
  //   • real screenshots + curated vectors  -> PROMINENT foreground (hero/split)
  //   • leftover assets (≥3)                 -> a MONTAGE grid scene (3–6 at once)
  //   • leftover photos                      -> scrimmed B-roll BACKGROUNDS behind
  //                                             text scenes (cinematic packs only;
  //                                             the scrim guarantees text contrast)
  // The agents still "think" (they picked these assets); the kit places them,
  // guaranteed clean. Each scene owns a 3-track block [bg, content, spare] so a
  // background never collides with (or covers) another scene's content.
  const pools = partitionAssets(assets);
  const plan = scenes.map((scene, i) => {
    const T = r(scene.start != null ? scene.start : scriptStart(scenes, i));
    const L = r(scene.duration || 4);
    const base = 20 + i * 3;                 // [bg=base, content=base+1] — unique track block; 0–9 reserved for background + pack-signature, 900+ for the filmic overlay
    const isLast = i === scenes.length - 1;
    // Each non-last scene's clip LINGERS `OVERLAP` seconds past its nominal end (its
    // own track, so no collision) so its exit straddles the seam and visually crosses
    // into the next scene's entrance — continuous motion instead of cut-to-black.
    const clipDur = isLast ? L : r(L + OVERLAP);
    const ctx = {
      theme, dims, id: `s${i + 1}`, T, L,
      clipDur, clipEnd: r(T + clipDur),
      track: base + 1, bgTrack: base,
      isLast,
      kicker: i === 0 ? (sb.title || "KEYFRAME") : "",
      asset: null, assets: null, bgAsset: null,
      // per-scene authored intent (was previously discarded by the kit)
      layout: layoutFor(scene, i),
      mode: revealMode(scene),
      trans: transOut(scene, isLast),
      timing: sceneTiming(scene, T, L),
    };
    return { scene, i, ctx, isContent: i > 0 && i < scenes.length - 1, build: archetypeFor(scene, i, scenes.length) };
  });

  const leftover = () => pools.screenshots.length + pools.vectors.length + pools.photos.length;
  let usedShot = false, montageDone = false;

  // Pass 1 — foreground features on plain-text content scenes (never override a
  // hook / stat / cta — those carry their own beat). Rotate a fresh screenshot
  // hero, reserve one scene for a montage when the pool is deep, then split-art.
  for (const p of plan) {
    if (p.build !== archText || !p.isContent) continue;
    if (!usedShot && pools.screenshots.length) {
      p.ctx.asset = pools.screenshots.shift(); p.build = archScreenshotHero; usedShot = true;
      p.ctx.kicker = p.scene.emphasis || "Live preview";
    } else if (!montageDone && leftover() >= 3) {
      p.ctx.assets = takeMontage(pools, 6); p.build = archAssetMontage; montageDone = true;
    } else if (pools.vectors.length) {
      p.ctx.asset = pools.vectors.shift(); p.build = archSplitVector;
    } else if (pools.photos.length) {
      p.ctx.asset = pools.photos.shift(); p.build = archSplitVector;
    } else if (pools.screenshots.length) {
      p.ctx.asset = pools.screenshots.shift(); p.build = archScreenshotHero;
      p.ctx.kicker = p.scene.emphasis || "Live preview";
    }
  }

  // Pass 2 — scrim B-roll behind any scene that still has no foreground asset
  // (cinematic packs only; never the branded hook). Spends the leftover photos
  // first (lowest-value as a foreground), then any remaining screenshots/vectors.
  if (theme.gradients) {
    // Full-bleed scrim b-roll is the MOST prominent asset slot, so only REAL brand
    // imagery (site screenshots / scraped page images) is allowed here. A generic
    // stock photo full-screen is the worst "off-topic b-roll" offender (the windmill
    // / old-woman / suitcase). Stock stays for small montage tiles or goes unused —
    // the visualMotif vector + pack background fill a scene with no real photo.
    const isReal = (a) => /website/.test((a && a.source) || "");
    for (const p of plan) {
      if (p.i === 0 || p.ctx.asset || p.ctx.assets) continue;
      const ri = pools.photos.findIndex(isReal);
      const a = ri >= 0 ? pools.photos.splice(ri, 1)[0] : pools.screenshots.shift();
      if (a) p.ctx.bgAsset = a;
    }
  }

  // Pass 3 — emit each scene (its scrim background first, so it sits under the
  // content clip), in storyboard order.
  for (const p of plan) {
    const bg = p.ctx.bgAsset ? scrimBg(p.ctx.bgAsset, p.ctx) : null;
    const out = p.build(p.scene, p.ctx);
    const tag = p.ctx.assets ? " +montage" : p.ctx.asset ? " +asset" : p.ctx.bgAsset ? " +bg" : "";
    bodyHtml.push(`<!-- s${p.i + 1} ${p.scene.kind || ""}${tag} [${p.ctx.T}–${r(p.ctx.T + p.ctx.L)}] -->`);
    if (bg) bodyHtml.push(bg.html);
    bodyHtml.push(out.html);
    scriptLines.push(`// s${p.i + 1}`);
    if (bg) scriptLines.push(bg.script);
    scriptLines.push(out.script);
  }

  // FILMIC OVERLAY — the pack's foremost layer (vignette + film grain), above scene
  // content (track 900) but below captions, so the whole frame gets cinematic
  // falloff/texture instead of reading as a flat CSS theme.
  const film = packAtoms.overlay(framePack, theme, dims, D, 900);
  if (film.html) {
    bodyHtml.push(`<!-- pack filmic overlay -->`, film.html);
    for (const sc of film.script) scriptLines.push(sc);
  }

  const cap = buildCaptions(captionCues, dims, D, theme, 950);
  if (cap) { bodyHtml.push(cap.html); scriptLines.push("// captions", cap.script); }

  scriptLines.push(`window.__timelines = window.__timelines || {};`, `window.__timelines["vid"] = tl;`);

  const indexHtml = [
    `<!DOCTYPE html>`, `<html>`, `<head>`, `<meta charset="utf-8">`, `<title>vid</title>`,
    `<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>`,
    `<style>`,
    `* { margin:0; padding:0; box-sizing:border-box; }`,
    `body { font-family:${theme.fontStack}; }`,
    `#root { position:relative; overflow:hidden; background:${theme.ground}; }`,
    `.clip { position:absolute; inset:0; }`,
    // .kfw MUST be inline-block or the per-word transforms (yPercent/xPercent/scale)
    // are silently dropped (CSS ignores transforms on inline elements) — this is why
    // the old word-stagger only ever faded. .kfhead is the container-reveal target.
    `.kfw { display:inline-block; will-change:transform,opacity,filter; }`,
    `.kfhead { will-change:transform,opacity,clip-path; }`,
    `</style>`, `</head>`, `<body>`,
    `<div id="root" data-composition-id="vid" data-start="0" data-width="${W}" data-height="${H}" data-duration="${D}">`,
    bodyHtml.join("\n"),
    `</div>`,
    `<script>`,
    scriptLines.join("\n"),
    `</script>`, `</body>`, `</html>`,
  ].join("\n");

  const metaJson = JSON.stringify({ compositionId: "vid", width: W, height: H, fps: dims.fps || 30, duration: D });
  return { indexHtml, metaJson };
}

function scriptStart(scenes, i) { let s = 0; for (let k = 0; k < i; k++) s += scenes[k].duration || 0; return s; }

module.exports = { buildComposition, deriveTheme, FLAT_PACKS };
