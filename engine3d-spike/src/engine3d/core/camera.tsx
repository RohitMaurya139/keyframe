// Per-scene camera rigs — the Three.js equivalent of the scene-kit's cam3D/cam3Dz.
// Position is a PURE FUNCTION of the frame (never a clock). Real perspective + real
// parallax: the camera physically moves through the depth-separated layers.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import { tween, EASE } from "./frame";

export type CameraKind = "hook-push" | "dolly-lateral" | "pull-back" | "punch-in";

export const CameraRig: React.FC<{ kind: CameraKind; durationInFrames: number }> = ({ kind, durationInFrames }) => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera);
  const end = durationInFrames;

  let x = 0, y = 0, z = 6, lookY = 0.1;
  switch (kind) {
    case "hook-push":
      // slow yaw drift + gentle dolly-in through the depth planes
      x = tween(frame, 0, end, -0.5, 0.5, EASE.inOutSine);
      y = tween(frame, 0, end, 0.28, -0.16, EASE.inOutSine);
      z = tween(frame, 0, end, 6.6, 5.4, EASE.inOutSine);
      break;
    case "punch-in":
      z = tween(frame, 0, end, 6.4, 4.9, EASE.out);
      break;
    case "pull-back":
      z = tween(frame, 0, end, 4.8, 6.2, EASE.out);
      break;
    case "dolly-lateral":
      x = tween(frame, 0, end, -0.9, 0.9, EASE.inOutSine);
      z = 5.8;
      break;
  }
  camera.position.set(x, y, z);
  camera.lookAt(0, lookY, 0);
  return null;
};
