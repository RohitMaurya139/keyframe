// Extract a headline number for the Stat archetype (port of scene_kit pickNumber), and the
// label text with the number stripped out.
export function pickNumber(headline: string, emphasis?: string): { value: number; suffix: string } {
  const src = emphasis || headline || "";
  const m = src.match(/(\d[\d,.]*)\s*(%|x|\+|k|m|bn)?/i);
  if (m) return { value: parseFloat(m[1].replace(/,/g, "")), suffix: (m[2] || "").toUpperCase().replace("BN", "B") };
  return { value: 100, suffix: "%" };
}

export function stripNumber(headline: string, emphasis?: string): string {
  if (emphasis && headline.includes(emphasis)) return headline.replace(emphasis, "").trim();
  return headline.replace(/(\d[\d,.]*)\s*(%|x|\+|k|m|bn)?/i, "").trim();
}

export function formatNumber(v: number, suffix: string): string {
  return `${Math.round(v).toLocaleString()}${suffix}`;
}
