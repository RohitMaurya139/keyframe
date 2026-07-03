// ImageHeroScene — the user's uploaded image/photo/screenshot on a 3D plane with an accent
// backing glow and a slow push-in (ken-burns), plus a headline below. Aspect-fit from the texture.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Text } from "@react-three/drei";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { beatFrame, tween, EASE } from "../core/frame";
import { useFontReady } from "../core/text";
import { useImageTexture, texAspect } from "../core/texture";
import { SceneStage } from "../components/SceneStage";
import type * as THREE from "three";

const HeroImage: React.FC<{ tex: THREE.Texture | null; theme: Theme; durationInFrames: number }> = ({ tex, theme, durationInFrames }) => {
  const frame = useCurrentFrame();
  const aspect = texAspect(tex, 1.6);
  // fit within a max box, centered a bit high so the headline sits below
  let w = 3.7, h = w / aspect;
  if (h > 2.35) { h = 2.35; w = h * aspect; }
  const op = tween(frame, 6, 24, 0, 1);
  const push = tween(frame, 0, durationInFrames, 1.0, 1.08, EASE.out);
  if (!tex) return null;
  return (
    <group position={[0, 0.5, 0]} scale={push}>
      <mesh position={[0, 0, -0.25]} scale={[w + 0.14, h + 0.14, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={theme.accent} transparent opacity={0.28 * op} toneMapped={false} />
      </mesh>
      <mesh scale={[w, h, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} transparent opacity={op} toneMapped={false} />
      </mesh>
    </group>
  );
};

export const ImageHeroScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  const { fps } = useVideoConfig();
  useFontReady(theme.displayFont, `${scene.headline ?? ""} ${scene.subtext ?? ""}`);
  const headFrame = beatFrame(scene.beats, "headline", 0.6, fps);
  // load the texture in the Remotion tree (delayRender can't run inside <ThreeCanvas>)
  const tex = useImageTexture(scene.assetDataUri);
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames}>
      <HeroImage tex={tex} theme={theme} durationInFrames={durationInFrames} />
      {scene.headline ? <Head theme={theme} text={scene.headline} inFrame={headFrame} /> : null}
      {scene.subtext ? <Sub theme={theme} text={scene.subtext} inFrame={headFrame + Math.round(0.4 * fps)} /> : null}
    </SceneStage>
  );
};

const Head: React.FC<{ theme: Theme; text: string; inFrame: number }> = ({ theme, text, inFrame }) => {
  const frame = useCurrentFrame();
  const op = tween(frame, inFrame, inFrame + 14, 0, 1);
  const dy = (1 - op) * -0.14;
  return (
    <Text position={[0, -1.55 + dy, 0.4]} font={theme.displayFont} fontSize={0.42} anchorX="center" anchorY="middle" color={theme.ink} fillOpacity={op} maxWidth={11} textAlign="center">
      {text}
    </Text>
  );
};

const Sub: React.FC<{ theme: Theme; text: string; inFrame: number }> = ({ theme, text, inFrame }) => {
  const frame = useCurrentFrame();
  const op = tween(frame, inFrame, inFrame + 14, 0, 1);
  return (
    <Text position={[0, -2.05, 0.4]} font={theme.displayFont} fontSize={0.2} anchorX="center" anchorY="middle" color={theme.dim} fillOpacity={op} maxWidth={13} textAlign="center">
      {text}
    </Text>
  );
};
