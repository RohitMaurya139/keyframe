// The KEYFRAME agent graph — LangGraph orchestration of the 12 agents.
//
//   INTAKE GRAPH      brief → script  (pauses at script_review via the API)
//
//   PRODUCTION GRAPH                  ┌─ storyboard ── scene_planner ─┐
//     frame_selector ── fan-out ──────┼─ asset_planner ─ asset_search ┼── composition ── animation ─┐
//                                     └─ voice ───────────────────────┘                             │
//                                                  ┌──────────────────────────────────── timeline ──┘
//                                                  └→ qa ──(blockers & repairs left)→ composition (one repair lap)
//                                                       └──(pass / out of repairs)──→ END
//
// Every node is a thin agent wrapping the battle-tested service functions —
// the graph owns ordering, joins, and the QA repair loop; the services own
// the work. JSON state flows between nodes; HyperFrames renders the MP4.

const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");
const db = require("../db");
const { UsageTracker } = require("../services/usage");
const { generateBrief } = require("../services/brief");
const { generateScript, normalizeScript } = require("../services/script");
const { generateStoryboard } = require("../services/storyboard");
const frameRegistry = require("../services/frame_registry");
const { withBudget, attemptLlmComposition, mixAudioIntoVideo, fallbackQueriesFor } = require("../services/pipeline");
const { acquire, hasProviderFor } = require("../services/asset_sources");
const { synthesizeFitted } = require("../services/vo_fit");
const { buildCues, writeSrt } = require("../services/captions");
const { fetchMusic } = require("../services/audio_sources");
const { dominantColors } = require("../services/ingest/website");
const { getSfx } = require("../services/sfx_library");
const { VALID_VOICES } = require("../services/audio_planner");
const { buildFallback } = require("../services/fallback");
const { normalizeComposition } = require("../services/normalize");
const { render } = require("../services/renderer");
const { renderThree, isThreeRenderable } = require("../services/three_render");
const { reviewRender } = require("./qa_agent");

function ms() { return Date.now(); }
function jobDirFor(jobId) { return path.join(config.paths.jobsDir, jobId); }

// ---------------------------------------------------------------- helpers
function storyboardPromptFromScript(script, brief) {
  const lines = [
    `Produce this exact video: "${script.title}".`,
    brief ? `Context: ${brief.improvedPrompt}` : "",
    "",
    "Scene-by-scene plan (FOLLOW these timings and contents exactly — same number of scenes, same start/duration):",
  ];
  for (const s of script.scenes) {
    lines.push(
      `- Scene ${s.id} [${s.start}s + ${s.duration}s] (${s.purpose}): ${s.visualDirection} ` +
      (s.onScreenText.length ? `On-screen text: ${s.onScreenText.map((t) => `"${t}"`).join(", ")}. ` : "") +
      (s.voiceover ? `Narration meanwhile: "${s.voiceover}"` : "No narration.")
    );
  }
  return lines.join("\n");
}

// The voices the gpt-audio TTS family actually renders (tts.js AUDIO_VOICES).
// pickVoice MUST resolve to one of these — an unknown name is silently
// downgraded to marin by tts.mapVoice().
const AUDIO_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]);

function pickVoice(job, script) {
  // 1) An explicit, exact voice name wins.
  const explicit = String(job.voice_style || "").trim().toLowerCase();
  if (AUDIO_VOICES.has(explicit)) return explicit;

  // 2) Map gender/tone cues from the script's voice style to a real voice
  //    (the old code substring-matched the wrong tts-1 set and always fell to
  //    marin — no gender fit, no variety).
  const want = `${job.voice_style || ""} ${script?.voice?.style || ""} ${script?.voice?.pace || ""}`.toLowerCase();
  const has = (...ks) => ks.some((k) => want.includes(k));
  // Gender cues MUST match on word boundaries — substring includes("man")/
  // includes("he ") fired inside "human"/"performance"/"the ", forcing neutral
  // and female-leaning brands onto a male voice before the tone branches ran.
  const FEM  = /\b(female|woman|feminine|she|her|hers)\b/.test(want);
  const MASC = /\b(male|man|masculine|he|him|his)\b/.test(want);
  if (FEM)  return has("warm", "soft", "calm", "gentle") ? "sage" : "coral";
  if (MASC) return has("deep", "authoritative", "bold", "gravitas") ? "cedar" : "ash";
  if (has("energetic", "upbeat", "excited", "punchy", "hype", "playful")) return "ballad";
  if (has("warm", "calm", "soothing", "gentle", "reassuring")) return "sage";
  if (has("elegant", "sophisticated", "premium", "refined", "luxury")) return "verse";
  if (has("bright", "friendly", "cheerful", "approachable")) return "shimmer";
  return "marin"; // a natural, neutral default
}

// ---------------------------------------------------------------- agents
// Each node receives the mutable graph state object and returns a partial
// state update. `s` carries: job, jobDir, tracker, script, brief, and the
// artifacts each agent adds.

async function frameSelectorAgent(s) {
  // A user's EXPLICIT pack choice always wins (strict-template promise). Only when they
  // left it on "auto" (job.frame_pack is null) do we choose — and we do NOT trust the LLM's
  // suggestedFramePack, which converged to midnight-glass on >50% of videos. Instead
  // selectAutoPack matches the prompt to a visual family, spreads within it by prompt hash,
  // and excludes the last few shipped packs so consecutive videos never share a look.
  const userPack = frameRegistry.resolvePack(s.job.frame_pack);
  let framePack = userPack;
  if (!framePack) {
    let recentPacks = [];
    try { recentPacks = (db.listRecent({ limit: 8 }) || []).map((j) => j.framePack).filter(Boolean); } catch { /* best effort */ }
    const text = [
      s.job.prompt, s.brief?.improvedPrompt, s.brief?.tone,
      (s.brief?.keyMessages || []).join(" "), s.brief?.audience, s.job.intent?.websiteUrl,
    ].filter(Boolean).join(" ");
    framePack = frameRegistry.selectAutoPack({ text, recentPacks })
      || frameRegistry.resolvePack(s.brief?.suggestedFramePack)
      || frameRegistry.resolvePack("auto");
    console.log(`[agents] frame_selector → ${framePack} (smart-auto; recent: ${recentPacks.slice(0, 3).join(",") || "none"})`);
  } else {
    console.log(`[agents] frame_selector → ${framePack} (user choice)`);
  }
  return { framePack };
}

async function storyboardAgent(s) {
  db.setProgress(s.job.id, "storyboard");
  const sbPrompt = storyboardPromptFromScript(s.script, s.brief);
  const r = await generateStoryboard({ prompt: sbPrompt, duration: s.job.duration, orientation: s.job.orientation });
  s.tracker.addLlm({ inputTokens: r.tokensIn, outputTokens: r.tokensOut, stage: "storyboard" });
  return { storyboard: r.storyboard };
}

// Scene Planner — guarantees every storyboard scene has executable beats.
// Deterministic: derives default beats from the script when the model
// omitted them (entrance at 0.1, content at 30%, exit 0.6s before handoff).
async function scenePlannerAgent(s) {
  const sb = s.storyboard;
  let derived = 0;
  for (const scene of sb.scenes || []) {
    if (!Array.isArray(scene.beats) || !scene.beats.length) {
      scene.beats = [
        { at: 0.1, action: "scene content enters", easing: "expo.out" },
        { at: Math.round(scene.duration * 0.3 * 100) / 100, action: "supporting content lands", easing: "power2.out" },
        { at: Math.max(0.2, scene.duration - 0.6), action: "exit begins / hand-off", easing: "power2.in" },
      ];
      derived++;
    }
  }
  if (derived) console.log(`[agents] scene_planner derived beats for ${derived} scene(s)`);
  return { storyboard: sb };
}

// Asset Planner — turns the approved script's needs into a concrete
// want-list (screenshots pinned first, stock wants after, caps applied).
async function assetPlannerAgent(s) {
  const { job, script } = s;
  const videoOk = hasProviderFor("video");
  // STRICT relevance (default): abstract/metaphorical scenes derive NO photo query
  // and fall back to a motif, instead of fetching unmatchable stock. See deriveQuery.
  const strictAssets = config.assets?.relevanceStrict !== false;
  const ex = (p) => { try { return fs.existsSync(p); } catch { return false; } };
  const shots = (job.website_screenshots || []).filter(ex);
  const realImgs = (job.website_images || []).filter(ex);
  // REAL brand assets (the site's own screenshots + scraped content images) are pinned
  // to the substance scenes BEFORE any generic stock is fetched — a real product shot
  // always beats a random Pixabay photo. Use ALL captured screenshots (was capped at 3
  // showcase scenes, which wasted the rest while stock filled the gaps).
  const substance = script.scenes.slice(1, -1);
  const showcase = substance.filter((x) => ["feature", "proof", "how", "context"].includes(x.purpose));
  const shotTargets = (showcase.length ? showcase : substance);
  const screenshotPlan = shots.slice(0, shotTargets.length).map((src, i) => ({ kind: "screenshot", src, scene: shotTargets[i], index: i }));
  const pinnedSceneIds = new Set(screenshotPlan.map((p) => p.scene.id));
  // Scraped page images go into the general photo POOL (the kit weaves them into
  // montage / b-roll / split), NOT bound to one scene — so they're used even when
  // screenshots already took the substance scenes, and they DISPLACE generic stock
  // instead of sitting unused.
  const imagePlan = realImgs.slice(0, 6).map((src, i) => ({ src, index: i }));

  // Derive a concrete image query from a scene's visualDirection when the
  // script asked for nothing — substance scenes should never go imageless.
  const STOP = new Set(["the", "a", "an", "with", "and", "of", "in", "on", "over", "into", "across", "as", "to", "that", "then", "while", "for", "is", "are", "we", "see", "scene", "text", "headline", "screen"]);
  // Camera/motion vocabulary — visualDirection usually LEADS with the camera move
  // ("Camera pushes aggressively toward the logo"), and the naive first-4-words pick
  // turned that motion language into image queries like "camera pushes aggressively".
  // Strip it so deriveQuery keeps only SUBJECT words; if nothing subject-y remains the
  // scene degrades to a motif (the intended fallback) instead of fetching garbage stock.
  const CAMERA_STOP = new Set([
    "camera", "lens", "shot", "frame", "framing", "angle", "view", "viewpoint",
    "push", "pushes", "pushing", "pull", "pulls", "pulling", "zoom", "zooms", "zooming",
    "pan", "pans", "panning", "tilt", "tilts", "dolly", "truck", "track", "tracks", "tracking",
    "crane", "drift", "drifts", "drifting", "glide", "glides", "gliding", "sweep", "sweeps",
    "rack", "orbit", "orbits", "orbiting", "parallax", "motion", "move", "moves", "moving",
    "movement", "forward", "backward", "toward", "towards", "away", "upward", "downward",
    "slow", "slowly", "fast", "quick", "quickly", "rapid", "rapidly", "aggressive",
    "aggressively", "smooth", "smoothly", "gentle", "gently", "gradual", "gradually",
    "subtle", "subtly", "dynamic", "dynamically", "reveal", "reveals", "revealing",
    "transition", "transitions", "cut", "cuts", "fade", "fades", "dissolve", "dissolves",
    "focus", "blur", "blurs", "sharpen", "begins", "starts", "ends", "holds", "snaps", "settles",
  ]);
  // Abstract MARKETING vocabulary — concepts, not photographable subjects. A query
  // built from these ("dominate rankings", "seamless growth", "unlock potential")
  // can't map to a real photo, so free stock returns whatever is popular (the
  // desert-woman, the race car). In STRICT mode we strip these too and, if too few
  // CONCRETE words survive, derive NO photo query → the scene gets a motif/typography
  // instead of doomed stock. (Lenient mode keeps the old behaviour.)
  const ABSTRACT_STOP = new Set([
    "dominate", "domination", "rankings", "ranking", "growth", "grow", "success", "successful",
    "power", "powerful", "seamless", "seamlessly", "instant", "instantly", "transform", "transforms",
    "transformation", "revolution", "revolutionary", "boost", "unlock", "unleash", "elevate", "amplify",
    "optimize", "optimized", "optimization", "scale", "scalable", "efficiency", "efficient",
    "productivity", "productive", "innovation", "innovative", "solution", "solutions", "experience",
    "journey", "future", "smart", "intelligent", "advanced", "premium", "ultimate", "exclusive",
    "confidence", "confident", "freedom", "potential", "results", "impact", "value", "quality",
    "excellence", "performance", "momentum", "vision", "mission", "strategy", "strategic", "robust",
    "agile", "streamline", "streamlined", "empower", "empowered", "breakthrough", "gamechanger",
    "win", "winning", "thrive", "thriving", "leverage", "synergy", "disrupt", "disruptive", "edge",
    "leading", "leader", "trusted", "proven", "simple", "simplify", "simplified", "effortless",
    "magic", "magical", "supercharge", "accelerate", "maximize", "deliver", "drive", "driving",
    "everything", "anything", "anyone", "everyone", "world", "global", "globally", "today", "now",
  ]);
  const deriveQuery = (scene) => {
    const words = String(scene.visualDirection || "").toLowerCase().match(/[a-z]{3,}/g) || [];
    const concrete = words.filter((w) => !STOP.has(w) && !CAMERA_STOP.has(w) && (!strictAssets || !ABSTRACT_STOP.has(w)));
    const picked = concrete.slice(0, 4);
    return picked.length >= 2 ? picked.join(" ") : null;
  };

  const VECTOR_ROLES = new Set(["icon", "texture", "vector"]);
  const roleOf = (n) => String(n.role || "").toLowerCase();

  const wants = [];
  for (const scene of script.scenes) {
    const needs = [...(scene.assetNeeds || [])];
    // Gap-fill: EVERY scene with no asset request gets a derived one (hook/cta
    // included — dense visuals everywhere beats sparse pure-typography beats).
    if (!needs.length && !pinnedSceneIds.has(scene.id)) {
      const q = deriveQuery(scene);
      if (q) {
        needs.push({ type: "image", query: q, role: "background", derived: true });
        // Alternate scenes also pull a photo inset for variety.
        if (script.scenes.indexOf(scene) % 2 === 1) {
          needs.push({ type: "image", query: q, role: "inset", derived: true });
        }
      }
    }
    // VECTOR GAP-FILL — the curated 2k+ SVG library was effectively never tapped
    // because nothing ever requested an icon/vector role. Guarantee EVERY scene
    // pulls one on-brand vector/icon so the composer always has real graphic
    // material to layer (not just photos), satisfying the vector cadence mandate.
    if (!needs.some((n) => VECTOR_ROLES.has(roleOf(n)))) {
      const q = deriveQuery(scene) || (scene.assetNeeds && scene.assetNeeds[0] && scene.assetNeeds[0].query) || null;
      if (q) needs.push({ type: "image", query: q, role: "icon", derived: true });
    }
    for (const need of needs) {
      if (pinnedSceneIds.has(scene.id) && need.role === "background") continue;
      const type = need.type === "video" && !videoOk ? "image" : need.type;
      wants.push({ kind: "search", scene, need: { ...need, type } });
    }
  }
  // A need is a vector if its ROLE is icon/texture/vector OR its script TYPE is
  // "icon" (the script schema allows type:"icon" with any role; keying only off
  // role missed those and fetched explicitly-requested icons as photos).
  const isVectorNeed = (n) => VECTOR_ROLES.has(roleOf(n)) || n.type === "icon";
  // How much REAL brand material we have (site screenshots + scraped page images +
  // the USER'S OWN uploaded assets). When it's plentiful, we cap (or zero) the
  // lower-quality stock sources below — a user's real logo/product beats any stock.
  const userImgCount = (job.user_assets || []).filter((a) => a && a.type === "image").length;
  const realCount = shots.length + imagePlan.length + userImgCount;
  const videos = wants.filter((w) => w.need.type === "video").slice(0, 2);
  // Vectors get their OWN budget so a long photo list can't starve them — this
  // is what finally feeds the curated SVG library into films.
  const vectorCap = realCount >= 4 ? 3 : 8;
  const vectors = wants.filter((w) => w.need.type !== "video" && isVectorNeed(w.need)).slice(0, vectorCap);
  // Stock photos are the worst-quality source (the off-topic "old woman / suitcase /
  // windmill" matches). Once we have enough REAL brand material — and motifs fill any
  // bare text scene — fetch NO stock at all; with some real material, fetch only a couple.
  const stockCap = realCount >= 4 ? 0 : realCount >= 2 ? 2 : (12 - videos.length);
  const photos  = wants.filter((w) => w.need.type !== "video" && !isVectorNeed(w.need)).slice(0, stockCap);
  console.log(`[agents] asset_planner: ${screenshotPlan.length} screenshot(s) + ${videos.length} video(s) + ${photos.length} photo(s) + ${vectors.length} vector(s) (${wants.filter((w) => w.need.derived).length} derived)`);
  return { assetPlan: { screenshots: screenshotPlan, realImages: imagePlan, searches: [...videos, ...photos, ...vectors] } };
}

// Asset Search — executes the plan: our database first, then providers.
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

// Pin the user's OWN uploaded assets (logos, product/company photos, graphics) as
// the HIGHEST-priority real material — copied into the job dir and tagged
// source:"user-upload" so the scene-kit weaves them like real brand assets, ahead of
// any stock. `kind` steers placement: logo/graphic → contained side-art, product →
// inset hero, photo/background/character → full-bleed-eligible photo. Uploaded VIDEOS
// are accepted and stored but skipped here — the kit renders <img> only, so <video>
// b-roll weaving is a deliberate later phase (no broken tiles in the meantime).
function pinUserAssets(job, jobDir) {
  const list = (job.user_assets || []).filter((a) => a && a.path);
  const out = [];
  let i = 0, iVid = 0;
  for (const a of list) {
    let abs = a.path;
    try { if (!fs.existsSync(abs)) continue; } catch { continue; }
    // VIDEO (b-roll) — pinned as MOVING footage; the scene-kit weaves it as a <video>
    // background (Phase C). Copied as-is; standard mp4/webm play directly in HyperFrames.
    if (a.type === "video") {
      const vext = (path.extname(abs) || ".mp4").toLowerCase().slice(0, 5);
      const vRel = `assets/videos/user_${iVid}${vext}`;
      try { fs.mkdirSync(path.join(jobDir, "assets", "videos"), { recursive: true }); fs.copyFileSync(abs, path.join(jobDir, vRel)); } catch { continue; }
      out.push({ path: vRel, type: "video", sceneId: null, style: "background", alt: "brand b-roll", license: "user content", sourceUrl: null, source: "user-upload", fromCache: false, kind: "broll" });
      iVid++;
      continue;
    }
    const ext = (path.extname(abs) || ".jpg").toLowerCase().slice(0, 5);
    const relPath = `assets/images/user_${i}${ext}`;
    try { fs.copyFileSync(abs, path.join(jobDir, relPath)); } catch { continue; }
    const kind = String(a.kind || "photo").toLowerCase();
    const style = kind === "logo" ? "logo"
      : kind === "graphic" ? "vector"
      : kind === "screenshot" ? "screenshot"
      : kind === "product" ? "inset"
      : "photo";
    // A "screenshot" kind carries the word "screenshot" in its alt so partitionAssets
    // routes it to the SCREENSHOT pool → device-framed browser hero (chrome + scroll),
    // the same premium treatment scraped site screenshots get.
    const alt = kind === "logo" ? "brand logo"
      : kind === "screenshot" ? "user website screenshot in a styled browser frame"
      : kind === "product" ? "product image"
      : `brand ${kind} image`;
    out.push({
      path: relPath, type: "image", sceneId: null, style, alt,
      license: "user content", sourceUrl: null, source: "user-upload", fromCache: false, kind,
    });
    i++;
  }
  if (out.length) console.log(`[agents] pinned ${out.length} user-uploaded asset(s)`);
  return out;
}

async function assetSearchAgent(s) {
  const { job, jobDir, tracker, assetPlan } = s;
  const anchor = topicAnchor(job, s.brief);
  // A concise subject sentence for the VISION relevance gate (what the video is about).
  const visionTopic = [s.brief?.improvedPrompt, job.website_title, (s.brief?.keyMessages || []).slice(0, 2).join("; ")]
    .filter(Boolean).join(" — ").slice(0, 300) || job.prompt || "";
  if (anchor) console.log(`[agents] asset_search topic anchor: "${anchor}"`);
  db.setProgress(job.id, "assets");
  fs.mkdirSync(path.join(jobDir, "assets", "images"), { recursive: true });
  fs.mkdirSync(path.join(jobDir, "assets", "videos"), { recursive: true });

  const pinned = assetPlan.screenshots.map(({ src, scene, index }) => {
    const relPath = `assets/images/site_${index}.png`;
    fs.copyFileSync(src, path.join(jobDir, relPath));
    return {
      path: relPath, type: "image", sceneId: scene.id, startSec: scene.start, durationSec: scene.duration,
      style: "inset",
      alt: `REAL website screenshot of ${job.website_title || "the product"} (${index === 0 ? "homepage hero" : `page section ${index + 1}`}) — present in a styled browser frame with hero treatment`,
      license: "owner content", sourceUrl: job.intent?.websiteUrl || null, source: "website", fromCache: false,
    };
  });

  // Scraped REAL page images — pinned as PHOTOS (no browser frame). source is
  // "website-image" so the scene-kit treats them as photos (montage/scrim/split),
  // not screenshots, while still counting as real brand material over stock.
  const pinnedImages = (assetPlan.realImages || []).map(({ src, index }) => {
    const ext = (path.extname(src) || ".jpg").slice(0, 5);
    const relPath = `assets/images/siteimg_${index}${ext}`;
    try { fs.copyFileSync(src, path.join(jobDir, relPath)); } catch { return null; }
    return {
      path: relPath, type: "image", sceneId: null, style: "photo",
      alt: `real image from the ${job.website_title || "product"} website`,
      license: "owner content", sourceUrl: job.intent?.websiteUrl || null, source: "website-image", fromCache: false,
    };
  }).filter(Boolean);

  // Map a scene's asset role to the kind of curated asset that fits it:
  // full-bleed backgrounds want real photos; insets/icons/textures want
  // vectors or illustrations. Threaded into acquire() -> curated.search.
  const kindPrefFor = (role) => {
    const r = String(role || "").toLowerCase();
    if (r === "background" || r === "fullscreen") return "photo";
    if (r === "icon" || r === "texture") return "vector";
    if (r === "inset") return "illustration";
    return undefined;
  };

  // Sequential so each curated pick can exclude the library files already
  // chosen for earlier scenes — no single film reuses the same file twice.
  const usedLibraryIds = new Set();
  let iImg = 0, iVid = 0;
  const results = [];
  for (const { scene, need } of assetPlan.searches) {
    const isVideo = need.type === "video";
    const relPath = isVideo ? `assets/videos/${iVid++}.mp4` : `assets/images/${iImg++}.jpg`;
    // type:"icon" OR role icon/texture -> want a curated vector. Do NOT append
    // "icon flat" to the query: that suffix trips the curated library's 0.5
    // relevance gate and zeroes its SVG hits — kindPref:"vector" already routes
    // to the SVG library on the concrete subject query.
    const isIcon = need.type === "icon" || ["icon", "texture"].includes(String(need.role || "").toLowerCase());
    // Anchor PHOTO/background queries to the video's subject so a derived
    // direction like "scalable growth" becomes "beauty cosmetics scalable
    // growth" — on-topic stock instead of trading charts. Icons/vectors keep
    // their concrete query (anchoring an abstract shape rarely helps). The plain
    // query is kept as a fallback so an over-narrow anchor still finds SOMETHING.
    const query = (!isIcon && anchor) ? `${anchor} ${need.query}` : need.query;
    const r = await acquire({
      query, fallbackQueries: [need.query, ...fallbackQueriesFor(query)], type: isVideo ? "video" : "image",
      orientation: job.orientation, outputPath: path.join(jobDir, relPath), tracker,
      kindPref: isVideo ? undefined : (isIcon ? "vector" : kindPrefFor(need.role)),
      excludeIds: usedLibraryIds, visionTopic,
    }).catch(() => null);
    if (!r) continue;
    if (r.libraryId) usedLibraryIds.add(r.libraryId);
    results.push({
      path: path.relative(jobDir, r.path).split(path.sep).join("/"), type: isVideo ? "video" : "image",
      sceneId: scene.id, startSec: scene.start, durationSec: scene.duration,
      style: need.role === "inset" ? "inset" : "background", alt: need.query,
      license: r.license, sourceUrl: r.sourceUrl, source: r.source, fromCache: r.fromCache === true,
    });
  }
  const got = results;

  // User uploads FIRST — highest priority, ahead of site screenshots/scraped images/stock.
  const userPinned = pinUserAssets(job, jobDir);
  const assets = [...userPinned, ...pinned, ...pinnedImages, ...got];
  db.setAssets(job.id, assets);
  console.log(`[agents] asset_search: ${assets.length} asset(s) (${got.filter((a) => a.fromCache).length} from cache)`);
  return { assets };
}

// Voice Agent — per-scene fitted VO + script SFX + music, in parallel.
async function voiceAgent(s) {
  const { job, jobDir, tracker, script } = s;
  const audioDir = path.join(jobDir, "audio");
  fs.mkdirSync(audioDir, { recursive: true });
  const voice = pickVoice(job, script);
  // Delivery DIRECTION, not a demographic profile. Strip gender/age words (they
  // pick the voice, not the read) and turn pace into a spoken-energy phrase so
  // gpt-audio gets actionable acting notes instead of "30s female".
  const tone = String(script.voice?.style || "")
    .replace(/\b(male|female|man|woman|masculine|feminine|young|younger|older|aged?|teen|adult|nonbinary|he\/him|she\/her|\d+\s*s?)\b/gi, "")
    .replace(/\s{2,}/g, " ").replace(/^[\s,.;-]+|[\s,.;-]+$/g, "").trim() || "clear and confident";
  const pace = String(script.voice?.pace || "").toLowerCase();
  const paceEnergy = /slow|calm|measured|gentle/.test(pace) ? "unhurried and measured"
    : /fast|brisk|quick|punchy|energetic/.test(pace) ? "brisk and energetic"
    : "a relaxed, natural conversational rhythm";
  const instructions = `Speak ${tone}. Delivery: ${paceEnergy}. Vary intonation naturally, land emphasis on key words, and warm the final line.`;

  const voTask = Promise.all(script.scenes.map((sc) =>
    (sc.voiceover && sc.voiceover.trim())
      ? synthesizeFitted({ text: sc.voiceover, targetSec: sc.duration, voice, instructions, outputPath: path.join(audioDir, `vo-${sc.id}.mp3`), tracker })
          .then((r) => r ? { sceneId: sc.id, startSec: sc.start, durationSec: r.durationSec, sceneDurationSec: sc.duration, text: r.text, path: r.path } : null)
          .catch((e) => { console.warn(`[agents] vo ${sc.id} failed: ${e.message}`); return null; })
      : Promise.resolve(null)
  )).then((a) => a.filter(Boolean));

  // Cap SFX low — 6 whooshes/dings layered over per-scene VO + music read as
  // cluttered, overlapping audio. A few accents beat a wall of sound.
  const sfxWanted = [];
  for (const sc of script.scenes) for (const name of (sc.sfx || [])) if (sfxWanted.length < 3) sfxWanted.push({ name, startSec: sc.start });
  const sfxTask = Promise.all(sfxWanted.map((x, i) =>
    getSfx({ name: x.name, outputPath: path.join(audioDir, `sfx-${i}.mp3`), tracker })
      .then((p) => p ? { path: p, startSec: x.startSec, volume: 0.4 } : null).catch(() => null)
  )).then((a) => a.filter(Boolean));

  // Richer music query: fold the mood field into the query so the provider gets
  // genre/feel cues, not just a bare 2-word phrase (which returned off-genre SFX).
  const musicQuery = [script.music?.mood, script.music?.query]
    .map((x) => String(x || "").trim()).filter(Boolean).join(" ").slice(0, 80);
  const musicTask = (script.music?.query || script.music?.mood)
    ? fetchMusic({ query: musicQuery, outputPath: path.join(audioDir, "music.mp3"), tracker }).catch(() => null)
    : Promise.resolve(null);

  const [voClips, sfxClips, musicPath] = await Promise.all([voTask, sfxTask, musicTask]);
  console.log(`[agents] voice: ${voClips.length} vo clip(s), ${sfxClips.length} sfx, music=${!!musicPath}`);
  return { voClips, sfxClips, musicPath };
}

// Composition Agent (+ the Animation agent's work product: the timeline).
async function compositionAgent(s) {
  const { job, jobDir, tracker } = s;
  db.setProgress(job.id, "composing");
  const dims = { width: job.width, height: job.height, fps: job.fps };

  const wc = (t) => (String(t || "").match(/\S+/g) || []).length;
  const captionCues = job.captions_enabled === 0 ? [] : buildCues(
    s.script.scenes.filter((x) => x.voiceover && x.voiceover.trim()).map((x) => ({
      sceneId: x.id, startSec: x.start,
      durationSec: Math.min(x.duration, wc(x.voiceover) / 2.6 + 0.4),
      sceneDurationSec: x.duration, text: x.voiceover,
    }))
  ).map((c) => ({ start: Math.round(c.start * 10) / 10, end: Math.round(c.end * 10) / 10, text: c.text }));

  // Brand colors drive the scene-kit's accents so the whole film reads on-brand.
  // Prefer the site's scraped palette; when there's none (upload-only, no URL), derive
  // one from the user's uploaded LOGO/first image so branding still shows. Cached on the
  // job so QA repair laps don't re-run ffmpeg. Threaded via the storyboard into deriveTheme.
  let brandColors = (job.intent?.website?.brandColors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(String(c || "").trim()));
  if (!brandColors.length) {
    if (Array.isArray(job.__brandColors)) {
      brandColors = job.__brandColors;
    } else {
      const src = (job.user_assets || []).find((a) => a && a.type === "image" && (a.kind === "logo" || a.kind === "product"))
        || (job.user_assets || []).find((a) => a && a.type === "image");
      if (src?.path && fs.existsSync(src.path)) {
        try { brandColors = (await dominantColors(src.path)).filter((c) => /^#[0-9a-f]{6}$/i.test(String(c || "").trim())); } catch { /* best effort */ }
      }
      job.__brandColors = brandColors; // cache (even if empty) so we don't re-extract each lap
    }
  }
  if (brandColors.length) console.log(`[agents] brand accents: ${brandColors.join(",")}`);
  // Carry QA repair feedback + brand colors into the composer when looping.
  const storyboard = {
    ...s.storyboard,
    ...(s.qa && s.qa.issues?.length ? { __qaIssuesToFix: s.qa.issues.map((i) => `at ${i.atSec}s [${i.severity}]: ${i.issue} — FIX: ${i.fix}`) } : {}),
    ...(brandColors.length ? { brandColors } : {}),
  };

  // Three.js render path (config.render.engine === "three"). Text-archetype storyboards render
  // via the Remotion + R3F engine (engine3d-spike/); storyboards with asset scenes fall back to
  // the scene-kit below. The engine consumes THIS SAME storyboard, so no LLM/orchestrator change.
  if (config.render?.engine === "three" && !s.qa) {
    if (isThreeRenderable(storyboard, job)) {
      try {
        db.setProgress(job.id, "rendering");
        tracker.addExternal("three_render");
        const visual = await renderThree({
          jobId: job.id, jobDir, storyboard, framePack: s.framePack, brandColors,
          dims, durationSec: job.duration, title: s.brief?.title || storyboard.title,
          userAssets: job.user_assets || [],
        });
        console.log(`[agents] rendered via Three.js engine (renderEngine=three, ${storyboard.scenes?.length || 0} scenes)`);
        return { visual, usedFallback: false, finalAttempt: "three", rendered: true };
      } catch (e) {
        console.warn(`[agents] three render failed (${String(e.message).slice(0, 200)}) — falling back to scene-kit`);
      }
    } else {
      console.log(`[agents] renderEngine=three but storyboard has asset scenes or is non-landscape — using scene-kit`);
    }
  }

  const budget = (Number(config.server.stageBudgetSec) || 480) * 1000;
  // PRIMARY composer = the LLM composition agent (remix), unless disabled via
  // USE_LLM_COMPOSER=0 — then attemptLlmComposition dispatches the deterministic
  // scene-kit directly. Either way the kit stays available as the fallback below.
  const useComposer = config.llm.useComposer !== false;
  try {
    const visual = await withBudget(
      (signal) => attemptLlmComposition({
        storyboard, dims, jobDir, assets: s.assets || [], tracker,
        jobId: job.id, durationSec: job.duration,
        label: s.qa ? "graph-repair" : "graph-main", abortSignal: signal,
        framePack: s.framePack, captionCues, remix: useComposer,
      }),
      budget, "composition agent"
    );
    return { visual, usedFallback: false, finalAttempt: s.qa ? "qa-repair" : "main" };
  } catch (e) {
    console.warn(`[agents] composition failed (${e.message.slice(0, 180)})`);
    // On a QA-triggered repair lap, a failed re-compose must NOT discard the
    // prior render that already passed lint and was QA-reviewed by shipping the
    // bland deterministic template. A real (if imperfect) composition beats a
    // fallback slide — keep the previous good render.
    if (s.qa && s.visual && !s.usedFallback) {
      console.warn(`[agents] repair re-compose failed — keeping prior lint-passing render (not falling back to template)`);
      return { visual: s.visual, usedFallback: false, finalAttempt: s.finalAttempt || "main", rendered: true };
    }
    try {
      if (fs.existsSync(path.join(jobDir, "index.html"))) {
        fs.copyFileSync(path.join(jobDir, "index.html"), path.join(jobDir, "index.llm-attempt.html"));
      }
    } catch { /* best effort */ }
    // The LLM composer failed its gates. Before the bland template, try the
    // deterministic ASSET-RICH scene-kit — a real, lint-clean, multi-asset comp
    // (screenshot hero + montage + scrim B-roll) beats a fallback slide. Only
    // worth a separate attempt when the composer (remix) was the primary path.
    if (useComposer) {
      try {
        console.warn(`[agents] scene-kit fallback (deterministic, asset-rich)`);
        const visual = await attemptLlmComposition({
          storyboard, dims, jobDir, assets: s.assets || [], tracker,
          jobId: job.id, durationSec: job.duration, label: "scene-kit-fallback",
          framePack: s.framePack, captionCues, remix: false,
        });
        return { visual, usedFallback: false, finalAttempt: "scene-kit", rendered: true };
      } catch (e2) {
        console.warn(`[agents] scene-kit fallback failed (${String(e2.message).slice(0, 120)}) — bland template`);
      }
    }
    console.warn(`[agents] deterministic fallback`);
    const fb = buildFallback({
      prompt: s.brief?.improvedPrompt || job.prompt, duration: job.duration,
      orientation: job.orientation, width: dims.width, height: dims.height, fps: dims.fps,
      storyboard: s.storyboard,
      packTokens: s.framePack ? frameRegistry.getPackTokens(s.framePack) : null,
      assets: s.assets || [],
      captionCues,
    });
    // Run the fallback through the same safe normalizer the LLM path uses, so a
    // pack font token / track overlap never ships an un-checked fallback.
    const fbNorm = normalizeComposition(fb.indexHtml);
    fs.writeFileSync(path.join(jobDir, "index.html"), fbNorm.html, "utf8");
    fs.writeFileSync(path.join(jobDir, "meta.json"), fb.metaJson, "utf8");
    tracker.addExternal("hyperframes_render");
    const visual = await render({ jobId: job.id, jobDir, durationSec: job.duration });
    return { visual, usedFallback: true, finalAttempt: "fallback", rendered: true };
  }
}

// Animation Agent — deterministic timeline audit of the composed HTML:
// every scene window must be covered by timeline activity, and the known
// footguns must be absent. Produces warnings; never blocks (QA decides).
async function animationAgent(s) {
  if (s.usedFallback) return { animationReport: { warnings: ["fallback composition"] } };
  let html = "";
  try { html = fs.readFileSync(path.join(s.jobDir, "index.html"), "utf8"); } catch { /* no file */ }
  const warnings = [];
  if (/repeat:\s*-1/.test(html)) warnings.push("repeat:-1 found (breaks deterministic capture)");
  if (/style="[^"]*transform:\s*translate/i.test(html)) warnings.push("inline transform hidden-state found (composes with GSAP xPercent — content may stay offscreen)");
  const tweenCount = (html.match(/tl\.(to|fromTo|from|set)\(/g) || []).length;
  const sceneCount = (s.storyboard?.scenes || []).length || 1;
  if (tweenCount < sceneCount * 2) warnings.push(`only ${tweenCount} timeline calls for ${sceneCount} scenes — likely under-animated`);
  if (warnings.length) console.warn(`[agents] animation audit: ${warnings.join(" | ")}`);
  return { animationReport: { tweenCount, warnings } };
}

// Timeline Agent — render (if not already), captions/SRT, audio mix.
async function timelineAgent(s) {
  const { job, jobDir, tracker } = s;
  let visual = s.visual;
  if (!s.rendered && !s.usedFallback) {
    // attemptLlmComposition already rendered; only the fallback path marks
    // rendered itself. visual is set either way.
  }
  db.setProgress(job.id, "audio");

  const cues = buildCues(s.voClips || []);
  if (cues.length) {
    try {
      const srtPath = path.join(config.paths.videosDir, `${job.id}.srt`);
      writeSrt(cues, srtPath);
      db.setCaptions(job.id, { cues, srtUrl: `/videos/${job.id}.srt` });
    } catch (e) { console.warn(`[agents] srt failed: ${e.message}`); }
  }

  await mixAudioIntoVideo({
    visualPath: visual.videoPath,
    durationSec: job.duration,
    audio: {
      ttsPath: null,
      musicPath: s.musicPath || null,
      sfx: [
        // kind:"vo" lets the mixer duck the background music under speech.
        ...(s.voClips || []).map((c) => ({ path: c.path, startSec: c.startSec, volume: 1.0, kind: "vo" })),
        ...(s.sfxClips || []),
      ],
      musicVolume: config.audio?.defaultMusicVolume ?? 0.10,
    },
  }).catch((e) => console.warn(`[agents] mix failed: ${e.message}`));

  return { visual };
}

// Repair lap — re-runs composition → animation audit → timeline as one
// node so the QA loop never re-enters the first lap's parallel joins.
async function repairAgent(s) {
  const comp = await compositionAgent(s);
  const m1 = { ...s, ...comp };
  const anim = await animationAgent(m1);
  const tl = await timelineAgent({ ...m1, ...anim });
  return { ...comp, ...anim, ...tl };
}

// QA Agent node — verdict + loop control.
async function qaAgentNode(s) {
  if (config.qa?.enabled === false || s.usedFallback) {
    return { qa: { pass: true, issues: [], skipped: true } };
  }
  db.setProgress(s.job.id, "qa");
  const verdict = await reviewRender({
    videoPath: s.visual.videoPath,
    scenes: s.script.scenes,
    duration: s.job.duration,
    framePack: s.framePack,
    workDir: path.join(s.jobDir, "qa"),
    tracker: s.tracker,
  }).catch((e) => {
    console.warn(`[agents] qa failed (${e.message.slice(0, 120)}); passing by default`);
    return { pass: true, issues: [], error: e.message };
  });
  return { qa: verdict, qaAttempts: (s.qaAttempts || 0) + 1 };
}

// ---------------------------------------------------------------- graph
let compiledGraph = null;

async function buildGraph() {
  if (compiledGraph) return compiledGraph;
  const { StateGraph, Annotation, START, END } = await import("@langchain/langgraph");

  const S = Annotation.Root({
    job: Annotation(), jobDir: Annotation(), tracker: Annotation(),
    brief: Annotation(), script: Annotation(),
    framePack: Annotation(), storyboard: Annotation(),
    assetPlan: Annotation(), assets: Annotation(),
    voClips: Annotation(), sfxClips: Annotation(), musicPath: Annotation(),
    visual: Annotation(), usedFallback: Annotation(), finalAttempt: Annotation(), rendered: Annotation(),
    animationReport: Annotation(), qa: Annotation(), qaAttempts: Annotation(),
  });

  // Node names must not collide with state channel names (LangGraph rule),
  // hence the _agent suffixes on storyboard/qa.
  const g = new StateGraph(S)
    .addNode("frame_selector", frameSelectorAgent)
    .addNode("storyboard_agent", storyboardAgent)
    .addNode("scene_planner", scenePlannerAgent)
    .addNode("asset_planner", assetPlannerAgent)
    .addNode("asset_search", assetSearchAgent)
    .addNode("voice_agent", voiceAgent)
    .addNode("composition", compositionAgent)
    .addNode("animation", animationAgent)
    .addNode("timeline", timelineAgent)
    .addNode("qa_agent", qaAgentNode)
    .addNode("repair", repairAgent);

  g.addEdge(START, "frame_selector");
  // Fan-out: three branches run in parallel.
  g.addEdge("frame_selector", "storyboard_agent");
  g.addEdge("frame_selector", "asset_planner");
  g.addEdge("frame_selector", "voice_agent");
  g.addEdge("storyboard_agent", "scene_planner");
  g.addEdge("asset_planner", "asset_search");
  // Join: composition needs the plan AND the assets.
  g.addEdge(["scene_planner", "asset_search"], "composition");
  g.addEdge("composition", "animation");
  // Join: the timeline mix needs the render AND the voice branch.
  g.addEdge(["animation", "voice_agent"], "timeline");
  g.addEdge("timeline", "qa_agent");
  g.addConditionalEdges("qa_agent", (s) => {
    const repairsLeft = (s.qaAttempts || 0) <= (Number(config.qa?.maxRepairs) || 1);
    // Only repair when the LLM COMPOSER is the active path: it's non-deterministic
    // and can actually respond to QA feedback. With the deterministic scene-kit
    // (config.llm.useComposer=false, the default), a repair lap re-renders byte-
    // identical output — so QA failing (e.g. the weak Flash vision model calling a
    // deliberately-sparse cinematic frame "under-illustrated") would just churn the
    // same render N times and burn vision calls. QA still runs ONCE as a diagnostic.
    if (!s.qa?.pass && repairsLeft && !s.usedFallback && config.llm.useComposer) {
      console.log(`[agents] QA failed — repair lap ${s.qaAttempts}`);
      return "repair";
    }
    if (!s.qa?.pass && !config.llm.useComposer) {
      console.log(`[agents] QA flagged the deterministic scene-kit render (diagnostic only — no repair lap; the kit is deterministic)`);
    }
    return END;
  }, ["repair", END]);
  g.addEdge("repair", "qa_agent");

  compiledGraph = g.compile();
  return compiledGraph;
}

// ---------------------------------------------------------------- runner
async function runProductionGraph({ jobId }) {
  const job = db.getRaw(jobId);
  if (!job || !job.script) {
    console.error(`[agents] ${jobId} aborted: no approved script`);
    return;
  }
  const jobDir = jobDirFor(jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  db.markStarted(jobId);

  const tracker = new UsageTracker();
  const t0 = ms();
  const script = normalizeScript(job.script, { targetDuration: job.duration });

  try {
    const graph = await buildGraph();
    const final = await graph.invoke(
      { job, jobDir, tracker, brief: job.brief, script, qaAttempts: 0 },
      { recursionLimit: 40 }
    );

    const costs = tracker.computeCosts();
    db.markDone(jobId, {
      videoUrl: final.visual.videoUrl,
      usedFallback: final.usedFallback === true,
      tokensIn: costs.llm.inputTokens,
      tokensOut: costs.llm.outputTokens,
      usage: costs,
      stageTimings: { ...(job.stage_timings || {}), productionMs: ms() - t0 },
      finalAttempt: final.finalAttempt || "main",
    });
    if (final.qa) db.setQa(jobId, final.qa);
    console.log(`[agents] ${jobId} done — ${final.finalAttempt}, qa=${final.qa?.pass === false ? "FAILED(delivered best attempt)" : final.qa?.skipped ? "skipped" : "pass"}, cost=$${costs.totalCostUsd}`);
  } catch (err) {
    console.error(`[agents] ${jobId} graph failed: ${err.message}`);
    const costs = tracker.computeCosts();
    db.markFailed(jobId, err.message.slice(0, 2000), costs.llm.inputTokens, costs.llm.outputTokens, costs);
  }
}

module.exports = { runProductionGraph };
