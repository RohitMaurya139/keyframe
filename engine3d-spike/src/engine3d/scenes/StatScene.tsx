// StatScene — a hero count-up number (forward in Z) + label + sub. The number's text
// content is a pure function of frame (deterministic count-up), rendered as in-3D MSDF.
import React from "react";
import { useVideoConfig, useCurrentFrame } from "remotion";
import { Text } from "@react-three/drei";

import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { beatFrame, tween, EASE } from "../core/frame";
import { useFontReady } from "../core/text";
import { useDomFonts } from "../core/domfont";
import { pickNumber, stripNumber, formatNumber } from "../core/number";
import { SceneStage } from "../components/SceneStage";
import { MiniMetrics } from "../components/DomBlocks";

const CountNumber: React.FC<{ theme: Theme; value: number; suffix: string; start: number; dur: number }> = ({ theme, value, suffix, start, dur }) => {
  const frame = useCurrentFrame();
  const t = tween(frame, start, start + dur, 0, 1, EASE.out);
  const op = tween(frame, start, start + 8, 0, 1);
  return (
    <Text position={[0, 0.78, 0.4]} font={theme.displayFont} fontSize={1.55} anchorX="center" anchorY="middle" color={theme.accent} fillOpacity={op}>
      {formatNumber(value * t, suffix)}
    </Text>
  );
};

export const StatScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  const { fps } = useVideoConfig();
  const label = stripNumber(scene.headline, scene.emphasis);
  useFontReady(theme.displayFont, `${scene.headline} ${label} ${scene.subtext ?? ""} 0123456789%xkmb+,.`);
  useDomFonts();
  const num = pickNumber(scene.headline, scene.emphasis);

  const start = beatFrame(scene.beats, "number", 0.2, fps);
  const labelFrame = start + Math.round(0.5 * fps);

  // secondary block — supporting metric tiles (fills the lower frame)
  const mini = (scene.metrics?.slice(1, 4).map((m) => ({ value: `${m.prefix || ""}${m.value}${m.suffix || ""}`, label: m.label }))
    || [{ value: "24/7", label: "Automated" }, { value: "0", label: "Setup time" }, { value: "SOC2", label: "Compliant" }]);

  return (
    <SceneStage
      theme={theme}
      cameraKind="punch-in"
      durationInFrames={durationInFrames}
      domOverlay={<MiniMetrics items={mini} theme={theme} inFrame={labelFrame + Math.round(0.6 * fps)} />}
    >
      <CountNumber theme={theme} value={num.value} suffix={num.suffix} start={start} dur={Math.round(1.4 * fps)} />
      <Label theme={theme} text={label} inFrame={labelFrame} />
      {scene.subtext ? <Sub theme={theme} text={scene.subtext} inFrame={labelFrame + Math.round(0.4 * fps)} /> : null}
    </SceneStage>
  );
};

const Label: React.FC<{ theme: Theme; text: string; inFrame: number }> = ({ theme, text, inFrame }) => {
  const frame = useCurrentFrame();
  const op = tween(frame, inFrame, inFrame + 14, 0, 1);
  const dy = (1 - op) * -0.18;
  return (
    <Text position={[0, -0.05 + dy, 0.2]} font={theme.displayFont} fontSize={0.38} anchorX="center" anchorY="middle" color={theme.ink} fillOpacity={op} maxWidth={9} textAlign="center">
      {text}
    </Text>
  );
};

const Sub: React.FC<{ theme: Theme; text: string; inFrame: number }> = ({ theme, text, inFrame }) => {
  const frame = useCurrentFrame();
  const op = tween(frame, inFrame, inFrame + 14, 0, 1);
  return (
    <Text position={[0, -0.62, 0.2]} font={theme.displayFont} fontSize={0.22} anchorX="center" anchorY="middle" color={theme.dim} fillOpacity={op} maxWidth={10} textAlign="center">
      {text}
    </Text>
  );
};
