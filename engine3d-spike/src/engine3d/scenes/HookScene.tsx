// HookScene — the fully-ported archHook, driven by a storyboard Scene object.
import React from "react";
import { useVideoConfig, useCurrentFrame } from "remotion";
import { Text } from "@react-three/drei";

import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { beatFrame, tween, EASE } from "../core/frame";
import { useFontReady, useWordLayout } from "../core/text";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";
import { Kicker } from "../components/Kicker";
import { KineticText } from "../components/KineticText";
import { ChipsRow } from "../components/DomBlocks";

const HEADLINE_SIZE = 0.74;

const SubAndRule: React.FC<{ scene: Scene; theme: Theme; subFrame: number }> = ({ scene, theme, subFrame }) => {
  const frame = useCurrentFrame();
  const op = tween(frame, subFrame, subFrame + 16, 0, 1);
  const uScale = tween(frame, subFrame + 4, subFrame + 28, 0, 1, EASE.inOut);
  return (
    <group>
      {scene.subtext ? (
        <Text position={[0, -0.72, 0.4]} font={theme.displayFont} fontSize={0.24} anchorX="center" anchorY="middle" color={theme.particle} fillOpacity={op}>
          {scene.subtext}
        </Text>
      ) : null}
      <mesh position={[0, -1.06, 0.7]} scale={[uScale * 2.2, 1, 1]}>
        <planeGeometry args={[1, 0.045]} />
        <meshBasicMaterial color={theme.accent} toneMapped={false} />
      </mesh>
    </group>
  );
};

const CoreNode: React.FC<{ theme: Theme; durationInFrames: number }> = ({ theme, durationInFrames }) => {
  const frame = useCurrentFrame();
  const scale = tween(frame, 0, durationInFrames, 0.5, 1.7, EASE.out);
  const rot = frame * 0.008;
  return (
    <mesh scale={scale} rotation={[rot, rot * 0.7, 0]} position={[0, -0.1, -4]}>
      <icosahedronGeometry args={[0.9, 1]} />
      <meshBasicMaterial color={theme.accent2} wireframe transparent opacity={0.22} toneMapped={false} />
    </mesh>
  );
};

export const HookScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  const { fps } = useVideoConfig();
  useFontReady(theme.displayFont, `${scene.headline} ${scene.subtext ?? ""}`);
  useDomFonts();
  const layout = useWordLayout(scene.headline, theme.displayFont, HEADLINE_SIZE, scene.emphasis);

  const kickerFrame = beatFrame(scene.beats, "kicker", 0.15, fps);
  const headFrame = beatFrame(scene.beats, "stagger", 0.55, fps);
  const subFrame = beatFrame(scene.beats, "underline", 1.5, fps);

  // secondary block (fills the lower frame) — feature chips from the scene or a tasteful default
  const chips = (scene.features?.map((f) => f.title) || scene.bullets || ["Fast setup", "Secure by default", "Built for teams"]).slice(0, 3);

  return (
    <SceneStage
      theme={theme}
      cameraKind="hook-push"
      durationInFrames={durationInFrames}
      domOverlay={
        <>
          {scene.kicker ? <Kicker text={scene.kicker} theme={theme} inFrame={kickerFrame} /> : null}
          <ChipsRow items={chips} theme={theme} inFrame={Math.round(1.8 * fps)} />
        </>
      }
    >
      <CoreNode theme={theme} durationInFrames={durationInFrames} />
      <KineticText
        layout={layout}
        fontUrl={theme.displayFont}
        fontSize={HEADLINE_SIZE}
        ink={theme.ink}
        accent={theme.accent}
        accent2={theme.accent2}
        headFrame={headFrame}
        y={0.35}
      />
      <SubAndRule scene={scene} theme={theme} subFrame={subFrame} />
    </SceneStage>
  );
};
