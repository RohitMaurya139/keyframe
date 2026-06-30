// PER-PACK SIGNATURE ATOMS — renders each design system's DEFINING visual in code
// so a pack reads as ITSELF, not a recolor of one generic particle template. This
// is what closes the gap between the polished FRAME.md showcases and what the
// pipeline actually shipped (flat grounds + the same blue bokeh on every pack).
//
//   • noir-spotlight  → a volumetric spotlight-cone + always-on vignette + film grain
//   • biennale-yellow → a warm sun-bloom + ember counter-bloom + 1px hairline frame
//   • midnight-glass / aurora-spectrum / vapor-chrome → a soft behind-glass depth bloom
//   • cinematic (dark) packs → a subtle vignette so the frame has filmic falloff
//
// Two products:
//   background(pack, theme, dims, D, t0) → signature layers that sit just ABOVE the
//     ground and BEHIND scene content (low track band), + `reduceAmbient` so sparse
//     packs (noir, biennale) quiet the generic particle field.
//   overlay(pack, theme, dims, D, t) → the FOREMOST filmic layer (vignette + grain),
//     pointer-events:none, above content but below captions.
//
// Everything is deterministic (build-time numbers, finite repeats, CSS-opacity
// initial state) so the captured runtime script stays lint-clean. Drift tweens are
// appended to the kit's existing paused `tl` timeline (the strings reference `tl`).

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return [124, 124, 124];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function r2(n) { return Math.round(n * 100) / 100; }
function reps(D, c) { return Math.max(0, Math.floor(D / c) - 1); }

// ---- signature background layers --------------------------------------------
// Returns { html:[], script:[], reduceAmbient } — html clips are inserted above the
// ground; tracks start at t0 and must stay below the scene band.
function background(pack, theme, dims, D, t0) {
  const W = dims.width, H = dims.height;
  const html = [], script = [];
  let reduceAmbient = false;
  const clip = (track, style, inner) =>
    `<div class="clip" data-start="0" data-duration="${D}" data-track-index="${track}" data-layout-allow-occlusion style="${style}">${inner || ""}</div>`;

  if (pack === "noir-spotlight") {
    // THE depth device: one soft volumetric cone from top-centre lighting the focus.
    const bone = theme.ink, gold = theme.accent;
    html.push(clip(t0,
      `background:radial-gradient(46% 66% at 50% 14%, ${rgba(bone, 0.16)}, ${rgba(gold, 0.07)} 40%, transparent 64%);`));
    // a low charcoal rise so the floor isn't a flat void
    html.push(clip(t0 + 1,
      `background:radial-gradient(120% 60% at 50% 118%, ${rgba(theme.accent2 || gold, 0.10)}, transparent 60%);`,
      `<div id="kfspot" style="position:absolute;inset:0;background:radial-gradient(30% 44% at 50% 18%, ${rgba(bone, 0.10)}, transparent 60%);"></div>`));
    script.push(`tl.fromTo("#kfspot",{xPercent:-4},{xPercent:4,duration:${r2(D)},ease:"sine.inOut",yoyo:true,repeat:${reps(D, D)}},0);`);
    reduceAmbient = true;
  } else if (pack === "biennale-yellow") {
    // Sun bloom (primary depth layer) + ember counter-bloom + a 1px hairline frame.
    const sun = theme.accent, ember = theme.accent2 || theme.accent;
    html.push(clip(t0, "", `<div id="kfbloom" style="position:absolute;left:6%;top:12%;width:60%;height:64%;transform-origin:50% 50%;border-radius:50%;background:radial-gradient(circle, ${rgba(sun, 0.42)}, transparent 64%);filter:blur(6px);"></div>`));
    html.push(clip(t0 + 1, "", `<div id="kfember" style="position:absolute;right:8%;bottom:10%;width:42%;height:46%;border-radius:50%;background:radial-gradient(circle, ${rgba(ember, 0.26)}, transparent 66%);filter:blur(8px);"></div>`));
    html.push(clip(t0 + 2, `border:1px solid ${rgba(theme.ink, 0.5)};`)); // inset hairline frame (clip is inset:0)
    script.push(`tl.fromTo("#kfbloom",{scale:1,xPercent:0},{scale:1.08,xPercent:3,duration:${r2(D)},ease:"sine.inOut",yoyo:true,repeat:${reps(D, D)}},0);`);
    script.push(`tl.fromTo("#kfember",{scale:1.05},{scale:1,duration:${r2(D)},ease:"sine.inOut",yoyo:true,repeat:${reps(D, D)}},0);`);
    reduceAmbient = true;
  } else if (pack === "midnight-glass" || pack === "aurora-spectrum" || pack === "vapor-chrome") {
    // Behind-glass depth: one large soft bloom that slowly breathes (light from behind).
    const a0 = theme.accent, a1 = theme.accent2 || theme.accent;
    html.push(clip(t0, "",
      `<div id="kfglassbloom" style="position:absolute;left:50%;top:38%;width:72%;height:80%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle, ${rgba(a0, 0.22)}, ${rgba(a1, 0.10)} 45%, transparent 70%);filter:blur(14px);"></div>`));
    script.push(`tl.fromTo("#kfglassbloom",{scale:0.96,yPercent:0},{scale:1.08,yPercent:-3,duration:${r2(D)},ease:"sine.inOut",yoyo:true,repeat:${reps(D, D)}},0);`);
  }
  return { html, script, reduceAmbient };
}

// ---- foremost filmic overlay (vignette + grain) -----------------------------
// One clip on a HIGH track, pointer-events:none, above scene content. Vignette on
// dark grounds only (a dark vignette over a light/print pack would muddy it); grain
// on cinematic dark packs (the texture that makes it read as film, not a CSS theme).
function overlay(pack, theme, dims, D, track) {
  const W = dims.width, H = dims.height;
  const wantVignette = theme.isDark;
  const grainPacks = new Set(["noir-spotlight", "midnight-glass", "aurora-spectrum", "vapor-chrome"]);
  const wantGrain = grainPacks.has(pack);
  if (!wantVignette && !wantGrain) return { html: "", script: [] };

  const layers = [];
  if (wantVignette) {
    const v = pack === "noir-spotlight" ? 0.62 : 0.42;
    layers.push(`<div style="position:absolute;inset:0;background:radial-gradient(130% 110% at 50% 42%, transparent 50%, rgba(0,0,0,${v}) 100%);"></div>`);
  }
  if (wantGrain) {
    const op = pack === "noir-spotlight" ? 0.10 : 0.06;
    // Static fractal-noise film grain. feTurbulence is deterministic; overlay blend
    // keeps it as texture, not a grey wash. No script → nothing to lint.
    layers.push(
      `<svg width="100%" height="100%" preserveAspectRatio="none" style="position:absolute;inset:0;opacity:${op};mix-blend-mode:overlay;">`
      + `<filter id="kfgrain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter>`
      + `<rect width="100%" height="100%" filter="url(#kfgrain)"/></svg>`);
  }
  const html = `<div id="__kf_film" class="clip" data-start="0" data-duration="${D}" data-track-index="${track}" data-layout-allow-occlusion style="pointer-events:none;">${layers.join("")}</div>`;
  return { html, script: [] };
}

module.exports = { background, overlay };
