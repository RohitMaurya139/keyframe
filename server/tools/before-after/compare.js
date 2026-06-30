#!/usr/bin/env node
// BEFORE/AFTER renderer — proves the cinematic-overhaul lift by rendering the SAME
// storyboard through the LEGACY kit (legacy-kit.js) and the LIVE kit
// (src/services/scene_kit.js), then hstacking matching frames side by side.
//
// Two modes:
//   1. Built-in (default): two hand-authored realistic storyboards (a SaaS tool and a
//      dev CLI). Runs offline — no API key, no LLM. Great for a quick visual check.
//   2. Real prompt (--prompt "..."): runs the actual Gemini chain
//      brief -> script -> storyboard, then renders before/after on model-generated
//      content. Needs an OpenRouter key in server/config.json (llm.apiKey).
//
// Usage:
//   node server/tools/before-after/compare.js
//   node server/tools/before-after/compare.js --prompt "A 12s ad for a habit-tracking app" --pack midnight-glass
//   node server/tools/before-after/compare.js --pack noir-spotlight --duration 9 --frames 22,140
//
// Options:
//   --prompt "<text>"   real-prompt mode (LLM); omit for the built-in demos
//   --pack <name>       frame pack (default: brief's suggestion in prompt mode, else per-demo)
//   --duration <sec>    target duration (prompt mode; default 10)
//   --orientation <horizontal|vertical|square>   default horizontal
//   --quality <480p|720p|1080p>   render size (default 480p — fastest)
//   --frames "a,b"      frame indices to extract for the side-by-side (default 24,150)
//   --name <label>      output subfolder label (default derived from prompt / "demo")
//
// Output: server/tools/before-after/out/<name>_{before,after}/out.mp4
//         server/tools/before-after/out/<name>_f<N>.png   (BEFORE | AFTER side-by-side)

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const legacyKit = require("./legacy-kit");
const liveKit = require("../../src/services/scene_kit");
const config = require("../../src/config");

const OUT = path.join(__dirname, "out");
// Pin to the repo's tested hyperframes (config.example.json render.hyperframesVersion)
// so the comparison is deterministic even when the runtime config.json omits it.
const HF_SPEC = config.render && config.render.hyperframesVersion
  ? `hyperframes@${config.render.hyperframesVersion}` : "hyperframes@0.6.120";
const WIN = process.platform === "win32";

// ---- args -------------------------------------------------------------------
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) { a[k.slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true; }
  }
  return a;
}
const args = parseArgs(process.argv);
const ORIENT = ["horizontal", "vertical", "square"].includes(args.orientation) ? args.orientation : "horizontal";
const QUALITY = ["480p", "720p", "1080p"].includes(args.quality) ? args.quality : "480p";
const FRAMES = String(args.frames || "24,150").split(",").map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));

function dimsFor(orientation, quality) {
  const q = (config.qualities && config.qualities[quality]) || { short: 480, long: 854 };
  const fps = (config.defaults && config.defaults.fps) || 30;
  if (orientation === "vertical") return { width: q.short, height: q.long, fps };
  if (orientation === "square") return { width: q.short, height: q.short, fps };
  return { width: q.long, height: q.short, fps };
}
const dims = dimsFor(ORIENT, QUALITY);

// ---- built-in realistic storyboards (offline mode) --------------------------
const DEMOS = {
  saas: {
    pack: "midnight-glass",
    sb: {
      title: "Your Work, Organized", durationSec: 9,
      palette: { background: "#0B1020", accent: "#7CC4FF", primary: "#FF7DB4", text: "#F6F4EE" },
      scenes: [
        { id: "s1", start: 0, duration: 3, kind: "hook", headline: "Drowning in 12 tabs?", emphasis: "12 tabs", animation: "word-stagger", layout: "fullbleed", transitionOut: "slide-left", beats: [{ at: 0.1 }, { at: 2.6 }] },
        { id: "s2", start: 3, duration: 3, kind: "chart", headline: "40% faster every week", emphasis: "40%", animation: "scale-pop", layout: "centered-card", transitionOut: "wipe", beats: [{ at: 0.1 }, { at: 2.6 }] },
        { id: "s3", start: 6, duration: 3, kind: "cta", headline: "Get your day back", subtext: "Try free", emphasis: "your day", animation: "ken-burns-text", layout: "centered-card", transitionOut: "none", beats: [{ at: 0.1 }] },
      ],
    },
  },
  devtool: {
    pack: "noir-spotlight",
    sb: {
      title: "Ship From The Terminal", durationSec: 9,
      palette: { background: "#08080B", accent: "#E8B23A", primary: "#F4F1EA", text: "#F4F1EA" },
      scenes: [
        { id: "s1", start: 0, duration: 3, kind: "hook", headline: "Deploys shouldn't hurt", emphasis: "shouldn't hurt", animation: "blur-sharp", layout: "fullbleed", transitionOut: "fade", beats: [{ at: 0.1 }, { at: 2.6 }] },
        { id: "s2", start: 3, duration: 3, kind: "caption", headline: "One command. Done.", subtext: "Zero config, zero yaml.", emphasis: "One command", animation: "slide-up", layout: "split-60-40", transitionOut: "scale-through", beats: [{ at: 0.1 }, { at: 2.6 }] },
        { id: "s3", start: 6, duration: 3, kind: "cta", headline: "Start shipping today", subtext: "npm i -g shipit", emphasis: "today", animation: "mask-reveal", layout: "centered-card", transitionOut: "none", beats: [{ at: 0.1 }] },
      ],
    },
  },
};

// storyboardPromptFromScript — reproduced from agents/graph.js (not exported there).
function storyboardPromptFromScript(script, brief) {
  const lines = [
    `Produce this exact video: "${script.title}".`,
    brief ? `Context: ${brief.improvedPrompt}` : "",
    "",
    "Scene-by-scene plan (FOLLOW these timings and contents exactly — same number of scenes, same start/duration):",
  ];
  for (const s of script.scenes) {
    lines.push(
      `- Scene ${s.id} [${s.start}s + ${s.duration}s] (${s.purpose}): ${s.visualDirection} ` +
      ((s.onScreenText || []).length ? `On-screen text: ${s.onScreenText.map((t) => `"${t}"`).join(", ")}. ` : "") +
      (s.voiceover ? `Narration meanwhile: "${s.voiceover}"` : "No narration.")
    );
  }
  return lines.join("\n");
}

// Real Gemini chain: prompt -> brief -> script -> storyboard.
async function storyboardFromPrompt(prompt, duration, orientation) {
  if (!config.llm || !config.llm.apiKey) {
    throw new Error("--prompt mode needs an OpenRouter key in server/config.json (llm.apiKey). Run without --prompt for the offline built-in demos.");
  }
  const { generateBrief } = require("../../src/services/brief");
  const { generateScript } = require("../../src/services/script");
  const { generateStoryboard } = require("../../src/services/storyboard");
  console.log(`[compare] brief…`);
  const { brief } = await generateBrief({ intent: { prompt, durationSec: duration, orientation } });
  console.log(`[compare] script…`);
  const script = await generateScript({ brief });
  const sb = script.script || script; // generateScript may wrap
  console.log(`[compare] storyboard…`);
  const sbPrompt = storyboardPromptFromScript(sb, brief);
  const { storyboard } = await generateStoryboard({ prompt: sbPrompt, duration, orientation, framePack: brief.suggestedFramePack });
  return { storyboard, pack: args.pack || brief.suggestedFramePack };
}

// ---- render + compare -------------------------------------------------------
function render(jobDir) {
  fs.mkdirSync(jobDir, { recursive: true });
  const cmd = WIN ? "npx.cmd" : "npx";
  const res = spawnSync(cmd, ["--yes", HF_SPEC, "render", "--output", "out.mp4", "--quality", "high", "--workers", "2"],
    { cwd: jobDir, shell: WIN, stdio: "ignore" });
  return res.status === 0 && fs.existsSync(path.join(jobDir, "out.mp4"));
}

function build(kit, sb, pack, jobDir) {
  const built = kit.buildComposition({ storyboard: sb, dims, framePack: pack, assets: [], captionCues: null });
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, "index.html"), built.indexHtml, "utf8");
  fs.writeFileSync(path.join(jobDir, "meta.json"), built.metaJson, "utf8");
}

function hstack(name, beforeMp4, afterMp4, frame) {
  const out = path.join(OUT, `${name}_f${frame}.png`);
  const fc =
    `[0:v]select='eq(n\\,${frame})',drawtext=text='BEFORE':x=12:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=red@0.6:boxborderw=6[a];` +
    `[1:v]select='eq(n\\,${frame})',drawtext=text='AFTER':x=12:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=green@0.6:boxborderw=6[b];` +
    `[a][b]hstack`;
  const res = spawnSync("ffmpeg", ["-v", "error", "-i", beforeMp4, "-i", afterMp4, "-filter_complex", fc, "-frames:v", "1", "-update", "1", out, "-y"], { stdio: "ignore" });
  return res.status === 0 && fs.existsSync(out) ? out : null;
}

async function runOne(name, sb, pack) {
  console.log(`\n[compare] "${name}" (pack=${pack}, ${dims.width}x${dims.height})`);
  const beforeDir = path.join(OUT, `${name}_before`);
  const afterDir = path.join(OUT, `${name}_after`);
  build(legacyKit, sb, pack, beforeDir);
  build(liveKit, sb, pack, afterDir);
  const b = render(beforeDir), a = render(afterDir);
  if (!b || !a) { console.warn(`[compare] render failed (before=${b}, after=${a})`); return; }
  console.log(`[compare]   before: ${beforeDir}/out.mp4`);
  console.log(`[compare]   after:  ${afterDir}/out.mp4`);
  for (const f of FRAMES) {
    const png = hstack(name, path.join(beforeDir, "out.mp4"), path.join(afterDir, "out.mp4"), f);
    if (png) console.log(`[compare]   side-by-side @frame ${f}: ${png}`);
    else console.warn(`[compare]   (ffmpeg not available / failed for frame ${f} — MP4s still rendered)`);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (args.prompt && typeof args.prompt === "string") {
    const duration = parseInt(args.duration, 10) || 10;
    const name = (args.name && String(args.name)) || args.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "prompt";
    const { storyboard, pack } = await storyboardFromPrompt(args.prompt, duration, ORIENT);
    fs.writeFileSync(path.join(OUT, `${name}_storyboard.json`), JSON.stringify(storyboard, null, 2));
    await runOne(name, storyboard, pack);
  } else {
    for (const [name, d] of Object.entries(DEMOS)) {
      await runOne(name, d.sb, args.pack && typeof args.pack === "string" ? args.pack : d.pack);
    }
  }
  console.log(`\n[compare] done. Open the PNGs in ${OUT} (left = BEFORE / legacy kit, right = AFTER / cinematic kit).`);
})().catch((e) => { console.error(`[compare] ${e.message}`); process.exit(1); });
