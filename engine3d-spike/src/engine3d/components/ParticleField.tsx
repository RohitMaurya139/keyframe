// Constellation depth layer: instanced dots + connecting lines (nearest-neighbour graph),
// drifting as one group so the links always match the dots. One InstancedMesh + one
// LineSegments = 2 draw calls. Sits on the particle depth plane; drift is a function of frame.
import React, { useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { mulberry32 } from "../core/frame";
import { DEPTH } from "../core/depth";

export const ParticleField: React.FC<{ color: string; count?: number; seed?: number; links?: boolean }> = ({
  color,
  count = 240,
  seed = 1337,
  links = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const pts = useMemo(() => {
    const r = mulberry32(seed);
    const arr: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      arr.push(new THREE.Vector3((r() - 0.5) * 20, (r() - 0.5) * 12, (r() - 0.5) * 6));
    }
    return arr;
  }, [count, seed]);

  const sizes = useMemo(() => {
    const r = mulberry32(seed + 7);
    return pts.map(() => r() * 0.05 + 0.012);
  }, [pts, seed]);

  // nearest-neighbour link graph (built once → deterministic constellation edges)
  const lineGeo = useMemo(() => {
    if (!links) return null;
    const verts: number[] = [];
    const added = new Set<string>();
    for (let i = 0; i < pts.length; i++) {
      // find the 2 nearest neighbours of i
      const near = pts
        .map((p, j) => ({ j, d: i === j ? Infinity : p.distanceToSquared(pts[i]) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      for (const { j, d } of near) {
        if (d > 9) continue; // don't link across huge gaps
        const key = i < j ? `${i}_${j}` : `${j}_${i}`;
        if (added.has(key)) continue;
        added.add(key);
        verts.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, [pts, links]);

  // static dot layout inside the group (the GROUP drifts, so links stay attached)
  if (meshRef.current) {
    for (let i = 0; i < count; i++) {
      dummy.position.copy(pts[i]);
      const tw = 1 + 0.3 * Math.sin(frame / fps * 2 + i);
      dummy.scale.setScalar(sizes[i] * tw);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }
  const t = frame / fps;
  if (groupRef.current) {
    groupRef.current.rotation.z = Math.sin(t * 0.15) * 0.04;
    groupRef.current.position.x = Math.sin(t * 0.2) * 0.4;
    groupRef.current.position.y = Math.cos(t * 0.16) * 0.3;
  }

  return (
    <group ref={groupRef} position={[0, 0, DEPTH.particles]}>
      <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, count]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
      {lineGeo ? (
        <lineSegments geometry={lineGeo}>
          <lineBasicMaterial color={color} transparent opacity={0.14} toneMapped={false} />
        </lineSegments>
      ) : null}
    </group>
  );
};
