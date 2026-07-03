// KineticText — the headline as individual in-3D MSDF word meshes with a staggered
// reveal and a continuous gradient-fill across the accent (emphasis) words.
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { Text } from "@react-three/drei";
import type { WordLayout } from "../core/text";
import { tween, EASE } from "../core/frame";
import { makeGradientTextMaterial } from "../materials/gradientText";

type Props = {
  layout: WordLayout | null; // measured in the Remotion tree (delayRender can't run inside R3F)
  fontUrl: string;
  fontSize?: number;
  ink: string;
  accent: string;
  accent2: string;
  headFrame: number;     // when the stagger begins (frames, scene-relative)
  staggerStep?: number;  // frames between words
  y?: number;            // vertical position of the headline block
};

export const KineticText: React.FC<Props> = ({
  layout,
  fontUrl,
  fontSize = 0.74,
  ink,
  accent,
  accent2,
  headFrame,
  staggerStep = 4,
  y = 0.35,
}) => {
  const frame = useCurrentFrame();

  // one shared gradient material for the accent run — continuous across word meshes
  const gradMat = useMemo(() => {
    if (!layout) return null;
    return makeGradientTextMaterial(accent, accent2, layout.gradX0, layout.gradX1);
  }, [layout, accent, accent2]);

  if (!layout) return null;

  return (
    <group position={[0, y, 0]}>
      {layout.words.map((word, i) => {
        const delay = headFrame + i * staggerStep;
        const rev = tween(frame, delay, delay + 14, 0, 1, EASE.out);
        const dy = (1 - rev) * -0.28; // rise up
        const dz = (1 - rev) * -0.5;  // recede in depth while arriving
        const isAccent = layout.accent[i];
        return (
          <group key={i} position={[layout.xs[i], dy, dz]}>
            <Text
              font={fontUrl}
              fontSize={fontSize}
              anchorX="left"
              anchorY="middle"
              color={ink}
              fillOpacity={rev}
              material={isAccent && gradMat ? gradMat : undefined}
              // slightly brighten accents so Bloom catches them
              outlineWidth={0}
            >
              {word}
            </Text>
          </group>
        );
      })}
    </group>
  );
};
