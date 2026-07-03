// CtaScene — gradient kinetic headline + a glow bloom behind it + a DOM button pill.
import React from "react";
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from "remotion";

import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { beatFrame, tween, EASE } from "../core/frame";
import { useFontReady, useWordLayout } from "../core/text";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";
import { KineticText } from "../components/KineticText";
import { ChipsRow } from "../components/DomBlocks";

const HEADLINE_SIZE = 0.72;

const GlowCore: React.FC<{ theme: Theme; durationInFrames: number }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const s = tween(frame, 0, 24, 0.6, 1.0, EASE.out);
  return (
    <mesh position={[0, 0.15, -2]} scale={s}>
      <circleGeometry args={[1.6, 48]} />
      <meshBasicMaterial color={theme.accent} transparent opacity={0.14} toneMapped={false} />
    </mesh>
  );
};

const Button: React.FC<{ label: string; theme: Theme; inFrame: number }> = ({ label, theme, inFrame }) => {
  const frame = useCurrentFrame();
  const a = tween(frame, inFrame, inFrame + 16, 0, 1, EASE.back);
  const pulse = 1 + 0.03 * Math.sin((frame - inFrame) * 0.12);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(110px) scale(${a * pulse})`, opacity: Math.min(1, a) }}>
        <span
          style={{
            display: "inline-flex",
            gap: 11,
            alignItems: "center",
            padding: "16px 36px",
            borderRadius: 9999,
            background: `linear-gradient(180deg, ${theme.accent}, ${theme.accent2})`,
            color: "#0A0E1A",
            font: `800 26px/1 ${theme.bodyFontCss}`,
          }}
        >
          {label}
          <span style={{ width: 11, height: 11, borderRight: "3px solid #0A0E1A", borderTop: "3px solid #0A0E1A", transform: "rotate(45deg)", display: "inline-block" }} />
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const CtaScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  const { fps } = useVideoConfig();
  useFontReady(theme.displayFont, `${scene.headline} ${scene.subtext ?? ""}`);
  useDomFonts();
  const layout = useWordLayout(scene.headline, theme.displayFont, HEADLINE_SIZE, scene.emphasis);
  const headFrame = beatFrame(scene.beats, "headline", 0.25, fps);
  const btnFrame = headFrame + Math.round(0.7 * fps);

  // secondary block — trust chips under the button (fills the lower frame)
  const chips = (scene.features?.map((f) => f.title) || ["No credit card", "14-day free trial", "Cancel anytime"]).slice(0, 3);

  return (
    <SceneStage
      theme={theme}
      cameraKind="pull-back"
      durationInFrames={durationInFrames}
      domOverlay={
        <>
          {scene.subtext ? <Button label={scene.subtext} theme={theme} inFrame={btnFrame} /> : null}
          <ChipsRow items={chips} theme={theme} inFrame={btnFrame + Math.round(0.5 * fps)} bottom={54} />
        </>
      }
    >
      <GlowCore theme={theme} durationInFrames={durationInFrames} />
      <KineticText
        layout={layout}
        fontUrl={theme.displayFont}
        fontSize={HEADLINE_SIZE}
        ink={theme.ink}
        accent={theme.accent}
        accent2={theme.accent2}
        headFrame={headFrame}
        y={0.2}
      />
    </SceneStage>
  );
};
