// WorkflowScene — Template "Production Workflow" / "AI Production Studio". A horizontal flow of
// labeled NODES connected by lines, with a bright data PULSE that travels the pipeline lighting
// each node as it passes. Headline + supporting paragraph. Dense, premium, DOM over the 3D stage.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function steps(scene: Scene): string[] {
  if (scene.features?.length) return scene.features.map((f) => f.title).slice(0, 6);
  if (scene.bullets?.length) return scene.bullets.slice(0, 6);
  return ["Prompt", "AI Director", "Script", "Template", "Motion Engine", "Render"];
}

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  const nodes = steps(scene);
  const N = nodes.length;

  const hOp = interpolate(frame, [4, 18], [0, 1], C);
  const hY = interpolate(frame, [4, 22], [22, 0], { ...C, easing: EO });
  const pOp = interpolate(frame, [16, 32], [0, 1], C);

  const flowStart = Math.round(0.8 * fps);
  const flowDur = Math.round(2.6 * fps);
  // pulse position along the row in node-index units (0..N-1), sweeping once then looping softly
  const pulse = interpolate(frame, [flowStart, flowStart + flowDur], [-0.4, N - 0.6], { ...C, easing: Easing.inOut(Easing.cubic) });
  const nodeXpct = (i: number) => ((i + 0.5) / N) * 100;
  const rowY = "58%";

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "6% 6%", perspective: 1400 }}>
      {/* header */}
      <div style={{ textAlign: "center" }}>
        {scene.kicker ? (
          <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 13px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: interpolate(frame, [2, 12], [0, 1], C) }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
          </span>
        ) : null}
        <h1 style={{ margin: "14px 0 0", font: "800 54px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
          {accentize(scene.headline, scene.emphasis, grad)}
        </h1>
        {scene.paragraph ? <p style={{ margin: "12px auto 0", maxWidth: "60ch", font: "500 20px/1.5 KFBody", color: theme.dim, opacity: pOp }}>{scene.paragraph}</p> : null}
      </div>

      {/* connector line + traveling pulse */}
      <div style={{ position: "absolute", left: "6%", right: "6%", top: rowY, height: 2, transform: "translateY(-1px)" }}>
        <div style={{ position: "absolute", left: `${nodeXpct(0)}%`, right: `${100 - nodeXpct(N - 1)}%`, top: 0, height: 2, background: theme.line, opacity: interpolate(frame, [flowStart - 8, flowStart + 8], [0, 1], C) }} />
        {/* traveling glow dot */}
        <div style={{ position: "absolute", left: `${nodeXpct(Math.max(0, Math.min(N - 1, pulse)))}%`, top: 1, width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: 16, background: theme.accent, boxShadow: `0 0 22px 6px ${theme.accent}`, opacity: interpolate(frame, [flowStart, flowStart + 6], [0, 1], C) }} />
      </div>

      {/* nodes */}
      {nodes.map((label, i) => {
        const at = Math.round(0.4 * fps) + i * Math.round(0.1 * fps);
        const op = interpolate(frame, [at, at + 12], [0, 1], C);
        const y = interpolate(frame, [at, at + 14], [16, 0], { ...C, easing: EO });
        const active = Math.max(0, 1 - Math.abs(pulse - i) * 1.4); // glow as the pulse passes
        return (
          <div key={i} style={{ position: "absolute", left: `${nodeXpct(i)}%`, top: rowY, transform: `translate(-50%, calc(-50% + ${y}px))`, opacity: op, textAlign: "center", width: `${88 / N}%` }}>
            <div style={{
              width: 54, height: 54, margin: "0 auto", borderRadius: 15, display: "grid", placeItems: "center",
              background: `rgba(120,150,255,${0.1 + active * 0.18})`, border: `1px solid ${active > 0.4 ? theme.accent : theme.line}`,
              boxShadow: active > 0.3 ? `0 0 ${18 * active}px ${theme.accent}` : "none",
              font: "800 20px/1 KFDisplay, KFBody", color: active > 0.4 ? theme.accent : theme.ink, transform: `scale(${1 + active * 0.08})`,
            }}>{i + 1}</div>
            <div style={{ marginTop: 12, font: "600 17px/1.25 KFBody", color: active > 0.4 ? theme.ink : theme.dim }}>{label}</div>
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

export const WorkflowScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
