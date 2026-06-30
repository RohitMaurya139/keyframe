// SCENE MOTIFS — turns the storyboard's per-scene `visualMotif` text (which the kit
// used to ignore) into an ANIMATED VECTOR GRAPHIC placed in the scene's OPEN zone.
// This is the fix for the "text-only scene reads as empty / 60% dead space" problem:
// a headline-only scene now carries a relevant, on-brand moving graphic instead of a
// bare line of text on a void.
//
// Everything is deterministic (build-time numbers, finite repeats, CSS-opacity for the
// initial hidden state, fromTo tweens) so the captured runtime script stays lint-clean.
// The motif clip is data-layout-allow-occlusion (decorative, sits in the empty region).
// Tweens reference the kit's global `tl` timeline.

function hexToRgb(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return [124, 124, 124]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function r2(n) { return Math.round(n * 100) / 100; }
function reps(D, c) { return Math.max(0, Math.floor(D / c) - 1); }

// Route the LLM's free-text visualMotif to one of a fixed set of premium motifs.
function motifKind(text) {
  const t = String(text || "").toLowerCase();
  if (/\b(bar|chart|graph|growth|metric|stat|rising|increase|data|analytics|revenue)\b/.test(t)) return "bars";
  if (/\b(arrow|trend|upward|soar|launch|rocket|climb|boost|scale up)\b/.test(t)) return "arrow";
  if (/\b(circuit|network|connect|node|wire|integration|automation|pipeline|api|code)\b/.test(t)) return "circuit";
  if (/\b(orb|sphere|sun|bloom|halo|core|glow|pulse|energy|power)\b/.test(t)) return "orb";
  if (/\b(grid|tile|block|square|mosaic|module|gallery|collection)\b/.test(t)) return "grid";
  if (/\b(wave|sound|audio|signal|frequency|voice|speech|music)\b/.test(t)) return "wave";
  if (/\b(spark|burst|star|particle|confetti|scatter|magic|ai|spark)\b/.test(t)) return "spark";
  if (/\b(stack|layer|card|paper|document|page|file|content|article|blog|post|write)\b/.test(t)) return "stack";
  return "orbit"; // a clean concentric-ring system — the safe premium default
}

// box: { x, y, w, h } in PX within the scene (the open zone). Returns {html, script}.
function buildMotif({ visualMotif, theme, id, box, T, L, D }) {
  const kind = motifKind(visualMotif);
  const acc = theme.accent, acc2 = theme.accent2 || theme.accent, ink = theme.ink;
  const mid = `#${id}_mo`;
  const W = Math.round(box.w), H = Math.round(box.h);
  const cx = W / 2, cy = H / 2;
  const at = r2(T + 0.5);                 // motif enters just after the headline starts
  const span = r2(Math.max(1.2, L - 0.9));
  const els = [], tw = [];
  const wrap = (inner) =>
    `<div id="${id}_mo" class="clip" data-start="${r2(T)}" data-duration="${r2(L)}" data-track-index="${box.track}" data-layout-allow-occlusion style="opacity:0;">`
    + `<svg viewBox="0 0 ${W} ${H}" style="position:absolute;left:${box.x}px;top:${box.y}px;width:${W}px;height:${H}px;overflow:visible;">${inner}</svg></div>`;

  tw.push(`tl.fromTo("${mid}",{opacity:0},{opacity:1,duration:0.6},${at});`);

  if (kind === "bars") {
    const n = 5, bw = W / (n * 1.8), gap = bw * 0.8, baseY = H * 0.92;
    const hs = [0.45, 0.7, 0.55, 0.95, 0.78];
    for (let i = 0; i < n; i++) {
      const x = (W - (n * bw + (n - 1) * gap)) / 2 + i * (bw + gap);
      const bh = Math.round(H * 0.8 * hs[i]);
      const col = i % 2 ? acc2 : acc;
      els.push(`<rect class="${id}b${i}" x="${r2(x)}" y="${r2(baseY - bh)}" width="${r2(bw)}" height="${bh}" rx="${r2(bw * 0.2)}" fill="${rgba(col, 0.85)}" style="transform-box:fill-box;transform-origin:center bottom;"/>`);
      tw.push(`tl.fromTo(".${id}b${i}",{scaleY:0},{scaleY:1,duration:0.55,ease:"back.out(1.4)"},${r2(at + 0.1 + i * 0.08)});`);
      tw.push(`tl.to(".${id}b${i}",{scaleY:${r2(0.9 + (i % 3) * 0.06)},duration:${1.4 + i * 0.2},ease:"sine.inOut",yoyo:true,repeat:${reps(span, 1.6)}},${r2(at + 0.9)});`);
    }
    els.push(`<line x1="0" y1="${r2(baseY)}" x2="${W}" y2="${r2(baseY)}" stroke="${rgba(ink, 0.18)}" stroke-width="2"/>`);
  } else if (kind === "arrow") {
    const len = Math.round(W * 0.86);
    els.push(`<polyline class="${id}p" points="${r2(W * 0.06)},${r2(H * 0.82)} ${r2(W * 0.4)},${r2(H * 0.55)} ${r2(W * 0.62)},${r2(H * 0.66)} ${r2(W * 0.94)},${r2(H * 0.2)}" fill="none" stroke="${acc}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"/>`);
    els.push(`<polyline class="${id}h" points="${r2(W * 0.78)},${r2(H * 0.2)} ${r2(W * 0.94)},${r2(H * 0.2)} ${r2(W * 0.94)},${r2(H * 0.36)}" fill="none" stroke="${acc}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0;"/>`);
    els.push(`<circle class="${id}d" cx="${r2(W * 0.06)}" cy="${r2(H * 0.82)}" r="6" fill="${acc2}" style="opacity:0;"/>`);
    tw.push(`tl.to(".${id}p",{strokeDashoffset:0,duration:1.0,ease:"power2.inOut"},${r2(at + 0.1)});`);
    tw.push(`tl.fromTo(".${id}h",{opacity:0},{opacity:1,duration:0.3},${r2(at + 1.0)});`);
    tw.push(`tl.fromTo(".${id}d",{opacity:0,scale:0},{opacity:1,scale:1,duration:0.4,transformOrigin:"center",ease:"back.out(2)"},${r2(at + 0.2)});`);
  } else if (kind === "circuit") {
    const lns = [[0.05, 0.3, 0.45, 0.3, 0.45, 0.7, 0.9, 0.7], [0.1, 0.85, 0.5, 0.85, 0.5, 0.5, 0.95, 0.5], [0.05, 0.55, 0.3, 0.55]];
    lns.forEach((p, i) => {
      const pts = []; for (let k = 0; k < p.length; k += 2) pts.push(`${r2(p[k] * W)},${r2(p[k + 1] * H)}`);
      const dl = Math.round(W * 1.5);
      els.push(`<polyline class="${id}l${i}" points="${pts.join(" ")}" fill="none" stroke="${i % 2 ? acc2 : acc}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" stroke-dasharray="${dl}" stroke-dashoffset="${dl}"/>`);
      pts.forEach((pt, k) => { if (k === 0 || k === pts.length - 1) els.push(`<circle class="${id}n${i}_${k}" cx="${pt.split(",")[0]}" cy="${pt.split(",")[1]}" r="5" fill="${i % 2 ? acc2 : acc}" style="opacity:0;"/>`); });
      tw.push(`tl.to(".${id}l${i}",{strokeDashoffset:0,duration:0.9,ease:"power2.inOut"},${r2(at + 0.1 + i * 0.2)});`);
      tw.push(`tl.fromTo(".${id}n${i}_0, .${id}n${i}_${pts.length - 1}",{opacity:0,scale:0},{opacity:1,scale:1,duration:0.3,transformOrigin:"center",ease:"back.out(2)"},${r2(at + 0.3 + i * 0.2)});`);
    });
  } else if (kind === "wave") {
    const segs = 24, amp = H * 0.22, midY = H * 0.5, step = W / segs;
    let d = `M 0 ${r2(midY)}`;
    for (let i = 1; i <= segs; i++) d += ` L ${r2(i * step)} ${r2(midY - Math.sin(i * 0.7) * amp * (0.5 + (i % 3) * 0.2))}`;
    const dl = Math.round(W * 1.6);
    els.push(`<path class="${id}w" d="${d}" fill="none" stroke="${acc}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${dl}" stroke-dashoffset="${dl}"/>`);
    tw.push(`tl.to(".${id}w",{strokeDashoffset:0,duration:1.1,ease:"power2.out"},${r2(at + 0.1)});`);
    tw.push(`tl.to(".${id}w",{attr:{transform:"translate(${r2(-step)},0)"},duration:1.4,ease:"sine.inOut",yoyo:true,repeat:${reps(span, 1.6)}},${r2(at + 1.1)});`);
  } else if (kind === "grid") {
    const cols = 3, rows = 3, pad = W * 0.06, cw = (W - pad * 2) / cols, ch = (H - pad * 2) / rows, sq = Math.min(cw, ch) * 0.62;
    let i = 0;
    for (let rN = 0; rN < rows; rN++) for (let c = 0; c < cols; c++) {
      const x = pad + c * cw + (cw - sq) / 2, y = pad + rN * ch + (ch - sq) / 2;
      els.push(`<rect class="${id}g${i}" x="${r2(x)}" y="${r2(y)}" width="${r2(sq)}" height="${r2(sq)}" rx="${r2(sq * 0.22)}" fill="${rgba((i % 3) ? acc : acc2, 0.7)}" style="transform-box:fill-box;transform-origin:center;"/>`);
      tw.push(`tl.fromTo(".${id}g${i}",{scale:0},{scale:1,duration:0.4,ease:"back.out(1.8)"},${r2(at + 0.1 + i * 0.05)});`);
      i++;
    }
    tw.push(`tl.to("${mid} rect",{y:"-=6",duration:1.6,ease:"sine.inOut",yoyo:true,stagger:0.08,repeat:${reps(span, 1.6)}},${r2(at + 1.0)});`);
  } else if (kind === "spark") {
    const n = 12;
    els.push(`<circle class="${id}c" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(Math.min(W, H) * 0.08)}" fill="${rgba(acc, 0.9)}" style="transform-box:fill-box;transform-origin:center;"/>`);
    tw.push(`tl.fromTo(".${id}c",{scale:0},{scale:1,duration:0.5,ease:"back.out(2)"},${r2(at)});`);
    tw.push(`tl.to(".${id}c",{scale:1.18,duration:1.2,ease:"sine.inOut",yoyo:true,repeat:${reps(span, 1.2)}},${r2(at + 0.5)});`);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, R = Math.min(W, H) * 0.42;
      const x2 = cx + Math.cos(ang) * R, y2 = cy + Math.sin(ang) * R;
      els.push(`<line class="${id}s${i}" x1="${r2(cx)}" y1="${r2(cy)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${i % 2 ? acc2 : acc}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${r2(R)}" stroke-dashoffset="${r2(R)}"/>`);
      tw.push(`tl.to(".${id}s${i}",{strokeDashoffset:${r2(R * 0.4)},duration:0.7,ease:"power2.out"},${r2(at + 0.2 + i * 0.03)});`);
    }
  } else if (kind === "stack") {
    const n = 3, cw = W * 0.6, ch = H * 0.26;
    for (let i = 0; i < n; i++) {
      const x = W * 0.12 + i * (W * 0.08), y = H * 0.62 - i * (ch * 0.86);
      els.push(`<rect class="${id}k${i}" x="${r2(x)}" y="${r2(y)}" width="${r2(cw)}" height="${r2(ch)}" rx="10" fill="${rgba(i === n - 1 ? acc : ink, i === n - 1 ? 0.9 : 0.14)}" stroke="${rgba(acc, 0.5)}" stroke-width="1.5" style="opacity:0;"/>`);
      tw.push(`tl.fromTo(".${id}k${i}",{opacity:0,y:18},{opacity:1,y:0,duration:0.5,ease:"power3.out"},${r2(at + 0.1 + i * 0.14)});`);
    }
    tw.push(`tl.to("${mid} rect",{y:"-=5",duration:1.8,ease:"sine.inOut",yoyo:true,stagger:0.1,repeat:${reps(span, 1.8)}},${r2(at + 1.0)});`);
  } else if (kind === "orb") {
    const R = Math.min(W, H) * 0.4;
    els.push(`<defs><radialGradient id="${id}og"><stop offset="0%" stop-color="${rgba(acc, 0.9)}"/><stop offset="60%" stop-color="${rgba(acc2, 0.4)}"/><stop offset="100%" stop-color="${rgba(acc2, 0)}"/></radialGradient></defs>`);
    els.push(`<circle class="${id}o" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R)}" fill="url(#${id}og)" style="transform-box:fill-box;transform-origin:center;"/>`);
    els.push(`<circle class="${id}r1" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 1.2)}" fill="none" stroke="${rgba(acc, 0.4)}" stroke-width="2" stroke-dasharray="6 12"/>`);
    tw.push(`tl.fromTo(".${id}o",{scale:0.4,opacity:0},{scale:1,opacity:1,duration:0.8,ease:"power2.out"},${r2(at)});`);
    tw.push(`tl.to(".${id}o",{scale:1.1,duration:1.6,ease:"sine.inOut",yoyo:true,repeat:${reps(span, 1.6)}},${r2(at + 0.8)});`);
    tw.push(`tl.to(".${id}r1",{rotation:360,svgOrigin:"${r2(cx)} ${r2(cy)}",duration:${r2(span)},ease:"none"},${r2(at)});`);
  } else { // orbit (default)
    const R = Math.min(W, H) * 0.4;
    els.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R)}" fill="none" stroke="${rgba(acc, 0.5)}" stroke-width="2.5" stroke-dasharray="5 14"/>`);
    els.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.6)}" fill="none" stroke="${rgba(acc2, 0.4)}" stroke-width="2" stroke-dasharray="3 10"/>`);
    els.push(`<circle class="${id}o1" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R)}" fill="none" stroke="none"/>`);
    els.push(`<circle class="${id}dot1" cx="${r2(cx + R)}" cy="${r2(cy)}" r="7" fill="${acc}" style="opacity:0;"/>`);
    els.push(`<circle class="${id}dot2" cx="${r2(cx - R * 0.6)}" cy="${r2(cy)}" r="5" fill="${acc2}" style="opacity:0;"/>`);
    els.push(`<circle class="${id}core" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.22)}" fill="${rgba(acc, 0.85)}" style="transform-box:fill-box;transform-origin:center;"/>`);
    tw.push(`tl.fromTo(".${id}core",{scale:0},{scale:1,duration:0.5,ease:"back.out(2)"},${r2(at)});`);
    tw.push(`tl.fromTo(".${id}dot1, .${id}dot2",{opacity:0},{opacity:1,duration:0.4},${r2(at + 0.3)});`);
    tw.push(`tl.to(".${id}dot1",{rotation:360,svgOrigin:"${r2(cx)} ${r2(cy)}",duration:${r2(Math.max(3, span * 0.9))},ease:"none",repeat:${reps(span, Math.max(3, span * 0.9))}},${r2(at)});`);
    tw.push(`tl.to(".${id}dot2",{rotation:-360,svgOrigin:"${r2(cx)} ${r2(cy)}",duration:${r2(Math.max(4, span))},ease:"none",repeat:${reps(span, Math.max(4, span))}},${r2(at)});`);
  }

  return { html: wrap(els.join("")), script: tw.join("\n") };
}

module.exports = { buildMotif, motifKind };
