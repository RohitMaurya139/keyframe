// Frame-pack registry. A "frame pack" is a folder under the frames dir
// containing FRAME.md (design tokens + composition rules, YAML frontmatter +
// prose) and optionally frame-showcase.html (the canonical reference render).
//
// The selected pack's FRAME.md is injected VERBATIM into the composer system
// prompt as the authoritative design system: atoms are sacred, composition is
// free. This is how every video gets a coherent, art-directed identity
// instead of generic AI styling.

const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");

function resolveFramesDir() {
  const candidates = [];
  if (config.frames && config.frames.dir) {
    candidates.push(path.resolve(config.paths.root, config.frames.dir));
  }
  candidates.push(path.resolve(config.paths.root, "frames"));
  candidates.push(path.resolve(config.paths.root, "..", "frames"));
  for (const c of candidates) {
    try { if (fs.statSync(c).isDirectory()) return c; } catch { /* keep looking */ }
  }
  return null;
}

const FRAMES_DIR = resolveFramesDir();
if (FRAMES_DIR) {
  console.log(`[frames] registry dir: ${FRAMES_DIR}`);
} else {
  console.warn(`[frames] no frames directory found — compositions will be unstyled (generic)`);
}

/** @type {Map<string, {frameMd: string, mtimeMs: number}>} */
const cache = new Map();

function frameMdPath(name) { return path.join(FRAMES_DIR, name, "FRAME.md"); }

function listPacks() {
  if (!FRAMES_DIR) return [];
  return fs.readdirSync(FRAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(frameMdPath(name)))
    .sort();
}

function defaultPack() {
  const packs = listPacks();
  if (!packs.length) return null;
  const preferred = config.frames && config.frames.defaultPack;
  return (preferred && packs.includes(preferred)) ? preferred : packs[0];
}

// Resolve a user-requested pack name. null/"" /"auto" -> default pack.
// Unknown name -> null (caller decides whether that's a 400 or a fallback).
function resolvePack(requested) {
  const packs = listPacks();
  if (!packs.length) return null;
  if (!requested || requested === "auto") return defaultPack();
  return packs.includes(requested) ? requested : null;
}

// Tone keywords per pack — used by selectAutoPack to match a prompt to a fitting VISUAL
// FAMILY, then spread within it. Packs can share keywords (a prompt usually fits several),
// which is what gives variety: the prompt-hash breaks ties differently for different text.
const PACK_VIBES = {
  "midnight-glass": ["tech", "saas", "ai", "software", "startup", "data", "cloud", "cyber", "futur", "premium", "platform", "developer", "api"],
  "vapor-chrome": ["crypto", "web3", "gaming", "neon", "cyber", "futur", "edgy", "nft", "metaverse", "trading", "esports"],
  "aurora-spectrum": ["ai", "creative", "vibrant", "gradient", "modern", "app", "beauty", "music", "design", "colorful", "generative"],
  "noir-spotlight": ["luxury", "premium", "cinematic", "fashion", "elegant", "film", "story", "watch", "jewelry", "spirits", "automotive"],
  "kinetic-bold": ["sports", "energy", "fitness", "motivation", "launch", "hype", "event", "bold", "gym", "athletic", "performance", "power"],
  "bauhaus-print": ["design", "editorial", "agency", "art", "creative", "magazine", "studio", "portfolio", "typography", "architecture"],
  "biennale-yellow": ["art", "culture", "festival", "warm", "friendly", "event", "exhibition", "museum", "community", "gallery"],
  "mono-corporate": ["corporate", "finance", "b2b", "enterprise", "consulting", "professional", "legal", "bank", "insurance", "invest", "compliance"],
  "blockframe": ["product", "clean", "minimal", "professional", "hardware", "utility", "tool", "dashboard", "logistics", "manufacturing"],
  "bloom-illustrated": ["friendly", "playful", "education", "health", "wellness", "community", "nonprofit", "kids", "food", "recipe", "garden", "care", "learn"],
};

// SMART "auto" pack selection. Instead of an LLM that converges to one pack (>50% of videos
// were midnight-glass), this matches the prompt to a visual family by keyword, spreads WITHIN
// the family via a prompt hash, and EXCLUDES the recently-used packs so consecutive videos
// never share a look. Deterministic: same (text, recent) → same pack.
function selectAutoPack({ text = "", recentPacks = [] } = {}) {
  const packs = listPacks();
  if (!packs.length) return null;
  const t = String(text).toLowerCase();

  const scored = packs.map((p) => {
    const kws = PACK_VIBES[p] || [];
    return { p, score: kws.reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0) };
  });
  const max = Math.max(...scored.map((s) => s.score));
  // Candidates = the top-scoring family (plus the next tier so a family is never a 1-pack rut).
  // No keyword hit at all → the whole registry is fair game (maximum spread).
  let candidates = max > 0
    ? scored.filter((s) => s.score >= Math.max(1, max - 1)).map((s) => s.p)
    : packs.slice();

  // Never repeat a recently-shipped pack (unless that would leave nothing).
  const recent = new Set((recentPacks || []).filter(Boolean).slice(0, 3));
  const fresh = candidates.filter((p) => !recent.has(p));
  const pool = (fresh.length ? fresh : candidates).sort();

  // Deterministic pick from the pool by hashing the prompt text (FNV-1a).
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return pool[(h >>> 0) % pool.length];
}

// Load a pack's FRAME.md, mtime-cached so edits during development are
// picked up without a restart.
function getFrameMd(name) {
  if (!FRAMES_DIR || !name) return null;
  const p = frameMdPath(name);
  let st;
  try { st = fs.statSync(p); } catch { return null; }
  const hit = cache.get(name);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.frameMd;
  const frameMd = fs.readFileSync(p, "utf8");
  cache.set(name, { frameMd, mtimeMs: st.mtimeMs });
  return frameMd;
}

// One-line human "vibe" for a pack, pulled from FRAME.md frontmatter
// (description:/vibe:/tagline:/summary:). Lets the brief LLM match tone -> pack
// for EVERY installed pack, not just the few hard-coded in brief.js — so the 7
// of 10 packs with no hard-coded blurb stop being invisible to pack selection.
function getPackVibe(name) {
  const md = getFrameMd(name);
  if (!md) return null;
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = fmMatch ? fmMatch[1] : md;
  const m = fm.match(/^(?:description|vibe|tagline|summary):\s*["']?(.+?)["']?\s*$/im);
  return m ? m[1].trim().slice(0, 240) : null;
}

function getShowcasePath(name) {
  if (!FRAMES_DIR || !name) return null;
  const p = path.join(FRAMES_DIR, name, "frame-showcase.html");
  return fs.existsSync(p) ? p : null;
}

// Extract machine-usable tokens from FRAME.md's YAML frontmatter: the exact
// color hexes and font families the pack permits. Used to append a hard
// "palette law" to the composer prompt — listing concrete values survives
// long-prompt attention dilution far better than prose rules do.
function getPackTokens(name) {
  const md = getFrameMd(name);
  if (!md) return null;
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = fmMatch ? fmMatch[1] : md;

  const colors = {};
  const colorsBlock = fm.match(/^colors:\r?\n((?:[ \t]+.+\r?\n?)+)/m);
  if (colorsBlock) {
    for (const line of colorsBlock[1].split(/\r?\n/)) {
      const m = line.match(/^[ \t]+([\w-]+):\s*"(#[0-9a-fA-F]{6})"/);
      if (m) colors[m[1]] = m[2].toUpperCase();
    }
  }

  const fonts = [...new Set(
    [...fm.matchAll(/fontFamily:\s*"([^"]+)"/g)].map((m) => m[1])
  )];

  return { name, colors, fonts };
}

module.exports = { listPacks, defaultPack, resolvePack, selectAutoPack, getFrameMd, getShowcasePath, getPackTokens, getPackVibe, FRAMES_DIR };
