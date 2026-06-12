// Lenient JSON extraction for LLM replies. Models occasionally append
// commentary, a second object, or stray tokens after the JSON payload even
// in json mode (observed with gemini-3.5-flash: valid envelope followed by
// trailing junk -> "Unexpected non-whitespace character after JSON").
// Strategy: strip fences, try a straight parse, then fall back to extracting
// the first balanced top-level object (string-aware brace matching).

function extractFirstJsonObject(text) {
  const t = String(text).trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");

  try { return JSON.parse(t); } catch { /* fall through to extraction */ }

  const start = t.indexOf("{");
  if (start < 0) throw new Error("no JSON object found in reply");

  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(t.slice(start, i + 1));
    }
  }
  throw new Error("unbalanced JSON object in reply");
}

module.exports = { extractFirstJsonObject };
