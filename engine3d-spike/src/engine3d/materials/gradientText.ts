// Horizontal gradient-fill for MSDF text (the cyan→purple accent look from the video).
//
// troika DERIVES its own SDF material from whatever base material you hand <Text>, applying
// the glyph alpha on top while preserving the base color logic. So we give it a MeshBasicMaterial
// whose fragment color is a gradient in WORLD-X. The gradient extents (x0..x1) are BAKED as GLSL
// literals at build time — no runtime uniforms — which survives troika's derivation cleanly and
// keeps the result deterministic. Because it's world-X, the gradient is CONTINUOUS across the
// separate per-word meshes, exactly as if the whole headline were one gradient.
import * as THREE from "three";

export function makeGradientTextMaterial(colorA: string, colorB: string, x0: number, x1: number) {
  const a = new THREE.Color(colorA);
  const b = new THREE.Color(colorB);
  const span = Math.max(1e-3, x1 - x0);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false });
  const f3 = (v: number) => v.toFixed(4);

  m.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying float vWX;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vWX = (modelMatrix * vec4(transformed, 1.0)).x;"
      );
    shader.fragmentShader =
      "varying float vWX;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n  float _t = clamp((vWX - (${f3(x0)})) / (${f3(span)}), 0.0, 1.0);\n` +
          `  diffuseColor.rgb = mix(vec3(${f3(a.r)}, ${f3(a.g)}, ${f3(a.b)}), vec3(${f3(b.r)}, ${f3(b.g)}, ${f3(b.b)}), _t);`
      );
  };
  // key so troika/three recompile when the gradient changes
  m.customProgramCacheKey = () => `kfgrad-${colorA}-${colorB}-${f3(x0)}-${f3(x1)}`;
  return m;
}
