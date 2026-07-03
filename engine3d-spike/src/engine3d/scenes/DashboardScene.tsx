// DashboardScene — Motion Template "Dashboard Showcase". Left: hero copy + KPIs. Right: a glass
// dashboard PANEL that slides in from the left, with a bar chart that grows, metric tiles that
// float in staggered, and a glow behind. Dense (~80% occupancy). DOM content over the 3D stage.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BARS = [0.42, 0.6, 0.5, 0.78, 0.66, 0.92]; // target heights (0-1) — deterministic

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  const metrics = scene.metrics?.slice(0, 3) || [
    { value: 3, suffix: "x", label: "Faster onboarding" },
    { value: 68, suffix: "%", label: "Fewer drop-offs" },
  ];
  const rows = scene.features?.slice(0, 3) || [
    { title: "Signups", desc: "1,284" }, { title: "Activated", desc: "912" }, { title: "Converted", desc: "437" },
  ];

  const kOp = interpolate(frame, [2, 12], [0, 1], C);
  const hOp = interpolate(frame, [8, 22], [0, 1], C);
  const hY = interpolate(frame, [8, 26], [24, 0], { ...C, easing: EO });
  const pOp = interpolate(frame, [18, 34], [0, 1], C);
  const panelAt = Math.round(0.5 * fps);
  const panelX = interpolate(frame, [panelAt, panelAt + Math.round(0.8 * fps)], [-140, 0], { ...C, easing: EO });
  const panelOp = interpolate(frame, [panelAt, panelAt + 16], [0, 1], C);

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "5.5% 6%", perspective: 1500 }}>
      <div style={{ display: "flex", gap: 40, height: "100%", alignItems: "center" }}>
        {/* LEFT — hero copy + KPIs */}
        <div style={{ flex: "0 0 38%" }}>
          {scene.kicker ? (
            <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 13px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: kOp }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
            </span>
          ) : null}
          <h1 style={{ margin: "14px 0 0", font: "800 50px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
            {accentize(scene.headline, scene.emphasis, grad)}
          </h1>
          {scene.paragraph ? <p style={{ margin: "14px 0 0", font: "500 19px/1.5 KFBody", color: theme.dim, maxWidth: "34ch", opacity: pOp }}>{scene.paragraph}</p> : null}
          <div style={{ display: "flex", gap: 34, marginTop: 26 }}>
            {metrics.map((m, i) => {
              const at = Math.round(1.4 * fps) + i * Math.round(0.14 * fps);
              const t = interpolate(frame, [at, at + Math.round(0.8 * fps)], [0, 1], { ...C, easing: EO });
              const op = interpolate(frame, [at, at + 10], [0, 1], C);
              return (
                <div key={i} style={{ opacity: op }}>
                  <div style={{ font: "800 38px/1 KFDisplay, KFBody", background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{Math.round((m.value || 0) * t)}{m.suffix || ""}</div>
                  <div style={{ marginTop: 3, font: "600 14px/1 KFBody", color: theme.dim }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — dashboard panel (slides in from left) */}
        <div style={{ flex: 1, transform: `translateX(${panelX}px)`, opacity: panelOp }}>
          <div style={{ position: "relative", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.line}`, backdropFilter: "blur(10px)", padding: 24, boxShadow: `0 30px 80px ${theme.accent}22` }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#ff6058" }} />
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#ffbe2f" }} />
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "#2aca44" }} />
              <span style={{ marginLeft: 12, font: "700 15px/1 KFBody", color: theme.dim }}>Onboarding · live</span>
            </div>
            {/* bar chart */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 168, padding: "0 4px 14px", borderBottom: `1px solid ${theme.line}` }}>
              {BARS.map((h, i) => {
                const at = panelAt + Math.round(0.5 * fps) + i * Math.round(0.08 * fps);
                const gh = interpolate(frame, [at, at + Math.round(0.7 * fps)], [0, h], { ...C, easing: EO });
                return <div key={i} style={{ flex: 1, height: `${gh * 100}%`, borderRadius: "8px 8px 3px 3px", background: grad, opacity: 0.55 + h * 0.45 }} />;
              })}
            </div>
            {/* metric rows */}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((r, i) => {
                const at = panelAt + Math.round(1.0 * fps) + i * Math.round(0.12 * fps);
                const op = interpolate(frame, [at, at + 12], [0, 1], C);
                const x = interpolate(frame, [at, at + 14], [24, 0], { ...C, easing: EO });
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${theme.line}`, opacity: op, transform: `translateX(${x}px)` }}>
                    <span style={{ font: "600 17px/1 KFBody", color: theme.ink }}>{r.title}</span>
                    <span style={{ font: "800 18px/1 KFDisplay, KFBody", color: theme.accent }}>{r.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
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

export const DashboardScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
