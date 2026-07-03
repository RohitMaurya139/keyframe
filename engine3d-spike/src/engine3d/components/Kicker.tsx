// Kicker chip — a crisp DOM pill (UI element, not headline type) layered over the canvas.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { tween } from "../core/frame";
import type { Theme } from "../core/theme";

export const Kicker: React.FC<{ text: string; theme: Theme; inFrame: number; offsetY?: number }> = ({
  text,
  theme,
  inFrame,
  offsetY = -170,
}) => {
  const frame = useCurrentFrame();
  const a = tween(frame, inFrame, inFrame + 12, 0, 1);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${offsetY + (1 - a) * 12}px)`, opacity: a }}>
        <span
          style={{
            display: "inline-flex",
            gap: 10,
            alignItems: "center",
            padding: "8px 16px",
            borderRadius: 9999,
            background: "rgba(80,110,255,0.14)",
            border: `1px solid ${theme.line}`,
            color: theme.particle,
            font: `700 15px/1 ${theme.bodyFontCss}`,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 8, background: theme.accent }} />
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
