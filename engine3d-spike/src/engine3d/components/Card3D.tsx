// Card3D — a real Three.js card MESH (not a DOM overlay): a rounded-box glass panel at the card
// depth, an emissive accent border behind it, a 3D icon primitive, and MSDF text on the face
// (slightly forward). It catches the scene lights and parallaxes with the camera — literal 3D depth.
import React from "react";
import { RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";

const ICON_GEO = ["icosahedron", "octahedron", "box", "torus"] as const;

const IconMesh: React.FC<{ i: number; color: string }> = ({ i, color }) => {
  const kind = ICON_GEO[i % ICON_GEO.length];
  const mat = <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} metalness={0.4} roughness={0.3} />;
  return (
    <mesh rotation={[0.5, 0.4, 0]}>
      {kind === "icosahedron" && <icosahedronGeometry args={[0.14, 0]} />}
      {kind === "octahedron" && <octahedronGeometry args={[0.15, 0]} />}
      {kind === "box" && <boxGeometry args={[0.2, 0.2, 0.2]} />}
      {kind === "torus" && <torusGeometry args={[0.12, 0.045, 12, 24]} />}
      {mat}
    </mesh>
  );
};

export const Card3D: React.FC<{
  position: [number, number, number];
  width: number;
  height: number;
  theme: { accent: string; accent2: string; ink: string; dim: string; line: string };
  fontUrl: string;
  index: number;
  title: string;
  desc?: string;
  appear: number;   // 0..1 reveal
  slideFrom: number; // starting x offset (world units) for the entrance
}> = ({ position, width, height, theme, fontUrl, index, title, desc, appear, slideFrom }) => {
  const x = position[0] + slideFrom * (1 - appear);
  const padX = -width / 2 + 0.28;
  return (
    <group position={[x, position[1], position[2]]} scale={0.9 + 0.1 * appear}>
      {/* emissive accent border (slightly larger, behind) */}
      <RoundedBox args={[width + 0.05, height + 0.05, 0.03]} radius={0.1} smoothness={3} position={[0, 0, -0.04]}>
        <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={0.5} transparent opacity={0.22 * appear} toneMapped={false} />
      </RoundedBox>
      {/* glass panel */}
      <RoundedBox args={[width, height, 0.07]} radius={0.11} smoothness={4}>
        <meshStandardMaterial color={"#0d1430"} metalness={0.35} roughness={0.32} transparent opacity={0.9 * appear} />
      </RoundedBox>
      {/* icon tile */}
      <group position={[padX + 0.22, height / 2 - 0.32, 0.09]}>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={0.15} transparent opacity={0.16 * appear} />
        </mesh>
        <IconMesh i={index} color={theme.accent} />
      </group>
      {/* title */}
      <Text font={fontUrl} position={[padX + 0.62, height / 2 - 0.32, 0.09]} fontSize={0.19} anchorX="left" anchorY="middle" color={theme.ink} fillOpacity={appear} maxWidth={width - 1}>
        {title}
      </Text>
      {/* description */}
      {desc ? (
        <Text font={fontUrl} position={[padX, height / 2 - 0.72, 0.09]} fontSize={0.115} lineHeight={1.35} anchorX="left" anchorY="top" color={theme.dim} fillOpacity={appear * 0.9} maxWidth={width - 0.5}>
          {desc}
        </Text>
      ) : null}
    </group>
  );
};
