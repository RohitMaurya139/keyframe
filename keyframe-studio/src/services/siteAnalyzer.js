// Fetches the target website and distills it into a compact brief the
// scriptwriter LLM can reason about: identity, copy, structure, brand colors.
// Dependency-free: regex extraction is good enough for a brief.

const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 25_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 KeyframeStudio/1.0";

function normalizeUrl(input) {
  let raw = String(input || "").trim();
  if (!raw) throw new Error("url is required");
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new Error("only http(s) URLs are supported");
  // Basic SSRF guard: refuse obvious local targets.
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" || host === "0.0.0.0" || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "[::1]"
  ) {
    throw new Error("local/private addresses are not allowed");
  }
  return u.toString();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) throw new Error(`site responded with HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html") && !type.includes("text")) {
      throw new Error(`URL is not an HTML page (content-type: ${type})`);
    }
    const text = await res.text();
    return text.slice(0, MAX_HTML_BYTES);
  } finally {
    clearTimeout(timer);
  }
}

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function textOf(fragment) {
  return decodeEntities(fragment.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function matchAll(re, html, group = 1, limit = 50) {
  const out = [];
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const v = textOf(m[group]);
    if (v) out.push(v);
  }
  return out;
}

function metaContent(html, nameOrProp) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']*)["']|` +
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProp}["']`, "i");
  const m = html.match(re);
  return m ? decodeEntities(m[1] || m[2] || "").trim() : "";
}

function extractColors(html) {
  const counts = new Map();
  const re = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\([\d\s.,%]+\)/g;
  let m;
  while ((m = re.exec(html))) {
    const c = m[0].toLowerCase();
    // Skip near-black/near-white noise so brand hues surface.
    if (/^#(fff|ffffff|000|000000|f{3,6}|0{3,6})$/.test(c)) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
}

/** Analyze a URL -> structured brief. */
async function analyze(inputUrl) {
  const url = normalizeUrl(inputUrl);
  const rawHtml = await fetchHtml(url);
  const html = strip(rawHtml);

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const brief = {
    url,
    domain: new URL(url).hostname,
    title: titleM ? textOf(titleM[1]) : "",
    description: metaContent(rawHtml, "description") || metaContent(rawHtml, "og:description"),
    ogTitle: metaContent(rawHtml, "og:title"),
    ogImage: metaContent(rawHtml, "og:image"),
    siteName: metaContent(rawHtml, "og:site_name"),
    themeColor: metaContent(rawHtml, "theme-color"),
    h1: matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, html, 1, 5),
    h2: matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, html, 1, 12),
    h3: matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, html, 1, 12),
    navLinks: matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi, html, 1, 40)
      .filter((t) => t.length > 1 && t.length < 40),
    buttons: matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi, html, 1, 12),
    brandColors: extractColors(rawHtml),
    bodyText: textOf(html.replace(/<(?:nav|header|footer)[\s\S]*?<\/(?:nav|header|footer)>/gi, " "))
      .slice(0, 4000),
  };
  if (!brief.title && !brief.bodyText) {
    throw new Error("could not extract any readable content from that URL");
  }
  return brief;
}

module.exports = { analyze, normalizeUrl };
