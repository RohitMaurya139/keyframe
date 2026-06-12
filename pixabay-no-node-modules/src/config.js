require('dotenv').config({ quiet: true });

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

module.exports = {
  port: num(process.env.PORT, 3000),
  lightpanda: {
    host: process.env.LIGHTPANDA_HOST || '127.0.0.1',
    port: num(process.env.LIGHTPANDA_PORT, 19333),
    /** Inactivity timeout (seconds) passed to Lightpanda serve() */
    timeout: num(process.env.LIGHTPANDA_TIMEOUT_SEC, 0) || undefined,
    obeyRobots: process.env.LIGHTPANDA_OBEY_ROBOTS === '1',
    disableHostVerification: process.env.LIGHTPANDA_DISABLE_TLS_VERIFY === '1',
  },
  browser: {
    navigationTimeoutMs: num(process.env.NAVIGATION_TIMEOUT_MS, 60_000),
    challengeWaitMs: num(process.env.CHALLENGE_WAIT_MS, 20_000),
    userAgent:
      process.env.PIXABAY_USER_AGENT ||
      'Mozilla/5.0 (compatible; PixabayAssetProxy/1.0; +https://pixabay.com)',
    /** Raw Cookie header value for pixabay.com (e.g. cf_clearance after solving challenge in a real browser) */
    cookieHeader: process.env.PIXABAY_COOKIE || '',
    /**
     * Opt-in: abort image/font requests during automation (can break Lightpanda CDP; default off).
     * Set SCRAPE_BLOCK_HEAVY=1 to enable.
     */
    scrapeBlockHeavyResources: process.env.SCRAPE_BLOCK_HEAVY === '1',
    /** Milliseconds to wait after closing a page before the next CDP target (Lightpanda quirk). */
    cdpSettleMs: num(process.env.CDP_SETTLE_MS, 100),
    /** Retries after transient Puppeteer / Lightpanda protocol errors. */
    maxRetries: num(process.env.BROWSER_MAX_RETRIES, 3),
  },
};
