// LEGACY (pre-change) scene-kit — the deterministic kit BEFORE the cinematic
// overhaul. Kept ONLY so before-after/compare.js can render a true baseline.
// Do NOT wire this into the pipeline; src/services/scene_kit.js is the live one.
const frameRegistry = require("../../src/services/frame_registry");
const { themeFromTokens } = require("../../src/services/enrich");

const SAFE_FONTS = "Inter, 'Segoe UI', system-ui, Roboto, Helvetica, Arial, sans-serif";
const FLAT_PACKS = new Set([
  "blockframe", "bauhaus-print", "biennale-yellow", "kinetic-bold", "noir-spotlight",
]);

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return 128;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

function deriveTheme(framePack, storyboard) {
  const tokens = framePack && framePack !== "auto" ? frameRegistry.getPackTokens(framePack) : null;
  const pal = (storyboard && storyboard.palette) || {};
  let ground, ink, accents, fonts;
  if (tokens) {
    const t = themeFromTokens(tokens);
    const colorVals = Object.values(tokens.colors || {});
    const flat = FLAT_PACKS.has(framePack);
    ground = flat ? (t.lightBase || "#FFFDF5") : (t.darkBase || "#0B1020");
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
  const safeBright = isDark ? ["#7CC4FF", "#FF7DB4", "#FFC878", "#8BE0A4"] : ["#3B5BFF", "#E2563C", "#1E9E5A", "#C9A227"];
  accents = accents.filter((a) => Math.abs(lum(a) - lum(ground)) > 55);
  for (const c of safeBright) { if (accents.length >= 2) break; if (!accents.includes(c)) accents.push(c); }
  accents = accents.slice(0, 4);
  ink = isDark ? "#FFFFFF" : "#14130E";
  const RESOLVABLE = new Set(["inter", "roboto", "arial", "helvetica", "georgia", "system-ui"]);
  const lead = fonts.filter((f) => RESOLVABLE.has(String(f).toLowerCase().trim()));
  return {
    ground, ink, accents,
    accent: accents[0],
    accent2: accents[1] || accents[0],
    fontStack: lead.length ? `${lead.map((f) => `'${f}'`).join(", ")}, ${SAFE_FONTS}` : SAFE_FONTS,
    isDark,
    gradients: !flat,
    dim: isDark ? "rgba(255,255,255,0.62)" : "rgba(20,18,12,0.62)",
    line: isDark ? "rgba(255,255,255,0.14)" : "rgba(20,18,12,0.14)",
    panel: isDark ? "rgba(255,255,255,0.05)" : "rgba(20,18,12,0.04)",
  };
}

function emitHelpers(D) {
  return [
    `var tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });`,
    `var D = ${D};`,
    `function reps(c){ return Math.max(0, Math.floor(D/c)-1); }`,
    `function sreps(span,c){ return Math.max(0, Math.floor(span/c)-1); }`,
    `function wordsIn(sel,at,stg){ tl.fromTo(sel,{yPercent:80,opacity:0,filter:"blur(8px)"},{yPercent:0,opacity:1,filter:"blur(0px)",duration:0.62,stagger:stg||0.08,ease:"power3.out"},at); }`,
    `function pushIn(sel,at,dur,from,to){ tl.fromTo(sel,{scale:from},{scale:to,duration:dur,ease:"none"},at); }`,
    `function countUp(id,to,at,dur,fmt){ var o={v:0}; tl.to(o,{v:to,duration:dur,ease:"power2.out",snap:{v:1},onUpdate:function(){var el=document.getElementById(id);if(el)el.textContent=fmt(Math.round(o.v));}},at); }`,
    `function exitScene(sel,at,end){ tl.to(sel,{opacity:0,duration:0.3,ease:"power2.in"},at); tl.set(sel,{opacity:0},end); }`,
  ].join("\n");
}

function buildBackground(theme, dims, D) {
  const { ground, accent, accent2, gradients } = theme;
  const W = dims.width, H = dims.height;
  const groundCss = gradients
    ? `background:radial-gradient(120% 95% at 50% -8%, ${mix(ground, "#ffffff", theme.isDark ? 0.10 : 0.04)}, ${ground} 55%, ${mix(ground, "#000000", theme.isDark ? 0.35 : 0.06)});`
    : `background:${ground};`;
  const parts = [];
  parts.push(`<div class="clip" data-start="0" data-duration="${D}" data-track-index="0" style="${groundCss}"></div>`);
  if (gradients) {
    parts.push(`<div id="kfbgGlow" class="clip" data-start="0" data-duration="${D}" data-track-index="1" data-layout-allow-occlusion style="background:radial-gradient(38% 46% at 22% 28%, ${rgba(accent, 0.20)}, transparent 70%), radial-gradient(34% 42% at 82% 72%, ${rgba(accent2, 0.14)}, transparent 72%); filter:blur(8px);"></div>`);
  }
  const N = 12;
  const circ = [];
  for (let i = 0; i < N; i++) {
    const cx = Math.round(((i * 97 + 60) % 100) / 100 * W);
    const cy = Math.round(((i * 53 + 40) % 100) / 100 * H);
    const r = 2 + (i % 4);
    const col = [accent, accent2, theme.ink][i % 3];
    const op = (0.28 + (i % 5) * 0.05).toFixed(2);
    circ.push(`<circle class="kfp${i}" cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="${op}"/>`);
  }
  parts.push(`<div class="clip" data-start="0" data-duration="${D}" data-track-index="2" data-layout-allow-occlusion><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;">${circ.join("")}</svg></div>`);
  const gridCol = rgba(theme.ink, gradients ? 0.04 : 0.06);
  const mask = gradients ? "-webkit-mask-image:radial-gradient(80% 80% at 50% 45%,#000 35%,transparent 90%);mask-image:radial-gradient(80% 80% at 50% 45%,#000 35%,transparent 90%);" : "";
  parts.push(`<div class="clip" data-start="0" data-duration="${D}" data-track-index="3" data-layout-allow-occlusion style="background-image:linear-gradient(${gridCol} 1px,transparent 1px),linear-gradient(90deg,${gridCol} 1px,transparent 1px);background-size:46px 46px;${mask}"></div>`);
  const script = [];
  if (gradients) script.push(`tl.fromTo("#kfbgGlow",{xPercent:-4,yPercent:-3,scale:1},{xPercent:4,yPercent:3,scale:1.07,duration:10,ease:"sine.inOut",yoyo:true,repeat:reps(10)},0);`);
  script.push(`for(var i=0;i<${N};i++){var pd=7+(i%5);tl.to(".kfp"+i,{attr:{cy:"-="+(40+(i%4)*18)},x:(i%2?12:-12),duration:pd,ease:"sine.inOut",yoyo:true,repeat:reps(pd)},0);}`);
  return { html: parts.join("\n  "), script: script.join("\n") };
}

function hexToRgb(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return [124, 124, 124]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(hex, with_, t) { const a = hexToRgb(hex), b = hexToRgb(with_); const c = a.map((v, i) => Math.round(v + (b[i] - v) * t)); return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`; }

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
  const accentText = theme.gradients
    ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};`
    : `color:${theme.accent};`;
  const big = dims.width >= dims.height ? 92 : 66;
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${L}" data-track-index="${track}" style="opacity:0;">
  <div style="position:absolute;left:7%;right:7%;top:50%;transform:translateY(-50%);">
    <span id="${id}k" style="opacity:0;display:inline-flex;align-items:center;gap:10px;padding:8px 16px;border-radius:9999px;background:${theme.panel};border:1px solid ${theme.line};color:${theme.accent};font:700 15px/1 ${cssFont(theme)};letter-spacing:.2em;text-transform:uppercase;"><span style="width:8px;height:8px;border-radius:50%;background:${theme.accent};"></span>${esc(ctx.kicker || "KEYFRAME")}</span>
    <h1 style="margin-top:18px;font:800 ${big}px/0.99 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:14ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h1>
    ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:16px;font:500 ${Math.round(big * 0.3)}px/1.45 ${cssFont(theme)};color:${theme.dim};max-width:42ch;">${esc(scene.subtext)}</p>` : ""}
  </div>
  <svg viewBox="0 0 ${dims.width} ${dims.height}" style="position:absolute;inset:0;pointer-events:none;" data-layout-allow-occlusion><line id="${id}u" x1="${Math.round(dims.width * 0.07)}" y1="${Math.round(dims.height * 0.66)}" x2="${Math.round(dims.width * 0.34)}" y2="${Math.round(dims.height * 0.66)}" stroke="${theme.accent}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${Math.round(dims.width * 0.27)}" stroke-dashoffset="${Math.round(dims.width * 0.27)}"/></svg>
</div>`;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `tl.fromTo("#${id}k",{opacity:0,y:14},{opacity:1,y:0,duration:0.5},${r(T + 0.25)});`,
    `wordsIn("#${id} .kfw",${r(T + 0.45)},0.09);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:20},{opacity:1,y:0,duration:0.55},${r(T + 1.05)});` : "",
    `tl.to("#${id}u",{strokeDashoffset:0,duration:0.7,ease:"power2.inOut"},${r(T + 1.1)});`,
    ctx.isLast ? "" : `exitScene("#${id}",${r(T + L - 0.35)},${r(T + L)});`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

function archStat(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const num = pickNumber(scene) || { value: 95, suffix: "%" };
  const big = dims.width >= dims.height ? 128 : 92;
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${L}" data-track-index="${track}" style="opacity:0;display:flex;align-items:center;justify-content:center;">
  <div class="kfstage" style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;padding:0 8%;width:100%;">
    <div id="${id}n" style="font:800 ${big}px/1 ${cssFont(theme)};letter-spacing:-0.04em;color:${theme.accent};">0${esc(num.suffix || "")}</div>
    <div style="font:700 ${Math.round(big * 0.26)}px/1.15 ${cssFont(theme)};color:${theme.ink};max-width:18ch;"><style>#${id} .kfacc{color:${theme.accent2};}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</div>
    ${scene.subtext ? `<div id="${id}s" style="opacity:0;font:500 ${Math.round(big * 0.18)}px/1.4 ${cssFont(theme)};color:${theme.dim};max-width:40ch;">${esc(scene.subtext)}</div>` : ""}
  </div>
</div>`;
  const fmt = num.suffix === "%" ? `function(v){return v+"%";}` : (num.prefix ? `function(v){return ${JSON.stringify(num.prefix)}+v.toLocaleString();}` : `function(v){return v.toLocaleString()+${JSON.stringify(num.suffix || "")};}`);
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `pushIn("#${id} .kfstage",${T},${r(L - 0.4)},1.0,1.04);`,
    `countUp("${id}n",${num.value},${r(T + 0.3)},${r(Math.min(1.6, L - 1))},${fmt});`,
    `wordsIn("#${id} .kfw",${r(T + 0.45)},0.07);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:16},{opacity:1,y:0,duration:0.5},${r(T + 0.9)});` : "",
    ctx.isLast ? "" : `exitScene("#${id}",${r(T + L - 0.35)},${r(T + L)});`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

function archCta(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const big = dims.width >= dims.height ? 78 : 60;
  const btnBg = theme.gradients ? `linear-gradient(180deg,${theme.accent2 || theme.accent},${theme.accent})` : theme.accent;
  const btnInk = lum(theme.accent) > 150 ? "#15140F" : "#FFFFFF";
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${L}" data-track-index="${track}" style="opacity:0;">
  ${theme.gradients ? `<div id="${id}g" class="clip" data-layout-allow-occlusion style="position:absolute;left:50%;top:46%;width:46%;height:60%;transform:translate(-50%,-50%);border-radius:50%;filter:blur(54px);background:radial-gradient(circle,${rgba(theme.accent, 0.30)},transparent 66%);"></div>` : ""}
  <div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center;padding:0 8%;">
    <h2 style="font:800 ${big}px/1.02 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:16ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    ${scene.subtext ? `<div id="${id}b" style="opacity:0;display:inline-flex;align-items:center;gap:11px;padding:16px 36px;border-radius:9999px;background:${btnBg};color:${btnInk};font:800 ${Math.round(big * 0.34)}px/1 ${cssFont(theme)};">${esc(scene.subtext)} <span style="width:11px;height:11px;border-right:3px solid ${btnInk};border-top:3px solid ${btnInk};transform:rotate(45deg);display:inline-block;"></span></div>` : ""}
  </div>
</div>`;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    theme.gradients ? `tl.fromTo("#${id}g",{opacity:0,scale:0.85},{opacity:1,scale:1,duration:0.8},${r(T + 0.05)});` : "",
    `wordsIn("#${id} .kfw",${r(T + 0.25)},0.08);`,
    scene.subtext ? `tl.fromTo("#${id}b",{opacity:0,scale:0.85,y:16},{opacity:1,scale:1,y:0,duration:0.6,ease:"back.out(1.7)"},${r(T + 0.9)});` : "",
    scene.subtext ? `tl.to("#${id}b",{scale:1.04,duration:0.8,ease:"sine.inOut",yoyo:true,repeat:sreps(${r(L - 1)},1.6)},${r(T + 1.5)});` : "",
    ctx.isLast ? "" : `exitScene("#${id}",${r(T + L - 0.35)},${r(T + L)});`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
}

function archText(scene, ctx) {
  const { theme, id, T, L, track, dims } = ctx;
  const big = dims.width >= dims.height ? 68 : 52;
  const accentText = theme.gradients ? `background:linear-gradient(100deg,${theme.accent},${theme.accent2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:${theme.accent};` : `color:${theme.accent};`;
  const bullets = Array.isArray(scene.bullets) ? scene.bullets.filter(Boolean).slice(0, 3) : [];
  const html = `<div id="${id}" class="clip" data-start="${T}" data-duration="${L}" data-track-index="${track}" style="opacity:0;">
  <div style="position:absolute;left:7%;right:7%;top:50%;transform:translateY(-50%);">
    <div style="width:54px;height:5px;border-radius:3px;background:${theme.accent};margin-bottom:22px;"></div>
    <h2 style="font:800 ${big}px/1.05 ${cssFont(theme)};letter-spacing:-0.02em;color:${theme.ink};max-width:20ch;"><style>#${id} .kfacc{${accentText}}</style>${headlineSpans(scene.headline, scene.emphasis, theme)}</h2>
    ${scene.subtext ? `<p id="${id}s" style="opacity:0;margin-top:14px;font:500 ${Math.round(big * 0.36)}px/1.45 ${cssFont(theme)};color:${theme.dim};max-width:44ch;">${esc(scene.subtext)}</p>` : ""}
    ${bullets.length ? `<div id="${id}bl" style="margin-top:20px;display:flex;flex-direction:column;gap:10px;">${bullets.map((b) => `<div class="kfbl" style="opacity:0;display:flex;align-items:center;gap:12px;font:600 ${Math.round(big * 0.3)}px/1.2 ${cssFont(theme)};color:${theme.ink};"><span style="width:9px;height:9px;border-radius:2px;background:${theme.accent};"></span>${esc(b)}</div>`).join("")}</div>` : ""}
  </div>
</div>`;
  const s = [
    `tl.set("#${id}",{opacity:1},${T});`,
    `wordsIn("#${id} .kfw",${r(T + 0.3)},0.07);`,
    scene.subtext ? `tl.fromTo("#${id}s",{opacity:0,y:18},{opacity:1,y:0,duration:0.5},${r(T + 0.85)});` : "",
    bullets.length ? `tl.fromTo("#${id} .kfbl",{opacity:0,x:-18},{opacity:1,x:0,duration:0.45,stagger:0.12,ease:"power2.out"},${r(T + 1.0)});` : "",
    ctx.isLast ? "" : `exitScene("#${id}",${r(T + L - 0.35)},${r(T + L)});`,
  ].filter(Boolean).join("\n");
  return { html, script: s };
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

function archetypeFor(scene, idx, total) {
  const k = (scene.kind || "").toLowerCase();
  if (idx === 0 || k === "hook" || k === "title") return archHook;
  if (idx === total - 1 || k === "cta") return archCta;
  if (k === "chart" || k === "countdown") return archStat;
  if (pickNumber(scene)) return archStat;
  return archText;
}

function buildComposition({ storyboard, dims, framePack, assets, captionCues } = {}) {
  const sb = storyboard || {};
  const scenes = Array.isArray(sb.scenes) && sb.scenes.length ? sb.scenes : [{ id: "s1", start: 0, duration: 4, kind: "hook", headline: sb.title || "KEYFRAME" }];
  const D = r(sb.durationSec || scenes.reduce((a, s) => a + (s.duration || 0), 0) || 12);
  const theme = deriveTheme(framePack, sb);
  const W = dims.width, H = dims.height;
  const bg = buildBackground(theme, dims, D);
  const bodyHtml = [bg.html];
  const scriptLines = [emitHelpers(D), bg.script];
  const plan = scenes.map((scene, i) => {
    const T = r(scene.start != null ? scene.start : scriptStart(scenes, i));
    const L = r(scene.duration || 4);
    const base = 4 + i * 3;
    const ctx = {
      theme, dims, id: `s${i + 1}`, T, L,
      track: base + 1, bgTrack: base,
      isLast: i === scenes.length - 1,
      kicker: i === 0 ? (sb.title || "KEYFRAME") : "",
    };
    return { scene, i, ctx, build: archetypeFor(scene, i, scenes.length) };
  });
  for (const p of plan) {
    const out = p.build(p.scene, p.ctx);
    bodyHtml.push(`<!-- s${p.i + 1} ${p.scene.kind || ""} [${p.ctx.T}-${r(p.ctx.T + p.ctx.L)}] -->`);
    bodyHtml.push(out.html);
    scriptLines.push(`// s${p.i + 1}`);
    scriptLines.push(out.script);
  }
  scriptLines.push(`window.__timelines = window.__timelines || {};`, `window.__timelines["vid"] = tl;`);
  const indexHtml = [
    `<!DOCTYPE html>`, `<html>`, `<head>`, `<meta charset="utf-8">`, `<title>vid</title>`,
    `<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>`,
    `<style>`,
    `* { margin:0; padding:0; box-sizing:border-box; }`,
    `body { font-family:${theme.fontStack}; }`,
    `#root { position:relative; overflow:hidden; background:${theme.ground}; }`,
    `.clip { position:absolute; inset:0; }`,
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

module.exports = { buildComposition };
