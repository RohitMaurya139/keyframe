const config = require('./config');

/**
 * @param {string} url
 * @param {AbortSignal} [signal]
 */
async function fetchBinary(url, signal) {
  const headers = {
    'User-Agent': config.browser.userAgent,
    Accept: '*/*',
  };
  if (config.browser.cookieHeader.trim()) {
    headers.Cookie = config.browser.cookieHeader.trim();
  }
  const res = await fetch(url, { redirect: 'follow', headers, signal });
  if (!res.ok) {
    const err = new Error(`Upstream ${res.status}`);
    /** @type {any} */ (err).status = res.status;
    throw err;
  }
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const buf = Buffer.from(await res.arrayBuffer());
  const cd = res.headers.get('content-disposition');
  return { buf, contentType, contentDisposition: cd };
}

module.exports = { fetchBinary };
