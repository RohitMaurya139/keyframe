// FeatureGridScene — the DENSE "Feature Breakdown" template. Hero headline + supporting
// paragraph + 4 feature cards (icon-first, alternating-direction reveal) + a metrics row
// (counter animation), targeting 70-85% screen occupancy over the 3D depth background.
// Content is a crisp DOM layer (CSS perspective) composited over the R3F SceneStage.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene, Feature, Metric } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ICONS = [
  "M4 13l5 5L20 6",
  "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z",
  "M3 12h4l3 8 4-16 3 8h4",
  "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z",
];

function feats(scene: Scene): Feature[] {
  if (scene.features?.length) return scene.features.slice(0, 4);
  const b = (scene.bullets || []).filter(Boolean);
  if (b.length) return b.slice(0, 4).map((t) => ({ title: t }));
  return [
    { title: "Blazing fast", desc: "Sub-100ms interactions everywhere." },
    { title: "Built for teams", desc: "Real-time by default, zero setup." },
    { title: "Secure by design", desc: "SSO, SOC2 and audit logs baked in." },
    { title: "Automate anything", desc: "Workflows and agents on autopilot." },
  ];
}
function mets(scene: Scene): Metric[] {
  if (scene.metrics?.length) return scene.metrics.slice(0, 3);
  return [
    { value: 99, suffix: "%", label: "Uptime" },
    { value: 3, suffix: "x", label: "Faster shipping" },
    { value: 40, suffix: "k+", label: "Teams onboard" },
  ];
}

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const features = feats(scene);
  const metrics = mets(scene);
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;

  const kOp = interpolate(frame, [2, 12], [0, 1], C);
  const hY = interpolate(frame, [8, 26], [26, 0], { ...C, easing: EO });
  const hOp = interpolate(frame, [8, 22], [0, 1], C);
  const pOp = interpolate(frame, [18, 34], [0, 1], C);
  const cardsAt = Math.round(0.85 * fps);
  const metricsAt = cardsAt + Math.round(1.0 * fps);

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, system-ui, sans-serif", color: theme.ink, padding: "5.5% 6%", perspective: 1400 }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 26 }}>
        {/* HEADER: kicker + headline + supporting paragraph */}
        <div>
          {scene.kicker ? (
            <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 14px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: kOp }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
            </span>
          ) : null}
          <h1 style={{ margin: "14px 0 0", font: "800 62px/1.02 KFDisplay, KFBody", letterSpacing: "-0.02em", maxWidth: "20ch", opacity: hOp, transform: `translateY(${hY}px)` }}>
            {accentize(scene.headline, scene.emphasis, grad)}
          </h1>
          {scene.paragraph ? (
            <p style={{ margin: "14px 0 0", font: "500 22px/1.5 KFBody", color: theme.dim, maxWidth: "56ch", opacity: pOp }}>{scene.paragraph}</p>
          ) : null}
        </div>

        {/* FEATURE CARDS — 2x2, alternating-direction reveal */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, flex: 1, alignContent: "center" }}>
          {features.map((f, i) => {
            const at = cardsAt + i * Math.round(0.13 * fps);
            const op = interpolate(frame, [at, at + 14], [0, 1], C);
            const fromX = (i % 2 === 0 ? -1 : 1) * interpolate(frame, [at, at + 16], [46, 0], { ...C, easing: EO });
            const iconRot = interpolate(frame, [at, at + 20], [-90, 0], { ...C, easing: EO });
            return (
              <div key={i} style={{ display: "flex", gap: 16, padding: "20px 22px", borderRadius: 18, background: "rgba(255,255,255,0.045)", border: `1px solid ${theme.line}`, backdropFilter: "blur(8px)", opacity: op, transform: `translateX(${fromX}px)` }}>
                <div style={{ flex: "none", width: 48, height: 48, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, transform: `rotate(${iconRot}deg)` }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[i % ICONS.length]} /></svg>
                </div>
                <div>
                  <div style={{ font: "700 22px/1.2 KFDisplay, KFBody", color: theme.ink }}>{f.title}</div>
                  {f.desc ? <div style={{ marginTop: 5, font: "500 16px/1.4 KFBody", color: theme.dim }}>{f.desc}</div> : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* METRICS ROW — counter animation */}
        <div style={{ display: "flex", gap: 40, borderTop: `1px solid ${theme.line}`, paddingTop: 18 }}>
          {metrics.map((m, i) => {
            const at = metricsAt + i * Math.round(0.15 * fps);
            const t = interpolate(frame, [at, at + Math.round(0.9 * fps)], [0, 1], { ...C, easing: EO });
            const op = interpolate(frame, [at, at + 10], [0, 1], C);
            const shown = Math.round((m.value || 0) * t);
            return (
              <div key={i} style={{ opacity: op }}>
                <div style={{ font: "800 44px/1 KFDisplay, KFBody", background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{m.prefix || ""}{shown.toLocaleString()}{m.suffix || ""}</div>
                <div style={{ marginTop: 4, font: "600 15px/1 KFBody", color: theme.dim, letterSpacing: "0.04em" }}>{m.label}</div>
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

export const FeatureGridScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="dolly-lateral" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
