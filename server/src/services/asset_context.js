// Asset grounding context — the small, shared functions that keep stock-asset
// search ON-SUBJECT. Both asset paths use these so they can't drift:
//   - the multi-agent graph (agents/graph.js, assetSearchAgent)
//   - the script-checkpoint pipeline (services/project_pipeline.js, acquireScriptAssets)
//
// Without grounding, an abstract scene direction ("scalable growth") fetched wildly
// off-topic stock (trading charts, a car logo) because the query never carried what
// the VIDEO is actually about. topicAnchor pins the SUBJECT into the query;
// buildVisionTopic feeds the same subject to the vision relevance gate.

// Stopwords for the topical anchor — drop the brand name and generic filler so
// the anchor is the SUBJECT (beauty, cosmetics), not "bulkdoor"/"marketplace".
const ANCHOR_STOP = new Set([
  "the", "and", "for", "with", "your", "our", "that", "this", "from", "into",
  "india", "indias", "best", "top", "leading", "number", "online", "platform",
  "marketplace", "website", "company", "brand", "brands", "business", "solution",
  "solutions", "service", "services", "app", "get", "now", "more", "all", "new",
  "buy", "shop", "store", "official", "home", "page", "welcome", "trusted",
]);

// 1-2 SUBJECT words distilled from the brief/site, used to keep derived stock
// queries on-topic. Without this, abstract scene directions ("scalable growth")
// fetched wildly off-topic stock (trading charts, a car logo) because the query
// never carried what the video is actually about.
function topicAnchor(job, brief) {
  const src = `${(brief?.keyMessages || []).join(" ")} ${brief?.audience || ""} ${brief?.goal || ""}`.toLowerCase();
  const freq = {};
  for (const w of src.match(/[a-z]{4,}/g) || []) {
    if (!ANCHOR_STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]).join(" ");
}

// A concise subject sentence for the VISION relevance gate (what the video is
// about). This is the WHOLE-VIDEO subject — imageFitsTopic already receives the
// per-scene subject separately as `query`, so this stays the cross-scene
// consistency guardrail, never per-scene.
function buildVisionTopic(brief, job) {
  return [brief?.improvedPrompt, job?.website_title, (brief?.keyMessages || []).slice(0, 2).join("; ")]
    .filter(Boolean).join(" — ").slice(0, 300) || job?.prompt || "";
}

// Map a scene's asset role to the kind of curated asset that fits it:
// full-bleed backgrounds want real photos; insets/icons/textures want
// vectors or illustrations. Threaded into acquire() -> curated.search.
function kindPrefFor(role) {
  const r = String(role || "").toLowerCase();
  if (r === "background" || r === "fullscreen") return "photo";
  if (r === "icon" || r === "texture") return "vector";
  if (r === "inset") return "illustration";
  return undefined;
}

module.exports = { ANCHOR_STOP, topicAnchor, buildVisionTopic, kindPrefFor };
