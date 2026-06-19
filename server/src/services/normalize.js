// Deterministic, low-risk normalizations applied to composer output BEFORE the
// hyperframes lint gate. These fix mechanical violations the LLM commonly emits
// that are 100% safe to rewrite in code (no layout/z-order impact), so the
// lint+repair loop doesn't burn an LLM lap (or fall back) on them.
//
// Scope is intentionally conservative: only transforms that cannot break a
// valid composition. Structural/animation issues (track overlaps, GSAP
// from/transform conflicts) are left to the prompt + repair LLM, since fixing
// them blindly risks changing the intended visual result.

// The only font stack the offline renderer + lint resolve without @font-face.
const SAFE_FONT_STACK = 'Inter, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif';

// Force every `font-family` declaration to the safe system stack. The renderer
// can't load webfonts, and the lint rejects any family it can't auto-resolve
// (e.g. "Space Grotesk" from a frame pack) with `font_family_without_font_face`.
// Family values never contain ';' or '}', so this bounded match is safe; it
// standardizes inline styles, CSS rules, and var() usages alike.
function normalizeFontFamilies(html) {
  return String(html).replace(/font-family\s*:\s*[^;}]+/gi, "font-family: " + SAFE_FONT_STACK);
}

// Strip external font loading — the offline renderer fails on it and the lint
// rejects it (`google_fonts_import`). Also drop `-apple-system` from any
// font-family (lint flags it as an unresolved family). Text then resolves via
// the system stack, exactly what the prompt now asks for.
function stripExternalFonts(html) {
  let out = String(html);

  // <link ... fonts.googleapis.com|fonts.gstatic.com ...> (preconnect + stylesheet)
  out = out.replace(
    /<link\b[^>]*\bhref\s*=\s*["'][^"']*fonts\.(?:googleapis|gstatic)\.com[^"']*["'][^>]*>\s*/gi,
    ""
  );
  // @import url('https://fonts.googleapis.com/...');  (and bare @import "...")
  out = out.replace(
    /@import\s+(?:url\(\s*)?["']?[^"';)]*fonts\.googleapis\.com[^"';)]*["']?\s*\)?\s*;?/gi,
    ""
  );
  // `-apple-system` token inside font-family lists.
  out = out.replace(/\s*,?\s*-apple-system(?=\s*[,;}"'])/gi, "");

  return out;
}

// Inject class="clip" into any element that has BOTH data-start and
// data-duration but is missing `clip` from its class. The lint rule
// `timed_element_missing_clip_class` requires every timed element to be a
// .clip (the runtime keys visibility off it); the LLM — especially weaker
// models — routinely forgets it on a few elements, which fails lint and burns
// a repair lap (or falls back). Adding the class is exactly the lint's own
// suggested fix and is 100% safe: a timed element IS a clip by definition.
// The root composition element (#root / .composition) carries timing attrs but
// is NOT a clip, so it is explicitly skipped.
function ensureClipClass(html) {
  return String(html).replace(/<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g, (full, name, attrs) => {
    if (!/\bdata-start\s*=/.test(attrs) || !/\bdata-duration\s*=/.test(attrs)) return full;
    // Skip the root composition element — it is timed but not a .clip.
    if (/\bid\s*=\s*["']root["']/.test(attrs) || /\bclass\s*=\s*["'][^"']*\bcomposition\b[^"']*["']/.test(attrs)) return full;
    const selfClose = /\/>$/.test(full) ? " /" : "";
    const body = attrs.replace(/\s*\/$/, "");
    const cm = body.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    if (cm) {
      const val = cm[1] != null ? cm[1] : cm[2];
      if (/\bclip\b/.test(val)) return full; // already a clip
      const merged = body.replace(cm[0], `class="${(val + " clip").trim()}"`);
      return `<${name}${merged}${selfClose}>`;
    }
    return `<${name}${body} class="clip"${selfClose}>`;
  });
}

// Deterministically remove same-track time overlaps — the single most common
// reason rich compositions get rejected (every model, including opus-4.8, stacks
// e.g. bg+scrim+content or per-scene overlays on one track and trips
// `overlapping_clips_same_track`, which has caused most fallbacks). The lint's
// own suggested fix is "move one clip to a different data-track-index".
//
// Algorithm = greedy interval coloring in DOCUMENT ORDER: walk clips top-to-bottom
// and give each the LOWEST track index on which no already-placed clip overlaps
// its [start, start+duration) window. Two properties make this safe:
//   • Correctness: by construction no two clips on a track overlap in time.
//   • Z-order preserved: clips that DON'T overlap in time never co-exist on
//     screen, so their relative track is visually irrelevant; clips that DO
//     overlap keep their document order (earlier DOM → lower track → behind),
//     which is exactly how composers author stacking (bg first, text last).
// The root composition element is timed but is NOT a clip, so it is skipped.
function reflowTrackOverlaps(html) {
  const src = String(html);
  const tagRe = /<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g;
  const tracks = []; // tracks[t] = [[start,end), ...] already placed
  let changed = false;

  const out = src.replace(tagRe, (full, name, attrs) => {
    if (!/\bdata-start\s*=/.test(attrs) || !/\bdata-duration\s*=/.test(attrs)) return full;
    // Skip the root composition element (timed, but not a track-bearing clip).
    if (/\bid\s*=\s*["']root["']/.test(attrs) || /\bclass\s*=\s*["'][^"']*\bcomposition\b[^"']*["']/.test(attrs)) return full;

    const sm = attrs.match(/\bdata-start\s*=\s*["']?(-?[\d.]+)/);
    const dm = attrs.match(/\bdata-duration\s*=\s*["']?(-?[\d.]+)/);
    if (!sm || !dm) return full;
    const start = parseFloat(sm[1]);
    const dur = parseFloat(dm[1]);
    if (!Number.isFinite(start) || !Number.isFinite(dur) || dur <= 0) return full;
    const end = start + dur;

    // Lowest track with no time-overlap (half-open intervals: touching is OK).
    let t = 0;
    while (tracks[t] && tracks[t].some(([s, e]) => start < e && s < end)) t++;
    (tracks[t] = tracks[t] || []).push([start, end]);

    const tm = attrs.match(/\bdata-track-index\s*=\s*["']?(-?\d+)["']?/);
    const cur = tm ? parseInt(tm[1], 10) : null;
    if (cur === t) return full; // already correct, leave verbatim
    changed = true;
    const selfClose = /\/>$/.test(full) ? " /" : "";
    let body = attrs.replace(/\s*\/$/, "");
    if (tm) body = body.replace(/\bdata-track-index\s*=\s*["']?-?\d+["']?/, `data-track-index="${t}"`);
    else body = `${body} data-track-index="${t}"`;
    return `<${name}${body}${selfClose}>`;
  });

  return { html: changed ? out : src, changed };
}

// Apply all safe normalizations. Returns { html, changed:[...] } so the caller
// can log what was touched.
function normalizeComposition(html) {
  const changed = [];
  let out = String(html);

  const afterFonts = stripExternalFonts(out);
  if (afterFonts !== out) { changed.push("stripped external fonts"); out = afterFonts; }

  const afterFamilies = normalizeFontFamilies(out);
  if (afterFamilies !== out) { changed.push("normalized font-family to system stack"); out = afterFamilies; }

  const afterClip = ensureClipClass(out);
  if (afterClip !== out) { changed.push("added missing class=\"clip\" to timed element(s)"); out = afterClip; }

  // Run AFTER ensureClipClass so newly-marked clips are also de-overlapped.
  const afterReflow = reflowTrackOverlaps(out);
  if (afterReflow.changed) { changed.push("reflowed clips off overlapping tracks"); out = afterReflow.html; }

  return { html: out, changed };
}

module.exports = { normalizeComposition, stripExternalFonts, ensureClipClass, reflowTrackOverlaps };
