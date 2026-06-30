// VISION RELEVANCE GATE — asks the model (Gemini Flash) whether a candidate stock
// image actually fits the video's subject. This is the SECOND-layer filter that
// catches the SEMANTIC misses the lexical/tag gate cannot: a literal flower for a
// metaphorical "bloom", a suitcase for "blog posts", a random portrait for "AI tool".
//
// Fail-OPEN: any error/timeout returns true, so a flaky vision call never blocks asset
// acquisition (worst case = the old behavior). One image is sent by REMOTE URL (no
// download needed), so rejected candidates cost nothing but the tiny vision call.

const fs = require("node:fs");
const openrouter = require("../openrouter");

// Accepts a remote imageUrl (fresh provider candidate, no download) OR a local
// imagePath (a cache hit) — whichever is given becomes the image content.
async function imageFitsTopic({ imageUrl, imagePath, topic, query, tracker }) {
  if (!topic) return true;
  let url = imageUrl;
  if (!url && imagePath) {
    try {
      const ext = /\.png$/i.test(imagePath) ? "png" : /\.webp$/i.test(imagePath) ? "webp" : "jpeg";
      url = `data:image/${ext};base64,${fs.readFileSync(imagePath).toString("base64")}`;
    } catch { return true; }
  }
  if (!url) return true;
  try {
    const { text, tokensIn, tokensOut } = await openrouter.chat({
      system: "You vet stock images for professional marketing/product videos. Reply STRICT JSON only.",
      user: [
        {
          type: "text",
          text:
            `Video subject: "${String(topic).slice(0, 300)}".\n` +
            `This image is a candidate for a scene about "${query}".\n` +
            `Reject ONLY if the image is clearly irrelevant, absurd, or misleading for the subject ` +
            `(e.g. a suitcase for a writing app, a random portrait for a deploy tool). A reasonable, ` +
            `on-theme image — even if generic — should PASS. When in doubt, keep it.\n` +
            `Reply exactly: {"fit": true|false, "reason": "<=6 words"}`,
        },
        { type: "image_url", image_url: { url } },
      ],
      jsonMode: true,
      stage: "assetRelevance",
      temperature: 0,
    });
    if (tracker) tracker.addLlm({ inputTokens: tokensIn, outputTokens: tokensOut, stage: "assetRelevance" });
    const j = JSON.parse(text);
    return j.fit !== false; // default to keep if the field is missing
  } catch {
    return true; // fail-open — never block acquisition on a vision hiccup
  }
}

module.exports = { imageFitsTopic };
