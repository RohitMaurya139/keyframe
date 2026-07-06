// The storyboard contract — INTENTIONALLY identical in shape to what the existing
// scene-kit / LLM orchestrator already emits (server/src/services/scene_kit.js). The
// Three.js engine consumes the SAME JSON, so the brief/script/storyboard/asset/audio
// layers stay unchanged. Only the renderer swaps (renderEngine: "three").

export type SceneKind =
  | "hook" | "stat" | "cta" | "bullet" | "caption" | "quote"
  | "screenshot" | "terminal" | "split" | "logo" | "product";

export type AnimationMode =
  | "word-stagger" | "mask-reveal" | "blur-sharp" | "scale-pop"
  | "slide-up" | "slide-left" | "ken-burns-text" | "typewriter";

export type LayoutMode = "fullbleed" | "split-60-40" | "grid-2x2" | "centered-card";

export type TransitionOut =
  | "fade" | "slide-left" | "wipe" | "scale-through"
  | "flip3d" | "cube" | "door" | "none";

export type Beat = { at: number; action: string; easing?: string };

// Density blocks (content-density system): a scene should carry a hero + supporting copy +
// feature highlights + metrics, so it fills 70-85% of the frame instead of headline+subtitle.
export type Feature = { title: string; desc?: string };
export type Metric = { value: number; suffix?: string; prefix?: string; label: string };

export type SceneKind2 = SceneKind | "feature" | "dashboard" | "comparison";

export type Scene = {
  id: string;
  kind: SceneKind | "feature" | "dashboard" | "comparison";
  start: number;      // seconds (absolute in the film)
  duration: number;   // seconds
  headline: string;
  emphasis?: string;  // substring of headline to accent (gradient-fill)
  subtext?: string;
  paragraph?: string; // supporting paragraph (1-2 sentences)
  features?: Feature[]; // 3-5 feature highlights
  metrics?: Metric[];   // relevant metrics (counter-animated)
  bullets?: string[];
  kicker?: string;
  animation?: AnimationMode;
  layout?: LayoutMode;
  beats?: Beat[];
  transitionOut?: TransitionOut;
  visualMotif?: string;
  assetPath?: string;      // screenshot/logo/video (resolved by the asset layer)
  assetDataUri?: string;   // base64 data-URI of the bound user asset (logo/image) for the 3D engine
};

export type Storyboard = {
  title: string;
  durationSec: number;
  framePack: string;
  brandColors?: string[];   // hex; seeds theme accents (from website scrape / logo)
  palette?: { background?: string; accent?: string; primary?: string; text?: string };
  watermarkDataUri?: string; // user logo → persistent corner watermark across the film
  scenes: Scene[];
};

// ---- sample storyboard: the Linear intro we reverse-engineered from j6jjiup2op.mp4 ----
// (Phase 1 renders scene 1 fully; the rest are here to prove the mapping scales.)
export const SAMPLE_STORYBOARD: Storyboard = {
  title: "KEYFRAME — AI video studio",
  durationSec: 19,
  framePack: "midnight-glass",
  brandColors: ["#5E6AD2", "#37E6FF", "#0B0F19"],
  scenes: [
    {
      id: "s1",
      kind: "ai-studio",
      start: 0,
      duration: 4.5,
      kicker: "Under the hood",
      headline: "Meet your AI production studio",
      emphasis: "production studio",
      features: [{ title: "Script Writer" }, { title: "Storyboard" }, { title: "Scene Planner" }, { title: "Asset Analyzer" }, { title: "Motion Designer" }, { title: "Voice Agent" }, { title: "Render Agent" }],
      animation: "word-stagger",
      transitionOut: "scale-through",
    },
    {
      id: "s2",
      kind: "timeline",
      start: 4.5,
      duration: 5,
      kicker: "How it flows",
      headline: "From idea to finished video",
      emphasis: "finished video",
      features: [
        { title: "Describe", desc: "Type a prompt or drop a URL." },
        { title: "Direct", desc: "The AI plans the story." },
        { title: "Build", desc: "Templates assemble the scenes." },
        { title: "Render", desc: "A finished MP4 in minutes." },
      ],
      animation: "slide-left",
      transitionOut: "wipe",
    },
    {
      id: "s3",
      kind: "testimonial",
      start: 9.5,
      duration: 4.5,
      kicker: "Loved by teams",
      headline: "Teams ship faster with KEYFRAME",
      emphasis: "faster",
      features: [
        { title: "Turned our landing page into a launch video in minutes.", desc: "Priya S." },
        { title: "Like having a motion designer on the team, 24/7.", desc: "Marcus L." },
        { title: "Every video comes out on-brand.", desc: "Dana R." },
      ],
      animation: "scale-pop",
      transitionOut: "scale-through",
    },
    {
      id: "s4",
      kind: "gallery",
      start: 14,
      duration: 5,
      kicker: "Showcase",
      headline: "Made with KEYFRAME",
      emphasis: "KEYFRAME",
      features: [{ title: "Product launch" }, { title: "Feature demo" }, { title: "Brand intro" }, { title: "Explainer" }, { title: "Ad creative" }],
      animation: "ken-burns-text",
      transitionOut: "none",
    },
  ],
};
