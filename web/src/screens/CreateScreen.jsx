import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createProject, listFrames, mediaUrl } from "../api.js";
import Landing from "./Landing.jsx";

const TABS = [
  { key: "prompt", label: "Prompt" },
  { key: "video", label: "Video" },
  { key: "url", label: "URL" },
];

// Hand-tuned identity chips for known packs; unknown packs get neutral.
const PACK_STYLES = {
  blockframe: { bg: "#FFFDF5", chips: ["#FE90E8", "#C0F7FE", "#99E885", "#F7CB46"], label: "#000000", vibe: "neo-brutalist candy" },
  "biennale-yellow": { bg: "#E9E5DB", chips: ["#F1EE2E", "#1B2566", "#E26B4A"], label: "#1B2566", vibe: "parchment editorial" },
  "midnight-glass": { bg: "#0A0F2A", chips: ["#00F0FF", "#7A5CFF", "#C7D6F0"], label: "#EAF2FF", vibe: "dark glass keynote" },
};

// Quick-start example prompts for the chip row under the textarea.
const EXAMPLE_PROMPTS = [
  "Launch a productivity app",
  "Promote a coffee brand",
  "Recap our Series A",
  "Explainer for a fintech",
];
const SURPRISE_PROMPT =
  "A 30-second cinematic launch film for an AI note-taking app called Lumen — fast kinetic typography, a warm sunrise-to-night palette, three crisp feature beats, and a confident closing call to action.";

// Three style previews shown in the hero strip to prove output above the fold.
const HERO_PREVIEWS = [
  { src: "/frames/blockframe/preview.mp4", poster: "/frames/blockframe/poster.jpg", label: "Blockframe" },
  { src: "/frames/noir-spotlight/preview.mp4", poster: "/frames/noir-spotlight/poster.jpg", label: "Noir Spotlight" },
  { src: "/frames/vapor-chrome/preview.mp4", poster: "/frames/vapor-chrome/poster.jpg", label: "Vapor Chrome" },
];

export default function CreateScreen({ onCreated }) {
  const [tab, setTab] = useState("prompt");
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(30);
  const [orientation, setOrientation] = useState("horizontal");
  const [framePack, setFramePack] = useState("auto");
  const [packs, setPacks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [isTouch, setIsTouch] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    listFrames().then((f) => setPacks(f.packs || [])).catch(() => {});
  }, []);

  // Touch / coarse-pointer devices have no hover, so previews play on scroll instead.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener ? mq.addEventListener("change", update) : mq.addListener(update);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", update) : mq.removeListener(update); };
  }, []);

  const canSubmit = !busy && (
    (tab === "prompt" && prompt.trim().length >= 10) ||
    (tab === "url" && /^https?:\/\/.+\..+/.test(url.trim())) ||
    (tab === "video" && file)
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const fields = {
        duration, orientation, quality: "720p", framePack,
        ...(prompt.trim().length >= 10 ? { prompt: prompt.trim() } : {}),
        ...(tab === "url" && url.trim() ? { websiteUrl: url.trim() } : {}),
        ...(tab === "video" && file ? { referenceVideo: file } : {}),
      };
      const r = await createProject(fields);
      onCreated(r.projectId);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="pt-16 pb-24">
      <div className="max-w-3xl mx-auto px-6">
      {/* Hero: headline + subcopy beside an autoplaying showreel that proves output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-center">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-5xl font-bold leading-tight tracking-tight"
          >
            Anything in.
            <br />
            <span className="text-accent-text">A designed film out.</span>
          </motion.h1>
          <p className="mt-4 text-dim max-w-lg">
            Type an idea, drop a reference video, or paste a website. KEYFRAME writes
            the script — you edit it — then it designs, voices, and renders the video.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
          className="glass-card overflow-hidden p-2"
        >
          <div className="relative rounded-xl overflow-hidden aspect-video bg-black/80">
            <video
              src={mediaUrl("/showcase.mp4")}
              poster={mediaUrl("/frames/aurora-spectrum/poster.jpg")}
              autoPlay muted loop playsInline preload="metadata"
              aria-label="KEYFRAME showreel — example films generated by KEYFRAME"
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-2 left-2 rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-widest text-white">
              Made with KEYFRAME
            </span>
          </div>
          {/* Compact strip of 3 style previews — the fold proves output */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {HERO_PREVIEWS.map((p) => (
              <div key={p.src} className="relative rounded-lg overflow-hidden aspect-video bg-black/80">
                <video
                  src={mediaUrl(p.src)}
                  poster={mediaUrl(p.poster)}
                  autoPlay muted loop playsInline preload="metadata"
                  aria-label={`${p.label} style preview`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Morphing input bar */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        className="mt-10 glass-card overflow-hidden"
      >
        <div className="flex border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative px-6 py-3 text-xs uppercase tracking-widest"
            >
              {tab === t.key && (
                <motion.div layoutId="tab-pill" className="absolute inset-0 bg-line rounded-full m-1" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className={`relative ${tab === t.key ? "text-accent-text" : "text-dim"}`}>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {tab === "prompt" && (
              <motion.textarea
                key="prompt"
                initial={{ opacity: 0, height: 90 }}
                animate={{ opacity: 1, height: 140 }}
                exit={{ opacity: 0, height: 90 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A 30-second launch video for…"
                className="inset-field w-full resize-none text-lg placeholder:text-dim px-4 py-3"
              />
            )}
            {tab === "url" && (
              <motion.div key="url" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-product.com"
                  className="inset-field w-full text-lg placeholder:text-dim px-4 py-3"
                />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Optional: anything specific you want the video to say?"
                  className="inset-field mt-3 w-full h-16 resize-none text-sm placeholder:text-dim px-4 py-2.5"
                />
              </motion.div>
            )}
            {tab === "video" && (
              <motion.div
                key="video"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
                className="border-2 border-dashed border-line rounded-xl py-10 text-center cursor-pointer hover:border-accent/40 transition-colors"
              >
                <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm" hidden
                  onChange={(e) => setFile(e.target.files?.[0] || null)} />
                {file
                  ? <p className="text-accent-text">{file.name} <span className="text-dim">({Math.round(file.size / 1048576)} MB)</span></p>
                  : <p className="text-dim">Drop a reference video<br /><span className="text-xs">mp4 / mov / webm · up to 200 MB · we transcribe and study its style</span></p>}
              </motion.div>
            )}
          </AnimatePresence>

          {tab === "prompt" && (
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Example prompts">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="chip"
                  aria-label={`Use example prompt: ${ex}`}
                >
                  {ex}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPrompt(SURPRISE_PROMPT)}
                className="chip"
                aria-label="Surprise me — fill in a fuller sample prompt"
              >
                ✦ Surprise me
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Options row — staggered entrance */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4" style={{ animation: "fadeUp .6s cubic-bezier(.16,1,.3,1) .16s both" }}>
          <div className="text-[10px] uppercase tracking-widest text-dim mb-2">Duration — {duration}s</div>
          <input type="range" min="10" max="60" step="5" value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full accent-[#ff6b57]" />
        </div>
        <div className="glass-card p-4" style={{ animation: "fadeUp .6s cubic-bezier(.16,1,.3,1) .24s both" }}>
          <div className="text-[10px] uppercase tracking-widest text-dim mb-2">Orientation</div>
          <div className="flex gap-2">
            {["horizontal", "vertical", "square"].map((o) => (
              <button key={o} onClick={() => setOrientation(o)}
                className={`flex items-center justify-center rounded-md border transition-all duration-300 ${orientation === o ? "border-accent shadow-[0_0_0_3px_rgba(255,107,87,.18)]" : "border-line hover:border-dim"}`}
                style={{ width: o === "vertical" ? 22 : o === "square" ? 30 : 42, height: o === "vertical" ? 36 : o === "square" ? 30 : 26 }}
                title={o}
                aria-label={`${o} orientation`}
                aria-pressed={orientation === o}
              />
            ))}
          </div>
        </div>
        {/* Script review is a guaranteed checkpoint — this card sets the
            expectation that you'll edit the script before anything renders. */}
        <div className="glass-card p-4 flex items-center gap-3" style={{ animation: "fadeUp .6s cubic-bezier(.16,1,.3,1) .32s both" }}>
          <div aria-hidden="true" className="shrink-0 w-8 h-8 rounded-full border border-accent/50 bg-accent/10 text-accent-text flex items-center justify-center text-sm">✓</div>
          <div>
            <div className="text-sm">Script review</div>
            <div className="text-[10px] text-dim">edit every line before we produce</div>
          </div>
        </div>
      </div>

      {error && <p className="mt-5 text-sm text-red-500">{error}</p>}

      {/* Primary CTA — highest-intent action, reachable before the long gallery */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={!canSubmit}
        onClick={submit}
        className="btn-solstice mt-6 w-full justify-center uppercase text-sm"
        style={{ animation: "fadeUp .6s cubic-bezier(.16,1,.3,1) .38s both" }}
      >
        {busy ? "Starting…" : "Make my film →"}
      </motion.button>

      {/* Template style gallery — pick a look, or let KEYFRAME choose */}
      <div className="mt-8" style={{ animation: "fadeUp .6s cubic-bezier(.16,1,.3,1) .4s both" }}>
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10px] uppercase tracking-widest text-dim">Template style</div>
          <div className="text-[10px] text-dim">{isTouch ? "tap to pick · scroll to preview · or let KEYFRAME choose" : "hover to preview · pick one or let KEYFRAME choose"}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <TemplateCard auto active={framePack === "auto"} onClick={() => setFramePack("auto")} isTouch={isTouch} />
          {packs.map((p) => (
            <TemplateCard
              key={p.name}
              active={framePack === p.name}
              onClick={() => setFramePack(framePack === p.name ? "auto" : p.name)}
              pack={p}
              fallback={PACK_STYLES[p.name]}
              isTouch={isTouch}
            />
          ))}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={!canSubmit}
        onClick={submit}
        className="btn-solstice mt-8 w-full justify-center uppercase text-sm"
        style={{ animation: "fadeUp .6s cubic-bezier(.16,1,.3,1) .48s both" }}
      >
        {busy ? "Starting…" : "Make my film →"}
      </motion.button>

      <p className="mt-16 text-center text-[11px] uppercase tracking-[0.3em] text-dim"
        style={{ animation: "softPulse 3.5s ease-in-out infinite" }}>
        ↓ scroll through a day at the studio ↓
      </p>
      </div>

      {/* The long landing — the sky follows the scroll from here to midnight. */}
      <Landing onStart={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
    </div>
  );
}

function TemplateCard({ auto, active, onClick, pack, fallback, isTouch }) {
  const vidRef = useRef(null);
  const cardRef = useRef(null);
  const label = auto ? "Auto" : (pack.label || pack.name);
  const vibe = auto ? "AI picks the best look for your script" : (pack.vibe || fallback?.vibe || "");
  const chips = auto
    ? ["#f5a623", "#2fb07b", "#3d8bd9", "#e86fa4"]
    : (pack.colors?.length ? pack.colors : (fallback?.chips || []));

  const onEnter = () => { const v = vidRef.current; if (v) v.play().catch(() => {}); };
  const onLeave = () => { const v = vidRef.current; if (v) { v.pause(); v.currentTime = 0; } };

  // On touch / coarse-pointer devices there's no hover — play the preview when the
  // card scrolls into view and pause it when it leaves. Poster stays as the fallback.
  useEffect(() => {
    if (!isTouch || auto || typeof IntersectionObserver === "undefined") return;
    const card = cardRef.current;
    if (!card) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = vidRef.current;
        if (!v) return;
        if (entry.isIntersecting) v.play().catch(() => {});
        else { v.pause(); v.currentTime = 0; }
      },
      { threshold: 0.6 }
    );
    io.observe(card);
    return () => io.disconnect();
  }, [isTouch, auto]);

  return (
    <motion.button
      ref={cardRef}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      onClick={onClick}
      onMouseEnter={isTouch ? undefined : onEnter}
      onMouseLeave={isTouch ? undefined : onLeave}
      aria-pressed={active}
      aria-label={auto
        ? `Auto style — let KEYFRAME pick the best look${active ? " (selected)" : ""}`
        : `${label} style${vibe ? ` — ${vibe}` : ""}${active ? " (selected)" : ""}`}
      className={`group relative rounded-2xl overflow-hidden border text-left transition-shadow duration-300 ${active ? "border-accent shadow-[0_8px_28px_rgba(255,107,87,.28)]" : "border-line hover:border-dim"}`}
    >
      <div className="relative aspect-video overflow-hidden bg-black/80">
        {!auto && pack.previewUrl ? (
          <video
            ref={vidRef}
            src={mediaUrl(pack.previewUrl)}
            poster={mediaUrl(pack.posterUrl) || undefined}
            muted loop playsInline preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: auto ? "linear-gradient(135deg,#f5a623,#e86fa4,#7b61c4)" : (fallback?.bg || "#15151f") }}
          >
            <span className="font-display uppercase text-[11px] tracking-widest" style={{ color: auto ? "#fff" : (fallback?.label || "#fff"), opacity: 0.92 }}>
              {auto ? "✦ Surprise me" : label}
            </span>
          </div>
        )}
        {active && (
          <div aria-hidden="true" className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent text-white text-[11px] flex items-center justify-center shadow">✓</div>
        )}
      </div>
      <div className="p-3" style={{ background: "var(--color-panel)", backdropFilter: "blur(10px)" }}>
        <div className="text-xs font-bold uppercase tracking-wider font-display text-ink truncate">{label}</div>
        {vibe && <div className="text-[10px] mt-0.5 text-dim truncate">{vibe}</div>}
        {chips.length > 0 && (
          <div className="flex gap-1 mt-2">
            {chips.slice(0, 5).map((c, i) => <span key={i} className="w-3 h-3 rounded-full border border-black/15" style={{ background: c }} />)}
          </div>
        )}
      </div>
    </motion.button>
  );
}
