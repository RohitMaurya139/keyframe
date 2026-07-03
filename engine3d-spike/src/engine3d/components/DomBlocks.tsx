// Crisp DOM secondary-info blocks layered over the 3D scenes so no frame feels empty
// (composition rule: every scene needs a secondary information block). Frame-driven reveals.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Theme } from "../core/theme";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// A row of feature/trust pill chips, pinned near the bottom.
export const ChipsRow: React.FC<{ items: string[]; theme: Theme; inFrame: number; bottom?: number }> = ({ items, theme, inFrame, bottom = 64 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: bottom, fontFamily: "KFBody, Inter, sans-serif" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", maxWidth: "80%" }}>
        {items.slice(0, 4).map((t, i) => {
          const at = inFrame + i * Math.round(0.1 * fps);
          const op = interpolate(frame, [at, at + 12], [0, 1], C);
          const y = interpolate(frame, [at, at + 14], [14, 0], { ...C, easing: EO });
          return (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "9px 18px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.line}`, color: theme.ink, font: "600 17px/1 KFBody", opacity: op, transform: `translateY(${y}px)` }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{t}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// A row of small supporting metric tiles (secondary to a hero number), pinned near the bottom.
export const MiniMetrics: React.FC<{ items: { value: string; label: string }[]; theme: Theme; inFrame: number }> = ({ items, theme, inFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 58, fontFamily: "KFBody, Inter, sans-serif" }}>
      <div style={{ display: "flex", gap: 46, borderTop: `1px solid ${theme.line}`, paddingTop: 16 }}>
        {items.slice(0, 3).map((m, i) => {
          const at = inFrame + i * Math.round(0.12 * fps);
          const op = interpolate(frame, [at, at + 12], [0, 1], C);
          return (
            <div key={i} style={{ textAlign: "center", opacity: op }}>
              <div style={{ font: "800 30px/1 KFDisplay, KFBody", background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{m.value}</div>
              <div style={{ marginTop: 3, font: "600 13px/1 KFBody", color: theme.dim, letterSpacing: "0.04em" }}>{m.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// A supporting paragraph/line positioned in the lower-middle band.
export const SupportLine: React.FC<{ text: string; theme: Theme; inFrame: number; bottomPct?: number }> = ({ text, theme, inFrame, bottomPct = 26 }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [inFrame, inFrame + 16], [0, 1], C);
  const y = interpolate(frame, [inFrame, inFrame + 18], [16, 0], { ...C, easing: EO });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: `${bottomPct}%`, fontFamily: "KFBody, Inter, sans-serif" }}>
      <p style={{ margin: 0, maxWidth: "50ch", textAlign: "center", font: "500 21px/1.5 KFBody", color: theme.dim, opacity: op, transform: `translateY(${y}px)` }}>{text}</p>
    </AbsoluteFill>
  );
};
