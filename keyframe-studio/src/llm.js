// Minimal chat-completions client over fetch.
// Tries the KIE primary provider first (if configured), then OpenRouter,
// then the OpenRouter fallback model. No SDK dependency.
const config = require("./config");

function providers() {
  const list = [];
  if (config.llm.primary && config.llm.primary.apiKey) {
    list.push({
      name: "kie",
      baseUrl: config.llm.primary.baseUrl,
      model: config.llm.primary.model,
      apiKey: config.llm.primary.apiKey,
    });
  }
  list.push({
    name: "openrouter",
    baseUrl: config.llm.baseUrl,
    model: config.llm.model,
    apiKey: config.llm.apiKey,
  });
  if (config.llm.modelFallback && config.llm.modelFallback !== config.llm.model) {
    list.push({
      name: "openrouter-fallback",
      baseUrl: config.llm.baseUrl,
      model: config.llm.modelFallback,
      apiKey: config.llm.apiKey,
    });
  }
  return list;
}

async function callProvider(p, { system, user, maxTokens, temperature }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.requestTimeoutMs);
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
        "HTTP-Referer": config.llm.httpReferer,
        "X-Title": config.llm.xTitle,
      },
      body: JSON.stringify({
        model: p.model,
        temperature: temperature ?? config.llm.temperature,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${p.name} HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error(`${p.name}: empty completion`);
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Run a completion across the provider chain. Throws only if ALL fail. */
async function complete(opts) {
  const errors = [];
  for (const p of providers()) {
    try {
      console.log(`[llm] trying ${p.name} (${p.model})`);
      return await callProvider(p, opts);
    } catch (e) {
      console.warn(`[llm] ${p.name} failed: ${e.message}`);
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  throw new Error(`all LLM providers failed -> ${errors.join(" | ")}`);
}

/** Extract the first JSON object/array from a completion that may have prose or fences around it. */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in completion");
  // Walk to the matching close bracket, string-aware.
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error("unbalanced JSON in completion");
}

/** Extract a full HTML document from a completion (fenced or raw). */
function extractHtml(text) {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/<!doctype html|<html/i);
  if (start === -1) throw new Error("no HTML document found in completion");
  const endIdx = candidate.toLowerCase().lastIndexOf("</html>");
  if (endIdx === -1) throw new Error("HTML document is truncated (missing </html>)");
  return candidate.slice(start, endIdx + "</html>".length);
}

module.exports = { complete, extractJson, extractHtml };
