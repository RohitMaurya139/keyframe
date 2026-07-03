// Per-pack light rig. MSDF text uses an unlit material (crisp), so lights here shape the
// 3D props/particles/glass. Cinematic packs get key+rim; flat packs stay ambient-only.
import React from "react";
import type { Theme } from "./theme";

export const LightRig: React.FC<{ theme: Theme }> = ({ theme }) => {
  if (!theme.gradients) {
    // flat pack: soft, even, no drama
    return <ambientLight intensity={0.9} />;
  }
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 3, 6]} intensity={45} color={theme.accent} />
      <pointLight position={[-5, -2, 3]} intensity={22} color={theme.accent2} />
      <directionalLight position={[0, 6, 4]} intensity={0.6} color={"#ffffff"} />
    </>
  );
};
