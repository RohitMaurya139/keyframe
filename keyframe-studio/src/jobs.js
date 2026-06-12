// In-memory job registry with per-job JSON persistence and the pipeline runner.
// Stages: analyze -> script -> assets -> compose -> done.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const config = require("./config");
const siteAnalyzer = require("./services/siteAnalyzer");
const scriptwriter = require("./services/scriptwriter");
const assets = require("./services/assets");
const composer = require("./services/composer");

const jobs = new Map();

const STAGES = ["queued", "analyzing", "scripting", "casting-assets", "composing", "done"];

function newJob({ url, requirements }) {
  const id = crypto.randomBytes(5).toString("hex");
  const job = {
    id,
    url,
    requirements: requirements || "",
    stage: "queued",
    stages: STAGES,
    error: null,
    createdAt: new Date().toISOString(),
    log: [],
    brief: null,
    script: null,
    engine: null,
    pageUrl: null,
  };
  jobs.set(id, job);
  return job;
}

function logTo(job, msg) {
  const line = `${new Date().toISOString().slice(11, 19)}  ${msg}`;
  job.log.push(line);
  console.log(`[job ${job.id}] ${msg}`);
}

function persist(job) {
  try {
    fs.mkdirSync(config.paths.jobsDir, { recursive: true });
    fs.writeFileSync(path.join(config.paths.jobsDir, `${job.id}.json`), JSON.stringify(job, null, 2));
  } catch (e) {
    console.warn(`[jobs] persist failed: ${e.message}`);
  }
}

async function run(job) {
  try {
    job.stage = "analyzing";
    logTo(job, `fetching & analyzing ${job.url}`);
    job.brief = await siteAnalyzer.analyze(job.url);
    job.url = job.brief.url;
    logTo(job, `brief ready — "${job.brief.title || job.brief.domain}", ${job.brief.brandColors.length} brand colors`);

    job.stage = "scripting";
    logTo(job, "writing the cinematic script (scenes, narration, audio, motion direction)…");
    job.script = await scriptwriter.write(job.brief, job.requirements);
    logTo(job, `script locked — "${job.script.meta.title}", ${job.script.scenes.length} scenes, ~${job.script.meta.durationSec}s`);

    job.stage = "casting-assets";
    logTo(job, "casting stock assets from Pixabay…");
    await assets.resolve(job.script);
    const hits = job.script.scenes.flatMap((s) => s.assets).filter((a) => a.resolved).length;
    logTo(job, hits ? `${hits} stock asset(s) cast` : "no stock key — switching to pure motion-graphics mode");

    job.stage = "composing";
    logTo(job, "composing the animated page (this is the long take — up to a few minutes)…");
    const { html, engine } = await composer.compose(job.script, job.url);
    job.engine = engine;

    fs.mkdirSync(config.paths.outputDir, { recursive: true });
    const file = path.join(config.paths.outputDir, `${job.id}.html`);
    fs.writeFileSync(file, html, "utf8");
    job.pageUrl = `/output/${job.id}.html`;

    job.stage = "done";
    logTo(job, `cut! page rendered by ${engine} engine -> ${job.pageUrl}`);
  } catch (e) {
    job.error = e.message;
    logTo(job, `FAILED: ${e.message}`);
  } finally {
    persist(job);
  }
}

function publicView(job) {
  // brief.bodyText is big; trim what the UI doesn't need.
  const { brief, ...rest } = job;
  return { ...rest, brief: brief ? { title: brief.title, domain: brief.domain, description: brief.description, brandColors: brief.brandColors } : null };
}

module.exports = { newJob, run, get: (id) => jobs.get(id), publicView };
