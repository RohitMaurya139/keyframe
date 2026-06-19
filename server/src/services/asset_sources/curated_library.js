// Curated local asset library — the user's pre-loaded packs of real photos,
// SVG vectors, and illustrations, organised by topic on disk under
// server/asset_library/<pack>/<Topic>/<Subtopic>/<file>.
//
// This is checked BEFORE the fetch cache and any external provider, so
// generations prefer these hand-picked, license-clean, offline assets and only
// hit the network when the library has no good match.
//
// Index: server/asset_library/index.json  (array of entries, built by buildIndex)
//   { id, kind, ext, pack, topics[], words[], file(abs), bytes }
// kind ∈ photo | illustration | vector   (all map to composer asset type "image")

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const config = require("../../config");

const LIB_DIR = path.resolve(config.paths.root, "asset_library");
const INDEX_FILE = path.join(LIB_DIR, "index.json");

const PHOTO_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const VECTOR_EXT = new Set([".svg"]);
// PNGs in the dedicated illustration packs are transparent illustrations, not photos.
const ILLUSTRATION_PACK = /illustrat|vector/i;

// Tokens that carry no search signal — pack artefacts, illustration-style
// suffixes (unDraw / Storyset), and generic filler.
const NOISE = new Set([
  "the", "and", "for", "with", "this", "that", "are", "from", "has", "have",
  "illustration", "illustrations", "illustrator", "vector", "vectors",
  "innovationvector", "artboard", "bro", "amico", "pana", "rafiki", "cuate",
  "twocolor", "monochromatic", "final", "copy", "untitled", "asset", "assets",
  "group", "frame", "layer", "image", "img", "photo", "file", "test", "cleanup",
  "unrelated", "keywords", "real", "collection", "assetcollection", "edit",
]);

function tokenize(s) {
  return String(s)
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase -> two words
    .toLowerCase()
    .match(/[a-z]{3,}/g) || [];
}

function classify(file, pack) {
  const ext = path.extname(file).toLowerCase();
  if (VECTOR_EXT.has(ext)) return "vector";
  if (ext === ".png" && ILLUSTRATION_PACK.test(pack)) return "illustration";
  if (PHOTO_EXT.has(ext)) return "photo";
  return null;
}

// ----------------------------------------------------------------- build

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

function buildIndex() {
  const files = [];
  walk(LIB_DIR, files);
  const idx = [];
  for (const file of files) {
    if (path.basename(file) === "index.json") continue;
    const rel = path.relative(LIB_DIR, file);
    const parts = rel.split(path.sep);
    const pack = parts[0] || "";
    const kind = classify(file, pack);
    if (!kind) continue;
    // topics = folder segments (skip the pack dir and any redundant top wrapper)
    const dirSegs = parts.slice(1, -1).filter((s) => s && !/^_/.test(s));
    const topics = [...new Set(dirSegs.map((s) => s.toLowerCase().trim()))];
    const nameTokens = tokenize(path.basename(file, path.extname(file)));
    const topicTokens = dirSegs.flatMap(tokenize);
    const words = [...new Set([...topicTokens, ...nameTokens])].filter((w) => !NOISE.has(w));
    if (!words.length) continue;
    let bytes = 0;
    try { bytes = fs.statSync(file).size; } catch { /* ignore */ }
    idx.push({
      id: crypto.createHash("sha1").update(rel).digest("hex").slice(0, 16),
      kind, ext: path.extname(file).toLowerCase().slice(1),
      pack, topics, words, file: path.resolve(file), bytes,
    });
  }
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx), "utf8");
  return { count: idx.length, byKind: idx.reduce((m, e) => ((m[e.kind] = (m[e.kind] || 0) + 1), m), {}) };
}

// ----------------------------------------------------------------- search

let _index = null;
function load() {
  if (_index) return _index;
  try {
    _index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
    if (!Array.isArray(_index)) _index = [];
  } catch { _index = []; }
  return _index;
}

const KIND_PREF = { photo: 3, illustration: 2, vector: 1 };

// Search the library. `type` is the composer asset type ("image" | "video").
// The library holds only stills, so video requests return nothing (caller
// falls through to providers). `kindPref` biases photo vs illustration/vector.
// `excludeIds` (Set | array of ids) skips entries already used in this video
// so a single film never reuses the same library file twice.
//
// Relevance gate: a candidate must show a STRONG topical overlap — either it
// hit a topic segment, or (for multi-word queries) it matched at least half
// the query terms. Weak/incidental matches are rejected so acquire() can fall
// through to the web providers rather than forcing a poor local pick.
function search({ query, type = "image", limit = 8, kindPref, excludeIds } = {}) {
  if (type === "video") return [];
  const idx = load();
  if (!idx.length) return [];
  const want = [...new Set(tokenize(query))].filter((w) => !NOISE.has(w));
  if (!want.length) return [];

  const skip = excludeIds instanceof Set
    ? excludeIds
    : (Array.isArray(excludeIds) ? new Set(excludeIds) : null);

  // A vector/icon request is a HARD constraint, not a soft bias: a photo is
  // never an acceptable substitute for an inline-icon role. (photo/illustration
  // prefs stay soft — they fall through the relevance gate to the best match of
  // any kind.) Without this, a strong photo match always outscores a weak vector
  // and explicit vector requests silently return photos — so curated SVGs never
  // materialize. If no vector matches, return [] and let the caller fall through.
  const restrictKind = kindPref === "vector" ? "vector" : null;

  const multi = want.length > 1;
  const scored = [];
  for (const e of idx) {
    if (skip && skip.has(e.id)) continue;
    if (restrictKind && e.kind !== restrictKind) continue;
    let overlap = 0, topicHit = 0;
    for (const w of want) {
      if (e.words.includes(w)) overlap++;
      if (e.topics.some((t) => t.includes(w))) topicHit++;
    }
    if (!overlap) continue;
    const ratio = overlap / want.length;
    // Strong-overlap requirement: keep only entries that either land on a
    // topic segment, or (multi-word query) cover at least half the terms.
    // Single-word queries must hit a topic to count as relevant.
    const strong = topicHit > 0 || (multi ? ratio >= 0.5 : false);
    if (!strong) continue;
    const kindBias = (kindPref && e.kind === kindPref ? 8 : 0) + (KIND_PREF[e.kind] || 0);
    const score = overlap * 10 + topicHit * 6 + ratio * 4 + kindBias;
    scored.push({ score, entry: e });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, limit)).map((s) => s.entry);
}

// Copy a library asset to outputPath, preserving the right extension so the
// composer's <img src> matches. Returns provider-style metadata.
function materialize(entry, outputPath) {
  // Keep the library file's real extension (svg/png/jpg) on the output.
  const wantExt = "." + entry.ext;
  let out = outputPath;
  if (path.extname(outputPath).toLowerCase() !== wantExt) {
    out = outputPath.replace(/\.[^.]+$/, "") + wantExt;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(entry.file, out);
  console.log(`[asset_lib] HIT "${entry.topics.join("/")}" (${entry.kind}, ${entry.pack}) -> ${path.basename(out)}`);
  return {
    path: out,
    source: `library:${entry.pack}`,
    license: "curated-library",
    sourceUrl: null,
    kind: entry.kind,
    width: null, height: null,
  };
}

function stats() {
  const idx = load();
  return { count: idx.length, byKind: idx.reduce((m, e) => ((m[e.kind] = (m[e.kind] || 0) + 1), m), {}) };
}

module.exports = { buildIndex, search, materialize, stats, LIB_DIR, INDEX_FILE };
