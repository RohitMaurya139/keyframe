// ComparisonScene — Motion Template "Comparison". Headline + two cards: the OLD way (left, muted,
// ✗ points, enters from left) vs the NEW way (right, accent glow, ✓ points, enters from right and
// sits slightly FORWARD = depth layering). A contrast metric underlines the payoff. DOM over 3D.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CHECK = "M4 13l5 5L20 6";
const CROSS = "M6 6l12 12M18 6L6 18";

const Card: React.FC<{
  theme: Theme; title: string; points: string[]; win: boolean; frame: number; fps: number; at: number;
}> = ({ theme, title, points, win, frame, fps, at }) => {
  const dir = win ? 1 : -1;
  const x = interpolate(frame, [at, at + Math.round(0.8 * fps)], [dir * 90, 0], { ...C, easing: EO });
  const op = interpolate(frame, [at, at + 16], [0, 1], C);
  const scale = win ? interpolate(frame, [at, at + Math.round(0.9 * fps)], [0.98, 1.05], { ...C, easing: EO }) : 1;
  const stroke = win ? theme.accent : theme.dim;
  return (
    <div style={{
      flex: 1, padding: "26px 28px", borderRadius: 22, opacity: op,
      transform: `translateX(${x}px) scale(${scale})`,
      background: win ? "rgba(120,150,255,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${win ? theme.accent : theme.line}`,
      boxShadow: win ? `0 30px 90px ${theme.accent}33` : "none",
    }}>
      <div style={{ font: "800 26px/1.1 KFDisplay, KFBody", color: win ? theme.ink : theme.dim, marginBottom: 18 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {points.slice(0, 4).map((p, i) => {
          const pat = at + Math.round(0.4 * fps) + i * Math.round(0.11 * fps);
          const pop = interpolate(frame, [pat, pat + 12], [0, 1], C);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, opacity: pop }}>
              <span style={{ flex: "none", width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: win ? "rgba(120,150,255,0.14)" : "rgba(255,255,255,0.05)", border: `1px solid ${theme.line}` }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d={win ? CHECK : CROSS} /></svg>
              </span>
              <span style={{ font: `${win ? 600 : 500} 19px/1.3 KFBody`, color: win ? theme.ink : theme.dim }}>{p}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  const pros = scene.features?.map((f) => f.title) || ["Automated workflows", "Real-time analytics", "One-click integrations", "Team collaboration"];
  const cons = scene.bullets || ["Manual data entry", "Days to onboard", "Disconnected tools", "Things slip through"];
  const metric = scene.metrics?.[0];

  const hOp = interpolate(frame, [4, 18], [0, 1], C);
  const hY = interpolate(frame, [4, 22], [22, 0], { ...C, easing: EO });
  const cardsAt = Math.round(0.6 * fps);
  const mAt = cardsAt + Math.round(1.4 * fps);
  const mOp = interpolate(frame, [mAt, mAt + 14], [0, 1], C);

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "5.5% 6%", perspective: 1600 }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 24 }}>
        <h1 style={{ margin: 0, textAlign: "center", font: "800 52px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
          {accentize(scene.headline, scene.emphasis, grad)}
        </h1>
        <div style={{ display: "flex", gap: 26, flex: 1, alignItems: "center" }}>
          <Card theme={theme} title={scene.subtext || "The old way"} points={cons} win={false} frame={frame} fps={fps} at={cardsAt} />
          <div style={{ flex: "none", font: "800 22px/1 KFDisplay, KFBody", color: theme.dim, opacity: interpolate(frame, [cardsAt, cardsAt + 14], [0, 1], C) }}>VS</div>
          <Card theme={theme} title={scene.kicker || "With Flowbase"} points={pros} win frame={frame} fps={fps} at={cardsAt + Math.round(0.15 * fps)} />
        </div>
        {metric ? (
          <div style={{ textAlign: "center", opacity: mOp }}>
            <span style={{ font: "800 40px/1 KFDisplay, KFBody", background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{metric.prefix || ""}{metric.value}{metric.suffix || ""}</span>
            <span style={{ marginLeft: 14, font: "600 20px/1 KFBody", color: theme.dim }}>{metric.label}</span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

function accentize(headline: string, emphasis: string | undefined, grad: string) {
  if (!emphasis || !headline.includes(emphasis)) return headline;
  const [a, b] = headline.split(emphasis);
  const acc = { background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties;
  return (<>{a}<span style={acc}>{emphasis}</span>{b}</>);
}

export const ComparisonScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="punch-in" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
