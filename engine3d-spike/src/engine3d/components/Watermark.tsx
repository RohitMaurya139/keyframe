// Persistent brand watermark — the user's logo in a corner across the whole film. DOM overlay
// (crisp, simple); rendered once at the top of the composition so it spans every scene.
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const Watermark: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [8, 24], [0, 0.72], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", padding: 40, alignItems: "flex-start", justifyContent: "flex-start" }}>
      <img src={src} alt="" style={{ height: 44, width: "auto", maxWidth: 220, objectFit: "contain", opacity: op }} />
    </AbsoluteFill>
  );
};
