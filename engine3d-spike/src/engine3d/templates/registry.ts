// KEYFRAME Template Library — the single source of truth mapping template IDs → scene
// components + metadata. The AI Director selects a TEMPLATE (by intent/keywords); the visual
// structure comes from these professionally-built templates, not from scratch each time.
//
// Status: "ready" = dedicated production component. "planned" = intent exists and renders via
// the nearest ready component until a dedicated one is built (so nothing is ever un-renderable).
import type React from "react";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";

import { HookScene } from "../scenes/HookScene";
import { StatScene } from "../scenes/StatScene";
import { CtaScene } from "../scenes/CtaScene";
import { Feature3DScene } from "../scenes/Feature3DScene";
import { FeatureGridScene } from "../scenes/FeatureGridScene";
import { DashboardScene } from "../scenes/DashboardScene";
import { ComparisonScene } from "../scenes/ComparisonScene";
import { WorkflowScene } from "../scenes/WorkflowScene";
import { UrlToVideoScene } from "../scenes/UrlToVideoScene";
import { PromptToVideoScene } from "../scenes/PromptToVideoScene";
import { AiStudioScene } from "../scenes/AiStudioScene";
import { TimelineScene } from "../scenes/TimelineScene";
import { TestimonialScene } from "../scenes/TestimonialScene";
import { GalleryScene } from "../scenes/GalleryScene";
import { LogoRevealScene } from "../scenes/LogoRevealScene";
import { ImageHeroScene } from "../scenes/ImageHeroScene";

export type SceneComponent = React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }>;

export type TemplateId =
  | "hero" | "url-to-video" | "prompt-to-video" | "asset-showcase" | "feature"
  | "dashboard" | "workflow" | "ai-studio" | "before-after" | "stat"
  | "timeline" | "testimonial" | "comparison" | "gallery" | "cta"
  | "feature-dom";

export type TemplateDef = {
  id: TemplateId;
  component: SceneComponent;
  status: "ready" | "planned";
  purpose: string;
  keywords: string[];        // AI Director selection signals
  kinds: string[];           // storyboard scene.kind values that route here
  defaultDurationSec: number;
};

// The 15+ library. `component` for a "planned" template points at the nearest ready one.
export const TEMPLATES: TemplateDef[] = [
  { id: "hero", component: HookScene, status: "ready", purpose: "Product/brand intro & opening", keywords: ["intro", "meet", "welcome", "introducing", "reveal", "brand"], kinds: ["hook", "title"], defaultDurationSec: 5 },
  { id: "prompt-to-video", component: PromptToVideoScene, status: "ready", purpose: "Show prompt→script→storyboard→video generation", keywords: ["prompt", "type", "describe", "generate from text"], kinds: ["prompt-to-video"], defaultDurationSec: 5 },
  { id: "url-to-video", component: UrlToVideoScene, status: "ready", purpose: "Show website→screenshot→scenes transformation", keywords: ["website", "url", "link", "scrape", "webpage"], kinds: ["url-to-video"], defaultDurationSec: 5 },
  { id: "asset-showcase", component: ImageHeroScene, status: "ready", purpose: "Show uploaded logos/images/screenshots", keywords: ["upload", "asset", "logo", "brand kit", "screenshot", "photo"], kinds: ["product", "screenshot", "image", "photo", "graphic"], defaultDurationSec: 4 },
  { id: "feature", component: Feature3DScene, status: "ready", purpose: "Capabilities as 3D feature cards", keywords: ["feature", "capabilities", "what you can do", "everything"], kinds: ["feature", "bullet", "caption"], defaultDurationSec: 4.5 },
  { id: "feature-dom", component: FeatureGridScene, status: "ready", purpose: "Feature cards (DOM variant, adds paragraph + metrics)", keywords: [], kinds: ["feature-dom"], defaultDurationSec: 4.5 },
  { id: "dashboard", component: DashboardScene, status: "ready", purpose: "Analytics / product UI with charts", keywords: ["dashboard", "analytics", "metrics", "insights", "data", "funnel"], kinds: ["dashboard"], defaultDurationSec: 4.5 },
  { id: "workflow", component: WorkflowScene, status: "ready", purpose: "How it works — connected nodes + data flow", keywords: ["how it works", "workflow", "pipeline", "process", "steps", "flow"], kinds: ["workflow"], defaultDurationSec: 4.5 },
  { id: "ai-studio", component: AiStudioScene, status: "ready", purpose: "Internal AI agents network", keywords: ["agents", "ai studio", "under the hood", "director", "orchestrat"], kinds: ["ai-studio"], defaultDurationSec: 4.5 },
  { id: "before-after", component: ComparisonScene, status: "ready", purpose: "Transformation / before vs after", keywords: ["before", "after", "transform", "old way", "used to"], kinds: ["before-after"], defaultDurationSec: 4.5 },
  { id: "comparison", component: ComparisonScene, status: "ready", purpose: "Us vs them / comparison grid", keywords: ["vs", "versus", "compare", "traditional", "instead of"], kinds: ["comparison"], defaultDurationSec: 4.5 },
  { id: "stat", component: StatScene, status: "ready", purpose: "A hero metric / statistic", keywords: ["faster", "%", "x faster", "500+", "hours saved", "stat"], kinds: ["stat", "chart"], defaultDurationSec: 3.5 },
  { id: "timeline", component: TimelineScene, status: "ready", purpose: "Narrative timeline of events", keywords: ["timeline", "roadmap", "journey", "history", "over time"], kinds: ["timeline"], defaultDurationSec: 5 },
  { id: "testimonial", component: TestimonialScene, status: "ready", purpose: "Social proof / quotes", keywords: ["testimonial", "review", "loved by", "customers say", "quote"], kinds: ["testimonial", "quote"], defaultDurationSec: 4.5 },
  { id: "gallery", component: GalleryScene, status: "ready", purpose: "Showcase of multiple outputs", keywords: ["gallery", "showcase", "examples", "made with"], kinds: ["gallery"], defaultDurationSec: 5 },
  { id: "cta", component: CtaScene, status: "ready", purpose: "Closing call to action", keywords: ["get started", "try", "sign up", "start free", "join", "today"], kinds: ["cta"], defaultDurationSec: 3.5 },
];

// logo has a dedicated component distinct from the generic asset-showcase image hero
const KIND_COMPONENT: Record<string, SceneComponent> = (() => {
  const m: Record<string, SceneComponent> = { logo: LogoRevealScene };
  for (const t of TEMPLATES) for (const k of t.kinds) if (!m[k]) m[k] = t.component;
  return m;
})();

export function componentForKind(kind: string): SceneComponent {
  return KIND_COMPONENT[kind] || HookScene;
}

// AI Director helper: map free text (a scene's intent/headline) → the best-fit template id.
export function selectTemplate(text: string): TemplateId {
  const t = String(text || "").toLowerCase();
  let best: TemplateId = "feature", score = 0;
  for (const tpl of TEMPLATES) {
    const s = tpl.keywords.reduce((a, k) => a + (t.includes(k) ? 1 : 0), 0);
    if (s > score) { score = s; best = tpl.id; }
  }
  return best;
}

export const TEMPLATE_KINDS = TEMPLATES.flatMap((t) => t.kinds);
