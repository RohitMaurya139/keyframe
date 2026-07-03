// Deterministic image-texture loading for user assets (logo / photo / screenshot).
// Assets arrive as base64 data-URIs in props (so there are no file-serving/path issues in
// the headless render). Loading is async → gate the frame with delayRender until the texture
// is decoded, then it renders reproducibly. Same pattern as the font preload.
import { useEffect, useState } from "react";
import { delayRender, continueRender } from "remotion";
import * as THREE from "three";

export function useImageTexture(src?: string): THREE.Texture | null {
  const [handle] = useState(() => delayRender("load-texture"));
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!src) { continueRender(handle); return; }
    let cancelled = false;
    new THREE.TextureLoader().load(
      src,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        if (!cancelled) { setTex(t); continueRender(handle); }
      },
      undefined,
      () => { if (!cancelled) continueRender(handle); } // fail-open: no texture, render continues
    );
    return () => { cancelled = true; };
  }, [src, handle]);
  return tex;
}

// natural aspect ratio (w/h) of a loaded texture, with a fallback until it's ready
export function texAspect(tex: THREE.Texture | null, fallback = 1.6): number {
  const img: any = tex?.image;
  return img && img.width && img.height ? img.width / img.height : fallback;
}
