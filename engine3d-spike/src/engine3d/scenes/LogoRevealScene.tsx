// LogoRevealScene — the user's uploaded logo on a 3D plane with a halo glow and a
// scale/opacity/float reveal, over the pack ambient. Aspect-correct from the texture.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Text } from "@react-three/drei";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { tween, EASE } from "../core/frame";
import { useFontReady } from "../core/text";
import { useImageTexture, texAspect } from "../core/texture";
import { SceneStage } from "../components/SceneStage";
import type * as THREE from "three";

const LogoMesh: React.FC<{ tex: THREE.Texture | null; theme: Theme }> = ({ tex, theme }) => {
  const frame = useCurrentFrame();
  const aspect = texAspect(tex, 2.6);
  const h = 1.3, w = h * aspect;
  const op = tween(frame, 6, 24, 0, 1);
  const sc = tween(frame, 6, 30, 0.82, 1, EASE.out);
  const floatY = Math.sin(frame * 0.045) * 0.03;
  const halo = tween(frame, 4, 34, 0.4, 1.1, EASE.out);
  return (
    <group>
      <mesh position={[0, 0.15, -1]} scale={halo}>
        <circleGeometry args={[Math.max(w, h) * 0.85, 48]} />
        <meshBasicMaterial color={theme.accent} transparent opacity={0.16 * op} toneMapped={false} />
      </mesh>
      {tex ? (
        <mesh position={[0, 0.15 + floatY, 0.3]} scale={[w * sc, h * sc, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} transparent opacity={op} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
};

export const LogoRevealScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  const { fps } = useVideoConfig();
  useFontReady(theme.displayFont, `${scene.headline ?? ""} ${scene.subtext ?? ""}`);
  // load the texture in the Remotion tree (delayRender can't run inside <ThreeCanvas>)
  const tex = useImageTexture(scene.assetDataUri);
  return (
    <SceneStage theme={theme} cameraKind="punch-in" durationInFrames={durationInFrames}>
      <LogoMesh tex={tex} theme={theme} />
      {scene.subtext ? <Caption theme={theme} text={scene.subtext} inFrame={Math.round(0.8 * fps)} /> : null}
    </SceneStage>
  );
};

const Caption: React.FC<{ theme: Theme; text: string; inFrame: number }> = ({ theme, text, inFrame }) => {
  const frame = useCurrentFrame();
  const op = tween(frame, inFrame, inFrame + 16, 0, 1);
  return (
    <Text position={[0, -1.05, 0.4]} font={theme.displayFont} fontSize={0.26} anchorX="center" anchorY="middle" color={theme.dim} fillOpacity={op} maxWidth={12} textAlign="center">
      {text}
    </Text>
  );
};
