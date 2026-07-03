// Pack-aware gradient ground, rendered as a DOM layer behind the transparent ThreeCanvas.
import React from "react";
import { AbsoluteFill } from "remotion";
import type { Theme } from "../core/theme";

export const Backdrop: React.FC<{ theme: Theme }> = ({ theme }) => {
  const bg = theme.gradients
    ? `radial-gradient(120% 95% at 50% -8%, ${theme.groundTop}, ${theme.ground} 55%, ${theme.groundBottom})`
    : theme.ground;
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: theme.ground }} />
      <AbsoluteFill style={{ background: bg }} />
    </>
  );
};
