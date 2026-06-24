import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getProject, mediaUrl } from "../api.js";

// The reveal: player with a curtain animation on first load, downloads,
// remix, and the cost/timing/attribution breakdown.
export default function Premiere({ projectId, onRemix, onNew }) {
  const [project, setProject] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  if (!project) return <div className="max-w-4xl mx-auto px-6 pt-20 text-dim">Loading…</div>;

  const cost = project.usage?.totalCostUsd;
  const secs = project.durationMs ? Math.round(project.durationMs / 1000) : null;

  // Per-video token consumption: LLM (script + planners + composer + QA + repairs)
  // plus the estimated TTS audio tokens. Output tokens dominate the cost.
  const llm = project.usage?.llm;
  const tts = project.usage?.tts;
  const totalTokens = llm
    ? llm.inputTokens + llm.outputTokens + ((tts?.inputTokensEst || 0) + (tts?.outputTokensEst || 0))
    : null;
  const fmt = (n) => Number(n).toLocaleString();

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-24">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-3xl font-bold">{project.script?.title || "Your film"}</h2>
        <div className="text-[10px] uppercase tracking-widest text-dim">
          {project.framePack} · {project.duration}s · {project.width}×{project.height}
        </div>
      </div>

      <div className="relative mt-6 rounded-2xl overflow-hidden border border-line bg-black shadow-[0_24px_60px_rgba(8,10,24,0.45)]">
        {project.videoUrl ? (
          <>
            <video src={mediaUrl(project.videoUrl)} controls className="w-full aspect-video" />
            {/* Curtain reveal on mount — midnight curtain for the premiere */}
            <motion.div initial={{ scaleY: 1 }} animate={{ scaleY: 0 }}
              transition={{ duration: 1.1, ease: [0.83, 0, 0.17, 1], delay: 0.35 }}
              style={{ originY: 0, background: "var(--color-night)" }}
              className="absolute inset-0 pointer-events-none" />
          </>
        ) : (
          <div className="aspect-video flex items-center justify-center text-dim text-sm">
            {project.status === "failed" ? `Failed: ${project.error}` : "No video yet."}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {project.videoUrl && (
          <a href={mediaUrl(project.videoUrl)} download className="btn-solstice uppercase text-xs">
            Download MP4
          </a>
        )}
        {project.srtUrl && (
          <a href={mediaUrl(project.srtUrl)} download
            className="px-6 py-3 rounded-xl border border-line text-xs uppercase tracking-widest hover:border-accent transition-colors">
            Captions .srt
          </a>
        )}
        {project.script && (
          <button onClick={onRemix}
            className="px-6 py-3 rounded-xl border border-line text-xs uppercase tracking-widest hover:border-accent transition-colors">
            ✂ Remix script
          </button>
        )}
        <button onClick={onNew}
          className="px-6 py-3 rounded-xl border border-line text-xs uppercase tracking-widest text-dim hover:text-ink transition-colors">
          + New video
        </button>
      </div>

      <button onClick={() => setDetailsOpen((v) => !v)}
        className="mt-8 text-[10px] uppercase tracking-widest text-dim hover:text-ink">
        {detailsOpen ? "▾ hide" : "▸ show"} production details
      </button>

      {detailsOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 glass-card p-5 text-sm space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Total cost" value={cost != null ? `$${Number(cost).toFixed(3)}` : "—"} />
            <Stat label="Production time" value={secs ? `${secs}s` : "—"} />
            <Stat label="Composition" value={project.finalAttempt || "—"} />
            <Stat
              label="Tokens used"
              value={totalTokens != null ? fmt(totalTokens) : "—"}
              sub={llm ? `${fmt(llm.inputTokens)} in · ${fmt(llm.outputTokens)} out · ${llm.callCount} calls` : null}
            />
          </div>
          {project.usage?.byStage?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-dim mb-2">Tokens by stage</div>
              <ul className="space-y-1">
                {project.usage.byStage.map((s) => (
                  <li key={s.stage} className="flex items-baseline justify-between gap-3 text-xs text-dim">
                    <span className="capitalize text-ink">{s.stage}</span>
                    <span className="flex-1 border-b border-line/40 translate-y-[-2px]" />
                    <span>{fmt(s.totalTokens)} tok · {s.callCount} {s.callCount === 1 ? "call" : "calls"} · ${Number(s.costUsd).toFixed(3)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {project.assets?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-dim mb-2">Asset attribution</div>
              <ul className="space-y-1">
                {project.assets.map((a, i) => (
                  <li key={i} className="text-xs text-dim">
                    {a.type} · {a.license} · {a.sourceUrl
                      ? <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-accent">{a.source}</a>
                      : a.source}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-dim">{label}</div>
      <div className="font-display font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-dim mt-0.5">{sub}</div>}
    </div>
  );
}
