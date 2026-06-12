// LLM pass 2: script (with resolved assets) -> ONE self-contained animated HTML page.
// If every LLM provider fails or returns broken HTML, fall back to a
// deterministic local template so the pipeline always produces a page.

const config = require("../config");
const llm = require("../llm");

const SYSTEM = `You are an elite creative developer (Awwwards Site-of-the-Day caliber).
You turn video scripts into a single, self-contained, scroll-driven cinematic HTML page —
the page IS the video: each script scene becomes a full-viewport animated section, and
scrolling plays the film.

OUTPUT: one complete HTML document and NOTHING else. No explanations, no markdown fences.

Hard requirements:
- Single file. All CSS in one <style>, all JS in one <script>. Only these externals allowed:
  * GSAP core + ScrollTrigger from https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js
    and https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js
  * Google Fonts (the families named in the script's meta.typography)
  * Asset URLs explicitly listed in the script (scenes[].assets[].resolved.url)
- Use the script's palette as CSS variables. Use its typography. NEVER Inter/Roboto/Arial.
- One section per scene, in order, each min-height:100vh, with the scene's onScreenText as
  kinetic typography (staggered char/word reveals, clip-path wipes, masked lines).
- Implement each scene's "motionGraphics" direction faithfully with GSAP + ScrollTrigger
  (pinning, scrubbed timelines, parallax layers, counters, SVG line-draw, particle canvas
  where the script calls for it).
- Show the narration for each scene as an elegant "subtitle" bar that fades in.
- A fixed film-style HUD: progress bar tied to scroll, scene counter (01/07), and the
  video title — like a player chrome.
- If an asset has resolved.url, use it (cover image / background video, with a slow Ken
  Burns or parallax treatment + a credit line). If NOT resolved, build the visual with
  pure CSS/SVG/canvas motion graphics instead (gradient meshes, animated geometry, noise,
  grain, glows) — never leave a section visually empty, never hotlink anything else.
- Opening: a cinematic preloader/title card (film-leader countdown, lens flare, or
  equivalent) that plays once before scene 1.
- Ending: final CTA scene links to the original website URL.
- prefers-reduced-motion: provide a graceful static fallback.
- Must be valid HTML5, no console errors, 60fps-friendly (transforms/opacity only).
Make it unforgettable. Commit fully to the script's tone.`;

async function composeWithLlm(script, sourceUrl) {
  const user = [
    `ORIGINAL WEBSITE: ${sourceUrl}`,
    "",
    "VIDEO SCRIPT (build the page from this, scene by scene):",
    JSON.stringify(script, null, 2),
  ].join("\n");

  const raw = await llm.complete({
    system: SYSTEM,
    user,
    maxTokens: config.llm.composerMaxTokens,
    temperature: 0.8,
  });
  return llm.extractHtml(raw);
}

// ---------------------------------------------------------------------------
// Deterministic fallback composer — no LLM, still cinematic.
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sceneMediaHtml(scene) {
  const a = (scene.assets || []).find((x) => x.resolved);
  if (!a) return `<div class="mg-orb" aria-hidden="true"></div><div class="mg-grid" aria-hidden="true"></div>`;
  if (a.kind === "video") {
    return `<video class="scene-media" src="${esc(a.resolved.url)}" autoplay muted loop playsinline></video>
      <p class="credit">${esc(a.resolved.credit || "")}</p>`;
  }
  return `<div class="scene-media kenburns" style="background-image:url('${esc(a.resolved.url)}')" role="img" aria-label="${esc(a.purpose || "")}"></div>
    <p class="credit">${esc(a.resolved.credit || "")}</p>`;
}

function composeFallback(script, sourceUrl) {
  const m = script.meta;
  const pal = m.palette;
  const display = m.typography?.display || "Bricolage Grotesque";
  const body = m.typography?.body || "Archivo";
  const fontsParam = [display, body]
    .map((f) => `family=${f.trim().replace(/ /g, "+")}:wght@400;700;900`).join("&");

  const sections = script.scenes.map((s, i) => `
  <section class="scene" id="${esc(s.id)}" data-index="${i + 1}">
    <div class="scene-bg">${sceneMediaHtml(s)}</div>
    <div class="scene-inner">
      <p class="scene-kicker">${String(i + 1).padStart(2, "0")} — ${esc(s.name)}</p>
      ${(s.onScreenText || []).map((t) => `<h2 class="kinetic"><span>${esc(t)}</span></h2>`).join("\n")}
      <p class="narration">${esc(s.narration)}</p>
    </div>
  </section>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?${fontsParam}&display=swap" rel="stylesheet">
<style>
:root{
  --bg:${esc(pal.background)};--ink:${esc(pal.ink)};--accent:${esc(pal.accent)};--accent2:${esc(pal.accent2 || pal.accent)};
  --display:'${esc(display)}',sans-serif;--body:'${esc(body)}',sans-serif;
}
*{margin:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--body);overflow-x:hidden}
.hud{position:fixed;inset:auto 0 0 0;top:0;height:54px;display:flex;align-items:center;justify-content:space-between;
  padding:0 22px;z-index:50;mix-blend-mode:difference;font-size:12px;letter-spacing:.18em;text-transform:uppercase}
.hud .bar{position:absolute;left:0;bottom:0;height:2px;width:100%;transform-origin:left;transform:scaleX(0);background:var(--accent)}
.scene{position:relative;min-height:100vh;display:grid;place-items:center;overflow:hidden;padding:14vh 6vw}
.scene-bg{position:absolute;inset:0;z-index:0}
.scene-media{position:absolute;inset:-6%;width:112%;height:112%;object-fit:cover;background-size:cover;background-position:center;
  filter:saturate(.9) brightness(.5)}
.kenburns{animation:kb 22s ease-in-out infinite alternate}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.12) translate(-2%,1%)}}
.credit{position:absolute;right:14px;bottom:10px;font-size:10px;opacity:.5;z-index:2}
.mg-orb{position:absolute;width:60vmin;height:60vmin;left:50%;top:50%;translate:-50% -50%;border-radius:50%;
  background:radial-gradient(circle at 35% 35%,var(--accent),transparent 65%),radial-gradient(circle at 70% 70%,var(--accent2),transparent 60%);
  filter:blur(60px);opacity:.55;animation:drift 14s ease-in-out infinite alternate}
@keyframes drift{from{transform:scale(.9) rotate(0)}to{transform:scale(1.15) rotate(40deg)}}
.mg-grid{position:absolute;inset:0;background-image:linear-gradient(var(--ink) 1px,transparent 1px),linear-gradient(90deg,var(--ink) 1px,transparent 1px);
  background-size:72px 72px;opacity:.05}
.scene-inner{position:relative;z-index:3;max-width:980px;text-align:center}
.scene-kicker{color:var(--accent);letter-spacing:.3em;text-transform:uppercase;font-size:12px;margin-bottom:2.2rem}
.kinetic{font-family:var(--display);font-weight:900;font-size:clamp(2.2rem,7.5vw,5.6rem);line-height:1.02;text-transform:uppercase;overflow:hidden}
.kinetic span{display:inline-block;transform:translateY(110%)}
.narration{margin-top:2.4rem;font-size:clamp(1rem,1.6vw,1.25rem);opacity:0;max-width:640px;margin-inline:auto;line-height:1.7}
.cta a{display:inline-block;margin-top:3rem;padding:1.1rem 2.6rem;border:1px solid var(--accent);color:var(--ink);
  text-decoration:none;letter-spacing:.2em;text-transform:uppercase;font-size:13px;transition:background .3s,color .3s}
.cta a:hover{background:var(--accent);color:var(--bg)}
.preloader{position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:var(--bg)}
.preloader .count{font-family:var(--display);font-size:clamp(6rem,22vw,16rem);font-weight:900;color:var(--accent)}
@media (prefers-reduced-motion:reduce){
  .kinetic span{transform:none}.narration{opacity:1}.mg-orb,.kenburns{animation:none}.preloader{display:none}
}
</style>
</head>
<body>
<div class="preloader" id="preloader" aria-hidden="true"><div class="count" id="count">3</div></div>
<header class="hud">
  <span>${esc(m.brand)}</span><span>${esc(m.title)}</span><span id="counter">01 / ${String(script.scenes.length).padStart(2, "0")}</span>
  <div class="bar" id="bar"></div>
</header>
<main>
${sections}
  <section class="scene cta">
    <div class="scene-bg"><div class="mg-orb" aria-hidden="true"></div></div>
    <div class="scene-inner">
      <h2 class="kinetic"><span>${esc(m.tagline || m.brand)}</span></h2>
      <p class="narration">Experience it yourself.</p>
      <a href="${esc(sourceUrl)}" target="_blank" rel="noopener">Visit ${esc(m.brand)} →</a>
    </div>
  </section>
</main>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
<script>
(function(){
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pre = document.getElementById('preloader'), count = document.getElementById('count');
  if (reduced || !window.gsap) { if (pre) pre.remove(); }
  if (!window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);
  if (!reduced && pre) {
    var n = 3;
    var iv = setInterval(function(){
      n--; if (n <= 0) { clearInterval(iv);
        gsap.to(pre, {yPercent:-100, duration:.7, ease:'power3.inOut', onComplete:function(){ pre.remove(); }});
      } else { count.textContent = n; gsap.fromTo(count,{scale:1.4,opacity:0},{scale:1,opacity:1,duration:.5}); }
    }, 700);
  }
  gsap.to('#bar', {scaleX:1, ease:'none', scrollTrigger:{scrub:.3, start:0, end:'max'}});
  var scenes = gsap.utils.toArray('.scene');
  var counter = document.getElementById('counter');
  scenes.forEach(function(sc, i){
    gsap.fromTo(sc.querySelectorAll('.kinetic span'),
      {yPercent:110},{yPercent:0, duration:1, stagger:.12, ease:'power4.out',
       scrollTrigger:{trigger:sc, start:'top 65%'}});
    gsap.to(sc.querySelector('.narration'), {opacity:1, y:0, duration:1, delay:.4,
       scrollTrigger:{trigger:sc, start:'top 55%'}});
    var media = sc.querySelector('.scene-media');
    if (media) gsap.fromTo(media, {yPercent:-8},{yPercent:8, ease:'none',
       scrollTrigger:{trigger:sc, scrub:true}});
    ScrollTrigger.create({trigger:sc, start:'top center', end:'bottom center',
      onToggle:function(self){ if (self.isActive && counter)
        counter.textContent = String(Math.min(i+1, scenes.length)).padStart(2,'0') + ' / ' + String(scenes.length).padStart(2,'0'); }});
  });
})();
</script>
</body>
</html>`;
}

/** Compose the final page. Returns { html, engine: "llm"|"fallback" }. */
async function compose(script, sourceUrl) {
  try {
    const html = await composeWithLlm(script, sourceUrl);
    return { html, engine: "llm" };
  } catch (e) {
    console.warn(`[composer] LLM compose failed (${e.message}) — using fallback template`);
    return { html: composeFallback(script, sourceUrl), engine: "fallback" };
  }
}

module.exports = { compose, composeFallback };
