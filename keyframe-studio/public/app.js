// KEYFRAME Studio frontend: submit -> poll job -> render script -> premiere page.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const form = $("pitch-form");
  const urlInput = $("url-input");
  const briefInput = $("brief-input");
  const actionBtn = $("action-btn");
  const formError = $("form-error");
  const rec = document.querySelector(".hud-rec");

  let pollTimer = null;
  let currentJob = null;

  // ---- running timecode in the HUD ----
  const t0 = Date.now();
  setInterval(() => {
    const ms = Date.now() - t0;
    const f = Math.floor((ms % 1000) / 41.7); // ~24fps frames
    const s = Math.floor(ms / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    $("timecode").textContent =
      `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
  }, 120);

  // ---- film-leader countdown number cycles 3-2-1 ----
  const leaderNum = document.querySelector(".leader-num");
  if (leaderNum) {
    let n = 3;
    setInterval(() => { n = n === 1 ? 3 : n - 1; leaderNum.textContent = n; }, 1000);
  }

  function show(id) { $(id).classList.remove("hidden"); }
  function hide(id) { $(id).classList.add("hidden"); }
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = String(s ?? "");
    return d.innerHTML;
  }

  // ---- submit ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.textContent = "";
    const url = urlInput.value.trim();
    if (!url) { formError.textContent = "A URL is required."; return; }

    actionBtn.disabled = true;
    actionBtn.querySelector(".action-label").textContent = "ROLLING…";
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, requirements: briefInput.value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      $("prod-subject").textContent = url.replace(/^https?:\/\//, "");
      hide("stage-script"); hide("stage-premiere");
      $("console").textContent = "";
      document.querySelectorAll(".pipeline li").forEach((li) => li.classList.remove("active", "complete"));
      show("stage-production");
      rec.classList.add("live");
      rec.lastChild.textContent = "REC";
      $("stage-production").scrollIntoView({ behavior: "smooth" });
      poll(data.id);
    } catch (err) {
      formError.textContent = err.message;
      resetButton();
    }
  });

  function resetButton() {
    actionBtn.disabled = false;
    actionBtn.querySelector(".action-label").textContent = "ROLL CAMERA";
  }

  // ---- polling ----
  function poll(id) {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) throw new Error(`job poll failed (HTTP ${res.status})`);
        const job = await res.json();
        currentJob = job;
        renderProgress(job);
        if (job.error) {
          clearInterval(pollTimer);
          logLine(`✖ ${job.error}`, true);
          rec.classList.remove("live");
          rec.lastChild.textContent = "STANDBY";
          resetButton();
        } else if (job.stage === "done") {
          clearInterval(pollTimer);
          rec.classList.remove("live");
          rec.lastChild.textContent = "WRAPPED";
          renderScript(job);
          renderPremiere(job);
          resetButton();
        }
      } catch (err) {
        logLine(`✖ ${err.message}`, true);
      }
    }, 1500);
  }

  function renderProgress(job) {
    const order = ["analyzing", "scripting", "casting-assets", "composing", "done"];
    const idx = order.indexOf(job.stage);
    document.querySelectorAll(".pipeline li").forEach((li) => {
      const i = order.indexOf(li.dataset.stage);
      li.classList.toggle("active", i === idx && job.stage !== "done");
      li.classList.toggle("complete", i < idx || job.stage === "done");
    });
    const con = $("console");
    const text = (job.log || []).join("\n");
    if (con.dataset.len !== String(text.length)) {
      con.dataset.len = String(text.length);
      con.textContent = text;
      con.scrollTop = con.scrollHeight;
    }
  }

  function logLine(msg, isErr) {
    const con = $("console");
    const line = document.createElement("div");
    if (isErr) line.className = "err";
    line.textContent = msg;
    con.appendChild(line);
    con.scrollTop = con.scrollHeight;
  }

  // ---- script rendering ----
  function renderScript(job) {
    const s = job.script;
    if (!s) return;
    const m = s.meta || {};
    const pal = m.palette || {};

    $("script-meta").innerHTML = `
      <div class="kv"><b>TITLE</b><span>${esc(m.title)}</span></div>
      <div class="kv"><b>BRAND</b><span>${esc(m.brand)}</span></div>
      <div class="kv"><b>RUNTIME</b><span>${esc(m.durationSec)}s</span></div>
      <div class="kv"><b>TONE</b><span>${esc(m.tone)}</span></div>
      <div class="kv"><b>TYPE</b><span>${esc(m.typography?.display || "")} / ${esc(m.typography?.body || "")}</span></div>
      <div class="kv"><b>PALETTE</b><span class="swatches">${
        ["background", "ink", "accent", "accent2"]
          .filter((k) => pal[k])
          .map((k) => `<i style="background:${esc(pal[k])}" title="${esc(k)}: ${esc(pal[k])}"></i>`).join("")
      }</span></div>`;

    const a = s.audio || {};
    $("audio-plan").innerHTML = `
      <div><b>VOICEOVER</b>&nbsp; ${esc(a.voice?.style || "—")} · ${esc(a.voice?.gender || "")} · ${esc(a.voice?.pace || "")}</div>
      <div><b>MUSIC</b>&nbsp; ${esc(a.music?.mood || "—")} (${esc(a.music?.genre || "")}) — search: <span class="q">"${esc(a.music?.searchQuery || "")}"</span></div>
      ${(a.sfx || []).map((x) => `<div><b>SFX</b>&nbsp; ${esc(x.moment)}: ${esc(x.description)} — search: <span class="q">"${esc(x.searchQuery)}"</span></div>`).join("")}`;

    $("scenes").innerHTML = (s.scenes || []).map((sc, i) => `
      <article class="scene-card" style="animation-delay:${i * 90}ms">
        <div class="sc-head">
          <h3><b>${String(i + 1).padStart(2, "0")}</b>${esc(sc.name)}</h3>
          <span class="sc-dur">${esc(sc.durationSec)}s · ${esc(sc.transitionOut || "")}</span>
        </div>
        ${(sc.onScreenText || []).length ? `<p class="sc-screen">${sc.onScreenText.map(esc).join(" — ")}</p>` : ""}
        <p class="sc-vo">“${esc(sc.narration)}”</p>
        <div class="sc-block"><b>VISUAL</b>${esc(sc.visual)}</div>
        <div class="sc-block"><b>MOTION DIRECTION</b>${esc(sc.motionGraphics)}</div>
        ${(sc.assets || []).length ? `<div class="sc-assets">${
          sc.assets.map((as) => `<em class="${as.resolved ? "cast" : ""}">${esc(as.kind)}: ${esc(as.searchQuery)}${as.resolved ? " ✓" : ""}</em>`).join("")
        }</div>` : ""}
      </article>`).join("");

    show("stage-script");
  }

  // ---- premiere ----
  function renderPremiere(job) {
    $("premiere-title").textContent = job.script?.meta?.title || "FINAL CUT";
    $("preview").src = job.pageUrl;
    $("open-link").href = job.pageUrl;
    $("download-page").href = job.pageUrl;
    $("download-page").setAttribute("download", `${job.id}-page.html`);
    $("download-script").href = `/api/jobs/${job.id}/script`;
    $("engine-note").textContent =
      job.engine === "llm"
        ? "DIRECTED BY: AI COMPOSER ENGINE — every animation custom-built from the script."
        : "DIRECTED BY: HOUSE TEMPLATE ENGINE — the AI composer was unavailable, so the deterministic engine cut this version.";
    show("stage-premiere");
    $("stage-premiere").scrollIntoView({ behavior: "smooth" });
  }

  $("again-btn").addEventListener("click", () => {
    hide("stage-production"); hide("stage-script"); hide("stage-premiere");
    rec.classList.remove("live");
    rec.lastChild.textContent = "STANDBY";
    window.scrollTo({ top: 0, behavior: "smooth" });
    urlInput.focus();
  });
})();
