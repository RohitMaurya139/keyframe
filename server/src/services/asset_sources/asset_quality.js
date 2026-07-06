// Asset QUALITY gates — resolution / aspect / transparency / perceptual near-duplicate.
// Built entirely on ffmpeg + ffprobe (already hard deps) rather than adding `sharp`:
// the codebase already reads raw pixels through ffmpeg (see dominantColors in
// ingest/website.js), so we reuse that pattern and avoid a native-module build.
//
// Every function fails OPEN (unknown dims / probe error / hash miss never BLOCKS
// acquisition) — quality gates should trim junk, never starve a scene of an asset.

const fs = require("node:fs");
const { spawn } = require("node:child_process");
const config = require("../../config");

function cfg(key, dflt) {
  const v = config.assets && config.assets[key];
  return v == null ? dflt : v;
}

// ffmpeg pixel formats that carry an alpha channel (transparency). Used so placement
// can route true-alpha art to CONTAINED slots instead of stretching it full-bleed.
const ALPHA_RE = /^(rgba|bgra|argb|abgr|ya8|ya16|yuva|gbrap|pal8)/;
function pixFmtHasAlpha(pf) { return ALPHA_RE.test(String(pf || "").toLowerCase()); }

// One ffprobe call: validate (decodable + real dims + not a tiny error-page) AND read
// dimensions + pixel format. Supersedes util.validateMedia in acquire() so we get
// validation, size, and alpha in a single probe. Returns { ok, width, height, pixFmt, hasAlpha }.
function probeMedia(filePath, type) {
  return new Promise((resolve) => {
    try {
      if (fs.statSync(filePath).size < 5 * 1024) return resolve({ ok: false });
    } catch { return resolve({ ok: false }); }
    const p = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,width,height,pix_fmt",
      "-of", "json",
      filePath,
    ]);
    let out = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* noop */ } resolve({ ok: false }); }, 20_000);
    p.on("error", () => { clearTimeout(timer); resolve({ ok: false }); });
    p.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) return resolve({ ok: false });
      try {
        const s = (JSON.parse(out).streams || [])[0];
        const width = (s && Number(s.width)) || 0;
        const height = (s && Number(s.height)) || 0;
        const pixFmt = (s && s.pix_fmt) || "";
        resolve({ ok: Boolean(width > 0 && height > 0), width, height, pixFmt, hasAlpha: pixFmtHasAlpha(pixFmt) });
      } catch { resolve({ ok: false }); }
    });
  });
}

// dHash (difference hash): downscale to 9x8 grayscale via ffmpeg, then for each row compare
// each pixel to its right neighbor → 8x8 = 64 bits → 16-char hex. Robust to scaling/reencoding/
// minor edits, so it catches the SAME shot arriving from two providers/queries byte-different.
// Raster only (ffmpeg can't decode SVG — but SVGs are curated-only and never reach here).
// Returns null on any failure (fail-open).
function perceptualHash(filePath) {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-i", filePath,
      "-vf", "scale=9:8,format=gray", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1",
    ]);
    const chunks = [];
    p.stdout.on("data", (d) => chunks.push(d));
    const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* noop */ } resolve(null); }, 15_000);
    p.on("error", () => { clearTimeout(timer); resolve(null); });
    p.on("exit", (code) => {
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      if (code !== 0 || buf.length < 72) return resolve(null);
      let bits = "";
      for (let row = 0; row < 8; row++) {
        const base = row * 9;
        for (let col = 0; col < 8; col++) bits += buf[base + col] > buf[base + col + 1] ? "1" : "0";
      }
      let hex = "";
      for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
      resolve(hex);
    });
  });
}

// Bit-difference between two dHash hexes (0 = identical, 64 = opposite). Mismatched/missing
// inputs → 64 (treated as "not a duplicate").
function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = (parseInt(a[i], 16) || 0) ^ (parseInt(b[i], 16) || 0);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

// Is this asset's phash within the near-duplicate band of ANY already-chosen hash?
function isNearDuplicate(phash, excludeHashes, threshold = cfg("dedupeHamming", 10)) {
  if (!phash || !excludeHashes || !excludeHashes.size) return false;
  for (const h of excludeHashes) if (hammingDistance(phash, h) <= threshold) return true;
  return false;
}

// Resolution floor — reject thumbnails a full-bleed slot would render mushy. Backgrounds
// need real pixels; insets/icons/logos can be smaller. Fail-open on unknown dims.
function resolutionOk({ width, height } = {}, target, role) {
  if (!width || !height) return true;
  const longer = Math.max(width, height);
  const r = String(role || "").toLowerCase();
  // kindPref values ("vector"/"illustration") and raw role words both map here. "photo" and
  // undefined fall through to the (higher) background floor — full-bleed slots need real pixels.
  const inset = ["inset", "icon", "texture", "logo", "vector", "illustration"].includes(r);
  if (inset) return longer >= cfg("minResolutionInset", 320);
  const targetLonger = target ? Math.max(target.targetW || 0, target.targetH || 0) : 1920;
  const floor = Math.min(cfg("minResolutionBg", 1000), Math.round(cfg("bgFloorRatio", 0.55) * targetLonger));
  return longer >= floor;
}

// Extreme mis-shape — a sliver/panorama that object-fit:cover would gut (loses the subject).
// Conservative: only rejects ratios well beyond normal 4:3↔16:9 crops. Fail-open on unknown.
function aspectExtreme({ width, height } = {}) {
  if (!width || !height) return false;
  return Math.max(width, height) / Math.min(width, height) > cfg("maxAspectRatio", 2.6);
}

module.exports = {
  probeMedia, perceptualHash, hammingDistance, isNearDuplicate,
  resolutionOk, aspectExtreme, pixFmtHasAlpha,
};
