// KEYFRAME project pipeline — the two-act flow with the script checkpoint.
//
//   Act 1  runIntake():    intent -> brief -> draft script -> PAUSE (script_review)
//   Act 2  runProduction(): approved script -> storyboard -> compose (frame pack)
//                           -> render -> VO/music from the script -> mix -> done
//
// The pause is the product's signature: the user edits voiceover lines, scene
// durations, and asset queries in the Script Room, then approves. With
// autopilot the approve step is automatic.
//
// Act 2 reuses the v1 pipeline's battle-tested pieces (withBudget,
// attemptLlmComposition, mixAudioIntoVideo) rather than reimplementing them.

const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");
const db = require("../db");
const { UsageTracker } = require("./usage");
const { generateBrief } = require("./brief");
const { generateScript, validateScript, normalizeScript } = require("./script");
const { understandWebsite } = require("./ingest/website");
const { transcribeVideo } = require("./ingest/transcribe");
const { generateStoryboard } = require("./storyboard");
const { buildFallback } = require("./fallback");
const { synthesize: ttsSynthesize } = require("./tts");
const { fetchMusic } = require("./audio_sources");
const { VALID_VOICES } = require("./audio_planner");
const { render } = require("./renderer");
const { withBudget, attemptLlmComposition, mixAudioIntoVideo } = require("./pipeline");

function jobDirFor(jobId) { return path.join(config.paths.jobsDir, jobId); }
function ms() { return Date.now(); }

// ---------- Act 1: intake ----------

async function runIntake({ jobId, onApproved, skipBrief = false }) {
  const job = db.getRaw(jobId);
  if (!job) return;

  const tracker = new UsageTracker();
  const timings = {};
  db.markStarted(jobId);

  try {
    const intent = job.intent || {
      prompt: job.prompt,
      preferences: {
        duration: job.duration,
        orientation: job.orientation,
        voiceStyle: job.voice_style || "auto",
        framePack: job.frame_pack || "auto",
      },
    };

    // ---- Multi-modal ingest: website + reference video, in parallel.
    // Each worker degrades to null on failure — a dead URL must not kill the
    // project when a prompt is also present.
    if ((intent.websiteUrl || job.upload_path) && !intent.__ingested) {
      const t0 = ms();
      db.setProgress(jobId, "ingest");
      const workDir = path.join(jobDirFor(jobId), "ingest");

      const websiteTask = intent.websiteUrl
        ? understandWebsite({ url: intent.websiteUrl, workDir, timeoutMs: config.ingest?.websiteTimeoutMs || 60_000 })
            .catch((e) => { console.warn(`[project] website ingest failed: ${e.message}`); return null; })
        : Promise.resolve(null);

      const videoTask = job.upload_path
        ? transcribeVideo({ videoPath: job.upload_path, workDir, tracker })
            .catch((e) => { console.warn(`[project] video ingest failed: ${e.message}`); return null; })
        : Promise.resolve(null);

      const [website, video] = await Promise.all([websiteTask, videoTask]);
      if (website) {
        intent.website = {
          url: website.url, title: website.title, description: website.description,
          headings: website.headings, bodyText: website.bodyText,
          brandColors: website.brandColors, ogImage: website.ogImage,
        };
        job.website_screenshot = website.screenshotPath;
      }
      if (video) intent.video = video;
      intent.__ingested = true;
      job.intent = intent; // persist enriched intent for regenerate runs
      timings.ingestMs = ms() - t0;

      if (!intent.prompt && !website && !video) {
        throw new Error("ingest produced no usable signal (prompt empty, website and video ingest both failed)");
      }
    }

    let brief;
    if (skipBrief && job.brief) {
      brief = job.brief; // regenerate-script keeps the existing brief
    } else {
      const t0 = ms();
      db.setProgress(jobId, "brief");
      const briefRes = await generateBrief({ intent });
      tracker.addLlm({ inputTokens: briefRes.tokensIn, outputTokens: briefRes.tokensOut });
      timings.briefMs = ms() - t0;
      brief = briefRes.brief;
    }

    // The user's explicit duration wins over the model's suggestion.
    if (job.duration) brief.suggestedDuration = job.duration;

    const tScript = ms();
    db.setProgress(jobId, "script");
    const scriptRes = await generateScript({ brief });
    tracker.addLlm({ inputTokens: scriptRes.tokensIn, outputTokens: scriptRes.tokensOut });
    timings.scriptMs = ms() - tScript;

    db.markScriptReview(jobId, {
      brief,
      script: scriptRes.script,
      warnings: scriptRes.warnings,
      framePack: brief.suggestedFramePack,
      usage: tracker.computeCosts(),
      stageTimings: timings,
    });
    console.log(`[project] ${jobId} intake done — ${scriptRes.script.scenes.length} scenes, paused at script_review (autopilot=${!!job.autopilot})`);

    if (job.autopilot) {
      db.markApproved(jobId, { script: scriptRes.script });
      if (onApproved) onApproved(jobId);
    }
  } catch (err) {
    console.error(`[project] ${jobId} intake failed: ${err.message}`);
    const costs = tracker.computeCosts();
    db.markFailed(jobId, err.message.slice(0, 2000), costs.llm.inputTokens, costs.llm.outputTokens, costs, timings);
  }
}

// ---------- Act 2: production ----------

// The storyboard stage still speaks "prompt" — feed it a structured digest of
// the approved script so scene boundaries, VO, and on-screen text line up.
// (Phase 5 upgrades storyboard.js to consume the script natively with beats.)
function storyboardPromptFromScript(script, brief) {
  const lines = [
    `Produce this exact video: "${script.title}".`,
    brief ? `Context: ${brief.improvedPrompt}` : "",
    "",
    "Scene-by-scene plan (FOLLOW these timings and contents exactly — same number of scenes, same start/duration):",
  ];
  for (const s of script.scenes) {
    lines.push(
      `- Scene ${s.id} [${s.start}s + ${s.duration}s] (${s.purpose}): ` +
      `${s.visualDirection} ` +
      (s.onScreenText.length ? `On-screen text: ${s.onScreenText.map((t) => `"${t}"`).join(", ")}. ` : "") +
      (s.voiceover ? `Narration meanwhile: "${s.voiceover}"` : "No narration.")
    );
  }
  return lines.join("\n");
}

function pickVoice(job, script) {
  const want = (job.voice_style || script?.voice?.style || "").toLowerCase();
  for (const v of VALID_VOICES) {
    if (want.includes(v)) return v;
  }
  return "nova";
}

async function runProduction({ jobId }) {
  const job = db.getRaw(jobId);
  if (!job || !job.script) {
    console.error(`[project] ${jobId} production aborted: no approved script`);
    return;
  }

  const jobDir = jobDirFor(jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const tracker = new UsageTracker();
  const timings = job.stage_timings ? { ...job.stage_timings } : {};
  const markStage = (name, startAt) => { timings[name + "Ms"] = ms() - startAt; };

  db.markStarted(jobId);
  const script = normalizeScript(job.script, { targetDuration: job.duration });
  const brief = job.brief;
  const framePack = job.frame_pack || null;
  const duration = job.duration;
  const dims = { width: job.width, height: job.height, fps: job.fps };

  let usedFallback = false;
  let finalAttempt = "main";
  let visualResult = null;

  try {
    // ---- Audio starts immediately, in parallel with the visual chain.
    // VO is the approved script's exact lines, in order — never re-written.
    const audioDir = path.join(jobDir, "audio");
    fs.mkdirSync(audioDir, { recursive: true });
    const narration = script.scenes.map((s) => s.voiceover).filter(Boolean).join(" ");
    const voice = pickVoice(job, script);

    const ttsTask = narration
      ? ttsSynthesize({
          script: narration,
          voice,
          instructions: `${script.voice.style}. Pace: ${script.voice.pace}.`,
          outputPath: path.join(audioDir, "tts.mp3"),
          tracker,
        }).catch((e) => { console.warn(`[project] tts failed: ${e.message}`); return null; })
      : Promise.resolve(null);

    const musicTask = script.music?.query
      ? fetchMusic({ query: script.music.query, outputPath: path.join(audioDir, "music.mp3"), tracker })
          .catch((e) => { console.warn(`[project] music failed: ${e.message}`); return null; })
      : Promise.resolve(null);

    // ---- Storyboard from the approved script ----
    {
      const t0 = ms();
      db.setProgress(jobId, "storyboard");
      const sbPrompt = storyboardPromptFromScript(script, brief);
      const sbRes = await generateStoryboard({ prompt: sbPrompt, duration, orientation: job.orientation });
      tracker.addLlm({ inputTokens: sbRes.tokensIn, outputTokens: sbRes.tokensOut });
      markStage("storyboard", t0);

      // ---- Compose + render (frame-pack styled), with the v1 budget wrapper ----
      const budget = (Number(config.server.stageBudgetSec) || 240) * 1000;
      const t1 = ms();
      db.setProgress(jobId, "composing");
      try {
        visualResult = await withBudget(
          (signal) => attemptLlmComposition({
            storyboard: sbRes.storyboard, dims, jobDir,
            assets: [], tracker, jobId, durationSec: duration,
            label: "project-main", abortSignal: signal, framePack,
          }),
          budget, "project composition"
        );
        markStage("compose_render", t1);
      } catch (e1) {
        markStage("compose_render", t1);
        console.warn(`[project] composition failed (${e1.message.slice(0, 200)}); using fallback`);
        finalAttempt = "fallback";
        usedFallback = true;
        const fb = buildFallback({
          prompt: brief?.improvedPrompt || job.prompt, duration,
          orientation: job.orientation, width: dims.width, height: dims.height, fps: dims.fps,
          storyboard: sbRes.storyboard,
        });
        fs.writeFileSync(path.join(jobDir, "index.html"), fb.indexHtml, "utf8");
        fs.writeFileSync(path.join(jobDir, "meta.json"), fb.metaJson, "utf8");
        tracker.addExternal("hyperframes_render");
        visualResult = await render({ jobId, jobDir, durationSec: duration });
      }
    }

    // ---- Mix audio ----
    {
      const t0 = ms();
      db.setProgress(jobId, "audio");
      const [ttsPath, musicPath] = await Promise.all([ttsTask, musicTask]);
      await mixAudioIntoVideo({
        visualPath: visualResult.videoPath,
        durationSec: duration,
        audio: { ttsPath, musicPath, sfx: [], musicVolume: config.audio?.defaultMusicVolume ?? 0.15 },
      }).catch((e) => console.warn(`[project] mix failed: ${e.message}`));
      markStage("audio", t0);
    }

    db.setProgress(jobId, "finalizing");
    const costs = tracker.computeCosts();
    db.markDone(jobId, {
      videoUrl: visualResult.videoUrl,
      usedFallback,
      tokensIn: costs.llm.inputTokens,
      tokensOut: costs.llm.outputTokens,
      usage: costs,
      stageTimings: timings,
      finalAttempt,
    });
    console.log(`[project] ${jobId} done — attempt=${finalAttempt}, cost=$${costs.totalCostUsd}`);
  } catch (err) {
    console.error(`[project] ${jobId} production failed: ${err.message}`);
    const costs = tracker.computeCosts();
    db.markFailed(jobId, err.message.slice(0, 2000), costs.llm.inputTokens, costs.llm.outputTokens, costs, timings);
  }
}

module.exports = { runIntake, runProduction, validateScript, normalizeScript };
