// scene_kit_3d.js — a deterministic Three.js depth-particle BACKDROP for the scene-kit.
//
// Renders under the HyperFrames determinism contract: a full-duration <canvas> clip whose
// WebGL frame is a PURE FUNCTION of timeline time. It is driven by a GSAP PROXY tween
// (tl.to(proxy,{onUpdate:renderAt(t)})) — the authoritative HyperFrames pattern for
// procedural canvases — so the capture engine seeks it exactly like every other layer.
// NO rAF / Date.now / clock deltas (those would desync the frame capture).
//
// Three is loaded as the UMD build (global `THREE`) via a classic <script src> — the lint
// (`missing_three_script`) only recognises a classic script tag, not a bare ESM import.
// Rules honoured: procedural geometry only (a seeded point cloud), colours ONLY from the
// pack/brand palette, pinned size + pixelRatio 1, subtle + slow, fails safe (if the CDN or
// WebGL is unavailable the canvas stays transparent and the pack background shows through).
// Applied on DARK packs only, where additive points read as glow (they wash out on light).

const THREE_SRC = "https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js";

// Build the three <script src>, the <canvas>, the classic setup script (which defines
// window.__kf3dRenderAt), and the GSAP proxy-tween line that drives it. Returns
// { html, gsap } or null when not applicable.
function build3DBackground(theme, dims, D, seed) {
  if (!theme || !theme.isDark) return null; // additive points glow on dark; wash out on light
  const W = dims.width, H = dims.height;
  const accent = /^#[0-9a-f]{6}$/i.test(theme.accent || "") ? theme.accent : "#7CC4FF";
  const accent2 = /^#[0-9a-f]{6}$/i.test(theme.accent2 || "") ? theme.accent2 : accent;
  const s = ((seed >>> 0) || 7) >>> 0;
  const dur = Math.round(D * 100) / 100;

  // Canvas on track 8 (free; above the pack ground/glow/signature at 0–6, below scene
  // content at 20+). data-layout-allow-occlusion — content clips sit over it by design.
  const html =
    `<script src="${THREE_SRC}"></script>\n` +
    `<canvas id="kf3d" class="clip" data-start="0" data-duration="${dur}" data-track-index="8" data-layout-allow-occlusion width="${W}" height="${H}"></canvas>\n` +
    `<script>\n` +
    `try{\n` +
    `  var cv=document.getElementById("kf3d");\n` +
    // seeded PRNG (mulberry32) — deterministic point layout, no Math.random()
    `  var _a=${s}>>>0;var rnd=function(){_a|=0;_a=_a+0x6D2B79F5|0;var t=Math.imul(_a^_a>>>15,1|_a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};\n` +
    `  var rn=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true});rn.setSize(${W},${H},false);rn.setPixelRatio(1);\n` +
    `  var sc=new THREE.Scene();var cam=new THREE.PerspectiveCamera(46,${W}/${H},0.1,100);cam.position.set(0,0,7);\n` +
    `  var N=560,pos=new Float32Array(N*3),col=new Float32Array(N*3);\n` +
    `  var c1=new THREE.Color("${accent}"),c2=new THREE.Color("${accent2}");\n` +
    `  for(var i=0;i<N;i++){pos[i*3]=(rnd()-0.5)*15;pos[i*3+1]=(rnd()-0.5)*9;pos[i*3+2]=(rnd()-0.5)*11-2;var c=rnd()<0.5?c1:c2;col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}\n` +
    `  var g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(pos,3));g.setAttribute("color",new THREE.BufferAttribute(col,3));\n` +
    `  var m=new THREE.PointsMaterial({size:0.055,vertexColors:true,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});\n` +
    `  var pts=new THREE.Points(g,m);sc.add(pts);\n` +
    // renderAt(t): ALL motion from t. Gentle Y-spin + X-wobble + camera parallax; opacity
    // fades in over 1.2s and out over the last 1.2s so it never pops on/off.
    `  window.__kf3dRenderAt=function(t){var fi=Math.min(1,t/1.2),fo=(t>${dur}-1.2)?Math.max(0,(${dur}-t)/1.2):1;m.opacity=0.6*fi*fo;pts.rotation.y=t*0.05;pts.rotation.x=Math.sin(t*0.11)*0.07;cam.position.x=Math.sin(t*0.16)*0.55;cam.position.y=Math.cos(t*0.13)*0.32;cam.lookAt(0,0,0);rn.render(sc,cam);};\n` +
    `  window.__kf3dRenderAt(0);\n` +
    `}catch(e){/* CDN/WebGL unavailable → transparent canvas, pack bg shows through */}\n` +
    `</script>`;

  // Deterministic driver: a proxy tween on the main timeline, built SYNCHRONOUSLY in the
  // main <script>. onUpdate is guarded so it no-ops if the three script hasn't defined the
  // renderer yet. ease:"none" so t maps linearly to timeline time.
  const gsap = `var __kf3d={t:0};tl.to(__kf3d,{t:${dur},duration:${dur},ease:"none",onUpdate:function(){if(window.__kf3dRenderAt)window.__kf3dRenderAt(__kf3d.t);}},0);`;

  return { html, gsap };
}

module.exports = { build3DBackground };
