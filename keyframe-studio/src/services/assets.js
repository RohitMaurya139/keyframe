// Resolves the script's stock-asset search queries against the Pixabay API.
// Without an API key (or on any failure) it returns no URL for that asset and
// the composer falls back to pure CSS/SVG/canvas motion graphics — the page
// must look spectacular either way.

const config = require("../config");

const PIXABAY_IMG = "https://pixabay.com/api/";
const PIXABAY_VID = "https://pixabay.com/api/videos/";

async function searchPixabay(kind, query) {
  const key = config.assets.pixabayApiKey;
  if (!key) return null;
  const base = kind === "video" ? PIXABAY_VID : PIXABAY_IMG;
  const url = `${base}?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&safesearch=true&per_page=5&order=popular`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`pixabay HTTP ${res.status}`);
  const data = await res.json();
  const hit = data?.hits?.[0];
  if (!hit) return null;
  if (kind === "video") {
    const v = hit.videos?.medium || hit.videos?.small || hit.videos?.large;
    return v ? { url: v.url, width: v.width, height: v.height, credit: `Pixabay / ${hit.user}` } : null;
  }
  return {
    url: hit.largeImageURL || hit.webformatURL,
    width: hit.imageWidth,
    height: hit.imageHeight,
    credit: `Pixabay / ${hit.user}`,
  };
}

/** Walk every scene, resolve up to maxAssetsPerScene queries. Mutates+returns the script. */
async function resolve(script) {
  const cap = config.assets.maxAssetsPerScene;
  const tasks = [];
  for (const scene of script.scenes) {
    scene.assets = (scene.assets || []).slice(0, cap);
    for (const asset of scene.assets) {
      tasks.push(
        searchPixabay(asset.kind === "video" ? "video" : "image", asset.searchQuery)
          .then((hit) => { if (hit) Object.assign(asset, { resolved: hit }); })
          .catch((e) => console.warn(`[assets] "${asset.searchQuery}" failed: ${e.message}`))
      );
    }
  }
  await Promise.all(tasks);
  const resolved = script.scenes.flatMap((s) => s.assets).filter((a) => a.resolved).length;
  console.log(`[assets] resolved ${resolved} stock asset(s)${config.assets.pixabayApiKey ? "" : " (no Pixabay key — CSS/SVG graphics mode)"}`);
  return script;
}

module.exports = { resolve };
