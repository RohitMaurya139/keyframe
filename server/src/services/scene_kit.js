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

const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");
const frameRegistry = require("./frame_registry");
const { themeFromTokens } = require("./enrich");
const packAtoms = require("./pack_atoms");
const { buildMotif } = require("./scene_motifs");

// Pack DISPLAY fonts are bundled as woff2 under server/assets/fonts and embedded as
// data-URI @font-face at build time. The pinned renderer only auto-resolves a handful of
// web-safe faces, so without this a pack's real display font (Anton, Fraunces, …) fell
// back to Inter and every pack looked identical. Cached base64 (read once per process).
const FONTS_DIR = path.resolve(__dirname, "..", "..", "assets", "fonts");
const _fontCache = new Map();
function fontFileFor(face) {
  return String(face || "").toLowerCase().trim().replace(/\s+/g, "-"); // "Space Grotesk" → "space-grotesk"
}
// @font-face CSS (data-URI) for a display face, or "" if we don't bundle it (→ falls back
// to Inter, no lint error). Family name is the exact face so `'Anton'` in CSS resolves.
function fontFaceCss(face) {
  if (!face) return "";
  if (_fontCache.has(face)) return _fontCache.get(face);
  let css = "";
  try {
    const file = path.join(FONTS_DIR, `${fontFileFor(face)}.woff2`);
    const b64 = fs.readFileSync(file).toString("base64");
    css = `@font-face{font-family:'${face}';font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  } catch { css = ""; }
  _fontCache.set(face, css);
  return css;
}
// Headline font: the pack's DISPLAY face when it's bundled (so it actually renders),
// else the safe Inter stack. Body/subtext always use cssFont (Inter).
function cssHead(theme) {
  return (theme && theme.displayFace && fontFaceCss(theme.displayFace)) ? theme.displayFont : (theme ? theme.fontStack : SAFE_FONTS);
}

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
  // BRAND COLORS (scraped from the site / provided) drive the ACCENTS — the pops:
  // text emphasis, glows, rules, buttons, motifs — so every video reads on-brand.
  // The PACK still owns ground, fonts and structure, so we keep its cinematic
  // identity instead of flattening to a recolor. Colors that vanish against the
  // ground are dropped by the contrast filter below.
  const brandColors = (((storyboard && storyboard.brandColors) || []))
    .filter((c) => /^#[0-9a-f]{6}$/i.test(String(c || "").trim()))
    .map((c) => c.trim());
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
  // Brand colors that already contrast are used as-is; ones that would VANISH against
  // the ground (a dark-navy brand on a near-black pack) are LIFTED — same hue, forced
  // to a visible lightness + vivid saturation — so the brand's colour identity still
  // shows instead of being silently dropped. This is what makes the accents on-brand.
  const liftAccent = (c) => {
    if (Math.abs(lum(c) - lum(ground)) > 55) return c;
    const [h, s] = hexToHsl(c);
    const lifted = hslToHex(h, Math.min(1, Math.max(0.58, s)), isDark ? 0.62 : 0.42);
    return Math.abs(lum(lifted) - lum(ground)) > 45 ? lifted : null;
  };
  const brandAccents = brandColors.map(liftAccent).filter(Boolean);
  // Brand accents take PRIORITY (prepended), then pack accents, then safe brights backfill —
  // all through the same ground-contrast filter so nothing muddy survives.
  accents = [...brandAccents, ...accents].filter((a) => Math.abs(lum(a) - lum(ground)) > 55);
  accents = [...new Map(accents.map((c) => [c.toLowerCase(), c])).values()]; // dedup, keep first/order
  for (const c of safeBright) { if (accents.length >= 2) break; if (!accents.some((a) => a.toLowerCase() === c.toLowerCase())) accents.push(c); }
  accents = accents.slice(0, 4);
  // Force maximum text contrast against the ground (the storyboard's text hex is
  // often a mid-tone that reads as muddy).
  ink = isDark ? "#FFFFFF" : "#14130E";
  // BODY stays on the safe stack (Inter is a great, legible body face on every pack).
  // The DISPLAY font is the pack's IDENTITY (Anton, Fraunces, Space Grotesk, Archivo
  // Black, Instrument Serif…) — HyperFrames' compiler embeds these Google faces
  // automatically, so headlines now carry each pack's real typographic personality
  // instead of all rendering in Inter (the #1 reason every pack looked identical).
  const MONO = new Set(["jetbrains mono", "fira code", "cascadia code", "ibm plex mono"]);
  const faceCands = (fonts || [])
    .map((f) => String(f || "").trim())
    .filter((f) => f && f.toLowerCase() !== "inter" && !MONO.has(f.toLowerCase()));
  // Prefer the pack's MOST display-y face (last in its list — e.g. bauhaus "Archivo Black"
  // over "Archivo", biennale "Instrument Serif" over "Archivo") that we actually bundle a
  // woff2 for; fall back to the first bundled one, else none (→ Inter, no lint error).
  const displayFace = [...faceCands].reverse().find((f) => fontFaceCss(f)) || faceCands.find((f) => fontFaceCss(f)) || null;
  return {
    ground, ink, accents,
    accent: accents[0],
    accent2: accents[1] || accents[0],
    fontStack: SAFE_FONTS,
    displayFont: displayFace ? `'${displayFace}', ${SAFE_FONTS}` : SAFE_FONTS,
    displayFace: displayFace || null,
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
    // cam3D(sel, at, dur, s0, s1, org) — a real CSS-3D camera move: scale push PLUS a slow
    // yaw/pitch/dolly (rotationY/rotationX/z) with per-element perspective, so the scene
    // lives in 3D space (depth + parallax) instead of a flat plane. One tween → no transform
    // conflict. Pure CSS transforms, so HyperFrames captures it deterministically (unlike WebGL).
    `function cam3D(sel,at,dur,s0,s1,org){ tl.fromTo(sel,{scale:s0,rotationY:-3.4,rotationX:1.4,z:-46,transformPerspective:1400},{scale:s1,rotationY:3.4,rotationX:-0.6,z:16,duration:dur,ease:"sine.inOut",transformOrigin:org||"50% 50%"},at); }`,
    // cam3Dz(sel, at, dur, s0, s1, org) — the DEPTH-PLANE camera. Same yaw/pitch/dolly as
    // cam3D but with NO baked transformPerspective: the lens (`perspective:1400px`) lives on
    // the scene ROOT (#id .clip) instead, so it governs the WHOLE 3D scene at once. That lets
    // the preserve-3d child layers inside #idc — pushed to different translateZ via GSAP `z`
    // (kicker forward, headline at 0, sub back, rule foreground) — parallax against each other
    // as this container rotates. Real per-layer depth separation from a single tween.
    `function cam3Dz(sel,at,dur,s0,s1,org){ tl.fromTo(sel,{scale:s0,rotationY:-5.4,rotationX:1.8,z:-34},{scale:s1,rotationY:5.4,rotationX:-1.0,z:16,duration:dur,ease:"sine.inOut",transformOrigin:org||"50% 50%"},at); }`,
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
      // 3D exits — the scene swings/turns away in perspective (a real 3D handoff, not a fade).
      + `if(mode==="flip3d"){tl.to(sel,{rotationY:-80,z:-190,opacity:0,transformPerspective:1400,duration:0.55,ease:"power2.in",transformOrigin:"0% 50%"},at);tl.set(sel,{opacity:0},end);return;}`
      + `if(mode==="cube"){tl.to(sel,{rotationY:-90,z:-120,opacity:0,transformPerspective:1400,duration:0.55,ease:"power2.inOut",transformOrigin:"50% 50%"},at);tl.set(sel,{opacity:0},end);return;}`
      + `if(mode==="door"){tl.to(sel,{rotationY:84,z:-150,opacity:0,transformPerspective:1400,duration:0.55,ease:"power2.in",transformOrigin:"100% 50%"},at);tl.set(sel,{opacity:0},end);return;}`
      + `tl.to(sel,{opacity:0,duration:0.3,ease:"power2.in"},at);tl.set(sel,{opacity:0},end);}`,
  ].join("\n");
}

// Ambient MOTIF treatments. Two videos in the SAME pack used to share the identical
// dots+grid ambient (only dot POSITIONS varied by seed) → they read as one template.
// A seed-selected mode gives each video a structurally different backdrop while staying
// on-pack. All motion is finite-repeat GSAP tweens (deterministic capture, occlusion-safe).
const AMBIENT_MODES = ["constellation", "orbits", "rays", "scatter"];

function ambientMotif(mode, theme, dims, D, sd) {
  const { accent, accent2, ink, gradients } = theme;
  const W = dims.width, H = dims.height;
  const html = [], script = [];
  const col3 = [accent, accent2, ink];
  const svgWrap = (id, inner, extra = "") =>
    `<div id="${id}" class="clip" data-start="0" data-duration="${D}" data-track-index="2" data-layout-allow-occlusion style="${extra}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;">${inner}</svg></div>`;
  const grid = (mul = 1) => {
    const gridCol = rgba(ink, (gradients ? 0.04 : 0.06) * mul);
    const mask = gradients ? "-webkit-mask-image:radial-gradient(80% 80% at 50% 45%,#000 35%,transparent 90%);mask-image:radial-gradient(80% 80% at 50% 45%,#000 35%,transparent 90%);" : "";
    return `<div class="clip" data-start="0" data-duration="${D}" data-track-index="3" data-layout-allow-occlusion style="background-image:linear-gradient(${gridCol} 1px,transparent 1px),linear-gradient(90deg,${gridCol} 1px,transparent 1px);background-size:46px 46px;${mask}"></div>`;
  };

  if (mode === "minimal" || mode === "constellation") {
    const N = mode === "minimal" ? 5 : 12;
    const circ = [];
    for (let i = 0; i < N; i++) {
      const cx = Math.round(((i * 97 + 60 + sd) % 100) / 100 * W);
      const cy = Math.round(((i * 53 + 40 + sd * 7) % 100) / 100 * H);
      circ.push(`<circle class="kfdust${i}" cx="${cx}" cy="${cy}" r="${2 + (i % 4)}" fill="${col3[i % 3]}" opacity="${(0.28 + (i % 5) * 0.05).toFixed(2)}"/>`);
    }
    html.push(svgWrap("kfamb", circ.join("")));
    if (mode === "constellation") html.push(grid());
    script.push(`for(var i=0;i<${N};i++){var pd=7+(i%5);tl.to(".kfdust"+i,{attr:{cy:"-="+(40+(i%4)*18)},x:(i%2?12:-12),duration:pd,ease:"sine.inOut",yoyo:true,repeat:reps(pd)},0);}`);
    return { html, script };
  }

  if (mode === "orbits") {
    const cx = Math.round((0.5 + ((sd % 7) - 3) * 0.05) * W);
    const cy = Math.round((0.44 + ((sd % 5) - 2) * 0.05) * H);
    let inner = "";
    [0.13, 0.21, 0.30].forEach((f, k) => {
      inner += `<ellipse cx="${cx}" cy="${cy}" rx="${Math.round(W * f)}" ry="${Math.round(H * f * 0.95)}" fill="none" stroke="${rgba(col3[k % 3], 0.22)}" stroke-width="1.4" stroke-dasharray="2 11"/>`;
    });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * 6.2832 + sd, rr = 0.13 + (i % 3) * 0.085;
      inner += `<g class="kfdust${i}"><circle cx="${Math.round(cx + Math.cos(ang) * W * rr)}" cy="${Math.round(cy + Math.sin(ang) * H * rr * 0.95)}" r="${3 + (i % 3)}" fill="${col3[i % 2]}" opacity="0.5"/></g>`;
    }
    html.push(svgWrap("kfamb", inner, "transform-origin:50% 50%;"));
    script.push(`tl.to("#kfamb",{scale:1.05,duration:13,ease:"sine.inOut",yoyo:true,repeat:reps(13)},0);`);
    script.push(`for(var i=0;i<8;i++){var pd=8+(i%4);tl.to(".kfdust"+i,{x:(i%2?14:-14),y:(i%3?-10:10),duration:pd,ease:"sine.inOut",yoyo:true,repeat:reps(pd)},0);}`);
    return { html, script };
  }

  if (mode === "rays") {
    const ox = (sd % 2 === 0 ? 0.82 : 0.18) * W, oy = 0.16 * H;
    let inner = "";
    for (let i = 0; i < 7; i++) {
      const ang = (-35 + i * 9 + (sd % 5) * 3) * Math.PI / 180, len = W * 0.95;
      inner += `<g class="kfray${i}"><line x1="${Math.round(ox)}" y1="${Math.round(oy)}" x2="${Math.round(ox + Math.cos(ang) * len)}" y2="${Math.round(oy + Math.sin(ang) * len)}" stroke="${rgba(col3[i % 2], 0.14)}" stroke-width="${2 + (i % 2)}"/></g>`;
    }
    html.push(svgWrap("kfamb", inner));
    html.push(grid(0.55));
    script.push(`for(var i=0;i<7;i++){var pd=6+(i%4);tl.fromTo(".kfray"+i,{opacity:0.06},{opacity:0.22,duration:pd,ease:"sine.inOut",yoyo:true,repeat:reps(pd)},i*0.3);}`);
    return { html, script };
  }

  // scatter — small geometric shapes floating (each wrapped in a <g> so GSAP translate
  // never clobbers a shape's own rotate transform).
  const shapes = [];
  for (let i = 0; i < 14; i++) {
    const cx = Math.round(((i * 89 + 50 + sd * 3) % 100) / 100 * W);
    const cy = Math.round(((i * 61 + 30 + sd * 5) % 100) / 100 * H);
    const s = 6 + (i % 4) * 4, c = rgba(col3[i % 3], 0.5), kind = i % 3;
    const shape = kind === 0
      ? `<rect x="${cx}" y="${cy}" width="${s}" height="${s}" fill="none" stroke="${c}" stroke-width="1.5" transform="rotate(45 ${cx + s / 2} ${cy + s / 2})"/>`
      : kind === 1
        ? `<circle cx="${cx}" cy="${cy}" r="${s / 2}" fill="${c}"/>`
        : `<path d="M${cx - s} ${cy}H${cx + s}M${cx} ${cy - s}V${cy + s}" stroke="${c}" stroke-width="1.5"/>`;
    shapes.push(`<g class="kfsh${i}">${shape}</g>`);
  }
  html.push(svgWrap("kfamb", shapes.join("")));
  script.push(`for(var i=0;i<14;i++){var pd=7+(i%6);tl.to(".kfsh"+i,{y:(i%2?-26:26),x:(i%3?10:-10),duration:pd,ease:"sine.inOut",yoyo:true,repeat:reps(pd)},0);}`);
  return { html, script };
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

  // ambient MOTIF — seed-selected treatment (constellation / orbits / rays / scatter) so
  // two videos in the SAME pack get a structurally different backdrop. Signature packs
  // (noir/biennale) keep their deliberate sparseness (minimal), letting the atom lead.
  const mode = reduceAmbient ? "minimal" : AMBIENT_MODES[sd % AMBIENT_MODES.length];
  const motif = ambientMotif(mode, theme, dims, D, sd);
  for (const h of motif.html) parts.push(h);

  const script = [];
  for (const sc of sig.script) script.push(sc);
  if (gradients) script.push(`tl.fromTo("#kfbgGlow",{xPercent:-4,yPercent:-3,scale:1},{xPercent:4,yPercent:3,scale:1.07,duration:10,ease:"sine.inOut",yoyo:true,repeat:reps(10)},0);`);
  for (const sc of motif.script) script.push(sc);
  return { html: parts.join("\n  "), script: script.join("\n") };
}

// ---- color utils -------------------------------------------------------------
function hexToRgb(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return [124, 124, 124]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; const d = mx - mn;
  if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4); h /= 6; }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  let r, g, b;
  if (!s) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const hue = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    r = hue(h + 1 / 3); g = hue(h); b = hue(h - 1 / 3);
  }
  return "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}
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
const TRANS = new Set(["fade", "slide-left", "wipe", "scale-through", "hard-cut", "none", "flip3d", "cube", "door"]);
const LAYOUTS = ["fullbleed", "split-60-40", "centered-card", "grid-2x2"];

function revealMode(scene) {
  const a = String((scene && scene.animation) || "").toLowerCase().trim();
  if (a === "typewriter") return "word-stagger"; // no terminal archetype yet → clean stagger
  return ANIMS.has(a) ? a : "word-stagger";
}
function transOut(scene, isLast, i, off = 0) {
  if (isLast) return "none";
  const t = String((scene && scene.transitionOut) || "").toLowerCase().trim();
  if (TRANS.has(t)) return t;
  // No authored transition → give the film real 3D HANDOFFS (a scene swinging/turning away
  // in perspective) on alternating seams, softer moves between, so it reads as motion
  // graphics, not slides. Deterministic by scene index (+ per-video seed offset, so two
  // videos don't share the same seam sequence) → a re-render is identical.
  const cycle = ["flip3d", "scale-through", "cube", "slide-left", "door", "wipe"];
  return cycle[(Math.max(0, i || 0) + off) % cycle.length];
}
// Honor the storyboard's layout; if it's missing/invalid the kit ROTATES by index (+ a
// per-video seed offset) so adjacent scenes never share a zone map AND two videos don't
// start the rotation at the same layout — variety is what reads as "produced".
function layoutFor(scene, i, off = 0) {
  const l = String((scene && scene.layout) || "").toLowerCase().trim();
  if (LAYOUTS.includes(l)) return l;
  return LAYOUTS[(i + off) % LAYOUTS.length];
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
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;perspective:1400px;">
  <div id="${id}c" style="${place.box}${center ? "text-align:center;" : ""}transform-style:preserve-3d;">
    <span id="${id}k" style="opacity:0;display:inline-flex;align-items:center;gap:10px;padding:8px 16px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 15px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:8px;height:8px;border-radius:50%;background:${theme.accent};"></span>${esc(ctx.kicker || "KEYFRAME")}</span>
    <h1 class="kfhead" style="margin-top:18px;font:800 ${big}px/0.99 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:${center ? "18ch" : "14ch"};${ctr}"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h1>
    ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:16px;font:500 ${Math.round(big * 0.3)}px/1.45 ${cssFont(theme)};color:${theme.dim};max-width:42ch;${ctr}">${esc(scene.subtext)}</p>` : ""}
    <div id="${id}u" style="margin-top:20px;width:${Math.round(big * 3)}px;max-width:42%;height:5px;border-radius:3px;background:linear-gradient(90deg,${theme.accent},${theme.accent2});transform:scaleX(0);transform-origin:left center;${ctr}"></div>
  </div>
</div>`;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    // Depth-plane camera: the layers below sit at different translateZ (set via GSAP `z`
    // so the transform isn't clobbered) and parallax as this preserve-3d box rotates.
    `cam3Dz("#${id}c",${T},${r(ctx.clipDur)},1.0,1.055,"${camOrg}");`,
    `tl.fromTo("#${id}k",{opacity:0,y:14,z:64},{opacity:1,y:0,z:64,duration:0.5},${kAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.09);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:20,z:-52},{opacity:1,y:0,z:-52,duration:0.55},${subAt});` : "",
    `tl.fromTo("#${id}u",{scaleX:0,z:104},{scaleX:1,z:104,duration:0.7,ease:"power3.inOut"},${uAt});`,
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
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;display:flex;align-items:center;justify-content:center;perspective:1400px;">
  <div class="kfstage" style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;padding:0 8%;width:100%;transform-style:preserve-3d;">
    <div id="${id}n" style="font:800 ${big}px/1 ${cssFont(theme)};letter-spacing:-0.04em;color:${theme.accent};transform:translateZ(74px);">0${esc(num.suffix || "")}</div>
    <div class="kfhead" style="font:700 ${Math.round(big * 0.26)}px/1.15 ${cssHead(theme)};color:${theme.ink};max-width:18ch;"><style>#${id} .kfacc{color:${theme.accent2};}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</div>
    ${scene.subtext ? `<div id="${id}s" style="opacity:0;font:500 ${Math.round(big * 0.18)}px/1.4 ${cssFont(theme)};color:${theme.dim};max-width:40ch;">${esc(scene.subtext)}</div>` : ""}
  </div>
</div>`;
  const fmt = num.suffix === "%" ? `function(v){return v+"%";}` : (num.prefix ? `function(v){return ${JSON.stringify(num.prefix)}+v.toLocaleString();}` : `function(v){return v.toLocaleString()+${JSON.stringify(num.suffix || "")};}`);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam3Dz("#${id} .kfstage",${T},${r(ctx.clipDur)},1.0,1.08,"50% 50%");`,
    `countUp("${id}n",${num.value},${r(headAt)},${r(Math.min(1.6, L - 1))},${fmt});`,
    `reveal("${id}",${r(headAt + 0.15)},"${ctx.mode}",0.07);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:16,z:-46},{opacity:1,y:0,z:-46,duration:0.5},${r(headAt + 0.6)});` : "",
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
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;perspective:1400px;">
  ${theme.gradients ? `<div id="${id}g" class="clip" data-layout-allow-occlusion style="position:absolute;left:50%;top:46%;width:46%;height:60%;transform:translate(-50%,-50%);border-radius:50%;filter:blur(54px);background:radial-gradient(circle,${rgba(theme.accent, 0.30)},transparent 66%);"></div>` : ""}
  <div id="${id}c" style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);transform-style:preserve-3d;display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center;padding:0 8%;">
    <h2 class="kfhead" style="font:800 ${big}px/1.02 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:16ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    ${scene.subtext ? `<div id="${id}b" style="opacity:0;display:inline-flex;align-items:center;gap:11px;padding:16px 36px;border-radius:9999px;background:${btnBg};color:${btnInk};font:800 ${Math.round(big * 0.34)}px/1 ${cssFont(theme)};">${esc(scene.subtext)} <span style="width:11px;height:11px;border-right:3px solid ${btnInk};border-top:3px solid ${btnInk};transform:rotate(45deg);display:inline-block;"></span></div>` : ""}
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const gAt = r(Math.max(T + 0.05, headAt - 0.2)), btnAt = r(headAt + 0.6), pulseAt = r(headAt + 1.2);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    // Depth planes: button floats forward on Z, headline anchors at z:0 (translateY(-50%)
    // centering on #idc is preserved — cam3Dz never touches `y`).
    `cam3Dz("#${id}c",${T},${r(ctx.clipDur)},1.07,1.0,"50% 50%");`,
    theme.gradients ? `tl.fromTo("#${id}g",{opacity:0,scale:0.85},{opacity:1,scale:1,duration:0.8},${gAt});` : "",
    `reveal("${id}",${headAt},"${ctx.mode}",0.08);`,
    scene.subtext ? `tl.fromTo("#${id}b",{opacity:0,scale:0.85,y:16,z:80},{opacity:1,scale:1,y:0,z:80,duration:0.6,ease:"back.out(1.7)"},${btnAt});` : "",
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
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;perspective:1400px;">
  <div id="${id}c" style="${place.box}${center ? "text-align:center;" : ""}transform-style:preserve-3d;">
    <div id="${id}u" style="width:54px;height:5px;border-radius:3px;background:linear-gradient(90deg,${theme.accent},${theme.accent2});margin-bottom:22px;transform:scaleX(0);transform-origin:left center;${center ? "margin-left:auto;margin-right:auto;" : ""}"></div>
    <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:20ch;${ctr}"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:14px;font:500 ${Math.round(big * 0.36)}px/1.45 ${cssFont(theme)};color:${theme.dim};max-width:44ch;${ctr}">${esc(scene.subtext)}</p>` : ""}
    ${bullets.length ? `<div id="${id}bl" style="margin-top:20px;display:flex;flex-direction:column;gap:10px;${center ? "align-items:center;" : ""}">${bullets.map((b) => `<div class="kfbl" style="opacity:0;display:flex;align-items:center;gap:12px;font:600 ${Math.round(big * 0.3)}px/1.2 ${cssFont(theme)};color:${theme.ink};"><span style="width:9px;height:9px;border-radius:2px;background:${theme.accent};"></span>${esc(b)}</div>`).join("")}</div>` : ""}
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const uAt = r(Math.max(T + 0.05, headAt - 0.2)), subAt = r(headAt + 0.55), blAt = r(headAt + 0.7);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    // Depth planes: rule floats forward, sub + bullets recede, headline anchors at z:0.
    `cam3Dz("#${id}c",${T},${r(ctx.clipDur)},1.0,1.05,"${camOrg}");`,
    `tl.fromTo("#${id}u",{scaleX:0,z:100},{scaleX:1,z:100,duration:0.5,ease:"power3.inOut"},${uAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.07);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:18,z:-48},{opacity:1,y:0,z:-48,duration:0.5},${subAt});` : "",
    bullets.length ? `tl.fromTo("#${id} .kfbl",{opacity:0,x:-18,z:-26},{opacity:1,x:0,z:-26,duration:0.45,stagger:0.12,ease:"power2.out"},${blAt});` : "",
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  // Bullets already fill the frame; a motif is for the bare headline+sub case.
  const motif = bullets.length ? null : maybeMotif(scene, ctx);
  return motif ? { html: `${html}\n${motif.html}`, script: `${s}\n${motif.script}` } : { html, script: s };
}

// FEATURE GRID — the dense "capabilities" archetype. Renders the features[] / metrics[] /
// paragraph the storyboard LLM authors (per system_storyboard.md) but which archText discarded,
// turning a bare headline into a launch-grade card scene: kicker + headline + supporting
// paragraph + 3-4 feature cards (title + one-line benefit) + an optional KPI count-up, over a
// blurred accent glow with a drawing underline. Layers: text(h2) + panel(cards) + glow +
// sticker(kicker) + svg = 5 (cinematic C1); the card entrance carries `scale` so C2 (camera)
// registers; the underline draw + optional count-up give the reactive beat (C4).
function archFeatureGrid(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const land = dims.width >= dims.height;
  const big = land ? 50 : 40;
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;

  // Cards from features[]; if too few, synthesize from bullets. Cap to keep the frame from
  // overflowing (fewer on vertical). Clamp copy so long text never spills a card.
  const maxCards = land ? 4 : 3;
  let cards = Array.isArray(scene.features) ? scene.features.filter((f) => f && (f.title || f.desc)) : [];
  if (cards.length < 2 && Array.isArray(scene.bullets)) {
    cards = scene.bullets.filter(Boolean).map((b) => ({ title: b, desc: "" }));
  }
  cards = cards.slice(0, maxCards).map((c) => ({ title: String(c.title || "").slice(0, 42), desc: String(c.desc || "").slice(0, 74) }));

  const metricRaw = Array.isArray(scene.metrics) ? scene.metrics.find((m) => m && Number.isFinite(Number(m.value))) : null;
  // Show a standalone KPI only when the card grid leaves room (avoids vertical overflow).
  const metric = metricRaw && cards.length <= (land ? 3 : 2) ? metricRaw : null;
  const paragraph = scene.paragraph || scene.subtext || "";
  const kicker = ctx.kicker || scene.kicker || scene.emphasis || "Capabilities";

  const cardChrome = theme.gradients
    ? `background:${theme.panel};border:1px solid ${theme.line};box-shadow:0 18px 44px rgba(0,0,0,0.32);`
    : `background:${theme.panel};border:3px solid ${theme.ink};box-shadow:6px 6px 0 ${theme.accent};`;
  const cols = !land ? 1 : (cards.length >= 3 ? 2 : Math.max(1, cards.length));
  const cf = land ? 21 : 18;

  const cardHtml = cards.map((c, k) => `<div class="card kffc" style="opacity:0;${cardChrome}border-radius:14px;padding:${land ? "18px 20px" : "14px 16px"};display:flex;flex-direction:column;gap:7px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="flex:none;width:26px;height:26px;border-radius:8px;background:${rgba(theme.accent, 0.16)};color:${theme.accent};font:800 ${Math.round(cf * 0.68)}px/26px ${cssFont(theme)};text-align:center;">${k + 1}</span>
        <div style="font:800 ${cf}px/1.15 ${cssHead(theme)};color:${theme.ink};">${esc(c.title)}</div>
      </div>
      ${c.desc ? `<div style="font:500 ${Math.round(cf * 0.72)}px/1.4 ${cssFont(theme)};color:${theme.dim};">${esc(c.desc)}</div>` : ""}
    </div>`).join("");

  const lineW = land ? 300 : 180;
  const metricHtml = metric ? `<div id="${id}mw" style="opacity:0;display:inline-flex;align-items:baseline;gap:10px;margin-top:${land ? 4 : 2}px;">
      <span id="${id}m" style="font:800 ${Math.round(big * 0.98)}px/1 ${cssFont(theme)};color:${theme.accent};letter-spacing:-0.03em;">0</span>
      <span style="font:600 ${Math.round(big * 0.32)}px/1.2 ${cssFont(theme)};color:${theme.dim};">${esc(metric.label || "")}</span>
    </div>` : "";

  const glow = theme.gradients
    ? `<div id="${id}g" class="clip" data-layout-allow-occlusion style="position:absolute;left:${land ? "24%" : "50%"};top:32%;width:44%;height:60%;transform:translate(-50%,-50%);border-radius:50%;filter:blur(58px);background:radial-gradient(circle,${rgba(theme.accent, 0.22)},transparent 66%);opacity:0;"></div>`
    : "";

  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;perspective:1400px;display:flex;align-items:center;justify-content:center;">
  ${glow}
  <div class="kfstage" style="display:flex;flex-direction:column;gap:${land ? 20 : 15}px;width:100%;padding:0 ${land ? "8%" : "7%"};transform-style:preserve-3d;">
    <div style="display:flex;flex-direction:column;gap:11px;">
      <span id="${id}k" class="kicker" style="opacity:0;align-self:flex-start;display:inline-flex;align-items:center;gap:9px;padding:7px 15px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 13px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:7px;height:7px;border-radius:50%;background:${theme.accent};"></span>${esc(kicker)}</span>
      <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:22ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
      <svg id="${id}lnwrap" width="${lineW}" height="6" viewBox="0 0 ${lineW} 6" style="display:block;"><line id="${id}ln" x1="0" y1="3" x2="${lineW}" y2="3" stroke="${theme.accent}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${lineW}" stroke-dashoffset="${lineW}"></line></svg>
      ${paragraph ? `<p id="${id}p" style="opacity:0;margin:0;font:500 ${Math.round(big * 0.4)}px/1.5 ${cssFont(theme)};color:${theme.dim};max-width:52ch;">${esc(paragraph)}</p>` : ""}
    </div>
    ${cards.length ? `<div id="${id}cards" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${land ? 16 : 12}px;">${cardHtml}</div>` : ""}
    ${metricHtml}
  </div>
</div>`;

  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const kAt = r(Math.max(T + 0.05, headAt - 0.2));
  const lnAt = r(headAt + 0.35), pAt = r(headAt + 0.5), cardsAt = r(headAt + 0.6), mAt = r(headAt + 0.95);
  const fmt = metric ? (metric.suffix === "%" ? `function(v){return v+"%";}` : `function(v){return v.toLocaleString()+${JSON.stringify(metric.suffix || "")};}`) : null;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam3Dz("#${id} .kfstage",${T},${r(ctx.clipDur)},1.0,1.06,"0% 40%");`,
    glow ? `tl.fromTo("#${id}g",{opacity:0,scale:0.85},{opacity:1,scale:1,duration:0.8,ease:"power2.out"},${kAt});` : "",
    `tl.fromTo("#${id}k",{opacity:0,y:-10},{opacity:1,y:0,duration:0.45,ease:"power2.out"},${kAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.06);`,
    `tl.fromTo("#${id}ln",{strokeDashoffset:${lineW}},{strokeDashoffset:0,duration:0.6,ease:"power2.inOut"},${lnAt});`,
    paragraph ? `tl.fromTo("#${id}p",{opacity:0,y:14},{opacity:1,y:0,duration:0.5},${pAt});` : "",
    // Card entrance carries `scale` so the cinematic camera check credits this scene.
    cards.length ? `tl.fromTo("#${id} .kffc",{opacity:0,y:24,scale:0.96,z:-30},{opacity:1,y:0,scale:1,z:-30,duration:0.5,stagger:0.1,ease:"power2.out"},${cardsAt});` : "",
    metric ? `tl.fromTo("#${id}mw",{opacity:0,y:12},{opacity:1,y:0,duration:0.4},${mAt});` : "",
    metric ? `countUp("${id}m",${Number(metric.value)},${mAt},${r(Math.min(1.4, L - 1))},${fmt});` : "",
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

// COMPARISON — the before/after (us-vs-them) archetype: a muted "before" column (old-way label +
// pains, ✕ marks) beside an accent "after" column (the wins, ✓ marks), split by a VS chip and a
// drawing arrow, with an optional payoff count-up. Renders the comparison data shape the LLM
// authors (features=wins, bullets=old-way pains, subtext=old-way label, kicker=product,
// metrics=payoff) as a distinct 2-column layout vs the feature grid. Lint: text(h2) + 2 panels +
// glow + svg(arrow/marks) = ≥4 layers (C1); the AFTER column entrance carries `scale` (C2);
// the arrow strokeDashoffset draw + optional count-up = reactive beat (C4).
function archComparison(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const land = dims.width >= dims.height;
  const big = land ? 46 : 38;
  const maxItems = land ? 4 : 3;
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;

  // AFTER (wins) ← features[]; BEFORE (pains) ← bullets[]. Fallbacks so a column is never blank.
  let wins = Array.isArray(scene.features) ? scene.features.filter((f) => f && (f.title || f.desc)).map((f) => String(f.title || f.desc)) : [];
  let pains = Array.isArray(scene.bullets) ? scene.bullets.filter(Boolean).map(String) : [];
  if (!wins.length) wins = [scene.emphasis || "Faster, automatic"];
  if (!pains.length) pains = ["Manual, slow, error-prone"];
  wins = wins.slice(0, maxItems).map((w) => w.slice(0, 46));
  pains = pains.slice(0, maxItems).map((p) => p.slice(0, 46));

  const beforeLabel = String(scene.subtext || "The old way").slice(0, 28);
  const afterLabel = String(ctx.kicker || scene.kicker || "The new way").slice(0, 28);
  const kicker = scene.emphasis || afterLabel;

  const metricRaw = Array.isArray(scene.metrics) ? scene.metrics.find((m) => m && Number.isFinite(Number(m.value))) : null;
  const metric = metricRaw && (land || wins.length + pains.length <= 4) ? metricRaw : null;

  // Marks: small inline SVGs (ASCII-safe, no emoji) — muted cross for pains, accent check for wins.
  const cross = `<svg width="16" height="16" viewBox="0 0 16 16" style="flex:none;margin-top:2px;"><path d="M4 4 L12 12 M12 4 L4 12" stroke="${theme.dim}" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>`;
  const check = `<svg width="16" height="16" viewBox="0 0 16 16" style="flex:none;margin-top:2px;"><path d="M3 8.5 L6.5 12 L13 4" stroke="${theme.accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

  const beforeChrome = theme.gradients
    ? `background:${theme.panel};border:1px solid ${theme.line};`
    : `background:${theme.panel};border:2px solid ${theme.line};`;
  const afterChrome = theme.gradients
    ? `background:${theme.panel};border:1px solid ${rgba(theme.accent, 0.5)};box-shadow:0 18px 44px rgba(0,0,0,0.32);`
    : `background:${theme.panel};border:3px solid ${theme.accent};box-shadow:6px 6px 0 ${theme.accent};`;
  const itemFont = land ? 18 : 16;
  const pad = land ? "18px 20px" : "14px 16px";
  const labelPill = (color, border) => `align-self:flex-start;font:700 12px/1 ${cssFont(theme)};letter-spacing:.16em;text-transform:uppercase;color:${color};padding:5px 12px;border-radius:9999px;border:1px solid ${border};background:${theme.panel};`;

  const colItems = (items, mark, textColor, weight) => items.map((t) => `<div style="display:flex;align-items:flex-start;gap:9px;font:${weight} ${itemFont}px/1.32 ${cssFont(theme)};color:${textColor};">${mark}<span>${esc(t)}</span></div>`).join("");

  const aLen = land ? 130 : 150;
  const arrow = `<svg width="${land ? 56 : 84}" height="24" viewBox="0 0 ${land ? 56 : 84} 24" style="display:block;"><path id="${id}arw" d="M4 12 L${land ? 44 : 72} 12 M${land ? 36 : 64} 5 L${land ? 44 : 72} 12 L${land ? 36 : 64} 19" fill="none" stroke="${theme.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${aLen}" stroke-dashoffset="${aLen}"></path></svg>`;

  const glow = theme.gradients
    ? `<div id="${id}g" class="clip" data-layout-allow-occlusion style="position:absolute;left:${land ? "74%" : "50%"};top:56%;width:44%;height:56%;transform:translate(-50%,-50%);border-radius:50%;filter:blur(58px);background:radial-gradient(circle,${rgba(theme.accent, 0.22)},transparent 66%);opacity:0;"></div>`
    : "";

  const metricHtml = metric ? `<div id="${id}mw" style="opacity:0;align-self:center;display:inline-flex;align-items:baseline;gap:10px;margin-top:${land ? 6 : 4}px;">
      <span id="${id}m" style="font:800 ${Math.round(big * 0.92)}px/1 ${cssFont(theme)};color:${theme.accent};letter-spacing:-0.03em;">0</span>
      <span style="font:600 ${Math.round(big * 0.32)}px/1.2 ${cssFont(theme)};color:${theme.dim};">${esc(metric.label || "")}</span>
    </div>` : "";

  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;perspective:1400px;display:flex;align-items:center;justify-content:center;">
  ${glow}
  <div class="kfstage" style="display:flex;flex-direction:column;align-items:center;gap:${land ? 20 : 15}px;width:100%;padding:0 ${land ? "7%" : "6%"};transform-style:preserve-3d;">
    <div style="display:flex;flex-direction:column;align-items:center;gap:11px;text-align:center;">
      <span id="${id}k" class="kicker" style="opacity:0;display:inline-flex;align-items:center;gap:9px;padding:7px 15px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 13px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:7px;height:7px;border-radius:50%;background:${theme.accent};"></span>${esc(kicker)}</span>
      <h2 class="kfhead" style="font:800 ${big}px/1.06 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:22ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    </div>
    <div id="${id}cols" style="display:flex;flex-direction:${land ? "row" : "column"};align-items:stretch;justify-content:center;gap:${land ? 16 : 12}px;width:100%;">
      <div id="${id}before" style="opacity:0;flex:1;${beforeChrome}border-radius:14px;padding:${pad};display:flex;flex-direction:column;gap:10px;">
        <span style="${labelPill(theme.dim, theme.line)}">${esc(beforeLabel)}</span>
        ${colItems(pains, cross, theme.dim, "500")}
      </div>
      <div style="flex:none;display:flex;flex-direction:${land ? "column" : "row"};align-items:center;justify-content:center;gap:8px;">
        <span style="font:800 14px/1 ${cssFont(theme)};color:${theme.accent};padding:8px 12px;border-radius:9999px;background:${theme.panel};border:1px solid ${rgba(theme.accent, 0.4)};">VS</span>
        <div style="transform:${land ? "none" : "rotate(90deg)"};">${arrow}</div>
      </div>
      <div id="${id}after" style="opacity:0;flex:1;${afterChrome}border-radius:14px;padding:${pad};display:flex;flex-direction:column;gap:10px;">
        <span style="${labelPill(theme.accent, rgba(theme.accent, 0.4))}">${esc(afterLabel)}</span>
        ${colItems(wins, check, theme.ink, "600")}
      </div>
    </div>
    ${metricHtml}
  </div>
</div>`;

  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const kAt = r(Math.max(T + 0.05, headAt - 0.2));
  const bAt = r(headAt + 0.35), arwAt = r(headAt + 0.6), aAt = r(headAt + 0.7), mAt = r(headAt + 1.0);
  const fmt = metric ? (metric.suffix === "%" ? `function(v){return v+"%";}` : `function(v){return v.toLocaleString()+${JSON.stringify(metric.suffix || "")};}`) : null;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam3Dz("#${id} .kfstage",${T},${r(ctx.clipDur)},1.0,1.05,"50% 40%");`,
    glow ? `tl.fromTo("#${id}g",{opacity:0,scale:0.85},{opacity:1,scale:1,duration:0.8,ease:"power2.out"},${aAt});` : "",
    `tl.fromTo("#${id}k",{opacity:0,y:-10},{opacity:1,y:0,duration:0.45,ease:"power2.out"},${kAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.06);`,
    `tl.fromTo("#${id}before",{opacity:0,x:${land ? -30 : 0},y:${land ? 0 : 18}},{opacity:1,x:0,y:0,duration:0.5,ease:"power2.out"},${bAt});`,
    `tl.fromTo("#${id}arw",{strokeDashoffset:${aLen}},{strokeDashoffset:0,duration:0.5,ease:"power2.inOut"},${arwAt});`,
    // AFTER column carries `scale` so the cinematic camera check credits this scene.
    `tl.fromTo("#${id}after",{opacity:0,x:${land ? 30 : 0},y:${land ? 0 : 18},scale:0.96},{opacity:1,x:0,y:0,scale:1,duration:0.55,ease:"back.out(1.4)"},${aAt});`,
    metric ? `tl.fromTo("#${id}mw",{opacity:0,y:12},{opacity:1,y:0,duration:0.4},${mAt});` : "",
    metric ? `countUp("${id}m",${Number(metric.value)},${mAt},${r(Math.min(1.4, L - 1))},${fmt});` : "",
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

// DASHBOARD — the analytics / product-UI archetype: header + a row of KPI tiles (metrics
// count-ups) + an animated bar chart (the signature analytics motif, axis draws + bars grow) +
// compact feature rows. Renders the metrics[]-forward intent the LLM authors for dashboard beats,
// distinct from the feature grid (cards) and comparison (2-col). Never fabricates numbers. Lint:
// text(h2) + panel(tiles/chart card) + svg(chart) + glow = ≥4 layers (C1); KPI tiles enter with
// `scale` (C2 camera); count-ups + axis strokeDashoffset draw = reactive beat (C4).
function archDashboard(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const land = dims.width >= dims.height;
  const big = land ? 46 : 38;
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;

  const kpis = (Array.isArray(scene.metrics) ? scene.metrics : [])
    .filter((m) => m && Number.isFinite(Number(m.value)))
    .slice(0, land ? 3 : 2);
  const rows = (Array.isArray(scene.features) ? scene.features.filter((f) => f && (f.title || f.desc)) : [])
    .slice(0, 3).map((f) => ({ title: String(f.title || "").slice(0, 40), desc: String(f.desc || "").slice(0, 58) }));
  const paragraph = scene.paragraph || scene.subtext || "";
  const kicker = ctx.kicker || scene.kicker || scene.emphasis || "Dashboard";

  const cardChrome = theme.gradients
    ? `background:${theme.panel};border:1px solid ${theme.line};box-shadow:0 14px 36px rgba(0,0,0,0.30);`
    : `background:${theme.panel};border:2px solid ${theme.ink};box-shadow:5px 5px 0 ${theme.accent};`;

  const kpiHtml = kpis.map((m, i) => `<div class="card kfkpi" style="opacity:0;flex:1;${cardChrome}border-radius:14px;padding:${land ? "16px 18px" : "12px 14px"};display:flex;flex-direction:column;gap:5px;">
      <span id="${id}k${i}" style="font:800 ${Math.round(big * 0.9)}px/1 ${cssFont(theme)};color:${theme.accent};letter-spacing:-0.03em;">0</span>
      <span style="font:600 ${Math.round(big * 0.26)}px/1.2 ${cssFont(theme)};color:${theme.dim};">${esc(m.label || "")}</span>
    </div>`).join("");

  // Fixed, non-fabricated bar heights (an abstract analytics motif — NOT presented as data).
  const heights = [0.42, 0.66, 0.5, 0.82, 0.6, 0.95];
  const chartW = land ? 300 : 220, chartH = land ? 118 : 96, barGap = 10, nb = heights.length;
  const bw = (chartW - barGap * (nb - 1)) / nb;
  const bars = heights.map((h, i) => {
    const bh = Math.round(h * (chartH - 12)) + 6;
    return `<rect class="kfbar" x="${Math.round(i * (bw + barGap))}" y="${chartH - bh}" width="${Math.round(bw)}" height="${bh}" rx="4" fill="${i === nb - 1 ? theme.accent : rgba(theme.accent, 0.45)}" style="transform-box:fill-box;transform-origin:center bottom;transform:scaleY(0);"></rect>`;
  }).join("");
  const chartHtml = `<svg width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" style="display:block;overflow:visible;"><line id="${id}base" x1="0" y1="${chartH}" x2="${chartW}" y2="${chartH}" stroke="${theme.line}" stroke-width="2" stroke-dasharray="${chartW}" stroke-dashoffset="${chartW}"/>${bars}</svg>`;

  const rowsHtml = rows.length ? `<div style="display:flex;flex-direction:column;gap:8px;">${rows.map((rw) => `<div class="kfrow" style="opacity:0;display:flex;align-items:center;gap:10px;font:600 ${land ? 17 : 15}px/1.25 ${cssFont(theme)};color:${theme.ink};"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:${theme.accent};"></span><span>${esc(rw.title)}</span>${rw.desc ? `<span style="font-weight:500;color:${theme.dim};">— ${esc(rw.desc)}</span>` : ""}</div>`).join("")}</div>` : "";

  const glow = theme.gradients
    ? `<div id="${id}g" class="clip" data-layout-allow-occlusion style="position:absolute;left:70%;top:42%;width:44%;height:60%;transform:translate(-50%,-50%);border-radius:50%;filter:blur(58px);background:radial-gradient(circle,${rgba(theme.accent, 0.2)},transparent 66%);opacity:0;"></div>`
    : "";

  const bodyDir = land ? "row" : "column";
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;perspective:1400px;display:flex;align-items:center;justify-content:center;">
  ${glow}
  <div class="kfstage" style="display:flex;flex-direction:column;gap:${land ? 18 : 14}px;width:100%;padding:0 ${land ? "8%" : "6%"};transform-style:preserve-3d;">
    <div style="display:flex;flex-direction:column;gap:10px;">
      <span id="${id}kick" class="kicker" style="opacity:0;align-self:flex-start;display:inline-flex;align-items:center;gap:9px;padding:7px 15px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 13px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:7px;height:7px;border-radius:50%;background:${theme.accent};"></span>${esc(kicker)}</span>
      <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:22ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
      ${paragraph ? `<p id="${id}p" style="opacity:0;margin:0;font:500 ${Math.round(big * 0.36)}px/1.5 ${cssFont(theme)};color:${theme.dim};max-width:50ch;">${esc(paragraph)}</p>` : ""}
    </div>
    <div style="display:flex;flex-direction:${bodyDir};align-items:${land ? "flex-end" : "stretch"};gap:${land ? 24 : 16}px;width:100%;">
      <div style="flex:1;display:flex;flex-direction:column;gap:${land ? 14 : 10}px;">
        ${kpis.length ? `<div style="display:flex;gap:${land ? 14 : 10}px;">${kpiHtml}</div>` : ""}
        ${rowsHtml}
      </div>
      <div id="${id}cw" class="card" style="opacity:0;flex:none;${cardChrome}border-radius:14px;padding:${land ? "16px 18px" : "12px 14px"};">${chartHtml}</div>
    </div>
  </div>
</div>`;

  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const kAt = r(Math.max(T + 0.05, headAt - 0.2));
  const pAt = r(headAt + 0.45), chartAt = r(headAt + 0.5), tilesAt = r(headAt + 0.55), barsAt = r(headAt + 0.7), rowsAt = r(headAt + 0.9);
  const fmtFor = (m) => m.suffix === "%" ? `function(v){return v+"%";}` : `function(v){return v.toLocaleString()+${JSON.stringify(String(m.suffix || ""))};}`;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam3Dz("#${id} .kfstage",${T},${r(ctx.clipDur)},1.0,1.05,"20% 40%");`,
    glow ? `tl.fromTo("#${id}g",{opacity:0,scale:0.85},{opacity:1,scale:1,duration:0.8,ease:"power2.out"},${kAt});` : "",
    `tl.fromTo("#${id}kick",{opacity:0,y:-10},{opacity:1,y:0,duration:0.45,ease:"power2.out"},${kAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.06);`,
    paragraph ? `tl.fromTo("#${id}p",{opacity:0,y:14},{opacity:1,y:0,duration:0.5},${pAt});` : "",
    `tl.fromTo("#${id}cw",{opacity:0,x:${land ? 24 : 0},y:${land ? 0 : 16}},{opacity:1,x:0,y:0,duration:0.5,ease:"power2.out"},${chartAt});`,
    `tl.fromTo("#${id}base",{strokeDashoffset:${chartW}},{strokeDashoffset:0,duration:0.5,ease:"power2.inOut"},${chartAt});`,
    `tl.fromTo("#${id} .kfbar",{scaleY:0},{scaleY:1,duration:0.55,stagger:0.07,ease:"power3.out"},${barsAt});`,
    // KPI tiles enter with `scale` — the C2 camera signal — and count up (C4 reactive beat).
    kpis.length ? `tl.fromTo("#${id} .kfkpi",{opacity:0,y:18,scale:0.96},{opacity:1,y:0,scale:1,duration:0.5,stagger:0.1,ease:"back.out(1.3)"},${tilesAt});` : "",
    ...kpis.map((m, i) => `countUp("${id}k${i}",${Number(m.value)},${r(tilesAt + 0.15)},${r(Math.min(1.4, L - 1))},${fmtFor(m)});`),
    rows.length ? `tl.fromTo("#${id} .kfrow",{opacity:0,x:-16},{opacity:1,x:0,duration:0.45,stagger:0.09,ease:"power2.out"},${rowsAt});` : "",
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

// WORKFLOW — the how-it-works / pipeline archetype: header + a numbered STEP SEQUENCE (3-5 nodes,
// each a badge + title + one-line desc) connected by drawing connectors that animate in order — a
// process flow (left→right landscape, top→down vertical), distinct from grid/comparison/dashboard.
// Steps ← features[] (or synthesized from bullets). Lint: text + panel(step cards) + svg(connectors
// /underline) + glow = ≥4 layers (C1); steps enter with `scale` (C2); connector + underline
// strokeDashoffset draws = reactive beat (C4).
function archWorkflow(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const land = dims.width >= dims.height;
  const big = land ? 46 : 38;
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const maxSteps = land ? 5 : 4;

  let steps = Array.isArray(scene.features) ? scene.features.filter((f) => f && (f.title || f.desc)).map((f) => ({ title: String(f.title || f.desc || "").slice(0, 28), desc: String(f.title ? (f.desc || "") : "").slice(0, 54) })) : [];
  if (steps.length < 2 && Array.isArray(scene.bullets)) {
    steps = scene.bullets.filter(Boolean).map((b) => ({ title: String(b).slice(0, 28), desc: "" }));
  }
  steps = steps.slice(0, maxSteps);
  const paragraph = scene.paragraph || scene.subtext || "";
  const kicker = ctx.kicker || scene.kicker || scene.emphasis || "How it works";
  const badgeInk = lum(theme.accent) > 150 ? "#15140F" : "#FFFFFF";

  const cardChrome = theme.gradients
    ? `background:${theme.panel};border:1px solid ${theme.line};box-shadow:0 14px 36px rgba(0,0,0,0.28);`
    : `background:${theme.panel};border:2px solid ${theme.ink};box-shadow:5px 5px 0 ${theme.accent};`;
  const sf = land ? 19 : 17;
  const connLen = land ? 44 : 30, connDash = connLen * 1.6;

  const parts = [];
  steps.forEach((st, i) => {
    parts.push(`<div class="card kfstep" style="opacity:0;flex:1;min-width:0;${cardChrome}border-radius:14px;padding:${land ? "16px 16px" : "12px 14px"};display:flex;flex-direction:column;gap:8px;">
      <span style="flex:none;width:32px;height:32px;border-radius:50%;background:${theme.accent};color:${badgeInk};font:800 ${Math.round(sf * 0.82)}px/32px ${cssFont(theme)};text-align:center;">${i + 1}</span>
      <div style="font:800 ${sf}px/1.2 ${cssHead(theme)};color:${theme.ink};">${esc(st.title)}</div>
      ${st.desc ? `<div style="font:500 ${Math.round(sf * 0.74)}px/1.35 ${cssFont(theme)};color:${theme.dim};">${esc(st.desc)}</div>` : ""}
    </div>`);
    if (i < steps.length - 1) {
      parts.push(`<div style="flex:none;display:flex;align-items:center;justify-content:center;${land ? "" : "transform:rotate(90deg);"}"><svg width="${connLen}" height="18" viewBox="0 0 ${connLen} 18" style="display:block;"><path class="kfconn" d="M2 9 L${connLen - 8} 9 M${connLen - 14} 4 L${connLen - 8} 9 L${connLen - 14} 14" fill="none" stroke="${theme.accent}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${connDash}" stroke-dashoffset="${connDash}"></path></svg></div>`);
    }
  });

  const lineW = land ? 280 : 170;
  const glow = theme.gradients
    ? `<div id="${id}g" class="clip" data-layout-allow-occlusion style="position:absolute;left:50%;top:56%;width:52%;height:52%;transform:translate(-50%,-50%);border-radius:50%;filter:blur(60px);background:radial-gradient(circle,${rgba(theme.accent, 0.18)},transparent 66%);opacity:0;"></div>`
    : "";

  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;perspective:1400px;display:flex;align-items:center;justify-content:center;">
  ${glow}
  <div class="kfstage" style="display:flex;flex-direction:column;align-items:center;gap:${land ? 22 : 16}px;width:100%;padding:0 ${land ? "7%" : "6%"};transform-style:preserve-3d;">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;">
      <span id="${id}kick" class="kicker" style="opacity:0;display:inline-flex;align-items:center;gap:9px;padding:7px 15px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 13px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:7px;height:7px;border-radius:50%;background:${theme.accent};"></span>${esc(kicker)}</span>
      <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:22ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
      <svg id="${id}lnwrap" width="${lineW}" height="6" viewBox="0 0 ${lineW} 6" style="display:block;"><line id="${id}ln" x1="0" y1="3" x2="${lineW}" y2="3" stroke="${theme.accent}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${lineW}" stroke-dashoffset="${lineW}"></line></svg>
      ${paragraph ? `<p id="${id}p" style="opacity:0;margin:0;font:500 ${Math.round(big * 0.36)}px/1.5 ${cssFont(theme)};color:${theme.dim};max-width:50ch;">${esc(paragraph)}</p>` : ""}
    </div>
    ${steps.length ? `<div id="${id}steps" style="display:flex;flex-direction:${land ? "row" : "column"};align-items:${land ? "stretch" : "center"};justify-content:center;gap:${land ? 10 : 8}px;width:100%;">${parts.join("")}</div>` : ""}
  </div>
</div>`;

  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const kAt = r(Math.max(T + 0.05, headAt - 0.2));
  const lnAt = r(headAt + 0.35), pAt = r(headAt + 0.5), stepsAt = r(headAt + 0.6), connAt = r(headAt + 0.95);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `cam3Dz("#${id} .kfstage",${T},${r(ctx.clipDur)},1.0,1.05,"50% 40%");`,
    glow ? `tl.fromTo("#${id}g",{opacity:0,scale:0.85},{opacity:1,scale:1,duration:0.8,ease:"power2.out"},${kAt});` : "",
    `tl.fromTo("#${id}kick",{opacity:0,y:-10},{opacity:1,y:0,duration:0.45,ease:"power2.out"},${kAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.06);`,
    `tl.fromTo("#${id}ln",{strokeDashoffset:${lineW}},{strokeDashoffset:0,duration:0.6,ease:"power2.inOut"},${lnAt});`,
    paragraph ? `tl.fromTo("#${id}p",{opacity:0,y:14},{opacity:1,y:0,duration:0.5},${pAt});` : "",
    // Steps pop in sequence with `scale` (the C2 camera signal); connectors draw between them (C4).
    steps.length ? `tl.fromTo("#${id} .kfstep",{opacity:0,y:18,scale:0.96},{opacity:1,y:0,scale:1,duration:0.5,stagger:0.12,ease:"back.out(1.3)"},${stepsAt});` : "",
    steps.length > 1 ? `tl.fromTo("#${id} .kfconn",{strokeDashoffset:${connDash}},{strokeDashoffset:0,duration:0.35,stagger:0.12,ease:"power2.out"},${connAt});` : "",
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

// Partition the fetched assets into the kinds the kit places differently:
// website screenshots (device-framed hero), vectors/illustrations (drawn-in side
// art or grids), and photos (scrimmed full-bleed). Paths are relative to jobDir.
function partitionAssets(assets) {
  const screenshots = [], vectors = [], photos = [], videos = [];
  const seen = new Set();
  for (const a of (assets || [])) {
    if (!a || !a.path) continue;
    // VIDEO assets go to their OWN pool — HyperFrames renders <video> natively (Phase C),
    // so they become MOVING b-roll backgrounds behind text (real motion, not a slideshow).
    if (a.type === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(a.path)) { videos.push(a); continue; }
    // DE-DUPLICATE. Stock can be fetched for several needs and saved as 3.jpg/4.jpg
    // (distinct paths, IDENTICAL picture) — dedup THAT by sourceUrl. But real FILE
    // assets (site screenshots, scraped page images, user uploads) are each a DISTINCT
    // file even though they share one page sourceUrl — keying them by sourceUrl wrongly
    // collapsed all 6 scraped images + 3 screenshots to one. Dedup file assets by PATH.
    const isFileAsset = /website|user-upload/.test(a.source || "");
    const key = String(isFileAsset ? a.path : (a.sourceUrl || a.path)).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const s = `${a.source || ""} ${a.style || ""} ${a.alt || ""}`.toLowerCase();
    if (a.source === "website" || /screenshot|webpage|web page|landing|\bsite\b/.test(s)) screenshots.push(a);
    // Logos/graphics → the VECTOR pool: contained, padded side-art placement (a logo
    // stretched full-bleed as a scrim looks broken; transparent PNGs need breathing room).
    else if (/\.svg($|\?)/i.test(a.path) || /vector|illustration|icon|line.?art|graphic|\blogo\b/.test(s)) vectors.push(a);
    else photos.push(a);
  }
  return { screenshots, vectors, photos, videos };
}

// Index of the first pooled asset fetched FOR this scene (asset.sceneId === scene.id), or -1.
// The manifest tags every per-scene asset with its sceneId; honoring it lets a scene claim its
// OWN asset before the global-pool fallback runs, so the screenshot fetched for the "feature"
// scene lands on the feature scene instead of becoming wallpaper elsewhere. Unbound assets
// (user uploads / scraped page images carry sceneId:null) skip this and stay brand-level/global.
const boundIdx = (pool, sceneId, pred) =>
  pool.findIndex((a) => a && a.sceneId != null && a.sceneId === sceneId && (!pred || pred(a)));

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
  // Flexbox centering (NOT top:50%+translateY): the frame is GSAP-animated (yPercent/
  // rotationX), and a CSS translateY(-50%) would be OVERWRITTEN by GSAP's transform —
  // that dropped the -50% and pushed the frame off the bottom of the video. Flex keeps it
  // dead-centre regardless, and GSAP's yPercent then reads as a small offset from centre.
  // Frame height is bounded to ≤56% so the whole device + chrome always fits, centred.
  const dir = land ? "row" : "column";
  const shotH = land ? Math.round(dims.height * 0.56) : Math.round(dims.height * 0.4);
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;display:flex;flex-direction:${dir};align-items:center;justify-content:center;gap:${land ? 46 : 22}px;padding:0 6%;">
  <div id="${id}fr" style="${chrome}overflow:hidden;flex-shrink:0;width:${land ? "56%" : "86%"};">
    <div style="height:42px;display:flex;align-items:center;gap:9px;padding:0 16px;background:${barBg};border-bottom:1px solid ${theme.line};">${dots}<span style="margin-left:12px;flex:1;max-width:340px;height:22px;border-radius:9999px;background:${rgba(theme.ink, 0.08)};"></span></div>
    <div style="position:relative;width:100%;height:${shotH}px;overflow:hidden;"><img id="${id}img" src="${esc(asset.path)}" alt="${esc(asset.alt || "screenshot")}" style="position:absolute;top:0;left:0;width:100%;height:auto;min-height:100%;object-fit:cover;object-position:top center;"></div>
  </div>
  <div style="${land ? "flex:1;" : "width:86%;text-align:center;"}">
    <span id="${id}k" style="opacity:0;display:inline-flex;align-items:center;gap:9px;padding:7px 15px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 13px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:7px;height:7px;border-radius:50%;background:${theme.accent};"></span>${esc(ctx.kicker || "Live")}</span>
    <h2 class="kfhead" style="margin-top:14px;font:800 ${big}px/1.05 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
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
      <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
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

// LOGO REVEAL — a brand logo that BUILDS ON: an accent halo expands behind the mark
// while it scales + settles in (back.out), then the tagline reveals and the mark keeps
// a gentle float. For user-uploaded logos (transparent PNGs) — contained + padded,
// never stretched. The signature brand beat, coloured by the pack + brand accent.
function archLogoReveal(scene, ctx) {
  const { theme, id, T, L, track, dims, asset } = ctx;
  const land = dims.width >= dims.height;
  const big = land ? 42 : 34;
  const logoMax = Math.round(dims.height * (land ? 0.32 : 0.24));
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const halo = theme.gradients
    ? `<div id="${id}halo" style="position:absolute;left:50%;top:50%;width:${Math.round(logoMax * 2.1)}px;height:${Math.round(logoMax * 2.1)}px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,${rgba(theme.accent, 0.32)},transparent 64%);filter:blur(26px);opacity:0;"></div>`
    : "";
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;display:flex;align-items:center;justify-content:center;">
  <div class="kfstage" style="display:flex;flex-direction:column;align-items:center;gap:${land ? 24 : 18}px;width:100%;padding:0 8%;text-align:center;">
    <div style="position:relative;display:flex;align-items:center;justify-content:center;min-height:${logoMax}px;">
      ${halo}
      <img id="${id}logo" src="${esc(asset.path)}" alt="${esc(asset.alt || "logo")}" style="position:relative;width:auto;max-width:${land ? "48%" : "66%"};max-height:${logoMax}px;height:auto;object-fit:contain;">
    </div>
    ${scene.headline ? `<h2 class="kfhead" style="font:800 ${big}px/1.08 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>` : ""}
    ${scene.subtext ? `<p id="${id}s" style="opacity:0;font:500 ${Math.round(big * 0.5)}px/1.4 ${cssFont(theme)};color:${theme.dim};">${esc(scene.subtext)}</p>` : ""}
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const logoAt = r(Math.max(T + 0.05, headAt - 0.45)), subAt = r(headAt + 0.4);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    halo ? `tl.fromTo("#${id}halo",{opacity:0,scale:0.4},{opacity:1,scale:1,duration:0.8,ease:"power2.out"},${logoAt});` : "",
    `tl.fromTo("#${id}logo",{opacity:0,scale:0.62,y:12,filter:"blur(6px)"},{opacity:1,scale:1,y:0,filter:"blur(0px)",duration:0.8,ease:"back.out(1.6)"},${logoAt});`,
    scene.headline ? `reveal("${id}",${headAt},"${ctx.mode}",0.07);` : "",
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:12},{opacity:1,y:0,duration:0.5},${subAt});` : "",
    `tl.to("#${id}logo",{y:"-=8",duration:1.8,ease:"sine.inOut",yoyo:true,repeat:sreps(${r(L - 0.9)},1.8)},${r(logoAt + 0.9)});`,
    `xout("#${id}",${exitAt},${end},"${ctx.trans}");`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

// PRODUCT REVEAL — the product image pushes IN (scale 1.14→1.0 + rise) with a soft
// drop shadow and an accent glow that drifts opposite (parallax depth), headline on the
// other side. A cinematic product beat, not a static inset.
function archProductReveal(scene, ctx) {
  const { theme, id, T, L, track, dims, asset } = ctx;
  const land = dims.width >= dims.height;
  const big = land ? 60 : 48;
  const dir = land ? "row" : "column";
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const prodGlow = theme.gradients ? `filter:drop-shadow(0 34px 60px rgba(0,0,0,0.55)) drop-shadow(0 8px 26px ${rgba(theme.accent, 0.28)});` : "";
  const bgGlow = theme.gradients
    ? `<div id="${id}g" style="position:absolute;left:${land ? "72%" : "50%"};top:50%;width:46%;height:72%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,${rgba(theme.accent, 0.22)},transparent 68%);filter:blur(46px);opacity:0;"></div>`
    : "";
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${track}" style="opacity:0;display:flex;align-items:center;justify-content:center;">
  ${bgGlow}
  <div class="kfstage" style="display:flex;flex-direction:${dir};align-items:center;gap:${land ? 52 : 24}px;width:100%;padding:0 7%;">
    <div style="flex:1;">
      <div id="${id}u" style="width:54px;height:5px;border-radius:3px;background:linear-gradient(90deg,${theme.accent},${theme.accent2});margin-bottom:20px;transform:scaleX(0);transform-origin:left center;"></div>
      <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
      ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:14px;font:500 ${Math.round(big * 0.4)}px/1.45 ${cssFont(theme)};color:${theme.dim};">${esc(scene.subtext)}</p>` : ""}
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;"><img id="${id}img" src="${esc(asset.path)}" alt="${esc(asset.alt || "product")}" style="width:100%;max-width:${land ? "54%" : "72%"};height:auto;max-height:${Math.round(dims.height * (land ? 0.66 : 0.42))}px;object-fit:contain;${prodGlow}"></div>
  </div>
</div>`;
  const { headAt, exitAt } = ctx.timing, end = ctx.clipEnd;
  const uAt = r(Math.max(T + 0.05, headAt - 0.2)), imgAt = r(Math.max(T + 0.05, headAt - 0.3)), subAt = r(headAt + 0.5);
  const parAt = r(imgAt + 1.0); // parallax drift starts AFTER the push-in (no tween overlap)
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    bgGlow ? `tl.fromTo("#${id}g",{opacity:0,scale:0.8},{opacity:1,scale:1,duration:0.9,ease:"power2.out"},${imgAt});` : "",
    `tl.fromTo("#${id}u",{scaleX:0},{scaleX:1,duration:0.5,ease:"power3.inOut"},${uAt});`,
    `reveal("${id}",${headAt},"${ctx.mode}",0.07);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:16},{opacity:1,y:0,duration:0.5},${subAt});` : "",
    `tl.fromTo("#${id}img",{opacity:0,scale:1.14,y:30},{opacity:1,scale:1,y:0,duration:0.9,ease:"expo.out"},${imgAt});`,
    // parallax depth: product drifts up while the glow drifts down (different planes)
    L - 1.2 > 0.5 ? `tl.to("#${id}img",{y:"-=16",duration:${r(L - 1.2)},ease:"sine.inOut"},${parAt});` : "",
    (bgGlow && L - 1.2 > 0.5) ? `tl.to("#${id}g",{yPercent:8,duration:${r(L - 1.2)},ease:"sine.inOut"},${parAt});` : "",
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
    <h2 class="kfhead" style="font:800 ${big}px/1.05 ${cssHead(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:22ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
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
  // A SCREENSHOT carries its OWN headline/UI text. A light photo scrim lets that text
  // bleed through and fight the scene's overlay (the "75+" reading over the page's own
  // "Supercharge Your Creativity" hero). Treat a screenshot as DEFOCUSED context: blur
  // it to a soft texture and lay a heavier, centre-weighted scrim so the overlay owns
  // the frame — and SKIP the colour grade (tinting a real product UI distorts it). Stock
  // photos carry no text, so they keep the light grade + light scrim. blur(10px) is
  // safely inside the kenBurns overscan (from ≥1.06 ⇒ ≥21px per side), so no edge gap.
  const meta = `${asset.source || ""} ${asset.style || ""} ${asset.alt || ""}`.toLowerCase();
  const isShot = asset.source === "website" || /screenshot|webpage|web page|landing|\bsite\b/.test(meta);
  const scrim = isShot
    ? `radial-gradient(125% 90% at 50% 46%, ${rgba(g, 0.58)}, ${rgba(g, 0.84)} 72%), linear-gradient(180deg, ${rgba(g, 0.66)} 0%, ${rgba(g, 0.8)} 55%, ${rgba(g, 0.93)} 100%)`
    : `linear-gradient(180deg, ${rgba(g, 0.55)} 0%, ${rgba(g, 0.74)} 55%, ${rgba(g, 0.9)} 100%)`;
  const imgFilter = isShot ? "filter:blur(10px);" : "";
  const grade = isShot ? "" : photoGrade(theme);
  const seed = (parseInt(String(id).replace(/\D/g, ""), 10) || 0);
  const kb = kenBurns(seed);
  // photo (bottom) → palette grade (tints stock to the pack) → scrim (text contrast)
  const html = `<div id="${id}bg" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${ctx.bgTrack}" data-layout-allow-occlusion style="opacity:0;overflow:hidden;"><img id="${id}bgi" src="${esc(asset.path)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${imgFilter}">${grade}<div style="position:absolute;inset:0;background:${scrim};"></div></div>`;
  const s = [
    `tl.fromTo("#${id}bg",{opacity:0},{opacity:1,duration:0.6},${r(T)});`,
    `tl.fromTo("#${id}bgi",{scale:${kb.from},xPercent:0,yPercent:0},{scale:${kb.to},xPercent:${kb.dx},yPercent:${kb.dy},duration:${r(ctx.clipDur)},ease:"none",transformOrigin:"${kb.origin}"},${r(T)});`,
    ctx.isLast ? "" : `tl.to("#${id}bg",{opacity:0,duration:0.35,ease:"power2.in"},${r(T + L - 0.1)});`,
  ].join("\n");
  return { html, script: s };
}

// VIDEO B-ROLL background — REAL moving footage behind a text scene (Phase C). The
// strongest "not a slideshow" signal. HyperFrames decodes the <video> in sync with the
// capture timeline, so the footage actually PLAYS. Contract: the <video> is the timed
// clip (framework forces its opacity:1 while active); it lives in a NON-TIMED wrapper so
// GSAP owns the opacity fade + a slow scale drift (Ken-Burns on motion). muted playsinline.
function videoBg(asset, ctx) {
  const { theme, id, T, L } = ctx;
  if (!asset) return null;
  const g = theme.ground;
  // Footage is busy → a heavier, centre-weighted scrim keeps text legible over the motion.
  const scrim = `radial-gradient(130% 100% at 50% 46%, ${rgba(g, 0.5)}, ${rgba(g, 0.8)} 74%), linear-gradient(180deg, ${rgba(g, 0.58)} 0%, ${rgba(g, 0.74)} 55%, ${rgba(g, 0.9)} 100%)`;
  const html = `<div id="${id}bgw" style="position:absolute;inset:0;opacity:0;overflow:hidden;">`
    + `<video id="${id}bgv" class="clip" data-start="${T}" data-duration="${ctx.clipDur}" data-track-index="${ctx.bgTrack}" data-media-start="0" data-layout-allow-occlusion src="${esc(asset.path)}" muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></video>`
    + `${photoGrade(theme)}<div style="position:absolute;inset:0;background:${scrim};"></div></div>`;
  const s = [
    `tl.set("#${id}bgw",{scale:1.06},${r(T)});`,
    `tl.fromTo("#${id}bgw",{opacity:0},{opacity:1,duration:0.6},${r(T)});`,
    `tl.to("#${id}bgw",{scale:1.12,duration:${r(ctx.clipDur)},ease:"none"},${r(T)});`,
    ctx.isLast ? "" : `tl.to("#${id}bgw",{opacity:0,duration:0.35,ease:"power2.in"},${r(T + L - 0.1)});`,
  ].filter(Boolean).join("\n");
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
  // Before/after · us-vs-them → a distinct two-column comparison (before-pains vs after-wins).
  if (k === "comparison" || k === "before-after") return archComparison;
  // Analytics / product-UI moment → KPI count-ups + a chart + rows (metrics-forward).
  if (k === "dashboard") return archDashboard;
  // How-it-works / pipeline / process → a numbered step sequence with drawing connectors.
  if (k === "workflow") return archWorkflow;
  // Rich card content: a "feature" scene, or ANY scene carrying features[] (the storyboard LLM
  // authors these on feature/dashboard/comparison beats) → the dense feature-grid instead of a
  // flat text scene. This renders the features[]/metrics[]/paragraph archText silently dropped.
  if (k === "feature" || (Array.isArray(scene.features) && scene.features.length >= 2)) return archFeatureGrid;
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
  // NOTE: a Three.js/WebGL backdrop (scene_kit_3d.js) was trialled here but FROZE the whole
  // render — the HyperFrames capture engine (0.6.120) does not drive a WebGL canvas frame-by-
  // frame, so the timeline stalled. Left disabled; real 3D needs a different renderer (R3F/Remotion).
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
      // per-scene authored intent (was previously discarded by the kit). Decorrelated seed
      // offsets (different "digits" of the base-997 seed) spread layout/transition rotation
      // per VIDEO — and independently of the ambient mode — so two films don't share a rhythm.
      layout: layoutFor(scene, i, Math.floor(seed / 4)),
      mode: revealMode(scene),
      trans: transOut(scene, isLast, i, Math.floor(seed / 16)),
      timing: sceneTiming(scene, T, L),
    };
    return { scene, i, ctx, isContent: i > 0 && i < scenes.length - 1, build: archetypeFor(scene, i, scenes.length) };
  });

  const leftover = () => pools.screenshots.length + pools.vectors.length + pools.photos.length;
  let usedShot = false, montageDone = false;

  // Are there REAL/user assets (uploaded brand assets or scraped site material) waiting
  // to be placed? They are user-intended and MUST get a slot — otherwise an uploaded
  // logo/screenshot silently vanishes. When present, we let them override STAT scenes
  // too (not just plain-text ones), so a tech intro full of stat + typewriter scenes
  // still shows the user's assets. We never touch the typewriter (archTerminal) scene
  // or the hook/cta. Pure-stock pools keep the conservative text-only behaviour.
  const isRealSrc = (a) => /website|user-upload/.test((a && a.source) || "");
  const hasRealForeground = [...pools.screenshots, ...pools.vectors, ...pools.photos].some(isRealSrc);
  // The dense card archetypes (feature grid, comparison) are content-COMPLETE — they fill the
  // frame with their own cards/columns. They must NOT be clobbered by unbound/stock leftovers just
  // because the film happens to carry a real asset somewhere. So a rich scene is hostable ONLY when
  // it has its OWN bound REAL asset (a screenshot/product fetched FOR this scene) worth showing
  // instead of the cards. Bare text scenes (archText) still host anything, exactly as before.
  const isRich = (b) => b === archFeatureGrid || b === archComparison || b === archDashboard || b === archWorkflow;
  const boundRealFor = (sid) => [...pools.screenshots, ...pools.photos, ...pools.vectors].some((a) => a && a.sceneId === sid && isRealSrc(a));
  const canHost = (p) => p.isContent && p.build !== archTerminal
    && (isRich(p.build) ? boundRealFor(p.scene.id) : (p.build === archText || hasRealForeground));

  // A user's OWN logo / product gets a DEDICATED cinematic reveal (build-on / push-in)
  // ahead of the generic weaving — they're the highest-value, most brand-critical assets.
  // Pulled from whichever pool partitionAssets routed them to (logo→vectors, product→photos).
  const isUserKind = (k) => (a) => a && a.source === "user-upload" && a.kind === k;

  // Pass 1 — foreground features on content scenes. User logo/product reveals first,
  // then a screenshot hero, a montage when the pool is deep, then split-art.
  for (const p of plan) {
    if (!canHost(p)) continue;
    const sid = p.scene.id;
    const prodI = pools.photos.findIndex(isUserKind("product"));
    const logoI = pools.vectors.findIndex(isUserKind("logo"));
    // SCENE BINDING: does this scene have an asset fetched FOR it? Prefer it over the generic
    // pool head so a scene shows its OWN asset, not scene 4's leftover. Screenshots always go
    // hero; vectors/photos go split-art — same archetypes, just the scene-correct asset.
    const bShotI = boundIdx(pools.screenshots, sid);
    const bVecI = boundIdx(pools.vectors, sid, (a) => !isUserKind("logo")(a)); // don't steal the logo reveal
    const bPhotoI = boundIdx(pools.photos, sid, (a) => !isUserKind("product")(a));
    // PRIORITY for scarce content slots: product → screenshot → logo. The logo is the
    // LOWEST-priority foreground because it ALSO shows on the persistent corner watermark
    // (every scene), so a screenshot/product — which has no other way to appear — must win
    // the slot. Without this, a short video (few content scenes) let the logo reveal claim
    // the only slot and the uploaded screenshot vanished entirely.
    if (prodI >= 0) {
      p.ctx.asset = pools.photos.splice(prodI, 1)[0]; p.build = archProductReveal;
    } else if (bShotI >= 0) {
      // A scene bound to its OWN screenshot always shows it (each pinned shot is a distinct
      // page), so bound shots bypass the single-screenshot `usedShot` throttle.
      p.ctx.asset = pools.screenshots.splice(bShotI, 1)[0]; p.build = archScreenshotHero;
      p.ctx.kicker = p.scene.emphasis || "Live preview";
    } else if (bVecI >= 0) {
      p.ctx.asset = pools.vectors.splice(bVecI, 1)[0]; p.build = archSplitVector;
    } else if (bPhotoI >= 0) {
      p.ctx.asset = pools.photos.splice(bPhotoI, 1)[0]; p.build = archSplitVector;
    } else if (!usedShot && pools.screenshots.length) {
      p.ctx.asset = pools.screenshots.shift(); p.build = archScreenshotHero; usedShot = true;
      p.ctx.kicker = p.scene.emphasis || "Live preview";
    } else if (logoI >= 0) {
      p.ctx.asset = pools.vectors.splice(logoI, 1)[0]; p.build = archLogoReveal; p.ctx.kicker = "";
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

  // Pass 1.5 — VIDEO B-ROLL backgrounds (Phase C): real moving footage behind text
  // scenes. The strongest "not a slideshow" signal, so it runs on ANY pack (motion suits
  // dark packs too) and takes the background slot ahead of a still image scrim. Config-gated.
  if (config.assets?.videoBroll !== false && pools.videos && pools.videos.length) {
    for (const p of plan) {
      if (p.i === 0 || p.ctx.asset || p.ctx.assets || p.ctx.bgAsset) continue; // skip hook + scenes already dressed
      if (!pools.videos.length) break;
      // Prefer a clip fetched FOR this scene; else the pool head. (marked type:"video" → videoBg in Pass 3)
      const bVidI = boundIdx(pools.videos, p.scene.id);
      p.ctx.bgAsset = pools.videos.splice(bVidI >= 0 ? bVidI : 0, 1)[0];
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
    const isReal = (a) => /website|user-upload/.test((a && a.source) || "");
    for (const p of plan) {
      if (p.i === 0 || p.ctx.asset || p.ctx.assets) continue;
      const sid = p.scene.id;
      // Prefer a REAL asset bound to THIS scene, then any real photo, then a bound/any screenshot.
      let a = null;
      let ri = boundIdx(pools.photos, sid, isReal);
      if (ri < 0) ri = pools.photos.findIndex(isReal);
      if (ri >= 0) {
        a = pools.photos.splice(ri, 1)[0];
      } else {
        let si = boundIdx(pools.screenshots, sid);
        if (si < 0 && pools.screenshots.length) si = 0;
        if (si >= 0) a = pools.screenshots.splice(si, 1)[0];
      }
      if (a) p.ctx.bgAsset = a;
    }
  }

  // Pass 3 — emit each scene (its scrim background first, so it sits under the
  // content clip), in storyboard order.
  for (const p of plan) {
    const bgIsVideo = p.ctx.bgAsset && (p.ctx.bgAsset.type === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(p.ctx.bgAsset.path || ""));
    const bg = p.ctx.bgAsset ? (bgIsVideo ? videoBg(p.ctx.bgAsset, p.ctx) : scrimBg(p.ctx.bgAsset, p.ctx)) : null;
    const out = p.build(p.scene, p.ctx);
    const tag = p.ctx.assets ? " +montage" : p.ctx.asset ? " +asset" : p.ctx.bgAsset ? (bgIsVideo ? " +videobg" : " +bg") : "";
    bodyHtml.push(`<!-- s${p.i + 1} ${p.scene.kind || ""}${tag} [${p.ctx.T}–${r(p.ctx.T + p.ctx.L)}] -->`);
    if (bg) bodyHtml.push(bg.html);
    bodyHtml.push(out.html);
    scriptLines.push(`// s${p.i + 1}`);
    if (bg) scriptLines.push(bg.script);
    scriptLines.push(out.script);
  }

  // PERSISTENT BRAND WATERMARK — a small user logo pinned top-left across the WHOLE
  // film for brand continuity (a real logo-reveal scene still gets the big build-on).
  // Subtle (62% opacity), its own high track, occlusion-allowed since it sits over content.
  const brandLogoPath = (assets || []).find((a) => a && a.source === "user-upload" && a.kind === "logo")?.path || null;
  if (brandLogoPath) {
    const wmH = Math.round(dims.height * 0.06);
    bodyHtml.push(`<!-- persistent brand watermark -->`,
      `<div id="kfwm" class="clip" data-start="0" data-duration="${D}" data-track-index="912" data-layout-allow-occlusion style="position:absolute;left:4%;top:5%;opacity:0;"><img src="${esc(brandLogoPath)}" alt="" style="height:${wmH}px;width:auto;max-width:200px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.45));"></div>`);
    scriptLines.push(`tl.fromTo("#kfwm",{opacity:0,y:-6},{opacity:0.62,y:0,duration:0.7,ease:"power2.out"},0.4);`);
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
    // Embed the pack's DISPLAY face (data-URI @font-face) so headlines render in the
    // pack's real typographic identity instead of falling back to Inter.
    fontFaceCss(theme.displayFace),
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
