// The local asset database — checked FIRST before any external provider.
// Every asset successfully downloaded from an external source is registered
// here, so over time the studio serves more and more assets from disk with
// zero network calls (and zero rate-limit/Cloudflare exposure).
//
// Layout: <root>/asset_cache/index.json + asset_cache/files/<id>.<ext>
// Index entry: { id, query, words[], type, orientation, source, license,
//                sourceUrl, width, height, file, bytes, addedAt, hits }

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const config = require("../../config");

const CACHE_DIR = path.resolve(config.paths.root, "asset_cache");
const FILES_DIR = path.join(CACHE_DIR, "files");
const INDEX_FILE = path.join(CACHE_DIR, "index.json");

let index = null;

function load() {
  if (index) return index;
  try {
    index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
    if (!Array.isArray(index)) index = [];
  } catch {
    index = [];
  }
  return index;
}

let writeTimer = null;
function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      const tmp = INDEX_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(index), "utf8");
      fs.renameSync(tmp, INDEX_FILE);
    } catch (e) {
      console.warn(`[asset_db] persist failed: ${e.message}`);
    }
  }, 200);
  writeTimer.unref?.();
}

function tokenize(q) {
  return [...new Set(String(q).toLowerCase().match(/[a-z0-9]{3,}/g) || [])];
}

// Score = word overlap between the search query and the stored query/words.
// Requires ≥60% of the search words to match so "red sports car" doesn't
// return a cached "red apple".
function search({ query, type, orientation, limit = 3 }) {
  const idx = load();
  const want = tokenize(query);
  if (!want.length) return [];

  const scored = [];
  for (const e of idx) {
    if (type && e.type !== type) continue;
    if (orientation && e.orientation && e.orientation !== orientation && e.orientation !== "all") continue;
    if (!fs.existsSync(e.file)) continue;
    const overlap = want.filter((w) => e.words.includes(w)).length;
    if (overlap / want.length >= 0.6) scored.push({ score: overlap / want.length, entry: e });
  }
  scored.sort((a, b) => b.score - a.score || b.entry.hits - a.entry.hits);
  return scored.slice(0, limit).map((s) => s.entry);
}

// Copy a cached asset to the requested output path. Returns metadata.
function materialize(entry, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(entry.file, outputPath);
  entry.hits = (entry.hits || 0) + 1;
  persist();
  console.log(`[asset_db] cache HIT "${entry.query}" (${entry.type}, ${entry.source}) -> ${path.basename(outputPath)}`);
  return { license: entry.license, sourceUrl: entry.sourceUrl, source: `cache:${entry.source}`, width: entry.width, height: entry.height };
}

// Register a freshly downloaded asset: copy into the cache and index it.
function register({ filePath, query, type, orientation, source, license, sourceUrl, width, height }) {
  try {
    const idx = load();
    fs.mkdirSync(FILES_DIR, { recursive: true });
    const id = crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex").slice(0, 16);
    if (idx.some((e) => e.id === id)) return; // identical bytes already cached
    const ext = path.extname(filePath) || (type === "video" ? ".mp4" : ".jpg");
    const dest = path.join(FILES_DIR, `${id}${ext}`);
    fs.copyFileSync(filePath, dest);
    idx.push({
      id, query, words: tokenize(query), type, orientation: orientation || "all",
      source, license: license || "unknown", sourceUrl: sourceUrl || null,
      width: width || null, height: height || null,
      file: dest, bytes: fs.statSync(dest).size, addedAt: Date.now(), hits: 0,
    });
    persist();
    console.log(`[asset_db] cached "${query}" (${type}, ${source}, ${id})`);
  } catch (e) {
    console.warn(`[asset_db] register failed: ${e.message}`);
  }
}

function stats() {
  const idx = load();
  return { count: idx.length, bytes: idx.reduce((s, e) => s + (e.bytes || 0), 0) };
}

module.exports = { search, materialize, register, stats, CACHE_DIR };
