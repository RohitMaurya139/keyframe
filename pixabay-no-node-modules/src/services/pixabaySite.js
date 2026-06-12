const config = require('../config');

/** @typedef {'vectors' | 'videos' | 'music' | 'sound-effects'} AssetCategory */

const CATEGORY_PATH = {
  vectors: 'vectors',
  videos: 'videos',
  music: 'music',
  'sound-effects': 'sound-effects',
};

/**
 * @param {AssetCategory} category
 * @param {string} query
 * @param {number} page
 */
function buildSearchUrl(category, query, page) {
  const segment = CATEGORY_PATH[category];
  const q = encodeURIComponent((query || '').trim() || ' ');
  const p = Math.max(1, Math.floor(page || 1));
  const base = `https://pixabay.com/${segment}/search/${q}/`;
  return p > 1 ? `${base}?p=${p}` : base;
}

/**
 * @param {AssetCategory} category
 * @param {string} id
 */
function buildDetailUrl(category, id) {
  const segment = CATEGORY_PATH[category];
  return `https://pixabay.com/${segment}/${String(id).replace(/\D/g, '')}/`;
}

/**
 * Wait until Cloudflare interstitial title clears or timeout.
 * @param {import('puppeteer-core').Page} page
 */
async function waitPastChallenge(page) {
  const max = config.browser.challengeWaitMs;
  const start = Date.now();
  while (Date.now() - start < max) {
    const title = await page.title().catch(() => '');
    if (!/just a moment/i.test(title)) break;
    await new Promise((r) => setTimeout(r, 800));
  }
}

/**
 * Heuristic: flatten nested JSON that might list hits.
 * @param {unknown} body
 * @returns {unknown[]}
 */
function flattenHitLikeArrays(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const o = /** @type {Record<string, unknown>} */ (body);
    for (const key of ['hits', 'results', 'items', 'data', 'media']) {
      const v = o[key];
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
    }
  }
  return [];
}

/**
 * @param {unknown[]} rows
 * @param {AssetCategory} category
 */
function mapJsonRowsToItems(rows, category) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (row);
    const id =
      r.id ??
      r.mediaId ??
      r.imageId ??
      r.videoId ??
      r.soundId ??
      r.trackId;
    if (id == null) continue;
    const sid = String(id);
    if (seen.has(sid)) continue;
    seen.add(sid);
    const pageURL =
      (typeof r.pageURL === 'string' && r.pageURL) ||
      (typeof r.url === 'string' && r.url) ||
      buildDetailUrl(category, sid);
    const previewURL =
      (typeof r.previewURL === 'string' && r.previewURL) ||
      (typeof r.thumbnail === 'string' && r.thumbnail) ||
      (typeof r.thumbnailUrl === 'string' && r.thumbnailUrl) ||
      undefined;
    const user = typeof r.user === 'string' ? r.user : typeof r.userName === 'string' ? r.userName : undefined;
    out.push({
      id: sid,
      pageURL,
      previewURL,
      user,
    });
  }
  return out;
}

/**
 * @param {import('puppeteer-core').Page} page
 * @param {AssetCategory} category
 */
async function extractItemsFromDom(page, category) {
  const segment = CATEGORY_PATH[category];
  return page.evaluate((seg) => {
    const esc = seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pathRe = new RegExp(`/${esc}/[^/?#]+-(\\d+)/?$`);
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="pixabay.com"]')) {
      const href = a.href || '';
      if (!href.includes(`/${seg}/`)) continue;
      const m = href.split('?')[0].match(pathRe);
      if (!m) continue;
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const title = (a.getAttribute('title') || a.textContent || '').trim().replace(/\s+/g, ' ');
      out.push({
        id,
        pageURL: href.split('?')[0],
        title: title.slice(0, 300),
      });
    }
    return out;
  }, segment);
}

/**
 * @param {import('puppeteer-core').Page} page
 * @param {AssetCategory} category
 * @param {{ q: string, page: number }} opts
 */
async function searchWithNetwork(page, category, opts) {
  const url = buildSearchUrl(category, opts.q, opts.page);
  const jsonBodies = [];
  const onResponse = async (res) => {
    try {
      const u = res.url();
      if (!u.includes('pixabay.com')) return;
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) return;
      const txt = await res.text();
      if (txt.length < 2 || txt.length > 2_000_000) return;
      let body;
      try {
        body = JSON.parse(txt);
      } catch {
        return;
      }
      jsonBodies.push({ url: u, body });
    } catch {
      /* ignore */
    }
  };
  page.on('response', onResponse);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await waitPastChallenge(page);
    const t0 = await page.title().catch(() => '');
    const stillChallenge = /just a moment/i.test(t0);
    await page
      .waitForNetworkIdle({ idleTime: 400, timeout: stillChallenge ? 4_000 : 20_000 })
      .catch(() => {});
    const pageTitle = await page.title().catch(() => '');
    let merged = [];
    for (const { body } of jsonBodies) {
      const rows = flattenHitLikeArrays(body);
      merged = merged.concat(mapJsonRowsToItems(rows, category));
    }
    const byId = new Map(merged.map((i) => [i.id, i]));
    const domItems = await extractItemsFromDom(page, category);
    for (const d of domItems) {
      if (!byId.has(d.id)) byId.set(d.id, { id: d.id, pageURL: d.pageURL, title: d.title });
    }
    return {
      url,
      pageTitle,
      challengeLikely: /just a moment/i.test(pageTitle),
      items: [...byId.values()],
      jsonSources: jsonBodies.map((j) => j.url),
    };
  } finally {
    page.off('response', onResponse);
  }
}

/**
 * Resolve a direct file URL from a detail page (best-effort).
 * @param {import('puppeteer-core').Page} page
 * @param {AssetCategory} category
 * @param {string} id
 */
async function resolveDownloadUrl(page, category, id) {
  const detail = buildDetailUrl(category, id);
  const candidates = [];
  const onResponse = async (res) => {
    try {
      const u = res.url();
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      const cd = res.headers()['content-disposition'] || '';
      if (
        ct.includes('octet-stream') ||
        ct.includes('audio/') ||
        ct.includes('video/') ||
        ct.includes('image/svg') ||
        cd.includes('attachment')
      ) {
        candidates.push({ url: u, contentType: ct });
      }
    } catch {
      /* ignore */
    }
  };
  page.on('response', onResponse);
  try {
    await page.goto(detail, { waitUntil: 'domcontentloaded' });
    await waitPastChallenge(page);
    const t0 = await page.title().catch(() => '');
    const stillChallenge = /just a moment/i.test(t0);
    await page
      .waitForNetworkIdle({ idleTime: 400, timeout: stillChallenge ? 4_000 : 20_000 })
      .catch(() => {});

    await page
      .evaluate(() => {
        const nodes = [...document.querySelectorAll('button, a')];
        for (const el of nodes) {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (/free\s*download/i.test(t)) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return;
          }
        }
      })
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 2500));

    const fromDom = await page.evaluate(() => {
      const found = [];
      for (const sel of ['a[download]', 'a[href*="download"]', 'a[href*="/get/"]']) {
        for (const a of document.querySelectorAll(sel)) {
          const href = a.getAttribute('href');
          if (!href || !/^https?:/i.test(href)) continue;
          if (/\/users\/|\/accounts?\//i.test(href)) continue;
          found.push(href.split('#')[0]);
        }
      }
      return [...new Set(found)];
    });
    for (const u of fromDom) candidates.push({ url: u, contentType: '' });

    return {
      detailUrl: detail,
      candidates: candidates.slice(0, 20),
      pageTitle: await page.title().catch(() => ''),
    };
  } finally {
    page.off('response', onResponse);
  }
}

module.exports = {
  CATEGORY_PATH,
  buildSearchUrl,
  buildDetailUrl,
  searchWithNetwork,
  resolveDownloadUrl,
};
