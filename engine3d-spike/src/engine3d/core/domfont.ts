// Register the bundled TTFs as CSS FontFaces for the DOM content layer (dense scenes use
// crisp DOM cards/type over the 3D canvas). Gated by delayRender so type never flashes/falls
// back mid-render. KFDisplay = Space Grotesk (headlines), KFBody = Inter (copy).
import { useEffect, useState } from "react";
import { delayRender, continueRender, staticFile } from "remotion";

const FACES = [
  { family: "KFDisplay", url: staticFile("fonts/SpaceGrotesk.ttf") },
  { family: "KFBody", url: staticFile("fonts/Inter-Bold.ttf") },
];

export function useDomFonts() {
  const [handle] = useState(() => delayRender("dom-fonts"));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        for (const f of FACES) {
          const face = new FontFace(f.family, `url(${f.url})`);
          await face.load();
          (document as any).fonts.add(face);
        }
        await (document as any).fonts.ready;
      } catch { /* fail-open */ }
      if (!cancelled) continueRender(handle);
    })();
    return () => { cancelled = true; };
  }, [handle]);
}
