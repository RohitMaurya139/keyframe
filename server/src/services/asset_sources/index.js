// Asset acquisition orchestrator.
//
// Order of attack for every request (the user's DB-first rule):
//   1. LOCAL DATABASE — previously fetched assets, keyword-matched
//   2. External providers in configured order, primary query then fallbacks
//   3. null (caller degrades gracefully)
//
// Every successful external download is validated (ffprobe) and registered
// into the local database so the next project hits the cache instead.

const fs = require("node:fs");
const config = require("../../config");
const localDb = require("./local_db");
const curated = require("./curated_library");
const util = require("./util");
const { imageFitsTopic } = require("./vision_filter");

const PROVIDERS = {
  pixabay: require("./pixabay_api"),
  openverse: require("./openverse"),
  pexels: require("./pexels"),
  pixabay_scrape: require("./pixabay_scrape"),
};

const DEFAULT_ORDER = ["pixabay", "openverse", "pexels", "pixabay_scrape"];

function providersFor(type) {
  const order = config.assetProviders?.order || DEFAULT_ORDER;
  return order
    .map((n) => PROVIDERS[n])
    .filter((p) => p && p.types.includes(type) && (p.available ? p.available() : true));
}

// Can ANY configured provider serve this asset type right now? (Callers use
// this to downgrade, e.g. a video need to a still image when no video
// provider has a key.)
function hasProviderFor(type) {
  return providersFor(type).length > 0;
}

// Acquire one asset. Returns { path, query, source, license, sourceUrl,
// width, height, fromCache, libraryId } or null.
//
// `kindPref` ("photo" | "illustration" | "vector") biases the curated library
// toward the right asset shape for the need's role. `excludeIds` (Set) skips
// curated entries already used in this video so a film never reuses a file.
// Generic words that carry no SUBJECT signal — excluded from relevance scoring so
// "modern business background" doesn't match every stock photo's boilerplate tags.
const REL_STOP = new Set([
  "the", "and", "for", "with", "from", "background", "backgrounds", "scene", "image",
  "photo", "modern", "abstract", "concept", "business", "technology", "digital", "design",
  "style", "view", "shot", "closeup", "close", "high", "quality", "professional", "premium",
  "beautiful", "creative", "color", "colorful", "light", "dark", "white", "black", "vector",
  "illustration", "icon", "texture", "pattern", "people", "person", "man", "woman",
]);
function relTokens(s) {
  return [...new Set((String(s || "").toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !REL_STOP.has(w)))];
}
// Overlap score between a query's subject words and a candidate's provider tags.
// Exact + 4-char-prefix match (so "writing"≈"writer", "deploy"≈"deployment").
function relevanceScore(qToks, tagStr) {
  const tags = relTokens(tagStr);
  if (!tags.length) return 0;
  let score = 0;
  for (const q of qToks) {
    for (const t of tags) {
      if (t === q || (q.length >= 4 && (t.startsWith(q.slice(0, 4)) || q.startsWith(t.slice(0, 4))))) { score++; break; }
    }
  }
  return score;
}

async function acquire({ query, fallbackQueries = [], type, orientation, outputPath, tracker, kindPref, excludeIds, visionTopic }) {
  const queries = [query, ...fallbackQueries].filter(Boolean);
  // Vision relevance is the SLOW gate (~one model call per image). Budget it hard:
  // at most VISION_MAX candidates across ANY query variant. CRITICAL invariant: when
  // vision is enabled we NEVER accept a vision-UNCHECKED image — once the budget is
  // spent we stop and resolve toward null → the scene-kit fills the slot with a motif.
  // (Previously, budget exhaustion let the NEXT candidate through unchecked, which is
  // exactly how an off-topic cache entry — the desert "old-woman" cached under a
  // "blinking cursor" query, or a race car cached under "sleek browser" — got shipped.)
  const useVision = type === "image" && visionTopic && config.assets?.visionRelevance !== false;
  const strict = config.assets?.relevanceStrict !== false; // STRICT (default): reject anything not clearly on-subject.
  const VISION_MAX = 3;
  let visionUsed = 0;
  const shouldVision = () => useVision && visionUsed < VISION_MAX;
  // True only when vision is on AND its budget is spent — the signal to STOP (not to
  // accept the current candidate unchecked).
  const visionExhausted = () => useVision && visionUsed >= VISION_MAX;

  // 0 — the curated local library (user's pre-loaded packs), stills only.
  // Highest priority: hand-picked, license-clean, offline. The file keeps its
  // real extension (svg/png/jpg), so we return the actual written path.
  if (type === "image") {
    for (const q of queries) {
      const hits = curated.search({ query: q, type, limit: 8, kindPref, excludeIds });
      if (hits.length) {
        // Variety: sample among the top relevant matches instead of always
        // returning hits[0]. Always picking the single best hit is the #1 reason
        // "every video uses the same images" — the same query (e.g. "shopping",
        // "headphones") deterministically resolved to the identical file across
        // every generation. Sampling the strongest few keeps relevance while
        // giving each video (and each regenerate) a fresh look. excludeIds (passed
        // through to search) still prevents reusing a file already used this video.
        const pool = hits.slice(0, Math.min(hits.length, 4));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const meta = curated.materialize(pick, outputPath);
        if (tracker) tracker.addExternal("asset_library_hit");
        return { path: meta.path, query: q, fromCache: true, libraryId: pick.id, ...meta };
      }
    }
  }

  // 1 — our fetch cache (vision-gated too, so a grandfathered off-topic cache entry
  // can't sneak past the relevance check that fresh fetches get).
  for (const q of queries) {
    const hits = localDb.search({ query: q, type, orientation });
    for (const hit of hits) {
      if (useVision) {
        // Budget spent → STOP using the (poisoned-prone) cache rather than accept an
        // unvetted hit; fall through to providers and ultimately a motif.
        if (visionExhausted()) break;
        visionUsed++;
        const fits = await imageFitsTopic({ imagePath: hit.file, topic: visionTopic, query: q, tracker, strict });
        if (!fits) { console.log(`[assets] vision-rejected cached image for "${q}" (off-topic for the subject)`); continue; }
      }
      const meta = localDb.materialize(hit, outputPath);
      if (tracker) tracker.addExternal("asset_cache_hit");
      return { path: outputPath, query: q, fromCache: true, ...meta };
    }
    if (visionExhausted()) break;
  }

  // 2 — external providers.
  for (const q of queries) {
    // Budget already spent on the cache → don't fire (slow) provider searches we could
    // never vet; resolve to null → motif instead.
    if (visionExhausted()) break;
    for (const provider of providersFor(type)) {
      let candidates = [];
      try {
        if (tracker) tracker.addExternal(`${provider.name}_search`);
        candidates = await provider.search({ query: q, type, orientation, limit: 8 });
      } catch (e) {
        console.warn(`[assets] ${provider.name} search failed for "${q}": ${e.message}`);
        continue;
      }

      // RELEVANCE GATE — providers fuzzy-match and happily return off-topic popular
      // stock (the "blog posts → suitcase" problem). When candidates carry subject
      // tags, keep only those that actually overlap the query and rank by overlap;
      // if NONE match, skip this query (→ eventually no asset, and the scene-kit fills
      // the scene with a visualMotif vector instead of shipping an irrelevant photo).
      const qToks = relTokens(q);
      const haveTags = qToks.length > 0 && candidates.some((c) => c.tags);
      let usable = candidates;
      if (haveTags) {
        usable = candidates
          .map((c) => ({ c, s: relevanceScore(qToks, c.tags) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .map((x) => x.c);
        if (!usable.length) {
          console.log(`[assets] ${provider.name}: all ${candidates.length} result(s) off-topic for "${q}" — skipping (no relevant match)`);
          continue;
        }
      }

      for (const c of usable.slice(0, 3)) {
        // VISION RELEVANCE — the model looks at the actual image (by URL, no download)
        // and rejects semantic misses the tag gate can't catch. Runs only on external
        // stock (curated/cache already passed their own relevance). Fail-open.
        if (useVision) {
          // Budget spent → don't download/accept an unvetted stock image; stop here so
          // the need resolves to a motif instead of shipping a plausible-but-wrong photo.
          if (visionExhausted()) break;
          visionUsed++;
          const fits = await imageFitsTopic({ imageUrl: c.url, topic: visionTopic, query: q, tracker, strict });
          if (!fits) { console.log(`[assets] vision-rejected ${provider.name} image for "${q}" (off-topic for the subject)`); continue; }
        }
        try {
          await util.download(c.url, outputPath);
          const ok = await util.validateMedia(outputPath, type);
          if (!ok) {
            try { fs.unlinkSync(outputPath); } catch { /* noop */ }
            continue;
          }
          if (type === "video") await util.reencodeForHyperframes(outputPath);
          localDb.register({
            filePath: outputPath, query: q, type, orientation,
            source: provider.name, license: c.license, sourceUrl: c.sourceUrl,
            width: c.width, height: c.height, tags: c.tags,
          });
          console.log(`[assets] "${q}" (${type}) <- ${provider.name}`);
          return {
            path: outputPath, query: q, fromCache: false,
            source: provider.name, license: c.license, sourceUrl: c.sourceUrl,
            width: c.width, height: c.height,
          };
        } catch (e) {
          console.warn(`[assets] ${provider.name} candidate failed for "${q}": ${e.message}`);
        }
      }
    }
  }

  console.warn(`[assets] no asset found for "${query}" (${type}) after ${queries.length} query variant(s)`);
  return null;
}

module.exports = { acquire, hasProviderFor, localDb };
