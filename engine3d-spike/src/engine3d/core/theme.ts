// Pack → visual theme. A slim port of scene_kit.js deriveTheme: ground/ink/accents/
// display font, plus brand-color seeding with an HSL lift so dark brand colors still
// read as visible accents on a dark ground. Deterministic (pure function of inputs).
import { staticFile } from "remotion";

export type Theme = {
  pack: string;
  isDark: boolean;
  gradients: boolean;
  groundTop: string;
  ground: string;
  groundBottom: string;
  ink: string;
  dim: string;
  accent: string;
  accent2: string;
  particle: string;
  line: string;
  displayFont: string; // TTF url for troika (in-3D MSDF text)
  bodyFontCss: string; // CSS family for DOM chrome (kicker pill)
};

const DISPLAY = {
  "space-grotesk": staticFile("fonts/SpaceGrotesk.ttf"),
  inter: staticFile("fonts/Inter-Bold.ttf"),
};

type Pack = Omit<Theme, "pack" | "accent" | "accent2"> & { accents: [string, string] };

const PACKS: Record<string, Pack> = {
  "midnight-glass": {
    isDark: true,
    gradients: true,
    groundTop: "#12193a",
    ground: "#070B18",
    groundBottom: "#03050d",
    ink: "#F4F7FF",
    dim: "#AEB9D6",
    particle: "#37E6FF",
    line: "rgba(120,150,255,0.35)",
    accents: ["#37E6FF", "#7C6BFF"],
    displayFont: DISPLAY["space-grotesk"],
    bodyFontCss: "Inter, system-ui, sans-serif",
  },
  "noir-spotlight": {
    isDark: true,
    gradients: false,
    groundTop: "#0b0b0c",
    ground: "#050506",
    groundBottom: "#000000",
    ink: "#F5F3EE",
    dim: "#9A968C",
    particle: "#C9A24B",
    line: "rgba(210,190,140,0.25)",
    accents: ["#E7C978", "#C9A24B"],
    displayFont: DISPLAY.inter,
    bodyFontCss: "Inter, system-ui, sans-serif",
  },
};

// --- HSL helpers for brand-color lift (dark brand hue → visible accent) ---
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}
function hslToHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function lift(hex: string, dark: boolean) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s } = rgbToHsl(r, g, b);
  // keep hue, force a legible lightness/saturation for the ground
  return hslToHex(h, Math.max(s, 0.58), dark ? 0.62 : 0.42);
}

export function deriveTheme(framePack: string, brandColors?: string[]): Theme {
  const p = PACKS[framePack] || PACKS["midnight-glass"];
  let [a1, a2] = p.accents;
  // brand colors PREPEND (keep pack ground/fonts) — first two non-neutral brand hues win
  const brand = (brandColors || []).filter((c) => /^#?[0-9a-f]{3,6}$/i.test(c));
  const usable = brand.map((c) => (c[0] === "#" ? c : `#${c}`)).filter((c) => {
    const { r, g, b } = hexToRgb(c);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx - mn > 24 && mx > 40; // skip near-neutral / near-black brand tokens
  });
  if (usable[0]) a1 = lift(usable[0], p.isDark);
  if (usable[1]) a2 = lift(usable[1], p.isDark);
  return { pack: framePack, ...p, accent: a1, accent2: a2 };
}
