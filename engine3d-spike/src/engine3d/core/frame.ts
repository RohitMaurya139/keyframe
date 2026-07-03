// Deterministic time + motion primitives. Everything downstream reads a FRAME number,
// never a wall clock — that is what makes the render reproducible (byte-identical).
import { Easing, interpolate } from "remotion";
import type { Beat } from "../../storyboard";

export const EASE = {
  out: Easing.out(Easing.cubic),
  outQuint: Easing.out(Easing.poly(5)),
  inOut: Easing.inOut(Easing.cubic),
  inOutSine: Easing.inOut(Easing.sin),
  expoOut: Easing.out(Easing.exp),
  back: Easing.out(Easing.back(1.7)),
} as const;

// map a named easing (from the storyboard beats) to a Remotion easing fn
export function easingFor(name?: string) {
  switch (name) {
    case "expo.out": return EASE.expoOut;
    case "back.out": return EASE.back;
    case "power2.in": return Easing.in(Easing.quad);
    case "power3.out": return EASE.out;
    case "sine.inOut": return EASE.inOutSine;
    default: return EASE.out;
  }
}

export const secToFrame = (sec: number, fps: number) => Math.round(sec * fps);

// resolve a beat's absolute frame (relative to the scene start) by matching action text
export function beatFrame(beats: Beat[] | undefined, match: string, fallbackSec: number, fps: number) {
  const b = beats?.find((x) => x.action.toLowerCase().includes(match));
  return secToFrame(b ? b.at : fallbackSec, fps);
}

// clamped interpolate helper (the 99% case)
export function tween(frame: number, inFrame: number, outFrame: number, from: number, to: number, easing = EASE.out) {
  return interpolate(frame, [inFrame, outFrame], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

// deterministic RNG — same seed → same sequence, every render
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// stable string → int seed (so a title/scene id yields a fixed look)
export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
