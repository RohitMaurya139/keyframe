// Dotted orbital rings — the "constellation network with orbital rings" motif. Instanced
// dots placed around concentric circles, slow rotation as a function of frame. Sits BEHIND
// the headline (negative z) so it reads as a background depth plane.
import React, { useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";

const RINGS = [
  { radius: 2.2, dots: 60, speed: 0.004 },
  { radius: 3.1, dots: 84, speed: -0.003 },
  { radius: 4.0, dots: 110, speed: 0.002 },
];
const TOTAL = RINGS.reduce((a, r) => a + r.dots, 0);

export const OrbitalRings: React.FC<{ color: string; z?: number; opacity?: number }> = ({
  color,
  z = -3.5,
  opacity = 0.5,
}) => {
  const frame = useCurrentFrame();
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const layout = useMemo(() => {
    const arr: { r: number; a: number; speed: number; s: number }[] = [];
    for (const ring of RINGS) {
      for (let i = 0; i < ring.dots; i++) {
        arr.push({ r: ring.radius, a: (i / ring.dots) * Math.PI * 2, speed: ring.speed, s: 0.018 });
      }
    }
    return arr;
  }, []);

  if (ref.current) {
    for (let i = 0; i < TOTAL; i++) {
      const d = layout[i];
      const a = d.a + frame * d.speed;
      dummy.position.set(Math.cos(a) * d.r, Math.sin(a) * d.r * 0.62, 0);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }

  return (
    <group position={[0, 0, z]}>
      <instancedMesh ref={ref} args={[undefined as any, undefined as any, TOTAL]}>
        <circleGeometry args={[1, 8]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
      </instancedMesh>
    </group>
  );
};
