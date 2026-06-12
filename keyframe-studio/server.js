// KEYFRAME Studio — URL -> cinematic script -> fully animated HTML page.
const express = require("express");
const path = require("node:path");

const config = require("./src/config");
const jobs = require("./src/jobs");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: `${config.server.maxBodyKb}kb` }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Kick off a generation job.
app.post("/api/generate", (req, res) => {
  const { url, requirements } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "body must include { url }" });
  }
  const job = jobs.newJob({ url, requirements: String(requirements || "").slice(0, 4000) });
  jobs.run(job); // fire-and-forget; client polls
  res.status(202).json({ id: job.id });
});

// Poll job status (UI polls this every ~1.5s).
app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "job not found" });
  res.json(jobs.publicView(job));
});

// Full script JSON (download button).
app.get("/api/jobs/:id/script", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job?.script) return res.status(404).json({ error: "script not ready" });
  res.setHeader("Content-Disposition", `attachment; filename="${job.id}-script.json"`);
  res.json(job.script);
});

app.use(express.static(path.join(config.paths.root, "public"), { index: "index.html" }));
app.use("/api", (_req, res) => res.status(404).json({ error: "not found" }));

app.listen(config.server.port, () => {
  console.log(`[keyframe-studio] listening on http://localhost:${config.server.port}`);
});
