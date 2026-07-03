// Deterministic font readiness + word-width measurement for in-3D MSDF text.
//
// - useFontReady: preload the TTF into troika's SDF cache ONCE (inside the Remotion tree,
//   gated by delayRender) so <Text> renders synchronously and reproducibly.
// - useWordLayout: measure each word's advance with the SAME font via an offscreen 2D canvas
//   (registered as a FontFace) so we can lay words out individually for per-word stagger. Pure
//   function of (text, font, size) → deterministic every frame.
import { useEffect, useState } from "react";
import { delayRender, continueRender } from "remotion";
import { preloadFont } from "troika-three-text";

export function useFontReady(fontUrl: string, characters: string) {
  const [handle] = useState(() => delayRender("preload-font"));
  useEffect(() => {
    preloadFont({ font: fontUrl, characters }, () => continueRender(handle));
  }, [fontUrl, characters, handle]);
}

export type WordLayout = {
  words: string[];
  xs: number[];        // left-edge world-x of each word (anchorX="left")
  accent: boolean[];   // is this word part of the emphasis phrase
  gradX0: number;      // world-x extents of the accent run (for the gradient)
  gradX1: number;
  totalWidth: number;
};

const REF_PX = 100;
let familyCounter = 0;

export function useWordLayout(
  headline: string,
  fontUrl: string,
  fontSize: number,
  emphasis?: string
): WordLayout | null {
  const [handle] = useState(() => delayRender("measure-words"));
  const [layout, setLayout] = useState<WordLayout | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const family = `KFMeasure_${familyCounter++}`;
      const res = await fetch(fontUrl);
      const buf = await res.arrayBuffer();
      const face = new FontFace(family, buf);
      await face.load();
      (document as any).fonts.add(face);
      await (document as any).fonts.ready;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      ctx.font = `${REF_PX}px ${family}`;
      const em = (s: string) => ctx.measureText(s).width / REF_PX;

      const words = headline.split(/\s+/).filter(Boolean);
      const spaceW = em(" ") * fontSize;
      const widths = words.map((w) => em(w) * fontSize);
      const totalWidth = widths.reduce((a, b) => a + b, 0) + spaceW * Math.max(0, words.length - 1);

      const xs: number[] = [];
      let cursor = -totalWidth / 2;
      for (let i = 0; i < words.length; i++) {
        xs.push(cursor);
        cursor += widths[i] + spaceW;
      }

      // accent = the emphasis phrase located as a contiguous word run ANYWHERE in the
      // headline (not just the prefix), so "the future" / "one place" accent correctly.
      const norm = (s: string) => s.toLowerCase().replace(/[^\w%]/g, "");
      const emWords = emphasis ? emphasis.split(/\s+/).filter(Boolean).map(norm) : [];
      let accentStart = -1;
      if (emWords.length) {
        for (let i = 0; i + emWords.length <= words.length; i++) {
          if (emWords.every((w, j) => norm(words[i + j]) === w)) { accentStart = i; break; }
        }
      }
      const accent = words.map((_, i) => accentStart >= 0 && i >= accentStart && i < accentStart + emWords.length);

      const aStart = accentStart >= 0 ? accentStart : 0;
      const aEnd = accentStart >= 0 ? accentStart + emWords.length - 1 : words.length - 1;
      const gradX0 = xs[aStart];
      const gradX1 = xs[aEnd] + widths[aEnd];

      if (!cancelled) {
        setLayout({ words, xs, accent, gradX0, gradX1, totalWidth });
        continueRender(handle);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [headline, fontUrl, fontSize, emphasis, handle]);

  return layout;
}
