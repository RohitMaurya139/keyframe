const { lightpanda } = require('@lightpanda/browser');
const puppeteer = require('puppeteer-core');
const config = require('../config');

let cdpProcess = null;
let connectPromise = null;
let browserInstance = null;

/** Serialize CDP page work — Lightpanda errors if multiple Target.createTarget overlap. */
let cdpTail = Promise.resolve();

async function ensureCdpServer() {
  if (cdpProcess && !cdpProcess.killed) return cdpProcess;
  const { host, port, timeout, obeyRobots, disableHostVerification } = config.lightpanda;
  cdpProcess = await lightpanda.serve({
    host,
    port,
    ...(timeout ? { timeout } : {}),
    obeyRobots,
    disableHostVerification,
  });
  cdpProcess.on('exit', () => {
    cdpProcess = null;
    browserInstance = null;
    connectPromise = null;
  });
  return cdpProcess;
}

async function getBrowser() {
  await ensureCdpServer();
  if (browserInstance && browserInstance.isConnected()) return browserInstance;
  if (!connectPromise) {
    const { host, port } = config.lightpanda;
    const browserURL = `http://${host}:${port}`;
    connectPromise = puppeteer.connect({ browserURL }).then((b) => {
      browserInstance = b;
      return b;
    });
  }
  return connectPromise;
}

async function resetBrowserConnection() {
  if (browserInstance) {
    try {
      await browserInstance.disconnect();
    } catch {
      /* ignore */
    }
    browserInstance = null;
  }
  connectPromise = null;
}

function isTransientCdpError(err) {
  return /TargetAlreadyLoaded|Target closed|Protocol error|createTarget|Connection closed|ECONNRESET|socket hang up|websocket/i.test(
    String(err && err.message ? err.message : err),
  );
}

/**
 * @param {(page: import('puppeteer-core').Page) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function runWithPage(fn) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    page.setDefaultNavigationTimeout(config.browser.navigationTimeoutMs);
    await page.setUserAgent(config.browser.userAgent);

    if (config.browser.scrapeBlockHeavyResources) {
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const rt = request.resourceType();
        if (rt === 'image' || rt === 'font') {
          request.abort().catch(() => {});
          return;
        }
        request.continue().catch(() => {});
      });
    }

    const cookie = config.browser.cookieHeader.trim();
    if (cookie) {
      const pairs = cookie.split(';').map((s) => s.trim()).filter(Boolean);
      const cookies = pairs.map((pair) => {
        const eq = pair.indexOf('=');
        const name = eq === -1 ? pair : pair.slice(0, eq).trim();
        const value = eq === -1 ? '' : pair.slice(eq + 1).trim();
        return { name, value, domain: '.pixabay.com', path: '/' };
      });
      if (cookies.length) await page.setCookie(...cookies);
    }
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
    const settle = config.browser.cdpSettleMs;
    if (settle > 0) await new Promise((r) => setTimeout(r, settle));
  }
}

/**
 * @param {(page: import('puppeteer-core').Page) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withPage(fn) {
  const max = Math.max(1, config.browser.maxRetries || 3);
  const job = async () => {
    let lastErr;
    for (let attempt = 0; attempt < max; attempt += 1) {
      try {
        return await runWithPage(fn);
      } catch (err) {
        lastErr = err;
        const retry = attempt < max - 1 && isTransientCdpError(err);
        if (retry) {
          await resetBrowserConnection();
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  };
  const p = cdpTail.then(job, job);
  cdpTail = p.then(
    () => {},
    () => {},
  );
  return p;
}

async function shutdown() {
  if (browserInstance) {
    await browserInstance.disconnect().catch(() => {});
    browserInstance = null;
    connectPromise = null;
  }
  if (cdpProcess && !cdpProcess.killed) {
    cdpProcess.kill('SIGTERM');
    cdpProcess = null;
  }
}

module.exports = {
  withPage,
  shutdown,
  getBrowser,
};
