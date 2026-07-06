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
const assetQuality = require("./asset_quality");
const iconify = require("./iconify");
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

// Race a promise against a timeout (losing side is abandoned). Keeps one slow
// provider from stalling the concurrent gather; the timer never keeps the loop alive.
function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    if (t.unref) t.unref();
  });
  return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(t)), timeout]);
}

// Drop duplicate candidates (same image from two providers/queries) BEFORE ranking,
// so identical CDN hits don't each burn a scarce vision-budget call.
function dedupeByUrl(pool) {
  const seen = new Set();
  const out = [];
  for (const c of pool) {
    const key = String(c && c.url || "").split("#")[0].toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

// GATHER: pool top-N candidates across ALL providers for one query, so ranking can
// pick the globally-best rather than whichever provider answered first. Fast API
// providers run concurrently; the headless-Chrome scraper (pixabay_scrape, ~45s) is
// a sequential last resort only if the APIs came up short — it must never sit inside
// the Promise.all. Each candidate is tagged with its provider (name) and config order.
async function gatherCandidates(providers, { q, type, orientation, tracker }) {
  const orderOf = new Map(providers.map((p, i) => [p.name, i]));
  const isSlow = (p) => p.name === "pixabay_scrape";
  const fast = providers.filter((p) => !isSlow(p));
  const slow = providers.filter(isSlow);

  const runOne = async (provider) => {
    try {
      if (tracker) tracker.addExternal(`${provider.name}_search`);
      const cands = await withTimeout(provider.search({ query: q, type, orientation, limit: 8 }), 12_000);
      return (cands || []).map((c) => ({ ...c, __provider: provider.name, __order: orderOf.get(provider.name) }));
    } catch (e) {
      console.warn(`[assets] ${provider.name} search failed for "${q}": ${e.message}`);
      return [];
    }
  };

  let pool = dedupeByUrl((await Promise.all(fast.map(runOne))).flat());
  if (pool.length < 3) {
    for (const provider of slow) {
      pool = dedupeByUrl(pool.concat(await runOne(provider)));
      if (pool.length >= 3) break;
    }
  }
  return pool;
}

// RANK: pooled candidates, best-first, using the same lexical relevanceScore.
// Tagged candidates that overlap the query subject rank first (by score, then provider
// config order, then resolution); tagged-but-zero-overlap ones are genuinely off-topic
// and dropped; tag-less candidates (pexels video, scrape — no subject signal to judge)
// are kept as a lower tier rather than discarded, so they stay eligible.
function rankCandidates(qToks, pool) {
  const haveTags = qToks.length > 0 && pool.some((c) => c.tags);
  if (!haveTags) return pool.slice(); // nothing to rank on — keep gather order (fast providers first)
  const tagged = pool.filter((c) => c.tags);
  const tagless = pool.filter((c) => !c.tags);
  const scored = tagged
    .map((c) => ({ c, s: relevanceScore(qToks, c.tags) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.c.__order - b.c.__order) || ((b.c.width || 0) - (a.c.width || 0)))
    .map((x) => x.c);
  return [...scored, ...tagless];
}

async function acquire({ query, fallbackQueries = [], type, orientation, outputPath, tracker, kindPref, excludeIds, excludeHashes, target, visionTopic, iconColor }) {
  const queries = [query, ...fallbackQueries].filter(Boolean);
  // Vision relevance is the SLOW gate (~one model call per image). Budget it hard:
  // at most VISION_MAX candidates across ANY query variant. CRITICAL invariant: when
  // vision is enabled we NEVER accept a vision-UNCHECKED image — once the budget is
  // spent we stop and resolve toward null → the scene-kit fills the slot with a motif.
  // (Previously, budget exhaustion let the NEXT candidate through unchecked, which is
  // exactly how an off-topic cache entry — the desert "old-woman" cached under a
  // "blinking cursor" query, or a race car cached under "sleek browser" — got shipped.)
  const visionOn = !!visionTopic && config.assets?.visionRelevance !== false;
  const useVision = type === "image" && visionOn;       // images check the URL pre-download
  const useVideoVision = type === "video" && visionOn;  // videos check an extracted frame post-download
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

  // 0.5 — ICONIFY: a real matching icon for an icon/vector need, fetched as a pack-accent
  // COLOR-BAKED SVG (a symbolic match, so NO vision gate, NO perceptual hash, NO cache-register —
  // Iconify is keyless and fast to refetch, and caching a color-baked icon under a bare query
  // would poison other packs / satisfy photo queries). Runs BEFORE the cache because the cache
  // can't kind-restrict and would hand back a photo for an icon query. SVGs render via <img>
  // exactly like curated-library SVGs, so no renderer change is needed.
  const wantIcon = type === "image" && kindPref === "vector";
  if (wantIcon && config.assets?.iconify !== false) {
    const color = iconColor || "#888888"; // safety: a mid-gray reads on both light and dark packs
    const svgPath = outputPath.replace(/\.[^.]+$/, "") + ".svg";
    for (const q of queries) {
      let names = [];
      try { names = await iconify.search(q, { limit: 24 }); } catch { names = []; }
      for (const name of names.slice(0, 3)) {
        const url = iconify.svgUrl(name, { height: 512, color });
        if (!url) continue;
        try {
          await util.download(url, svgPath);
          // ffprobe can't validate an SVG — check for real SVG markup instead.
          let head = "";
          try { head = fs.readFileSync(svgPath, "utf8").slice(0, 500); } catch { /* unreadable */ }
          if (!/<svg[\s>]/i.test(head)) { try { fs.unlinkSync(svgPath); } catch { /* noop */ } continue; }
          if (tracker) tracker.addExternal("iconify_fetch");
          console.log(`[assets] "${q}" (icon) <- iconify:${name}`);
          return {
            path: svgPath, query: q, fromCache: false,
            source: "iconify", license: "Iconify (open-source icons)",
            sourceUrl: "https://icon-sets.iconify.design/",
            width: null, height: null, hasAlpha: true, // SVG: scalable, transparent
            style: "icon", phash: null,
          };
        } catch { /* try the next icon candidate */ }
      }
    }
  }

  // A vector/icon need must NEVER be satisfied by a photo. If curated + Iconify found nothing,
  // resolve to null → the scene-kit fills the slot with a pack-colored visualMotif vector, which
  // is far better than an off-topic stock photo stretched into a contained icon slot. (Skipping
  // the cache/provider loops below, which are kind-blind and would return a photo.)
  if (wantIcon) {
    console.log(`[assets] no icon for "${query}" — resolving to motif (photos are not used for icon needs)`);
    return null;
  }

  // 1 — our fetch cache (vision-gated too, so a grandfathered off-topic cache entry
  // can't sneak past the relevance check that fresh fetches get).
  for (const q of queries) {
    const hits = localDb.search({ query: q, type, orientation });
    for (const hit of hits) {
      // Perceptual near-duplicate of an asset already chosen for this film → skip (cheaper
      // than the vision call, so check it first). Legacy entries without a phash fall through.
      if (assetQuality.isNearDuplicate(hit.phash, excludeHashes)) {
        console.log(`[assets] near-duplicate skipped cached image for "${q}"`);
        continue;
      }
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

  // 2 — external providers: GATHER (all providers pooled) → RANK (best-first) → VERIFY
  // (spend the vision budget on the ranked-best). Replaces the old sequential
  // first-hit-wins loop, which let a provider's first hit beat a better cross-provider
  // match that was never fetched.
  for (const q of queries) {
    // Budget already spent on the cache → don't fire (slow) provider searches we could
    // never vet; resolve to null → motif instead.
    if (visionExhausted()) break;

    const pool = await gatherCandidates(providersFor(type), { q, type, orientation, tracker });
    if (!pool.length) continue;

    // RELEVANCE GATE — providers fuzzy-match and happily return off-topic popular stock
    // (the "blog posts → suitcase" problem). rankCandidates keeps only tagged candidates
    // that overlap the query subject (best-first) plus tag-less ones; if the tagged pool
    // is entirely off-topic it skips this query (→ eventually no asset, and the scene-kit
    // fills the scene with a visualMotif vector instead of shipping an irrelevant photo).
    const qToks = relTokens(q);
    const ranked = rankCandidates(qToks, pool);
    if (!ranked.length) {
      console.log(`[assets] pooled: all ${pool.length} candidate(s) off-topic for "${q}" — skipping (no relevant match)`);
      continue;
    }

    for (const c of ranked) {
      // VISION RELEVANCE — the model looks at the actual image (by URL, no download)
      // and rejects semantic misses the tag gate can't catch. Runs only on external
      // stock (curated/cache already passed their own relevance). Fail-open.
      if (useVision) {
        // Budget spent → don't download/accept an unvetted stock image; stop here so
        // the need resolves to a motif instead of shipping a plausible-but-wrong photo.
        if (visionExhausted()) break;
        visionUsed++;
        const fits = await imageFitsTopic({ imageUrl: c.url, topic: visionTopic, query: q, tracker, strict });
        if (!fits) { console.log(`[assets] vision-rejected ${c.__provider} image for "${q}" (off-topic for the subject)`); continue; }
      }
      try {
        await util.download(c.url, outputPath);
        // QUALITY GATE — probe validates (decodable + real dims + not a tiny error page) and
        // returns dims + alpha in one ffprobe call. Then reject thumbnails and extreme slivers
        // that object-fit:cover would gut → next ranked candidate (→ motif if all fail).
        const probe = await assetQuality.probeMedia(outputPath, type);
        if (!probe.ok) {
          try { fs.unlinkSync(outputPath); } catch { /* noop */ }
          continue;
        }
        if (!assetQuality.resolutionOk(probe, target, kindPref) || assetQuality.aspectExtreme(probe)) {
          console.log(`[assets] rejected ${c.__provider} for "${q}" (${probe.width}x${probe.height} — low-res or extreme aspect)`);
          try { fs.unlinkSync(outputPath); } catch { /* noop */ }
          continue;
        }
        // Perceptual near-duplicate of an asset already chosen for this film? (raster only —
        // ffmpeg can't dHash an SVG, and video near-dup isn't worth the extract cost for ≤1 clip.)
        let phash = null;
        if (type === "image") {
          phash = await assetQuality.perceptualHash(outputPath);
          if (assetQuality.isNearDuplicate(phash, excludeHashes)) {
            console.log(`[assets] near-duplicate skipped ${c.__provider} for "${q}"`);
            try { fs.unlinkSync(outputPath); } catch { /* noop */ }
            continue;
          }
        }
        if (type === "video") {
          // A stock VIDEO goes FULL-BLEED + moving (the highest-visibility slot), yet it
          // skipped the vision gate entirely — that's how a generic "code-processing"
          // clip landed behind an AI-platform headline. Sample a frame and vet it against
          // the subject; off-topic → drop it BEFORE the costly reencode (→ motif fallback).
          if (useVideoVision && visionUsed < VISION_MAX) {
            visionUsed++;
            const frame = outputPath + ".frame.jpg";
            let vfits = true;
            try { if (await util.extractFrame(outputPath, frame, 0.6)) vfits = await imageFitsTopic({ imagePath: frame, topic: visionTopic, query: q, tracker, strict }); } catch { /* fail-open */ }
            try { fs.unlinkSync(frame); } catch { /* noop */ }
            if (!vfits) {
              console.log(`[assets] vision-rejected ${c.__provider} VIDEO for "${q}" (off-topic for the subject)`);
              try { fs.unlinkSync(outputPath); } catch { /* noop */ }
              continue;
            }
          }
          await util.reencodeForHyperframes(outputPath);
        }
        localDb.register({
          filePath: outputPath, query: q, type, orientation,
          source: c.__provider, license: c.license, sourceUrl: c.sourceUrl,
          width: probe.width || c.width, height: probe.height || c.height, tags: c.tags,
          phash, hasAlpha: probe.hasAlpha,
        });
        console.log(`[assets] "${q}" (${type}) <- ${c.__provider}`);
        return {
          path: outputPath, query: q, fromCache: false,
          source: c.__provider, license: c.license, sourceUrl: c.sourceUrl,
          width: probe.width || c.width, height: probe.height || c.height,
          hasAlpha: probe.hasAlpha, phash,
        };
      } catch (e) {
        console.warn(`[assets] ${c.__provider} candidate failed for "${q}": ${e.message}`);
      }
    }
  }

  console.warn(`[assets] no asset found for "${query}" (${type}) after ${queries.length} query variant(s)`);
  return null;
}

module.exports = { acquire, hasProviderFor, localDb, rankCandidates, dedupeByUrl, gatherCandidates };
