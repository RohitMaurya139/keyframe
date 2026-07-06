// Iconify ICON source — 200k+ open-license icons via the keyless public API
// (https://iconify.design). Closes the Area-1 gap where icon needs had NO external
// source and degraded to off-topic photos.
//
// Icons are fetched as a COLOR-BAKED SVG (via the API's ?color= param, which replaces
// currentColor in the returned markup). The scene-kit renders vector assets via <img src>,
// and while an <img> SVG can't INHERIT css color, a baked color renders fine — so the icon
// shows in the pack accent, visible on any ground. (The public API serves SVG, not PNG.)
// SVGs render via <img> exactly like the curated-library SVGs already do.

const { UA } = require("./util");

const SEARCH_URL = "https://api.iconify.design/search";
const RENDER_BASE = "https://api.iconify.design";
// Prefer a few clean, uniform families so icons across one film share a visual style;
// fall back to ANY family when these don't cover the concept (relevance > uniformity).
const PREFERRED = ["lucide", "tabler", "ph", "mdi", "solar", "heroicons"];

function withTimeout(promise, ms = 8000) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`iconify timeout after ${ms}ms`)), ms);
    if (t.unref) t.unref();
  });
  return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(t)), timeout]);
}

function prefixOf(name) { const i = String(name).indexOf(":"); return i > 0 ? name.slice(0, i) : ""; }

// Rank icon names: PREFERRED families first (in listed order), original relevance order within.
function rankByFamily(icons) {
  const rankOf = (n) => { const p = PREFERRED.indexOf(prefixOf(n)); return p < 0 ? PREFERRED.length : p; };
  return icons
    .map((n, i) => ({ n, i, r: rankOf(n) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.n);
}

// Search Iconify for icon names ("prefix:name") matching the query, ranked by family.
// Returns [] on any failure (keyless, so callers degrade to a motif, never a hard error).
async function search(query, { limit = 24 } = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("query", q);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 999)));
    const resp = await withTimeout(fetch(url.toString(), { headers: { "User-Agent": UA } }));
    if (!resp.ok) return [];
    const data = await resp.json();
    const icons = Array.isArray(data && data.icons)
      ? data.icons.filter((n) => typeof n === "string" && n.includes(":"))
      : [];
    return rankByFamily(icons);
  } catch { return []; }
}

// Color-baked SVG render URL for an icon name ("prefix:name"). The ?color= param bakes the
// color into the returned SVG (replaces currentColor). `color` accepts "#RRGGBB" or "RRGGBB".
function svgUrl(name, { height = 512, color } = {}) {
  const i = String(name).indexOf(":");
  if (i <= 0) return null;
  const prefix = name.slice(0, i), icon = name.slice(i + 1);
  const url = new URL(`${RENDER_BASE}/${encodeURIComponent(prefix)}/${encodeURIComponent(icon)}.svg`);
  url.searchParams.set("height", String(height));
  if (color) url.searchParams.set("color", String(color).startsWith("#") ? String(color) : `#${color}`);
  return url.toString();
}

module.exports = { search, svgUrl, rankByFamily, PREFERRED };
