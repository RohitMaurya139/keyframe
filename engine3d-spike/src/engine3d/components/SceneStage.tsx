// Shared canvas stage: the ambient every scene sits in (gradient ground, lights, camera rig,
// orbital-ring depth plane, instanced particle field, Bloom/Vignette post). Scene components
// provide only their own foreground 3D content as children, plus optional DOM overlays.
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import type { Theme } from "../core/theme";
import { CameraRig, type CameraKind } from "../core/camera";
import { LightRig } from "../core/lighting";
import { Backdrop } from "./Backdrop";
import { ParticleField } from "./ParticleField";
import { OrbitalRings } from "./OrbitalRings";

export const SceneStage: React.FC<{
  theme: Theme;
  cameraKind: CameraKind;
  durationInFrames: number;
  rings?: boolean;
  children: React.ReactNode;
  domOverlay?: React.ReactNode;
}> = ({ theme, cameraKind, durationInFrames, rings = true, children, domOverlay }) => {
  const { width, height } = useVideoConfig(); // match whatever size the composition requests
  return (
    <AbsoluteFill>
      <Backdrop theme={theme} />
      <ThreeCanvas
        width={width}
        height={height}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, 6], fov: 40 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <LightRig theme={theme} />
        <CameraRig kind={cameraKind} durationInFrames={durationInFrames} />
        {rings ? <OrbitalRings color={theme.particle} z={-3.5} opacity={0.4} /> : null}
        <ParticleField color={theme.particle} count={240} />
        {children}
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.35} luminanceSmoothing={0.3} />
          <Vignette eskil={false} offset={0.25} darkness={0.72} />
        </EffectComposer>
      </ThreeCanvas>
      {domOverlay}
    </AbsoluteFill>
  );
};
