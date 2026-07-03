// LLM client — KIE AI (Gemini 3.5 Flash) as the sole text-generation provider.
// Exposes chat() returning { text, tokensIn, tokensOut, model }.
//
// History: this module used to run a KIE-primary -> OpenRouter-fallback cascade.
// Now KIE is the sole LLM TEXT provider here (no fallback). TTS/voiceover runs on
// OpenRouter's gpt-audio family — see tts.js — NOT in this module. Formerly named
// openrouter.js.
//
// KIE quirk handled here: KIE returns transport-level errors as HTTP 200 with a
// JSON body {code, msg, data} (code !== 200). The OpenAI SDK would treat that as
// a success and yield empty content, so we use raw fetch and inspect the body
// explicitly, mapping code -> err.status so isRetryable() works.
//
// Because there is no longer a second provider to fall through to, callKie() owns
// its own resilience: it retries transient failures (429/402/5xx/timeout) AND
// "lazy stop" bad completions (empty body, or truncated JSON in json mode) on the
// same model with backoff before surfacing the error to the caller.

const config = require("../config");
const { extractFirstJsonObject } = require("./json_lenient");

function isRetryable(err) {
  // Empty / truncated-JSON completions are flagged retryable by callKie (gemini
  // "lazy stop" returns finish_reason:"stop" with a near-empty body — not an HTTP
  // error, so we synthesize one to drive a retry).
  if (err?.retryable === true) return true;
  const status = err?.status || err?.response?.status;
  if (status === 429) return true;
  // 402 = the key's credit limit can't cover this request's max_tokens ceiling.
  if (status === 402) return true;
  if (status >= 500 && status < 600) return true;
  const code = err?.code || err?.cause?.code || err?.name;
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND" ||
      code === "APIConnectionTimeoutError" || code === "AbortError") return true;
  if (err?.message && /\btimed out\b|\baborted\b/i.test(err.message)) return true;
  return false;
}

// Combine an optional external AbortSignal (e.g. the pipeline stage budget) with
// a per-call timeout, so EITHER firing cancels the in-flight request promptly.
function withTimeoutSignal(external, timeoutMs, timeoutMsg) {
  const timeoutAc = new AbortController();
  const timer = setTimeout(() => timeoutAc.abort(new Error(timeoutMsg)), timeoutMs);
  const signal = external ? AbortSignal.any([external, timeoutAc.signal]) : timeoutAc.signal;
  return { signal, clear: () => clearTimeout(timer) };
}

// ---------- KIE AI (Gemini 3.5 Flash) via raw fetch, with same-model retries ----------
async function callKie({ messages, jsonMode, temperature, timeoutMs, stage, signal: external }) {
  const p = config.llm.primary;
  const url = `${p.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: p.model,
    messages,
    stream: false, // KIE defaults stream:true — must force false for a single JSON response
    temperature: temperature ?? config.llm.temperature,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const MAX_ATTEMPTS = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (external?.aborted) throw external.reason || new Error("kie: aborted");
    const { signal, clear: hardTimer } = withTimeoutSignal(external, timeoutMs, "kie call timed out");
    const t0 = Date.now();
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
      const dt = Date.now() - t0;
      const rawText = await resp.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        const err = new Error(`kie: non-JSON response (HTTP ${resp.status}): ${rawText.slice(0, 200)}`);
        err.status = resp.status;
        throw err;
      }

      // KIE returns transport errors in-body with HTTP 200: {code, msg, data}.
      if (data && typeof data.code === "number" && data.code !== 200) {
        const err = new Error(`kie: API error ${data.code} — ${data.msg || "unknown"}`);
        err.status = data.code; // 429/5xx -> retryable via isRetryable()
        throw err;
      }
      if (!resp.ok) {
        const err = new Error(`kie: HTTP ${resp.status} — ${rawText.slice(0, 200)}`);
        err.status = resp.status;
        throw err;
      }

      const text = data.choices?.[0]?.message?.content ?? "";
      const finish = data.choices?.[0]?.finish_reason;

      // Guard against gemini's intermittent "lazy stop": a 200-OK response whose
      // body is empty or — in JSON mode — a truncated/unbalanced object. It is
      // NOT an HTTP error, so without this the caller gets junk. Synthesize a
      // retryable error so this same model is retried before we give up.
      let badCompletion = null;
      if (!text.trim()) {
        badCompletion = `empty completion (finish=${finish}, out=${data.usage?.completion_tokens ?? 0})`;
      } else if (jsonMode) {
        try { extractFirstJsonObject(text); }
        catch { badCompletion = `truncated/unparseable JSON (finish=${finish}, ${text.length}ch)`; }
      }
      if (badCompletion) {
        const e = new Error(`kie: ${badCompletion}`); e.retryable = true; throw e;
      }

      const tokensIn = data.usage?.prompt_tokens ?? 0;
      const tokensOut = data.usage?.completion_tokens ?? 0;
      console.log(`[kie] ${p.model} stage=${stage || "?"} ok (${dt}ms, in=${tokensIn} out=${tokensOut}, ${text.length}ch)`);
      return { text, tokensIn, tokensOut, model: p.model };
    } catch (err) {
      const dt = Date.now() - t0;
      const tag = err?.status || err?.code || err?.name || err?.message?.slice(0, 80) || "unknown";
      console.warn(`[kie] ${p.model} stage=${stage || "?"} FAILED after ${dt}ms: ${tag}`);
      lastErr = err;
      hardTimer();
      if (attempt < MAX_ATTEMPTS && isRetryable(err) && !external?.aborted) {
        const backoff = 1500 * attempt;
        console.warn(`[kie] ${p.model} transient ${tag} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    } finally {
      hardTimer();
    }
  }
  throw lastErr;
}

async function chat({ system, user, jsonMode = false, temperature, model, stage, signal }) {
  if (signal?.aborted) throw signal.reason || new Error("llm: aborted before dispatch");

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  // Per-stage timeout: the composer authors a ~25KB document from a ~140KB
  // prompt and is legitimately slow — a flat ceiling times it out and re-sends
  // the giant prompt on retry. Heavy stages get a longer ceiling.
  const timeoutMs = Math.max(
    10_000,
    Number(config.llm.requestTimeoutByStage?.[stage]) || Number(config.llm.requestTimeoutMs) || 90_000
  );

  // Per-stage temperature: a distilled, decision-table-driven stage (composer)
  // should TRANSCRIBE its recipe, not improvise — low temp makes the model copy
  // defaults instead of inventing variance. Explicit caller arg always wins.
  const effTemp = temperature ?? config.llm.temperatureByStage?.[stage] ?? config.llm.temperature;

  // NOTE: `model` is accepted for backward compatibility (e.g. script.js's
  // escalation lap) but ignored — KIE serves a single model bound to its baseUrl.
  // A caller wanting a "stronger" retry simply gets another KIE attempt (with
  // whatever corrected prompt it supplies), which is what those call sites rely on.
  void model;

  const p = config.llm.primary;
  console.log(`[llm] provider=kie:${p.model} stage=${stage || "?"} dispatching (sys=${system.length}ch user=${user.length}ch json=${jsonMode} timeout=${timeoutMs}ms)`);

  return await callKie({ messages, jsonMode, temperature: effTemp, timeoutMs, stage, signal });
}

// KIE credit pre-flight. Probes GET /api/v1/chat/credit -> { code, data:<credits> }.
// Returns { remaining, limit } where `remaining` is the account's KIE credit
// balance and `limit` is null (a prepaid balance has no ceiling), or null when
// the probe fails so callers treat it as "unknown — proceed". 60s cache, since a
// job calls it twice (script + production) within seconds.
let budgetCache = { at: 0, value: null };
async function checkBudget() {
  if (Date.now() - budgetCache.at < 60_000) return budgetCache.value;
  const key = config.llm.primary && config.llm.primary.apiKey;
  if (!key) return null;
  let value = null;
  try {
    const r = await fetch("https://api.kie.ai/api/v1/chat/credit", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) {
      const remaining = Number((await r.json())?.data);
      if (Number.isFinite(remaining)) value = { remaining, limit: null };
    }
  } catch { /* probe optional — null means "unknown, proceed" */ }
  budgetCache = { at: Date.now(), value };
  return value;
}

// Minimum KIE credits required to START a job — a fail-fast floor so an
// essentially-empty account errors up front instead of dying mid-render. A short
// TTS clip is ~12 credits and a full job runs to a few hundred, so 20 catches the
// "basically broke" case without blocking small jobs. Override: config.llm.minCredits.
const MIN_CREDITS = Number(config.llm.minCredits) > 0 ? Number(config.llm.minCredits) : 20;

const BUDGET_EXHAUSTED_MSG =
  "LLM budget exhausted — the KIE AI key is out of credit or rate-limited. " +
  "Add credits or check the key at kie.ai.";

module.exports = { chat, checkBudget, BUDGET_EXHAUSTED_MSG, MIN_CREDITS };
