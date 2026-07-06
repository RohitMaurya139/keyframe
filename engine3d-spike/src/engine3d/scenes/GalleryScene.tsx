// GalleryScene — Template "Showcase Gallery". A row of floating video-poster cards at varying
// depth (center largest, sides angled) with play buttons, gently drifting/bobbing. "Made with KEYFRAME."
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function titles(scene: Scene): string[] {
  if (scene.features?.length) return scene.features.map((f) => f.title).slice(0, 5);
  if (scene.bullets?.length) return scene.bullets.slice(0, 5);
  return ["Product launch", "Feature demo", "Brand intro", "Explainer", "Ad creative"];
}

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const grad = `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`;
  const cards = titles(scene);
  const mid = (cards.length - 1) / 2;
  const hOp = interpolate(frame, [4, 18], [0, 1], C);
  const hY = interpolate(frame, [4, 22], [22, 0], { ...C, easing: EO });

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "6% 4%", perspective: 1500 }}>
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        {scene.kicker ? (
          <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 13px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: interpolate(frame, [2, 12], [0, 1], C) }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
          </span>
        ) : null}
        <h1 style={{ margin: "12px 0 0", font: "800 50px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
          {accentize(scene.headline, scene.emphasis, grad)}
        </h1>
      </div>

      <div style={{ display: "flex", gap: 22, flex: 1, alignItems: "center", justifyContent: "center", transformStyle: "preserve-3d" }}>
        {cards.map((label, i) => {
          const at = Math.round(0.4 * fps) + i * Math.round(0.12 * fps);
          const op = interpolate(frame, [at, at + 14], [0, 1], C);
          const d = i - mid;                                  // distance from center
          const depthScale = 1 - Math.abs(d) * 0.1;           // center largest
          const rotY = d * -9;                                // sides angled inward
          const bob = Math.sin(t * 1.2 + i) * 8;              // floating
          const posterA = i % 2 === 0 ? theme.accent : theme.accent2;
          const posterB = i % 2 === 0 ? theme.accent2 : theme.accent;
          return (
            <div key={i} style={{ flex: "0 0 20%", opacity: op, transform: `perspective(1200px) rotateY(${rotY}deg) scale(${depthScale}) translateY(${bob}px)`, zIndex: 10 - Math.abs(d) }}>
              <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${Math.abs(d) < 0.5 ? theme.accent : theme.line}`, boxShadow: Math.abs(d) < 0.5 ? `0 24px 60px ${theme.accent}44` : `0 14px 40px #00000055` }}>
                {/* poster */}
                <div style={{ position: "relative", aspectRatio: "16/10", background: `linear-gradient(135deg, ${posterA}, ${posterB})`, display: "grid", placeItems: "center" }}>
                  <div style={{ position: "absolute", inset: 0, background: "rgba(6,10,22,0.45)" }} />
                  <div style={{ position: "relative", width: 54, height: 54, borderRadius: 54, background: "rgba(255,255,255,0.9)", display: "grid", placeItems: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A0E1A"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
                {/* footer */}
                <div style={{ padding: "12px 14px", background: "rgba(13,20,48,0.9)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ font: "700 15px/1 KFBody", color: theme.ink }}>{label}</span>
                  <span style={{ font: "600 12px/1 KFBody", color: theme.dim }}>0:15</span>
                </div>
              </div>
            </div>
          );
        })}
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

export const GalleryScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
