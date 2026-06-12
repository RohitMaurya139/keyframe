// Loads config.json, applies env overrides, resolves paths, freezes.
const fs = require("node:fs");
const path = require("node:path");

const CONFIG_PATH = path.resolve(__dirname, "..", "config.json");

function build() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

  if (process.env.PORT) {
    const p = Number(process.env.PORT);
    if (Number.isFinite(p) && p > 0) cfg.server.port = p;
  }
  if (process.env.OPENROUTER_API_KEY) cfg.llm.apiKey = process.env.OPENROUTER_API_KEY;
  if (process.env.KIE_API_KEY && cfg.llm.primary) cfg.llm.primary.apiKey = process.env.KIE_API_KEY;
  if (process.env.PIXABAY_API_KEY) cfg.assets.pixabayApiKey = process.env.PIXABAY_API_KEY;

  if (!cfg.llm.apiKey) throw new Error("config: llm.apiKey missing and OPENROUTER_API_KEY not set");

  const root = path.resolve(__dirname, "..");
  cfg.paths.root = root;
  cfg.paths.jobsDir = path.resolve(root, cfg.paths.jobsDir);
  cfg.paths.outputDir = path.resolve(root, cfg.paths.outputDir);

  return Object.freeze(cfg);
}

module.exports = build();
