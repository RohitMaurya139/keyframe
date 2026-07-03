// FFmpeg-based audio mixer. Takes a visual MP4 and 0-or-more audio layers
// (tts, music, sfx[]) and produces a new MP4 with the audio tracks mixed in.
//
// Bug we avoid: if we used `amix=duration=first` + `-shortest`, a short TTS
// clip (say 3 s) would truncate the whole video to 3 s. Instead we:
//   1. Inject an `anullsrc` silent track as the FIRST amix input, sized to
//      the requested video duration. `duration=first` now anchors to that
//      silent track, always full length.
//   2. Use `-t durationSec` as the single authoritative output length.
//   3. Do NOT pass `-shortest` — it overrides `-t` when any audio input
//      is shorter, which was our 3-sec-video bug.
// Any layer that's null or missing is skipped; if no audio at all, we
// short-circuit and return the original path.

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

function log(...args) { console.log("[audio_mix]", ...args); }

function runFFmpeg(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args]);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch {}
    }, timeoutMs);
    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-600)}`));
    });
  });
}

/**
 * Mix audio into a video file.
 */
async function mix({
  videoPath,
  outputPath,
  durationSec,
  ttsPath = null,
  musicPath = null,
  musicVolume = 0.10, // music is a BED under the (normalised) voiceover, not a peer
  sfx = [],
}) {
  // Build layer list (entries are just metadata; input args built separately).
  const layers = [];
  const inputs = ["-i", videoPath];              // [0:v] + [0:a] if video has audio
  let nextIdx = 1;

  // Silent anchor track — same length as the video. Guarantees amix output
  // is always `durationSec` long regardless of other layers' durations.
  inputs.push(
    "-f", "lavfi",
    "-t", String(durationSec),
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
  );
  const silenceIdx = nextIdx++;

  if (ttsPath) {
    inputs.push("-i", ttsPath);
    layers.push({ kind: "tts", idx: nextIdx++, volume: 1.0, delayMs: 0 });
  }
  // Music is handled separately (fade + sidechain ducking), NOT as a flat layer.
  let musicLayer = null;
  if (musicPath) {
    inputs.push("-stream_loop", "-1", "-i", musicPath); // loop so short clips cover full duration
    musicLayer = { idx: nextIdx++, volume: musicVolume };
  }
  for (const s of sfx) {
    if (!s.path) continue;
    const kind = s.kind || "sfx";
    // Drop a percussive SFX (whoosh/impact/riser) that lands in the last ~1.2s — it can't
    // resolve before the cut and reads as a jarring "different sound" at the very end.
    // VO (speech) is exempt: a closing line at the final scene is intentional.
    if (kind !== "vo" && (s.startSec || 0) > durationSec - 1.2) continue;
    inputs.push("-i", s.path);
    layers.push({
      // Voiceover clips arrive tagged kind:"vo" so the mixer can duck music
      // under speech; everything else defaults to sfx.
      kind,
      idx: nextIdx++,
      volume: s.volume ?? 0.5,
      delayMs: Math.max(0, Math.round((s.startSec || 0) * 1000)),
    });
  }

  if (layers.length === 0 && !musicLayer) {
    log("no audio layers — returning original video");
    if (videoPath !== outputPath) fs.copyFileSync(videoPath, outputPath);
    return outputPath;
  }

  // Voice = TTS + VO clips; these key the music ducking AND mix into the output.
  const voiceLayers = layers.filter((l) => l.kind === "vo" || l.kind === "tts");
  const duck = !!musicLayer && voiceLayers.length > 0;

  // Filter graph: silent anchor first, then each layer volumed + delayed.
  const parts = [`[${silenceIdx}:a]anull[silence]`];
  const mixInputs = [`[silence]`];
  const keyLabels = []; // VO copies that drive the sidechain key bus

  for (const l of layers) {
    const label = `a${l.idx}`;
    const isVoice = l.kind === "vo" || l.kind === "tts";
    // VOICEOVER MUST SIT ABOVE THE MUSIC. Raw TTS clips are often low-amplitude, so at a
    // flat volume the 0.15 music bed could bury them. Normalise every VO clip to a
    // consistent, prominent speech loudness (-16 LUFS, -1.5 dB true-peak) FIRST — this
    // also gives the sidechain a strong key so the music actually ducks under speech.
    const norm = isVoice ? "loudnorm=I=-16:TP=-1.5:LRA=11," : "";
    const delay = l.delayMs > 0 ? `adelay=${l.delayMs}|${l.delayMs},` : "";
    const chain = `${norm}${delay}volume=${l.volume}`;
    if (duck && isVoice) {
      // Split each VO: one copy to the final mix, one to the duck key.
      parts.push(`[${l.idx}:a]${chain},aresample=44100,asplit=2[${label}m][${label}k]`);
      mixInputs.push(`[${label}m]`);
      keyLabels.push(`[${label}k]`);
    } else {
      parts.push(`[${l.idx}:a]${chain}[${label}]`);
      mixInputs.push(`[${label}]`);
    }
  }

  if (musicLayer) {
    // Fade in/out so music never starts or ends abruptly. atrim gives the
    // afade-out a defined endpoint on the infinite stream_loop input. The fade-out is
    // LONG (≈25% of the video, 2–3s) on purpose: we truncate a full-length track to the
    // clip length, so its tail can land mid-phrase or on a beat/drop — a gentle 2–3s fade
    // dissolves that "different sound at the end" instead of exposing it under a short 1.2s cut.
    const fadeOutDur = Math.min(3, Math.max(1.5, durationSec * 0.25));
    const fadeOutStart = Math.max(0, durationSec - fadeOutDur);
    const fadeInDur = Math.min(0.8, durationSec);
    parts.push(
      `[${musicLayer.idx}:a]atrim=0:${durationSec},volume=${musicLayer.volume},` +
      `afade=t=in:st=0:d=${fadeInDur},afade=t=out:st=${fadeOutStart}:d=${fadeOutDur},aresample=44100[muspre]`
    );
    if (duck) {
      // Build the VO key bus, then duck music under speech (sidechain compressor).
      if (keyLabels.length === 1) {
        parts.push(`${keyLabels[0]}aresample=44100[vokey]`);
      } else {
        parts.push(`${keyLabels.join("")}amix=inputs=${keyLabels.length}:duration=longest:normalize=0,aresample=44100[vokey]`);
      }
      // Duck the music HARD under speech: with a normalised VO key, this drops the bed
      // clearly whenever the voiceover is talking, then recovers in the gaps.
      parts.push(`[muspre][vokey]sidechaincompress=threshold=0.05:ratio=12:attack=15:release=350[musfinal]`);
    } else {
      parts.push(`[muspre]anull[musfinal]`);
    }
    mixInputs.push(`[musfinal]`);
  }

  // duration=first anchors to the silent track (full video length).
  parts.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=first:normalize=0[aout]`);
  const filter = parts.join(";");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", filter,
    "-map", "0:v",
    "-map", "[aout]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "160k",
    "-t", String(durationSec),       // authoritative output length
    // Intentionally NO -shortest — it would re-truncate to shortest stream.
    outputPath,
  ];

  log(`mixing ${layers.length} audio layer(s) + silence anchor into ${path.basename(outputPath)} (t=${durationSec}s)`);
  const timeoutMs = Math.max(60_000, Math.round(durationSec * 6_000));
  await runFFmpeg(args, timeoutMs);
  return outputPath;
}

module.exports = { mix };
