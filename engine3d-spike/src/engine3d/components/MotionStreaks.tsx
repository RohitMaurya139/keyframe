// MotionStreaks — adds energy/depth behind the content: vertical DATA STREAMS (faint lines with
// bright dots flowing down) + diagonal LIGHT STREAKS (thin bright bars sweeping across). Sits
// behind the content plane so it never occludes text. All motion is a pure function of frame.
import React, { useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { mulberry32 } from "../core/frame";

const Z = -6;
const SPAN_Y = 5.2; // half-height in world units the streams travel
const SPAN_X = 7.2; // half-width the streaks travel

export const MotionStreaks: React.FC<{ color: string; seed?: number }> = ({ color, seed = 909 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const dotRef = useRef<THREE.InstancedMesh>(null);
  const streakRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 10 vertical data streams: a faint line + a bright dot flowing down each
  const streams = useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({ length: 10 }, () => ({ x: (r() - 0.5) * 15, speed: 0.7 + r() * 1.1, phase: r() * SPAN_Y * 2 }));
  }, [seed]);
  // 5 diagonal light streaks sweeping across
  const streaks = useMemo(() => {
    const r = mulberry32(seed + 3);
    return Array.from({ length: 5 }, () => ({ y: (r() - 0.5) * 8, speed: 1.4 + r() * 1.6, phase: r() * SPAN_X * 2, len: 1.1 + r() * 1.4 }));
  }, [seed]);

  if (dotRef.current) {
    streams.forEach((s, i) => {
      const y = SPAN_Y - ((t * s.speed + s.phase) % (SPAN_Y * 2));
      dummy.position.set(s.x, y, 0);
      dummy.scale.setScalar(0.05);
      dummy.updateMatrix();
      dotRef.current!.setMatrixAt(i, dummy.matrix);
    });
    dotRef.current.instanceMatrix.needsUpdate = true;
  }
  if (streakRef.current) {
    streaks.forEach((s, i) => {
      const x = -SPAN_X + ((t * s.speed + s.phase) % (SPAN_X * 2));
      dummy.position.set(x, s.y, 0);
      dummy.rotation.set(0, 0, -0.5);
      dummy.scale.set(s.len, 0.014, 1);
      dummy.updateMatrix();
      streakRef.current!.setMatrixAt(i, dummy.matrix);
    });
    streakRef.current.instanceMatrix.needsUpdate = true;
    dummy.rotation.set(0, 0, 0); // reset shared dummy
  }

  return (
    <group position={[0, 0, Z]}>
      {/* faint vertical guide lines for the data streams */}
      {streams.map((s, i) => (
        <mesh key={i} position={[s.x, 0, -0.2]}>
          <planeGeometry args={[0.012, SPAN_Y * 2]} />
          <meshBasicMaterial color={color} transparent opacity={0.05} toneMapped={false} />
        </mesh>
      ))}
      {/* flowing data dots */}
      <instancedMesh ref={dotRef} args={[undefined as any, undefined as any, streams.length]}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
      {/* diagonal light streaks */}
      <instancedMesh ref={streakRef} args={[undefined as any, undefined as any, streaks.length]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} toneMapped={false} />
      </instancedMesh>
    </group>
  );
};
