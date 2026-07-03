import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  staticFile,
  delayRender,
  continueRender,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { preloadFont } from "troika-three-text";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

const FONT = staticFile("fonts/SpaceGrotesk.ttf");

// ---- deterministic seeded RNG ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNT = 280;

type Props = {
  kicker: string;
  headline: string;
  accentWords: number;
  sub: string;
};

// ---- in-3D MSDF text (font is preloaded once at the composition level, so these
//      render synchronously from troika's cache — no per-instance async) ----
const KText: React.FC<any> = ({ children, ...props }) => (
  <Text font={FONT} {...props}>
    {children}
  </Text>
);

// Preload the TTF ONCE inside the Remotion tree (has Remotion context for delayRender);
// gate the whole render until troika has built the SDF atlas → deterministic.
const useFontReady = (characters: string) => {
  const [handle] = useState(() => delayRender("preload-font"));
  useEffect(() => {
    preloadFont({ font: FONT, characters }, () => continueRender(handle));
  }, [characters, handle]);
};

// ---- 3D constellation (drift = pure function of frame) ----
const Particles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => {
    const r = mulberry32(1337);
    const a: { x: number; y: number; z: number; s: number; ph: number }[] = [];
    for (let i = 0; i < COUNT; i++)
      a.push({ x: (r() - 0.5) * 17, y: (r() - 0.5) * 10, z: (r() - 0.5) * 7 - 1.5, s: r() * 0.045 + 0.01, ph: r() * Math.PI * 2 });
    return a;
  }, []);
  const t = frame / fps;
  if (ref.current) {
    for (let i = 0; i < COUNT; i++) {
      const p = seeds[i];
      dummy.position.set(p.x + Math.cos(t * 0.4 + p.ph) * 0.22, p.y + Math.sin(t * 0.6 + p.ph) * 0.28, p.z);
      dummy.scale.setScalar(p.s * (1 + 0.35 * Math.sin(t * 2 + p.ph)));
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, COUNT]}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial color={"#37E6FF"} toneMapped={false} />
    </instancedMesh>
  );
};

// dim wireframe core, pushed BEHIND the text so type reads as clean foreground
const Core: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 30, 90], [0.4, 1.5, 1.7], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const rot = frame * 0.008;
  return (
    <mesh scale={scale} rotation={[rot, rot * 0.7, 0]} position={[0, -0.1, -4]}>
      <icosahedronGeometry args={[0.9, 1]} />
      <meshBasicMaterial color={"#2B6BE0"} wireframe transparent opacity={0.28} toneMapped={false} />
    </mesh>
  );
};

// camera dolly (pure function of frame) — gentle so type stays readable
const Rig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera);
  camera.position.set(
    interpolate(frame, [0, 90], [-0.35, 0.35], { easing: Easing.inOut(Easing.sin) }),
    interpolate(frame, [0, 90], [0.22, -0.12], { easing: Easing.inOut(Easing.sin) }),
    interpolate(frame, [0, 90], [6.4, 5.6], { easing: Easing.inOut(Easing.sin) })
  );
  camera.lookAt(0, 0.1, 0);
  return null;
};

const Headline: React.FC<Props> = ({ headline, sub }) => {
  const frame = useCurrentFrame();
  const hOpacity = interpolate(frame, [16, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hY = interpolate(frame, [16, 40], [0.1, 0.42], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const hScale = interpolate(frame, [16, 40], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const sOpacity = interpolate(frame, [46, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const uScale = interpolate(frame, [50, 74], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  return (
    <group>
      <group position={[0, hY, 0]} scale={hScale}>
        <KText
          fontSize={0.74}
          fontWeight={700}
          maxWidth={7}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color={"#F4F7FF"}
          fillOpacity={hOpacity}
          letterSpacing={-0.02}
        >
          {headline}
        </KText>
      </group>
      <KText position={[0, -0.72, 0]} fontSize={0.24} anchorX="center" anchorY="middle" color={"#8FE9FF"} fillOpacity={sOpacity}>
        {sub}
      </KText>
      {/* underline rule as a thin 3D bar, scaleX driven by frame */}
      <mesh position={[0, -1.06, 0]} scale={[uScale * 2.2, 1, 1]}>
        <planeGeometry args={[1, 0.04]} />
        <meshBasicMaterial color={"#37E6FF"} toneMapped={false} />
      </mesh>
    </group>
  );
};

// kicker chip stays a crisp DOM pill (UI element, not headline type)
const Kicker: React.FC<{ kicker: string }> = ({ kicker }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(-160px) translateY(${(1 - a) * 12}px)`, opacity: a }}>
        <span
          style={{
            display: "inline-flex",
            gap: 10,
            alignItems: "center",
            padding: "8px 16px",
            borderRadius: 9999,
            background: "rgba(80,110,255,0.14)",
            border: "1px solid rgba(120,150,255,0.35)",
            color: "#8FE9FF",
            font: "700 15px/1 Inter, system-ui, sans-serif",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 8, background: "#37E6FF" }} />
          {kicker}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const HookScene: React.FC<Props> = (props) => {
  useFontReady(`${props.headline} ${props.sub}`);
  return (
    <AbsoluteFill style={{ backgroundColor: "#070B18" }}>
      <AbsoluteFill style={{ background: "radial-gradient(120% 95% at 50% -8%, #12193a, #070B18 55%, #03050d)" }} />
      <ThreeCanvas width={1280} height={720} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 6], fov: 40 }} style={{ position: "absolute", inset: 0 }}>
        <ambientLight intensity={0.7} />
        <Rig />
        <Particles />
        <Core />
        <Headline {...props} />
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.35} luminanceSmoothing={0.3} />
          <Vignette eskil={false} offset={0.25} darkness={0.72} />
        </EffectComposer>
      </ThreeCanvas>
      <Kicker kicker={props.kicker} />
    </AbsoluteFill>
  );
};
