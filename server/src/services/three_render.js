// Three.js (Remotion + React-Three-Fiber) render path — the alternative to the HyperFrames
// scene-kit renderer, selected by config.render.engine === "three". Consumes the SAME internal
// storyboard the scene-kit gets, writes it as props.json, and runs `remotion render` in the
// engine3d project. Produces jobDir/renders/out.mp4, then publishes it exactly like the
// scene-kit path so downstream (audio mux, DB, gallery) is unchanged.
//
// Scope: text archetypes (hook/stat/cta/bullet/caption/quote), landscape. Storyboards with
// asset scenes fall back to the scene-kit (isThreeRenderable → false). See docs/threejs-video-engine.md.

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const config = require("../config");
const { publishRenderedMp4 } = require("./renderer");

const WINDOWS = process.platform === "win32";
const SUPPORTED_KINDS = new Set(["hook", "stat", "chart", "cta", "bullet", "caption", "quote", "feature", "dashboard", "comparison", "workflow", "before-after", "url-to-video", "prompt-to-video", "ai-studio", "timeline", "testimonial", "gallery", "logo", "product", "screenshot", "image", "photo", "graphic"]);
const ASSET_KINDS = ["product", "screenshot", "image", "photo", "graphic"];

// Read an image file → base64 data-URI (so the engine gets the asset via props, no file serving).
function toDataUri(absPath) {
  try {
    const ext = path.extname(absPath).toLowerCase().replace(".", "");
    const mime = ext === "svg" ? "image/svg+xml"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "webp" ? "image/webp"
      : ext === "gif" ? "image/gif"
      : "image/png";
    return `data:${mime};base64,${fs.readFileSync(absPath).toString("base64")}`;
  } catch { return null; }
}

// Can the Three.js engine render this whole storyboard today?
function isThreeRenderable(storyboard, job) {
  if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) return false;
  // Layouts are tuned for 16:9; vertical/square route to the scene-kit for now.
  if (job && job.orientation && job.orientation !== "horizontal") return false;
  return storyboard.scenes.every((s) => SUPPORTED_KINDS.has(s.kind));
}

// Map the internal storyboard onto the engine3d contract (near-identical by design) and BIND
// the user's uploaded assets — WITHOUT changing scene count or timing, so the audio stays in
// sync. Logo → persistent watermark + a branded open (the hook becomes a logo reveal, its
// headline demoted to the caption). Images/screenshots → bound to asset scenes, or a middle
// text scene is converted to an image hero. Assets travel as base64 data-URIs in props.
function toEngineStoryboard(storyboard, framePack, brandColors, title, userAssets = []) {
  const imgs = (userAssets || []).filter((a) => a && a.type === "image" && a.path && fs.existsSync(a.path));
  const logo = imgs.find((a) => a.kind === "logo");
  const pics = imgs.filter((a) => a.kind !== "logo");
  const logoUri = logo ? toDataUri(logo.path) : null;

  const scenes = (storyboard.scenes || []).map((sc, i) => ({
    id: sc.id || `s${i + 1}`,
    kind: sc.kind || "caption",
    start: Number(sc.start) || 0,
    duration: Number(sc.duration) || 3,
    headline: sc.headline || sc.title || "",
    emphasis: sc.emphasis || undefined,
    subtext: sc.subtext || sc.sub || undefined,
    bullets: Array.isArray(sc.bullets) ? sc.bullets.filter(Boolean) : undefined,
    paragraph: sc.paragraph || undefined,
    features: Array.isArray(sc.features) ? sc.features : undefined,
    metrics: Array.isArray(sc.metrics) ? sc.metrics : undefined,
    kicker: sc.kicker || (sc.kind === "hook" ? title || "" : undefined),
    beats: Array.isArray(sc.beats) ? sc.beats : undefined,
    transitionOut: sc.transitionOut || undefined,
    assetDataUri: undefined,
  }));

  // 1) bind pics to asset-kind scenes the LLM already produced
  let p = 0;
  for (const s of scenes) {
    if (ASSET_KINDS.includes(s.kind) && pics[p]) { s.assetDataUri = toDataUri(pics[p].path); p++; }
    if (s.kind === "logo" && logoUri) s.assetDataUri = logoUri;
  }

  // 2) logo, but no logo scene yet → make the HOOK a branded logo open (headline → caption)
  if (logoUri && !scenes.some((s) => s.kind === "logo")) {
    const hook = scenes.find((s) => s.kind === "hook");
    if (hook) { hook.kind = "logo"; hook.assetDataUri = logoUri; hook.subtext = hook.headline || hook.subtext; }
  }

  // 3) leftover pics → convert a middle text scene to an image hero (timing preserved)
  for (let k = 1; k < scenes.length - 1 && pics[p]; k++) {
    const s = scenes[k];
    if (["bullet", "caption", "quote", "text"].includes(s.kind)) {
      s.kind = "image"; s.assetDataUri = toDataUri(pics[p].path); p++;
    }
  }

  // 4) DENSITY: a bullet scene → the dense Feature-Grid template (headline + paragraph +
  // feature cards + metrics ≈ 75-85% occupancy). Carries bullets → the grid derives cards
  // from them; subtext becomes the supporting paragraph. Empty frames become launch-grade.
  for (const s of scenes) {
    if ((s.kind === "bullet" || s.kind === "caption") && Array.isArray(s.bullets) && s.bullets.length >= 2 && !s.assetDataUri) {
      s.kind = "feature";
      s.paragraph = s.paragraph || s.subtext || undefined;
      s.features = s.features || s.bullets.slice(0, 4).map((t) => ({ title: t }));
    }
  }

  const durationSec = storyboard.durationSec || Math.max(...scenes.map((s) => s.start + s.duration), 1);
  return {
    title: title || storyboard.title || "",
    durationSec,
    framePack: framePack || storyboard.framePack || "midnight-glass",
    brandColors: (brandColors || storyboard.brandColors || []).filter(Boolean),
    watermarkDataUri: logoUri || undefined,
    scenes,
  };
}

// Run `remotion render` and publish. Returns { videoPath, videoUrl } like renderer.render().
async function renderThree({ jobId, jobDir, storyboard, framePack, brandColors, dims, durationSec, title, userAssets, abortSignal }) {
  const threeDir = config.render.threeDir;
  if (!fs.existsSync(path.join(threeDir, "src", "index.ts"))) {
    throw new Error(`three engine not found at ${threeDir} (set config.render.threeDir / RENDER_THREE_DIR)`);
  }
  const rendersDir = path.join(jobDir, "renders");
  fs.mkdirSync(rendersDir, { recursive: true });
  const outPath = path.join(rendersDir, "out.mp4");
  const propsPath = path.join(jobDir, "props.json");

  const engineStoryboard = toEngineStoryboard(storyboard, framePack, brandColors, title, userAssets);
  const props = { storyboard: engineStoryboard, width: dims.width, height: dims.height, fps: dims.fps };
  fs.writeFileSync(propsPath, JSON.stringify(props), "utf8");

  const gl = config.render.threeGl || "angle";
  const concurrency = String(config.render.threeConcurrency || "1");
  // Under shell:true (needed for npx.cmd on Node ≥18.20) the command line is re-parsed, so
  // quote the path args — jobDir contains spaces and parentheses.
  const q = (p) => (WINDOWS ? `"${p}"` : p);
  const args = [
    "remotion", "render", "src/index.ts", "Film", q(outPath),
    `--props=${q(propsPath)}`,
    `--gl=${gl}`,
    `--concurrency=${concurrency}`,
    "--log=error",
  ];

  const res = await new Promise((resolve) => {
    const child = spawn(WINDOWS ? "npx.cmd" : "npx", args, {
      cwd: threeDir,
      env: { ...process.env },
      shell: WINDOWS,
    });
    let stdout = "", stderr = "", lastPct = 0;
    const startedAt = Date.now();
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      const m = s.match(/Rendered\s+(\d+)\/(\d+)/);
      if (m) {
        const pct = Math.min(100, Math.round((parseInt(m[1], 10) / Math.max(1, parseInt(m[2], 10))) * 100));
        if (pct >= lastPct + 10) {
          console.log(`[three] job ${jobId} ${pct}% (${Math.round((Date.now() - startedAt) / 1000)}s)`);
          lastPct = Math.floor(pct / 10) * 10;
        }
      }
    });
    // Generous watchdog: first invocation also webpack-bundles the engine (~30s), and CPU/
    // SwiftShader 1080p renders are minutes-long.
    const watchdogMs = Math.max(10 * 60 * 1000, (Number(durationSec) || 15) * 30 * 1000);
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* noop */ } }, watchdogMs);
    const onAbort = () => { try { child.kill("SIGKILL"); } catch { /* noop */ } };
    if (abortSignal) abortSignal.addEventListener("abort", onAbort, { once: true });
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, code: -1, stderr: `${stderr}\nspawn error: ${e.message}`, stdout }); });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (abortSignal) abortSignal.removeEventListener("abort", onAbort);
      resolve({ ok: code === 0, code, signal, stdout, stderr });
    });
  });

  if (!res.ok) {
    const tail = [res.stdout.slice(-1200), res.stderr.slice(-1800)].filter(Boolean).join("\n---\n");
    throw new Error(`remotion render exited code ${res.code}${res.signal ? ` (${res.signal})` : ""}. Tail:\n${tail}`);
  }
  return publishRenderedMp4({ jobId, jobDir, durationSec });
}

module.exports = { renderThree, isThreeRenderable, toEngineStoryboard, SUPPORTED_KINDS };
