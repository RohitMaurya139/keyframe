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
async function acquire({ query, fallbackQueries = [], type, orientation, outputPath, tracker, kindPref, excludeIds }) {
  const queries = [query, ...fallbackQueries].filter(Boolean);

  // 0 — the curated local library (user's pre-loaded packs), stills only.
  // Highest priority: hand-picked, license-clean, offline. The file keeps its
  // real extension (svg/png/jpg), so we return the actual written path.
  if (type === "image") {
    for (const q of queries) {
      const hits = curated.search({ query: q, type, limit: 8, kindPref, excludeIds });
      if (hits.length) {
        const meta = curated.materialize(hits[0], outputPath);
        if (tracker) tracker.addExternal("asset_library_hit");
        return { path: meta.path, query: q, fromCache: true, libraryId: hits[0].id, ...meta };
      }
    }
  }

  // 1 — our fetch cache.
  for (const q of queries) {
    const hits = localDb.search({ query: q, type, orientation });
    if (hits.length) {
      const meta = localDb.materialize(hits[0], outputPath);
      if (tracker) tracker.addExternal("asset_cache_hit");
      return { path: outputPath, query: q, fromCache: true, ...meta };
    }
  }

  // 2 — external providers.
  for (const q of queries) {
    for (const provider of providersFor(type)) {
      let candidates = [];
      try {
        if (tracker) tracker.addExternal(`${provider.name}_search`);
        candidates = await provider.search({ query: q, type, orientation, limit: 5 });
      } catch (e) {
        console.warn(`[assets] ${provider.name} search failed for "${q}": ${e.message}`);
        continue;
      }

      for (const c of candidates.slice(0, 3)) {
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
            width: c.width, height: c.height,
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
