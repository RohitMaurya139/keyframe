// LLM pass 1: site brief + user requirements -> detailed cinematic video script.
// The script is the contract for everything downstream: narration, audio plan,
// stock-asset queries, and per-scene motion-graphics direction.

const config = require("../config");
const llm = require("../llm");

const SYSTEM = `You are an award-winning commercial video director and motion designer.
You write production-ready scripts for short promotional videos about websites/brands.

You will receive a structured brief extracted from a real website plus optional user
requirements. Produce a DETAILED video script as STRICT JSON (no markdown, no prose
outside the JSON) with this exact shape:

{
  "meta": {
    "title": string,                  // punchy video title
    "brand": string,                  // brand/site name
    "tagline": string,
    "durationSec": number,            // total video length, 30-90
    "tone": string,                   // e.g. "premium, kinetic, confident"
    "palette": { "background": string, "ink": string, "accent": string, "accent2": string }, // hex colors derived from the brand
    "typography": { "display": string, "body": string }  // Google Fonts names that fit the brand (NEVER Inter/Roboto/Arial)
  },
  "audio": {
    "voice": { "style": string, "gender": string, "pace": string },
    "music": { "mood": string, "genre": string, "searchQuery": string },   // query for a stock-music site like Pixabay
    "sfx": [ { "moment": string, "description": string, "searchQuery": string } ]
  },
  "scenes": [                         // 5 to 9 scenes
    {
      "id": "scene-1",
      "name": string,                 // e.g. "Cold Open", "Problem", "Reveal", "Features", "Social Proof", "CTA"
      "durationSec": number,
      "narration": string,            // exact voiceover line(s) for this scene
      "onScreenText": [string],       // big kinetic-typography lines shown on screen
      "visual": string,               // rich description of what we see
      "motionGraphics": string,       // SPECIFIC animation direction: camera moves, transitions, easing, particles, masks, counters, parallax...
      "assets": [ { "kind": "image"|"video", "searchQuery": string, "purpose": string } ],  // stock searches (Pixabay-style, 2-4 keywords)
      "transitionOut": string         // how this scene hands off to the next
    }
  ]
}

Rules:
- Narration must read aloud naturally and fit the scene duration (~2.4 words/sec).
- Ground EVERYTHING in the brief: real headings, real features, real value props. Never invent facts.
- Motion direction must be concrete and executable in CSS/JS (GSAP-level vocabulary), not vague.
- Palette must harmonize with the site's brand colors from the brief when available.
- Output ONLY the JSON object.`;

async function write(brief, requirements) {
  const user = [
    "WEBSITE BRIEF (extracted automatically):",
    JSON.stringify(brief, null, 2),
    "",
    "USER REQUIREMENTS:",
    requirements?.trim() || "(none provided — use your best judgment for a premium promo video)",
  ].join("\n");

  const raw = await llm.complete({
    system: SYSTEM,
    user,
    maxTokens: config.llm.scriptMaxTokens,
  });
  const script = llm.extractJson(raw);

  // Light validation + normalization so the composer can trust the shape.
  if (!script.meta || !Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error("scriptwriter returned malformed script (missing meta/scenes)");
  }
  script.meta.brand ||= brief.siteName || brief.domain;
  script.meta.title ||= `The ${script.meta.brand} Story`;
  script.meta.palette ||= { background: "#0d0d10", ink: "#f4f1ea", accent: "#ffb000", accent2: "#3a7bff" };
  script.scenes.forEach((s, i) => {
    s.id ||= `scene-${i + 1}`;
    s.onScreenText ||= [];
    s.assets ||= [];
  });
  return script;
}

module.exports = { write };
