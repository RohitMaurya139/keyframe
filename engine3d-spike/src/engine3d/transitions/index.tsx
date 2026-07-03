// Scene transition system. Every scene ENTERS from a direction and EXITS in a direction, and
// adjacent scenes OVERLAP (both on screen during the handoff) so there is never a hard cut.
// A seam has a single style; the outgoing scene exits one way and the incoming enters from the
// complementary side so the motion reads as continuous. Frame-driven → deterministic.
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";

export type SeamStyle =
  | "push-left" | "push-right" | "push-up" | "push-down"
  | "zoom-through" | "rotate-3d" | "parallax";

// Seam cycle used when the storyboard doesn't specify a transition. Order chosen so adjacent
// seams differ in axis/type (never two slides in a row on the same axis).
export const SEAM_CYCLE: SeamStyle[] = [
  "push-left", "zoom-through", "push-up", "rotate-3d", "push-right", "parallax", "push-down",
];

type XForm = { x: number; y: number; scale: number; rotY: number; rotX: number; opacity: number };
const NONE: XForm = { x: 0, y: 0, scale: 1, rotY: 0, rotX: 0, opacity: 1 };

// ENTER: p is "remaining" (1 at start → 0 when fully arrived). The scene comes FROM an offset.
function enterX(style: SeamStyle, p: number): XForm {
  switch (style) {
    case "push-left": return { ...NONE, x: 115 * p, opacity: 1 - p * 0.6 };   // enters from the right
    case "push-right": return { ...NONE, x: -115 * p, opacity: 1 - p * 0.6 };  // enters from the left
    case "push-up": return { ...NONE, y: 115 * p, opacity: 1 - p * 0.6 };      // enters from the bottom
    case "push-down": return { ...NONE, y: -115 * p, opacity: 1 - p * 0.6 };   // enters from the top
    case "zoom-through": return { ...NONE, scale: 1 + 0.55 * p, opacity: 1 - p };
    case "rotate-3d": return { ...NONE, rotY: -85 * p, x: 22 * p, opacity: 1 - p };
    case "parallax": return { ...NONE, y: 26 * p, scale: 1 + 0.12 * p, opacity: 1 - p };
    default: return NONE;
  }
}
// EXIT: t is "progress" (0 at start of exit → 1 fully gone). The scene leaves toward an offset.
function exitX(style: SeamStyle, t: number): XForm {
  switch (style) {
    case "push-left": return { ...NONE, x: -115 * t, opacity: 1 - t };         // leaves to the left
    case "push-right": return { ...NONE, x: 115 * t, opacity: 1 - t };
    case "push-up": return { ...NONE, y: -115 * t, opacity: 1 - t };
    case "push-down": return { ...NONE, y: 115 * t, opacity: 1 - t };
    case "zoom-through": return { ...NONE, scale: 1 - 0.4 * t, opacity: 1 - t };
    case "rotate-3d": return { ...NONE, rotY: 85 * t, x: -22 * t, opacity: 1 - t };
    case "parallax": return { ...NONE, y: -26 * t, scale: 1 - 0.1 * t, opacity: 1 - t };
    default: return NONE;
  }
}

export const Transition: React.FC<{
  enterStyle?: SeamStyle;
  exitStyle?: SeamStyle;
  enterFrames: number;
  exitFrames: number;
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ enterStyle, exitStyle, enterFrames, exitFrames, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const tin = interpolate(frame, [0, enterFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const tout = interpolate(frame, [durationInFrames - exitFrames, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const e = enterStyle ? enterX(enterStyle, 1 - tin) : NONE;
  const x = exitStyle ? exitX(exitStyle, tout) : NONE;
  const tx = e.x + x.x, ty = e.y + x.y;
  const scale = e.scale * x.scale;
  const rotY = e.rotY + x.rotY;
  const opacity = e.opacity * x.opacity;
  return (
    <AbsoluteFill style={{ perspective: 1700 }}>
      <AbsoluteFill
        style={{
          transform: `translate(${tx}%, ${ty}%) scale(${scale}) rotateY(${rotY}deg)`,
          transformOrigin: "50% 50%",
          opacity,
          backfaceVisibility: "hidden",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
