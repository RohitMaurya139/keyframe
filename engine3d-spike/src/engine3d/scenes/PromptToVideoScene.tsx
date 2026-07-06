// PromptToVideoScene — Template "Prompt → Video". A terminal types the prompt, an AI-processing
// indicator pulses, then the production pipeline stages (Script → Storyboard → Animation → Video)
// light up in sequence and assemble into a final video card. Frame-driven typing (deterministic).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function stages(scene: Scene): string[] {
  if (scene.features?.length) return scene.features.map((f) => f.title).slice(0, 4);
  return ["Script", "Storyboard", "Animation", "Video"];
}

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  const prompt = scene.subtext || scene.paragraph || "a 15-second cinematic product launch for our app";
  const st = stages(scene);

  const hOp = interpolate(frame, [4, 18], [0, 1], C);
  const hY = interpolate(frame, [4, 22], [22, 0], { ...C, easing: EO });

  // typing
  const typeStart = Math.round(0.7 * fps);
  const typeDur = Math.round(1.6 * fps);
  const chars = Math.round(interpolate(frame, [typeStart, typeStart + typeDur], [0, prompt.length], C));
  const typed = prompt.slice(0, chars);
  const typing = frame >= typeStart && chars < prompt.length;
  const cursor = Math.floor(frame / 8) % 2 === 0;
  const typeEnd = typeStart + typeDur;

  // stages activate after typing
  const stStart = typeEnd + Math.round(0.3 * fps);
  const stStep = Math.round(0.42 * fps);

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "5.5% 6%", perspective: 1500 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        {scene.kicker ? (
          <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 13px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: interpolate(frame, [2, 12], [0, 1], C) }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
          </span>
        ) : null}
        <h1 style={{ margin: "12px 0 0", font: "800 50px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
          {accentize(scene.headline, scene.emphasis, grad)}
        </h1>
      </div>

      <div style={{ display: "flex", gap: 40, flex: 1, alignItems: "center" }}>
        {/* TERMINAL */}
        <div style={{ flex: "0 0 52%" }}>
          <div style={{ borderRadius: 16, overflow: "hidden", background: "rgba(6,10,22,0.72)", border: `1px solid ${theme.line}`, boxShadow: `0 30px 80px ${theme.accent}22` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${theme.line}` }}>
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#ff6058" }} />
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#ffbe2f" }} />
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#2aca44" }} />
              <span style={{ marginLeft: 12, font: "700 13px/1 KFBody", color: theme.dim }}>keyframe — prompt</span>
            </div>
            <div style={{ padding: "22px 22px 26px", minHeight: 180, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 19, lineHeight: 1.6 }}>
              <div style={{ color: theme.dim }}><span style={{ color: theme.accent }}>$</span> keyframe generate</div>
              <div style={{ color: theme.ink }}>
                <span style={{ color: theme.accent }}>&gt; </span>"{typed}"{(typing && cursor) ? <span style={{ color: theme.accent }}>▋</span> : null}
              </div>
              {frame > typeEnd ? (
                <div style={{ marginTop: 12, color: theme.particle, opacity: interpolate(frame, [typeEnd, typeEnd + 10], [0, 1], C) }}>
                  ▸ AI director working{".".repeat(1 + (Math.floor(frame / 10) % 3))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* PIPELINE STAGES */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 13 }}>
          {st.map((s, i) => {
            const at = stStart + i * stStep;
            const op = interpolate(frame, [at, at + 12], [0, 1], C);
            const x = interpolate(frame, [at, at + 14], [40, 0], { ...C, easing: EO });
            const done = frame > at + stStep * 0.6;
            const isVideo = i === st.length - 1;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderRadius: 14, background: isVideo ? "rgba(120,150,255,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${done || isVideo ? theme.accent : theme.line}`, boxShadow: isVideo && done ? `0 0 26px ${theme.accent}55` : "none", opacity: op, transform: `translateX(${x}px)` }}>
                <span style={{ flex: "none", width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "rgba(120,150,255,0.14)", border: `1px solid ${theme.line}`, color: theme.accent }}>
                  {isVideo ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={theme.accent}><path d="M8 5v14l11-7z" /></svg>
                  ) : done ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M4 13l5 5L20 6" /></svg>
                  ) : (
                    <span style={{ font: "800 14px/1 KFDisplay, KFBody" }}>{i + 1}</span>
                  )}
                </span>
                <span style={{ font: "700 19px/1.2 KFDisplay, KFBody", color: theme.ink }}>{s}</span>
                {done && !isVideo ? <span style={{ marginLeft: "auto", font: "700 12px/1 KFBody", color: theme.accent }}>DONE</span> : null}
                {isVideo && done ? <span style={{ marginLeft: "auto", font: "700 12px/1 KFBody", color: theme.accent }}>READY</span> : null}
              </div>
            );
          })}
        </div>
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

export const PromptToVideoScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
