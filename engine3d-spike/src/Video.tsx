// Video — maps storyboard.scenes[] onto Remotion <Sequence>s, dispatches by `kind`, and wraps
// each in the directional Transition system. Adjacent scenes OVERLAP by OVERLAP seconds so the
// outgoing scene's exit and the incoming scene's entrance play together — never a hard cut.
import React from "react";
import { Sequence } from "remotion";
import type { Storyboard, Scene } from "./storyboard";
import { deriveTheme, type Theme } from "./engine3d/core/theme";
import { HookScene } from "./engine3d/scenes/HookScene";
import { StatScene } from "./engine3d/scenes/StatScene";
import { TextScene } from "./engine3d/scenes/TextScene";
import { CtaScene } from "./engine3d/scenes/CtaScene";
import { LogoRevealScene } from "./engine3d/scenes/LogoRevealScene";
import { ImageHeroScene } from "./engine3d/scenes/ImageHeroScene";
import { FeatureGridScene } from "./engine3d/scenes/FeatureGridScene";
import { DashboardScene } from "./engine3d/scenes/DashboardScene";
import { ComparisonScene } from "./engine3d/scenes/ComparisonScene";
import { Watermark } from "./engine3d/components/Watermark";
import { Transition, SEAM_CYCLE } from "./engine3d/transitions";

const OVERLAP = 0.8; // seconds both scenes co-exist for the transition (spec: 0.8–1.5s)

type SceneProps = { scene: Scene; theme: Theme; durationInFrames: number };

const SceneComponent: React.FC<SceneProps> = (props) => {
  switch (props.scene.kind) {
    case "hook": return <HookScene {...props} />;
    case "stat": case "chart": return <StatScene {...props} />;
    case "feature": return <FeatureGridScene {...props} />;
    case "dashboard": return <DashboardScene {...props} />;
    case "comparison": return <ComparisonScene {...props} />;
    case "bullet": case "caption": case "quote": return <TextScene {...props} />;
    case "cta": return <CtaScene {...props} />;
    case "logo": return <LogoRevealScene {...props} />;
    case "product": case "screenshot": case "image": case "photo": case "graphic": return <ImageHeroScene {...props} />;
    default: return <HookScene {...props} />;
  }
};

export const Video: React.FC<{ storyboard: Storyboard; fps: number }> = ({ storyboard, fps }) => {
  const theme = deriveTheme(storyboard.framePack, storyboard.brandColors);
  const overlapFrames = Math.round(OVERLAP * fps);
  const n = storyboard.scenes.length;
  // one style per SEAM (between scene i and i+1); scene i enters via seam[i-1], exits via seam[i].
  const seam = (k: number) => SEAM_CYCLE[Math.max(0, k) % SEAM_CYCLE.length];
  return (
    <>
      {storyboard.scenes.map((scene, i) => {
        const isLast = i === n - 1;
        const durFrames = Math.round((scene.duration + (isLast ? 0 : OVERLAP)) * fps);
        return (
          <Sequence key={scene.id} from={Math.round(scene.start * fps)} durationInFrames={durFrames} name={`${scene.kind}:${scene.id}`}>
            <Transition
              enterStyle={i > 0 ? seam(i - 1) : undefined}
              exitStyle={!isLast ? seam(i) : undefined}
              enterFrames={overlapFrames}
              exitFrames={overlapFrames}
              durationInFrames={durFrames}
            >
              <SceneComponent scene={scene} theme={theme} durationInFrames={durFrames} />
            </Transition>
          </Sequence>
        );
      })}
      {storyboard.watermarkDataUri ? <Watermark src={storyboard.watermarkDataUri} /> : null}
    </>
  );
};
