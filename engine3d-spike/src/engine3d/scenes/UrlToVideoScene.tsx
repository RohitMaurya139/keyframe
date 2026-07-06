// UrlToVideoScene — Template "URL → Video Transformation". A browser window slides in from the
// left, a scan line sweeps down it, and as it passes each region a labelled SECTION CARD is
// "extracted" and flies out to the right stack. Shows KEYFRAME turning a site into scenes.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function sections(scene: Scene): string[] {
  if (scene.features?.length) return scene.features.map((f) => f.title).slice(0, 4);
  if (scene.bullets?.length) return scene.bullets.slice(0, 4);
  return ["Hero section", "Feature grid", "Pricing", "Call to action"];
}

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  const url = scene.subtext || "yourwebsite.com";
  const secs = sections(scene);

  const hOp = interpolate(frame, [4, 18], [0, 1], C);
  const hY = interpolate(frame, [4, 22], [22, 0], { ...C, easing: EO });
  const winX = interpolate(frame, [Math.round(0.2 * fps), Math.round(1.0 * fps)], [-160, 0], { ...C, easing: EO });
  const winOp = interpolate(frame, [Math.round(0.2 * fps), Math.round(0.6 * fps)], [0, 1], C);

  const scanStart = Math.round(1.0 * fps);
  const scanDur = Math.round(2.0 * fps);
  const scanY = interpolate(frame, [scanStart, scanStart + scanDur], [4, 96], { ...C, easing: Easing.inOut(Easing.cubic) });
  const scanOn = frame > scanStart && frame < scanStart + scanDur + 6;
  const srcY = [22, 44, 66, 86];

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "5.5% 6%", perspective: 1500 }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        {scene.kicker ? (
          <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 13px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: interpolate(frame, [2, 12], [0, 1], C) }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
          </span>
        ) : null}
        <h1 style={{ margin: "12px 0 0", font: "800 48px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
          {accentize(scene.headline, scene.emphasis, grad)}
        </h1>
      </div>

      <div style={{ display: "flex", gap: 40, flex: 1, alignItems: "center" }}>
        {/* BROWSER WINDOW */}
        <div style={{ flex: "0 0 56%", transform: `translateX(${winX}px)`, opacity: winOp }}>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.line}`, boxShadow: `0 30px 80px ${theme.accent}22` }}>
            {/* chrome */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${theme.line}` }}>
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#ff6058" }} />
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#ffbe2f" }} />
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#2aca44" }} />
              <span style={{ marginLeft: 12, flex: 1, padding: "7px 14px", borderRadius: 999, background: "rgba(0,0,0,0.25)", font: "600 14px/1 KFBody", color: theme.dim }}>🔒 {url}</span>
            </div>
            {/* fake page */}
            <div style={{ position: "relative", height: 340, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ height: 54, borderRadius: 10, background: "rgba(120,150,255,0.14)" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, height: 90 }}>
                <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.05)" }} />
              </div>
              <div style={{ height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)" }} />
              <div style={{ height: 42, width: "40%", borderRadius: 10, background: "rgba(120,150,255,0.18)" }} />
              {/* scan line */}
              {scanOn ? (
                <div style={{ position: "absolute", left: 0, right: 0, top: `${scanY}%`, height: 3, background: theme.accent, boxShadow: `0 0 24px 5px ${theme.accent}` }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: -60, height: 60, background: `linear-gradient(to bottom, transparent, ${theme.accent}22)` }} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* EXTRACTED SECTION CARDS */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {secs.map((s, i) => {
            const at = scanStart + Math.round((srcY[i] / 100) * scanDur);
            const op = interpolate(frame, [at, at + 14], [0, 1], C);
            const x = interpolate(frame, [at, at + 16], [-60, 0], { ...C, easing: EO });
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.line}`, backdropFilter: "blur(8px)", opacity: op, transform: `translateX(${x}px)` }}>
                <span style={{ flex: "none", width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "rgba(120,150,255,0.14)", border: `1px solid ${theme.line}`, font: "800 15px/1 KFDisplay, KFBody", color: theme.accent }}>{i + 1}</span>
                <span style={{ font: "700 19px/1.2 KFDisplay, KFBody", color: theme.ink }}>{s}</span>
                <span style={{ marginLeft: "auto", font: "700 12px/1 KFBody", color: theme.accent, letterSpacing: "0.1em" }}>SCENE</span>
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

export const UrlToVideoScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
