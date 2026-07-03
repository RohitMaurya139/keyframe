// Feature3DScene — the Feature Breakdown as REAL 3D card meshes (Card3D) in a 2x2 grid at the
// card depth, with an MSDF headline forward of them. Cards slide in from alternating sides in 3D,
// catch the scene lights, and parallax with the camera. (3D-mesh variant of FeatureGridScene.)
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Text } from "@react-three/drei";
import type { Scene, Feature } from "../../storyboard";
import type { Theme } from "../core/theme";
import { tween, EASE } from "../core/frame";
import { useFontReady } from "../core/text";
import { SceneStage } from "../components/SceneStage";
import { Card3D } from "../components/Card3D";

const CARD_W = 3.15, CARD_H = 1.2;
const POS: [number, number][] = [[-1.72, -0.05], [1.72, -0.05], [-1.72, -1.4], [1.72, -1.4]];

function feats(scene: Scene): Feature[] {
  if (scene.features?.length) return scene.features.slice(0, 4);
  const b = (scene.bullets || []).filter(Boolean);
  if (b.length) return b.slice(0, 4).map((t) => ({ title: t }));
  return [
    { title: "Blazing fast", desc: "Sub-100ms interactions everywhere." },
    { title: "Built for teams", desc: "Real-time by default, zero setup." },
    { title: "Secure by design", desc: "SSO, SOC2 and audit logs baked in." },
    { title: "Automate anything", desc: "Workflows and agents on autopilot." },
  ];
}

const Content: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const features = feats(scene);
  const hOp = tween(frame, 6, 22, 0, 1);
  const cardsAt = Math.round(0.6 * fps);
  return (
    // scaled + lifted so the whole grid + headline fit the frame with margin, even under the
    // lateral camera drift (was overflowing the edges at full scale).
    <group scale={0.76} position={[0, 0.18, 0]}>
      {/* kicker + headline (MSDF, forward of the cards) */}
      {scene.kicker ? (
        <Text font={theme.displayFont} position={[0, 1.95, 1.5]} fontSize={0.15} letterSpacing={0.18} anchorX="center" anchorY="middle" color={theme.particle} fillOpacity={tween(frame, 2, 14, 0, 1)}>
          {scene.kicker.toUpperCase()}
        </Text>
      ) : null}
      <Text font={theme.displayFont} position={[0, 1.48, 1.5]} fontSize={0.46} letterSpacing={-0.01} anchorX="center" anchorY="middle" color={theme.ink} fillOpacity={hOp} maxWidth={8.5} textAlign="center">
        {scene.headline}
      </Text>
      {features.map((f, i) => {
        const at = cardsAt + i * Math.round(0.14 * fps);
        const appear = tween(frame, at, at + Math.round(0.55 * fps), 0, 1, EASE.out);
        return (
          <Card3D
            key={i}
            index={i}
            position={[POS[i][0], POS[i][1], 0]}
            width={CARD_W}
            height={CARD_H}
            theme={theme}
            fontUrl={theme.displayFont}
            title={f.title}
            desc={f.desc}
            appear={appear}
            slideFrom={(i % 2 === 0 ? -1 : 1) * 2.6}
          />
        );
      })}
    </group>
  );
};

export const Feature3DScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  const features = feats(scene);
  useFontReady(theme.displayFont, `${scene.headline} ${scene.kicker ?? ""} ${features.map((f) => `${f.title} ${f.desc ?? ""}`).join(" ")}`);
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames}>
      <Content scene={scene} theme={theme} />
    </SceneStage>
  );
};
