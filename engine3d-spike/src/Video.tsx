// Video — maps storyboard.scenes[] onto Remotion <Sequence>s, dispatches by `kind`, and wraps
// each in the directional Transition system. Adjacent scenes OVERLAP by OVERLAP seconds so the
// outgoing scene's exit and the incoming scene's entrance play together — never a hard cut.
import React from "react";
import { Sequence } from "remotion";
import type { Storyboard, Scene } from "./storyboard";
import { deriveTheme, type Theme } from "./engine3d/core/theme";
import { Watermark } from "./engine3d/components/Watermark";
import { Transition, SEAM_CYCLE } from "./engine3d/transitions";
import { componentForKind } from "./engine3d/templates/registry";

const OVERLAP = 0.8; // seconds both scenes co-exist for the transition (spec: 0.8–1.5s)

type SceneProps = { scene: Scene; theme: Theme; durationInFrames: number };

// The scene's kind selects a TEMPLATE from the library (registry) — no scene is built from scratch.
const SceneComponent: React.FC<SceneProps> = (props) => {
  const Template = componentForKind(props.scene.kind);
  return <Template {...props} />;
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
