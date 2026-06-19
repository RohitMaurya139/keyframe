// QA Agent — the reviewer at the end of the line. Samples frames from the
// RENDERED video, shows them to the vision model alongside the design-system
// expectations, and returns a structured verdict. A failed verdict feeds one
// repair pass back through the Composition agent.
//
// This agent exists because every failure we shipped during development
// (empty scenes, offscreen content, unreadable text) was visible in frames
// and invisible to lint.

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const openrouter = require("./../services/openrouter");
const { extractFirstJsonObject } = require("../services/json_lenient");

function extractFrame(videoPath, atSec, outPath) {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(atSec), "-i", videoPath, "-vframes", "1", "-vf", "scale=640:-2", "-q:v", "6", outPath]);
    const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* noop */ } }, 30_000);
    p.on("error", () => { clearTimeout(timer); resolve(false); });
    p.on("exit", (code) => { clearTimeout(timer); resolve(code === 0 && fs.existsSync(outPath)); });
  });
}

// Sample one frame inside every scene (mid-scene, past the entrance) plus the
// very first frame — empty openings were a real failure mode.
function sampleTimes(scenes, duration) {
  const times = [0.6];
  for (const s of scenes || []) {
    times.push(Math.min(duration - 0.2, s.start + Math.min(s.duration * 0.6, s.duration - 0.3)));
  }
  return [...new Set(times.map((t) => Math.round(t * 10) / 10))].slice(0, 8);
}

const VERDICT_INSTRUCTIONS = `You are the quality-assurance director reviewing rendered video frames before delivery. Judge ONLY what is visible. Return STRICT JSON:
{
  "pass": true|false,
  "score": <0-10>,
  "issues": [{ "atSec": <number>, "severity": "blocker|minor", "issue": "<what is wrong>", "fix": "<a CONCRETE instruction for the composer: which element, what to change, where>" }]
}

BLOCKER issues (any ONE fails the video — be strict, this is a premium motion-graphics product):
1. EMPTY / NEAR-EMPTY FRAME: only a background or solid color is visible, with no real content.
2. UNDER-ILLUSTRATED FRAME: the frame shows essentially just text (a headline/body) on a flat or near-flat background, with NO supporting imagery, vectors, shapes, particles, or decorative layers. Premium video keeps multiple distinct visual layers on screen — a frame must show AT LEAST 2–3 distinct non-text visual elements (a photo, plus SVG accents / particles / shapes / icons). A text-only or text-plus-one-static-gradient frame is a BLOCKER. In the "fix", tell the composer to add specific animated vector/asset layers (e.g. "add a drifting particle field + a drawing underline + an inset image at 8–10s").
3. TEXT CONTRAST FAILURE: any text you cannot read instantly and comfortably at thumbnail size — light text on a light ground, dark text on a dark ground, text in an accent hue that blends into the background, or text laid over a busy image/gradient without a solid contrast device behind it. Treat WCAG AA (~4.5:1) as the floor; if contrast looks even borderline, FAIL it and tell the composer the exact fix (swap text to the lightest/darkest token, or add a solid panel/scrim behind it).
4. TEXT OVERFLOW: text cut off mid-word, overflowing its container, or clipped at the frame edge.
5. IMAGE DISTORTION: an image stretched/squashed (missing object-fit: cover) or covering critical text.
6. CONTENT OFFSCREEN: a card/element half off the frame edge with nothing else visible (layout error).
7. ELEMENT COLLISION: two or more CONTENT blocks (cards, stat tiles, labels, headlines, icon groups, image insets) overlapping or stacked on top of one another in SPACE when they should sit side-by-side or stacked-with-a-gap — e.g. text running through another text block, a stat tile covering a label, two cards occupying the same region. (This does NOT apply to deliberate layered effects like a glow/scrim/shadow behind text.) In the "fix", NAME which elements collide and tell the composer to lay them out in a flex/grid container with an explicit gap, or move/scale one element so they no longer overlap.

MINOR issues (report, do NOT fail): cramped spacing, weak hierarchy, a transition caught mid-motion, a single thin scene in an otherwise rich video. (A caption that very slightly touches a content edge is minor; two CONTENT blocks overlapping is a BLOCKER per #7, not minor.)

A frame caught mid-transition with PARTIAL content is NORMAL — do not fail it for that alone. Be strict about the blockers above (especially under-illustration and contrast), lenient about pure style.`;

async function reviewRender({ videoPath, scenes, duration, framePack, frameMd, workDir, tracker, signal }) {
  fs.mkdirSync(workDir, { recursive: true });
  const times = sampleTimes(scenes, duration);
  const frames = [];
  for (const t of times) {
    const out = path.join(workDir, `qa_${String(t).replace(".", "_")}.jpg`);
    if (await extractFrame(videoPath, t, out)) frames.push({ t, path: out });
  }
  if (frames.length < 2) {
    return { pass: true, score: null, issues: [], note: "qa skipped: could not extract frames" };
  }

  const content = [
    {
      type: "text",
      text: [
        VERDICT_INSTRUCTIONS,
        "",
        framePack ? `The video must follow the "${framePack}" design system. Its rules (summary): the frames should visibly use this system's palette and components.` : "",
        `Frames below are sampled at: ${frames.map((f) => `${f.t}s`).join(", ")} of a ${duration}s video. Scene plan: ${JSON.stringify((scenes || []).map((s) => ({ id: s.id, start: s.start, duration: s.duration, purpose: s.purpose })))}`,
      ].filter(Boolean).join("\n"),
    },
    ...frames.map((f) => ({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(f.path).toString("base64")}` },
    })),
  ];

  const { text, tokensIn, tokensOut } = await openrouter.chat({
    system: "You are a meticulous video QA director. Strict JSON only.",
    user: content,
    jsonMode: true,
    stage: "qa",
    temperature: 0.2,
    signal,
  });
  if (tracker) tracker.addLlm({ inputTokens: tokensIn, outputTokens: tokensOut });

  const verdict = extractFirstJsonObject(text);
  const issues = Array.isArray(verdict.issues) ? verdict.issues.slice(0, 8) : [];
  const blockers = issues.filter((i) => i.severity === "blocker");
  const pass = verdict.pass !== false && blockers.length === 0;
  console.log(`[qa] verdict: ${pass ? "PASS" : "FAIL"} score=${verdict.score ?? "?"} blockers=${blockers.length} minors=${issues.length - blockers.length}`);
  return { pass, score: verdict.score ?? null, issues };
}

module.exports = { reviewRender };
