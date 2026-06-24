import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { API_BASE, mediaUrl } from "../api.js";

// A muted/looped preview that only plays while it's on screen (saves battery
// and bandwidth) and falls back to its poster when paused or unsupported.
function PreviewVideo({ src, poster, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else { el.pause(); }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster || undefined}
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
    />
  );
}

export default function Gallery({ onOpen }) {
  const [projects, setProjects] = useState(null);
  const [packs, setPacks] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/projects`)
      .then((r) => r.json())
      .then((d) => setProjects((d.projects || []).filter((p) => p.videoUrl)))
      .catch(() => setProjects([]));

    // Seed: the page is NEVER empty — featured looks always render.
    fetch(`${API_BASE}/api/frames`)
      .then((r) => r.json())
      .then((d) => setPacks((d.packs || []).filter((p) => p.previewUrl)))
      .catch(() => setPacks([]));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      {/* ——— Featured looks (always present) ——— */}
      <section>
        <h2 className="font-display text-3xl font-bold">Featured looks</h2>
        <p className="mt-2 text-dim max-w-xl leading-relaxed">
          Ten art-directed design systems, each a finished film aesthetic. Hover or
          scroll to preview — then make one your own.
        </p>

        {packs === null ? (
          <div className="mt-8 text-dim">Loading featured looks…</div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {packs.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                className="overflow-hidden glass-card"
              >
                <div className="aspect-video bg-black relative overflow-hidden rounded-t-[21px]">
                  <PreviewVideo
                    src={mediaUrl(p.previewUrl)}
                    poster={mediaUrl(p.posterUrl)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="text-sm font-medium truncate">{p.label || p.name}</div>
                  {p.vibe && (
                    <p className="mt-1.5 text-[13px] text-dim leading-relaxed line-clamp-3">{p.vibe}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ——— Your films ——— */}
      <section className="mt-20">
        <h2 className="font-display text-3xl font-bold">Your films</h2>

        {projects === null ? (
          <div className="mt-8 text-dim">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="mt-4 glass-card p-6 text-dim leading-relaxed">
            Nothing here yet — the films you finish will land in this gallery. Pick a
            look above and make your first one.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p, i) => (
              <motion.button
                key={p.jobId}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                onClick={() => onOpen(p.jobId)}
                className="text-left overflow-hidden glass-card hover:border-accent/50 transition-colors group"
              >
                <div className="aspect-video bg-black relative overflow-hidden rounded-t-[21px]">
                  {/* Hover-scrub: muted autoplay on hover */}
                  <video
                    src={mediaUrl(p.videoUrl)}
                    poster={mediaUrl(p.videoUrl.replace(/\.mp4$/, ".jpg"))}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                </div>
                <div className="p-4">
                  <div className="text-sm font-medium truncate">{p.title || "Untitled"}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-dim">
                    {p.framePack || "—"} · {p.duration}s
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
