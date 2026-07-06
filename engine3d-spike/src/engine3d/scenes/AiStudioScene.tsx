// AiStudioScene — Template "AI Production Studio". A central hub (the Director) with agent nodes
// arranged in a ring, connected by lines, with a pulse that sweeps around lighting each agent.
// Visualizes KEYFRAME's internal AI workflow. DOM nodes + an aligned SVG line layer over the stage.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function agents(scene: Scene): string[] {
  if (scene.features?.length) return scene.features.map((f) => f.title).slice(0, 7);
  if (scene.bullets?.length) return scene.bullets.slice(0, 7);
  return ["Script Writer", "Storyboard", "Scene Planner", "Asset Analyzer", "Motion Designer", "Voice Agent", "Render Agent"];
}

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  const list = agents(scene);
  const N = list.length;
  const CX = 50, CY = 60, RX = 34, RY = 30; // stage center + ring radii (in %)
  const pos = list.map((_, i) => {
    const a = (-90 + (i * 360) / N) * (Math.PI / 180);
    return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
  });

  const hOp = interpolate(frame, [4, 18], [0, 1], C);
  const hY = interpolate(frame, [4, 22], [22, 0], { ...C, easing: EO });
  const linesAt = Math.round(0.7 * fps);
  const sweepStart = Math.round(1.3 * fps);
  const sweep = ((frame - sweepStart) / (0.32 * fps)); // agent index currently pulsing

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "5% 6%", perspective: 1400 }}>
      <div style={{ textAlign: "center" }}>
        {scene.kicker ? (
          <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 13px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: interpolate(frame, [2, 12], [0, 1], C) }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
          </span>
        ) : null}
        <h1 style={{ margin: "12px 0 0", font: "800 46px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
          {accentize(scene.headline, scene.emphasis, grad)}
        </h1>
      </div>

      {/* connector lines (aligned to the % node positions via a stretched viewBox) */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {pos.map((p, i) => {
          const op = interpolate(frame, [linesAt + i * 2, linesAt + i * 2 + 12], [0, 0.5], C);
          return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={theme.accent} strokeWidth={0.18} opacity={op} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>

      {/* central hub */}
      <div style={{ position: "absolute", left: `${CX}%`, top: `${CY}%`, transform: "translate(-50%,-50%)", opacity: interpolate(frame, [linesAt - 6, linesAt + 6], [0, 1], C) }}>
        <div style={{ width: 108, height: 108, borderRadius: 26, display: "grid", placeItems: "center", textAlign: "center", background: "rgba(120,150,255,0.16)", border: `1px solid ${theme.accent}`, boxShadow: `0 0 ${26 + 10 * Math.sin(frame * 0.12)}px ${theme.accent}`, font: "800 17px/1.15 KFDisplay, KFBody", color: theme.ink }}>
          AI<br />Director
        </div>
      </div>

      {/* agent nodes */}
      {list.map((label, i) => {
        const at = linesAt + i * Math.round(0.08 * fps);
        const op = interpolate(frame, [at, at + 12], [0, 1], C);
        const active = Math.max(0, 1 - Math.abs(((sweep % N) + N) % N - i) * 1.6);
        return (
          <div key={i} style={{ position: "absolute", left: `${pos[i].x}%`, top: `${pos[i].y}%`, transform: "translate(-50%,-50%)", opacity: op, textAlign: "center", width: 150 }}>
            <div style={{ width: 46, height: 46, margin: "0 auto", borderRadius: 13, background: `rgba(120,150,255,${0.1 + active * 0.2})`, border: `1px solid ${active > 0.4 ? theme.accent : theme.line}`, boxShadow: active > 0.3 ? `0 0 ${16 * active}px ${theme.accent}` : "none", transform: `scale(${1 + active * 0.12})` }} />
            <div style={{ marginTop: 8, font: "600 15px/1.2 KFBody", color: active > 0.4 ? theme.ink : theme.dim }}>{label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

function accentize(headline: string, emphasis: string | undefined, grad: string) {
  if (!emphasis || !headline.includes(emphasis)) return headline;
  const [a, b] = headline.split(emphasis);
  const acc = { background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties;
  return (<>{a}<span style={acc}>{emphasis}</span>{b}</>);
}

export const AiStudioScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames} rings={false} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
