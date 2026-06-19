const fs = require("node:fs");
const path = require("node:path");
const { cinematicCheck, safeAreaCheck, findChromium } = require("../cinematic_lint");
const { buildFallback } = require("../fallback");

const dir = __dirname;
const goldenPath = path.join(dir, "flagship_golden.html");
const badPath = path.join(dir, "slideshow_bad.html");
const golden = fs.readFileSync(goldenPath, "utf8");
const bad = fs.readFileSync(badPath, "utf8");

const goldenScenes = [
  { id: "s1", start: 0, duration: 4.4 },
  { id: "s2", start: 4.4, duration: 3.9 },
  { id: "s3", start: 8.3, duration: 3.7 },
];
const badScenes = [
  { id: "s1", start: 0, duration: 4 },
  { id: "s2", start: 4, duration: 4 },
  { id: "s3", start: 8, duration: 4 },
];

function line(s) { console.log(s); }

(async () => {
  let pass = true;

  line("=== cinematicCheck: GOLDEN (expect 0 errors) ===");
  const g = cinematicCheck(golden, { duration: 12, scenes: goldenScenes, assets: [] });
  line(`  errors:   ${g.errors.length}`); g.errors.forEach((e) => line("    ✗ " + e));
  line(`  warnings: ${g.warnings.length}`); g.warnings.forEach((w) => line("    · " + w));
  if (g.errors.length !== 0) { pass = false; line("  >>> FAIL: golden should have 0 cinematic errors"); }

  line("\n=== cinematicCheck: SLIDESHOW (expect several errors) ===");
  const b = cinematicCheck(bad, { duration: 12, scenes: badScenes, assets: [] });
  line(`  errors:   ${b.errors.length}`); b.errors.forEach((e) => line("    ✗ " + e));
  if (b.errors.length < 3) { pass = false; line("  >>> FAIL: slideshow should be flagged with several errors"); }

  line("\n=== cinematicCheck: deterministic FALLBACK (informational) ===");
  const fb = buildFallback({ prompt: "A launch video for an AI notes app.\n\nCapture ideas instantly.\n\nTry it free.", duration: 18, orientation: "horizontal", width: 1920, height: 1080, fps: 30 });
  const fbHasInfiniteRepeat = /repeat:\s*-1/.test(fb.indexHtml);
  line(`  fallback repeat:-1 present? ${fbHasInfiniteRepeat} (should be false)`);
  if (fbHasInfiniteRepeat) { pass = false; line("  >>> FAIL: fallback still emits repeat:-1"); }
  const f = cinematicCheck(fb.indexHtml, { duration: 18, scenes: [], assets: [] });
  line(`  fallback cinematic errors: ${f.errors.length} (fallback is the emergency path; it is not gated)`);
  f.errors.forEach((e) => line("    · " + e));

  const exe = findChromium();
  line(`\n=== safeAreaCheck (headless geometry) — chromium: ${exe ? "found" : "NOT found (skipping)"} ===`);
  if (exe) {
    const gs = await safeAreaCheck(goldenPath, { width: 1920, height: 1080, scenes: goldenScenes, executablePath: exe });
    line(`  GOLDEN: ok=${gs.ok} violations=${gs.violations.length}`);
    gs.violations.slice(0, 6).forEach((v) => line(`    ✗ [${v.edges}] <${v.tag}> "${v.text}"`));
    if (!gs.ok) { pass = false; line("  >>> FAIL: golden should be inside the safe area"); }

    const bs = await safeAreaCheck(badPath, { width: 1920, height: 1080, scenes: badScenes, executablePath: exe });
    line(`  SLIDESHOW: ok=${bs.ok} violations=${bs.violations.length}`);
    bs.violations.slice(0, 6).forEach((v) => line(`    ✗ [${v.edges}] <${v.tag}> "${v.text}"`));
    if (bs.ok) { pass = false; line("  >>> FAIL: slideshow text spans full width and should violate the safe area"); }
  }

  line(`\n=== RESULT: ${pass ? "PASS ✅ — cinematic gate discriminates correctly" : "FAIL ❌"} ===`);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error("harness error:", e); process.exit(1); });
