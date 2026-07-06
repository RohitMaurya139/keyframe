// TimelineScene — Template "Timeline Story". A horizontal axis with milestone nodes; a playhead
// sweeps left→right and each event card (alternating above/below) reveals as it passes. Narrative.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene, Feature } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function events(scene: Scene): Feature[] {
  if (scene.features?.length) return scene.features.slice(0, 4);
  if (scene.bullets?.length) return scene.bullets.slice(0, 4).map((t) => ({ title: t }));
  return [
    { title: "Describe", desc: "You type a prompt or drop a URL." },
    { title: "Direct", desc: "The AI plans the story and scenes." },
    { title: "Build", desc: "Templates assemble every frame." },
    { title: "Render", desc: "A finished MP4 in minutes." },
  ];
}

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  const evs = events(scene);
  const N = evs.length;
  const axisY = 54;
  const x = (i: number) => 8 + (i / (N - 1)) * 84; // % across
  const hOp = interpolate(frame, [4, 18], [0, 1], C);
  const hY = interpolate(frame, [4, 22], [22, 0], { ...C, easing: EO });
  const start = Math.round(0.9 * fps);
  const dur = Math.round(2.4 * fps);
  const head = interpolate(frame, [start, start + dur], [x(0), x(N - 1)], { ...C, easing: Easing.inOut(Easing.cubic) });

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "5.5% 6%", perspective: 1400 }}>
      <div style={{ textAlign: "center" }}>
        {scene.kicker ? (
          <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 13px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: interpolate(frame, [2, 12], [0, 1], C) }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
          </span>
        ) : null}
        <h1 style={{ margin: "12px 0 0", font: "800 48px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
          {accentize(scene.headline, scene.emphasis, grad)}
        </h1>
      </div>

      {/* axis + progress fill */}
      <div style={{ position: "absolute", left: `${x(0)}%`, width: `${x(N - 1) - x(0)}%`, top: `${axisY}%`, height: 3, background: theme.line, transform: "translateY(-1px)" }} />
      <div style={{ position: "absolute", left: `${x(0)}%`, width: `${Math.max(0, head - x(0))}%`, top: `${axisY}%`, height: 3, background: grad, transform: "translateY(-1px)", boxShadow: `0 0 12px ${theme.accent}` }} />
      {/* playhead dot */}
      <div style={{ position: "absolute", left: `${head}%`, top: `${axisY}%`, width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: 16, background: theme.accent, boxShadow: `0 0 20px 5px ${theme.accent}`, opacity: interpolate(frame, [start, start + 6], [0, 1], C) }} />

      {/* nodes + alternating cards */}
      {evs.map((e, i) => {
        const passed = head >= x(i) - 1;
        const at = start + Math.round(((x(i) - x(0)) / (x(N - 1) - x(0))) * dur);
        const op = interpolate(frame, [at, at + 14], [0, 1], C);
        const above = i % 2 === 0;
        const y = interpolate(frame, [at, at + 16], [above ? 10 : -10, 0], { ...C, easing: EO });
        return (
          <React.Fragment key={i}>
            {/* node dot */}
            <div style={{ position: "absolute", left: `${x(i)}%`, top: `${axisY}%`, width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: 14, background: passed ? theme.accent : "#0d1430", border: `2px solid ${passed ? theme.accent : theme.line}`, boxShadow: passed ? `0 0 12px ${theme.accent}` : "none" }} />
            {/* connector + card */}
            <div style={{ position: "absolute", left: `${x(i)}%`, top: `${above ? axisY - 24 : axisY + 5}%`, transform: `translate(-50%, ${above ? "-100%" : "0"}%) translateY(${y}px)`, width: `${78 / N}%`, minWidth: 190, opacity: op }}>
              <div style={{ padding: "15px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.line}`, backdropFilter: "blur(8px)" }}>
                <div style={{ font: "800 14px/1 KFDisplay, KFBody", color: theme.accent, marginBottom: 6 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ font: "700 20px/1.15 KFDisplay, KFBody", color: theme.ink }}>{e.title}</div>
                {e.desc ? <div style={{ marginTop: 5, font: "500 15px/1.35 KFBody", color: theme.dim }}>{e.desc}</div> : null}
              </div>
            </div>
          </React.Fragment>
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

export const TimelineScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
