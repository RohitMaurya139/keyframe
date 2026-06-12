// Stage 11 helper: make a scene's voiceover FIT its scene.
// Measure the synthesized clip with ffprobe; if it overruns the scene by
// more than 10%, ask the fast model ONCE for a tighter line and re-synth.

const { spawn } = require("node:child_process");
const openrouter = require("./openrouter");
const { synthesize } = require("./tts");

function probeDurationSec(filePath) {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath]);
    let out = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* noop */ } }, 15_000);
    p.on("error", () => { clearTimeout(timer); resolve(null); });
    p.on("exit", (code) => {
      clearTimeout(timer);
      const v = parseFloat(out.trim());
      resolve(code === 0 && Number.isFinite(v) ? v : null);
    });
  });
}

async function tightenLine({ line, targetSec, signal }) {
  const targetWords = Math.max(3, Math.floor(targetSec * 2.6));
  const { text, tokensIn, tokensOut } = await openrouter.chat({
    system: "You tighten voiceover lines. Reply with ONLY the rewritten line — no quotes, no commentary. Preserve the meaning and any names/numbers exactly.",
    user: `Rewrite this voiceover line to at most ${targetWords} words so it can be spoken comfortably in ${targetSec} seconds:\n${line}`,
    stage: "vo_fit",
    temperature: 0.4,
    signal,
  });
  return { line: text.trim().replace(/^["']|["']$/g, ""), tokensIn, tokensOut };
}

// Synthesize one scene's VO, tightening once if it overruns.
// Returns { path, durationSec, text, tightened } or null (no VO / synth failed).
async function synthesizeFitted({ text, targetSec, voice, instructions, outputPath, tracker, signal }) {
  if (!text || !text.trim()) return null;

  await synthesize({ script: text, voice, instructions, outputPath, tracker });
  let dur = await probeDurationSec(outputPath);
  if (dur == null) return { path: outputPath, durationSec: targetSec, text, tightened: false };

  if (dur <= targetSec * 1.10) {
    return { path: outputPath, durationSec: dur, text, tightened: false };
  }

  console.log(`[vo_fit] scene VO ${dur.toFixed(1)}s > ${targetSec}s budget — tightening once`);
  try {
    const t = await tightenLine({ line: text, targetSec, signal });
    if (tracker) tracker.addLlm({ inputTokens: t.tokensIn, outputTokens: t.tokensOut });
    await synthesize({ script: t.line, voice, instructions, outputPath, tracker });
    dur = (await probeDurationSec(outputPath)) ?? targetSec;
    return { path: outputPath, durationSec: dur, text: t.line, tightened: true };
  } catch (e) {
    console.warn(`[vo_fit] tighten failed (${e.message}); keeping original take`);
    return { path: outputPath, durationSec: dur, text, tightened: false };
  }
}

module.exports = { synthesizeFitted, probeDurationSec };
