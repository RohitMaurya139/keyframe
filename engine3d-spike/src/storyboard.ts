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
  title: "Flowbase — onboarding on autopilot",
  durationSec: 16,
  framePack: "midnight-glass",
  brandColors: ["#5E6AD2", "#37E6FF", "#0B0F19"],
  scenes: [
    {
      id: "s1",
      kind: "hook",
      start: 0,
      duration: 3.5,
      kicker: "Linear: system for teams and agents",
      headline: "Teams and agents",
      emphasis: "Teams and",
      subtext: "Built together",
      animation: "word-stagger",
      layout: "fullbleed",
      visualMotif: "constellation network with orbital rings",
      beats: [
        { at: 0.15, action: "kicker in", easing: "expo.out" },
        { at: 0.55, action: "headline stagger", easing: "power3.out" },
        { at: 1.5, action: "subtext + underline", easing: "power3.out" },
        { at: 3.1, action: "exit", easing: "power2.in" },
      ],
      transitionOut: "flip3d",
    },
    {
      id: "s2",
      kind: "dashboard",
      start: 3.5,
      duration: 4.5,
      kicker: "Real-time analytics",
      headline: "Your whole funnel, live",
      emphasis: "live",
      paragraph: "Watch signups turn into activated, paying customers — in real time, no spreadsheets.",
      metrics: [
        { value: 3, suffix: "x", label: "Faster onboarding" },
        { value: 68, suffix: "%", label: "Fewer drop-offs" },
      ],
      features: [
        { title: "Signups", desc: "1,284" },
        { title: "Activated", desc: "912" },
        { title: "Converted", desc: "437" },
      ],
      animation: "slide-left",
      transitionOut: "scale-through",
    },
    {
      id: "s3",
      kind: "feature",
      start: 8,
      duration: 4.5,
      kicker: "Everything you need",
      headline: "One platform, every workflow",
      emphasis: "every workflow",
      subtext: "Manual onboarding",
      features: [
        { title: "Automated workflows", desc: "Trigger onboarding steps automatically." },
        { title: "Real-time analytics", desc: "See activation and drop-off as it happens." },
        { title: "One-click integrations", desc: "Connect your stack in seconds." },
        { title: "Team collaboration", desc: "Assign, comment and ship together." },
      ],
      bullets: ["Manual data entry", "Days to onboard", "Disconnected tools", "Things slip through"],
      metrics: [{ value: 10, suffix: " min", label: "Time to onboard" }],
      animation: "slide-up",
      transitionOut: "wipe",
    },
    {
      id: "s4",
      kind: "cta",
      start: 12.5,
      duration: 3.5,
      headline: "Onboarding that scales itself",
      emphasis: "scales itself",
      subtext: "Start free",
      animation: "ken-burns-text",
      layout: "centered-card",
      beats: [{ at: 0.25, action: "headline in", easing: "power3.out" }],
      transitionOut: "none",
    },
  ],
};
