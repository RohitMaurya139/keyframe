// TextScene — headline + a staggered list of in-3D bullet lines with accent square markers.
import React from "react";
import { useVideoConfig, useCurrentFrame } from "remotion";
import { Text } from "@react-three/drei";

import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { beatFrame, tween, EASE } from "../core/frame";
import { useFontReady, useWordLayout } from "../core/text";
import { SceneStage } from "../components/SceneStage";
import { KineticText } from "../components/KineticText";

const HEADLINE_SIZE = 0.6;

const Bullet: React.FC<{ theme: Theme; text: string; y: number; inFrame: number }> = ({ theme, text, y, inFrame }) => {
  const frame = useCurrentFrame();
  const a = tween(frame, inFrame, inFrame + 14, 0, 1, EASE.out);
  const dx = (1 - a) * -0.3;
  return (
    <group position={[-1.9 + dx, y, 0.2]}>
      <mesh position={[0, 0, 0]} scale={a}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial color={theme.accent} toneMapped={false} />
      </mesh>
      <Text position={[0.3, 0, 0]} font={theme.displayFont} fontSize={0.3} anchorX="left" anchorY="middle" color={theme.ink} fillOpacity={a}>
        {text}
      </Text>
    </group>
  );
};

export const TextScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  const { fps } = useVideoConfig();
  const bullets = (scene.bullets || []).filter(Boolean).slice(0, 3);
  useFontReady(theme.displayFont, `${scene.headline} ${bullets.join(" ")}`);
  const layout = useWordLayout(scene.headline, theme.displayFont, HEADLINE_SIZE, scene.emphasis);
  const headFrame = beatFrame(scene.beats, "headline", 0.3, fps);
  const blFrame = headFrame + Math.round(0.7 * fps);

  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames}>
      <KineticText
        layout={layout}
        fontUrl={theme.displayFont}
        fontSize={HEADLINE_SIZE}
        ink={theme.ink}
        accent={theme.accent}
        accent2={theme.accent2}
        headFrame={headFrame}
        y={0.75}
      />
      {bullets.map((b, i) => (
        <Bullet key={i} theme={theme} text={b} y={-0.05 - i * 0.5} inFrame={blFrame + i * Math.round(0.18 * fps)} />
      ))}
    </SceneStage>
  );
};
