// VISION RELEVANCE GATE — asks the model (Gemini Flash) whether a candidate stock
// image actually fits the video's subject. This is the SECOND-layer filter that
// catches the SEMANTIC misses the lexical/tag gate cannot: a literal flower for a
// metaphorical "bloom", a suitcase for "blog posts", a random portrait for "AI tool".
//
// Fail-OPEN: any error/timeout returns true, so a flaky vision call never blocks asset
// acquisition (worst case = the old behavior). One image is sent by REMOTE URL (no
// download needed), so rejected candidates cost nothing but the tiny vision call.

const fs = require("node:fs");
const llm = require("../llm");

// Accepts a remote imageUrl (fresh provider candidate, no download) OR a local
// imagePath (a cache hit) — whichever is given becomes the image content.
// `strict` (default true) flips the bar: STRICT rejects anything not clearly,
// directly on-subject and requires an explicit pass ("when in doubt, reject");
// lenient keeps any reasonable on-theme image ("when in doubt, keep").
async function imageFitsTopic({ imageUrl, imagePath, topic, query, tracker, strict = true }) {
  if (!topic) return true;
  let url = imageUrl;
  if (!url && imagePath) {
    try {
      const ext = /\.png$/i.test(imagePath) ? "png" : /\.webp$/i.test(imagePath) ? "webp" : "jpeg";
      url = `data:image/${ext};base64,${fs.readFileSync(imagePath).toString("base64")}`;
    } catch { return true; }
  }
  if (!url) return true;
  const prompt = strict
    ? `Video subject: "${String(topic).slice(0, 300)}".\n` +
      `This image is a candidate for a scene about "${query}".\n` +
      `REJECT it unless it clearly and directly depicts the subject. A generic, tangential, ` +
      `or metaphor-literal image (a flower for "growth", a suitcase for "blog posts", a stranger's ` +
      `portrait for an AI tool) must be REJECTED — a motif vector will be used instead, which is ` +
      `better than an off-topic photo. Only a directly on-subject image passes. When in doubt, REJECT.\n` +
      `Also REJECT if a watermark, stock-agency logo, or a URL/text overlay is stamped across the image.\n` +
      `Reply exactly: {"fit": true|false, "reason": "<=6 words"}`
    : `Video subject: "${String(topic).slice(0, 300)}".\n` +
      `This image is a candidate for a scene about "${query}".\n` +
      `Reject ONLY if the image is clearly irrelevant, absurd, or misleading for the subject ` +
      `(e.g. a suitcase for a writing app, a random portrait for a deploy tool). A reasonable, ` +
      `on-theme image — even if generic — should PASS. When in doubt, keep it.\n` +
      `But REJECT any image with a visible watermark, stock-agency logo, or URL/text overlay stamped across it.\n` +
      `Reply exactly: {"fit": true|false, "reason": "<=6 words"}`;
  try {
    const { text, tokensIn, tokensOut } = await llm.chat({
      system: "You vet stock images for professional marketing/product videos. Reply STRICT JSON only.",
      user: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url } },
      ],
      jsonMode: true,
      stage: "assetRelevance",
      temperature: 0,
    });
    if (tracker) tracker.addLlm({ inputTokens: tokensIn, outputTokens: tokensOut, stage: "assetRelevance" });
    const j = JSON.parse(text);
    // STRICT needs an explicit pass (a malformed/missing verdict → reject → motif).
    // Lenient keeps unless explicitly failed. Note: a THROWN error below still
    // fails-open (keep) — we don't punish an asset for an infra hiccup, only for
    // the model's own judgment.
    return strict ? j.fit === true : j.fit !== false;
  } catch {
    return true; // fail-open — never block acquisition on a vision hiccup
  }
}

module.exports = { imageFitsTopic };
