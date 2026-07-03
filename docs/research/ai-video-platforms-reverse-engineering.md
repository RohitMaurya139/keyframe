# Reverse-Engineering the State of the Art in AI Video Generation

**A technical research study for building a world-class text/image/asset-to-video platform**

Author: Senior AI Research Engineer / Generative Video Architect (prepared for the KEYFRAME project)
Last updated: 2026-07-01
Status: Living document — combines public facts with informed engineering inference.

---

## 0. How to read this report

### 0.1 Confidence legend

Because none of the frontier labs publish full architecture details, every claim is tagged so you can tell fact from inference:

- **[V] Verified** — stated in an official paper, model card, docs, or release blog.
- **[R] Reported** — credible third-party reporting, leaks, or maintainer statements (not first-party but well-sourced).
- **[I] Inferred** — a strong engineering deduction from behavior, benchmarks, adjacent open models, or standard practice.
- **[A] Assumption** — a reasonable guess where evidence is thin; treat as a hypothesis to validate.

Rule of thumb: **open models (CogVideoX, Mochi, Wan, HunyuanVideo, LTX-Video) are [V]** because we have the weights and papers. **Closed models (Veo, Sora, Kling, Runway, etc.) are mostly [I]/[R]** — we reverse-engineer them by triangulating from (a) their published research lineage, (b) the open models their teams also ship, and (c) observed behavior on benchmarks.

### 0.2 Methodology

The analysis triangulates from five source classes:

1. **Primary research papers** — Sora technical report, CogVideoX, Mochi, HunyuanVideo, Movie Gen, DiT, Latent Diffusion, Stable Video Diffusion, flow-matching literature.
2. **Open-weight reference implementations** that mirror the closed systems' techniques (the single most useful source — you can read the actual code).
3. **Official product docs / model cards / release blogs.**
4. **Independent benchmarks** — VBench / VBench++, Artificial Analysis Video Arena, Movie Gen Bench, human-preference Elo boards.
5. **Engineering community** — ComfyUI ecosystem, Diffusers, xDiT, HF discussions, r/StableDiffusion.

### 0.3 The single most important insight

> **The frontier is 90% converged on one architecture.** Every leading 2024–2026 system is a **latent video diffusion Transformer (a "Video DiT")** trained with **flow matching**, operating in the latent space of a **3D (spatio-temporal) causal VAE**, conditioned on **dense synthetic captions** produced by a VLM, with text encoded by **T5-XXL and/or an LLM**. The differences that produce visible quality gaps are **data quality, caption quality, VAE quality, model scale, and post-training (RLHF/reward models)** — *not* exotic architecture. This is very good news if you are building a platform: the recipe is public, and open weights (Wan 2.2, HunyuanVideo, CogVideoX) put you within striking distance of Kling-1.x-class quality.

---

## 1. Foundations: the shared architecture of modern video generators

Read this once; every platform section below refers back to it.

### 1.1 The canonical stack (what "everyone" does now)

```
              TEXT PROMPT / IMAGE / REFERENCE
                          │
        ┌─────────────────┼─────────────────────┐
        ▼                 ▼                      ▼
  Text encoder       Image encoder          (optional) LLM
  (T5-XXL / LLM)     (VAE-encode +          prompt rewriter /
   → text tokens      CLIP/SigLIP)           storyboard planner
        │                 │                      │
        └────────►  CROSS-ATTENTION / CONCAT  ◄──┘
                          │
                   ┌──────▼───────┐
                   │  VIDEO DiT    │  ← denoises a latent video tensor
                   │ (flow-match)  │     shape ≈ [C, T', H', W']
                   │  N transformer│     over K sampling steps
                   │  blocks w/    │
                   │  3D attention │
                   └──────┬───────┘
                          │  clean latent
                   ┌──────▼───────┐
                   │  3D VAE       │  ← decodes latent → pixels
                   │  DECODER      │
                   └──────┬───────┘
                          │
                     RAW FRAMES  →  upscale → interpolate → audio → mux
```

### 1.2 Component-by-component

**3D VAE (spatio-temporal autoencoder) [V for open models].**
Compresses raw video `[3, T, H, W]` into a compact latent `[C, T/rt, H/rs, W/rs]`. Typical compressions: **8× spatial, 4× temporal** (CogVideoX, Wan) up to **8×8×8 or higher** (newer models). Mochi's AsymmVAE hits **128× spatial-area (8×8) and 6× temporal, 12 latent channels** [V]. The VAE is *causal* in time (each latent frame depends only on past frames) so you can stream/extend. **The VAE is the quality ceiling** — no diffusion model can recover detail the VAE threw away. Labs invest enormous effort here; it is one of the biggest closed-vs-open gaps.

**Video DiT (Diffusion Transformer) [V: Peebles & Xie 2023; used by all].**
Replaces the U-Net of image diffusion with a Transformer over **patchified latent tokens**. The latent video is cut into 3D patches ("spacetime patches" in Sora's language [V]), flattened to a token sequence, and denoised. Attention variants:
- **Full 3D attention** (every token attends to every token across space *and* time) — best quality/consistency, O(N²) cost. Used by CogVideoX, HunyuanVideo, Wan [V].
- **Factorized / separated spatial+temporal attention** — cheaper, slightly weaker long-range coherence. Used by many earlier/lighter models (AnimateDiff-lineage, some Open-Sora configs) [V].
- **Sparse / windowed / hybrid** — emerging for long-context (minutes).

**Conditioning [V/I].**
- *Text*: **T5-XXL** encoder is the workhorse (CogVideoX, Mochi, Wan, PixArt lineage) [V]. HunyuanVideo uses a **decoder-only MLLM (LLaVA-style)** as the text encoder for better prompt following [V]. Many closed models likely use an in-house LLM encoder [I].
- *Image (I2V)*: encode the conditioning image with the VAE and concatenate along the latent-frame axis, or inject via cross-attention + CLIP/SigLIP embeddings [V].
- *Injection*: **cross-attention** (text) and **adaptive LayerNorm / AdaLN-Zero** for timestep + global conditioning [V, DiT].

**Training objective: flow matching / rectified flow [V, dominant since 2024].**
Instead of the classic DDPM ε-prediction, modern models learn a **velocity field** along a straight probability path from noise to data (rectified flow / conditional flow matching). Benefits: fewer sampling steps, more stable training, cleaner motion. Wan, Mochi, HunyuanVideo, SD3/Flux all use flow matching [V]. Sora/Veo almost certainly do too [I].

**Sampling.** 30–50 solver steps (Euler / DPM-style ODE solvers for flow models), plus **classifier-free guidance (CFG)**. Acceleration: **caching** (TeaCache, FBCache), **step distillation** (LCM/DMD/Turbo variants), **guidance distillation** to drop CFG's 2× cost.

**Post-training (the closed-model moat) [I/R].**
Frontier quality comes from **supervised fine-tuning on curated cinematic data + RLHF/reward-model alignment** for aesthetics, motion quality, and prompt adherence — plus **prompt upsampling** (an LLM rewrites the user's short prompt into a dense, model-friendly caption matching the training caption distribution). This last trick alone is worth a large jump in perceived quality and is trivial to adopt.

### 1.3 Why quality varies so much despite shared architecture

| Lever | Impact on perceived quality | Who wins |
|---|---|---|
| **Training data (cinematic, licensed/scraped film)** | Huge | Veo (YouTube-scale), Sora, Kling |
| **Caption density/quality (VLM recaptioning)** | Huge | Sora [V it recaptions], Veo, Seedance |
| **VAE fidelity** | Huge (detail ceiling) | Closed labs; Wan-VAE strong in open |
| **Model scale (params × tokens)** | Large | Veo, Sora, Seedance |
| **Post-training / reward models** | Large | Kling, Runway, Seedance |
| **Motion-specific data & physics priors** | Large | Kling, Veo 3, Sora 2 |
| **Resolution/step budget at inference** | Medium | anyone who pays for compute |

Keep this table in mind: **as a builder, your fastest ROI is caption quality + prompt upsampling + a great VAE + curated fine-tune data**, not a novel architecture.

---

## 2. Platform deep-dives

Each platform: **(A) Product overview** with quality scored across your requested dimensions, **(B) reverse-engineered architecture & pipeline**, **(C) most-likely model design**. Scores are 1–5 relative to the 2025–2026 field (5 = best-in-class), based on benchmarks + community consensus; they are judgments, not lab-published numbers.

> Scoring dimensions: Video quality (VQ), Animation/motion realism (AM), Motion consistency/temporal stability (MC), Character consistency (CC), Camera control (CAM), Prompt adherence (PA).

---

### 2.1 Google Veo (DeepMind)

**(A) Overview.** Veo 2 (Dec 2024) and **Veo 3 (May 2025, Google I/O)** are the flagship. Veo 3's headline feature is **native, synchronized audio generation** — dialogue with lip-sync, sound effects, and ambient sound produced *jointly* with video, not bolted on [V, DeepMind]. Available via **Gemini app, Vertex AI, the Gemini API, and Flow** (Google's AI filmmaking tool). Outputs up to **4K** (Veo 2) and strong 1080p (Veo 3), 8s base clips extendable. All outputs carry **SynthID** watermarking [V].

- Strengths: **best-in-class physical realism and prompt adherence**; native audio is a genuine moat; excellent camera-language understanding; strong text rendering.
- Weaknesses: heavy gating/cost; conservative content filters; clip-length limits; less "editable" than Runway.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 5  | 5  | 5  | 4  | 5   | 5  |

**(B) Reverse-engineered pipeline [I/R].**
- Prompt → **Gemini (LLM) prompt understanding + upsampling** to a dense caption; likely also a lightweight **scene/shot plan** for longer generations [I].
- **Latent video diffusion Transformer** with joint audio-video modeling. Veo 3's synchronized audio implies a **joint or tightly-coupled A/V latent space** (audio latent tokens attended alongside video tokens), or a cascaded audio model conditioned on the video latent + captions [I]. DeepMind's lineage (Imagen Video, Lumiere, VideoPoet) informs this: Lumiere's **Space-Time U-Net** [V] and VideoPoet's **LLM-tokenized** approach [V] are ancestors, but Veo is most likely a **DiT + flow-matching** system [I] given the field's convergence.
- Trained on **YouTube-scale video** [R, widely reported] — the data advantage no competitor can match.
- **Cascaded super-resolution** to 4K [I], SynthID watermark at the end [V].

**(C) Likely design:** large Video DiT, 3D VAE, T5/Gemini-derived text conditioning, flow matching, **joint A/V generation**, cascaded upsamplers, RLHF on aesthetics + physics. **The audio-video joint model is the differentiator to study.**

---

### 2.2 OpenAI Sora (and Sora 2)

**(A) Overview.** Original **Sora** revealed Feb 2024 with the report *"Video generation models as world simulators"* [V] — the paper that popularized **spacetime patches** and **variable duration/resolution/aspect-ratio training**. Public **Sora Turbo** launched Dec 2024. **Sora 2** (late 2025) added **synchronized audio, stronger physical consistency, and "cameos"** (insert a real person/identity via a consent-based reference) plus a social app [V/R].

- Strengths: long-range coherence, world-model-like physics, flexible aspect ratios/durations, strong prompt adherence, (Sora 2) audio + identity insertion.
- Weaknesses: still hallucinates physics on complex interactions; heavy moderation; limited fine-grained camera/editing controls vs Runway; access/cost.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 5  | 5  | 5  | 4  | 4   | 5  |

**(B) Reverse-engineered pipeline [V where cited, else I].**
- **Video compression network (VAE)** encodes video into a lower-dim **spacetime latent**; the model operates on **spacetime patches** as tokens [V, report].
- **DiT** backbone (the report explicitly frames Sora as a diffusion *transformer*) [V].
- **Re-captioning**: they train a **highly descriptive captioner** (DALL·E 3-style) and at inference **GPT expands the user's short prompt** into a long detailed caption [V, report]. *This is the clearest first-party confirmation that prompt-upsampling is central to frontier quality.*
- Variable-resolution/duration training via patch-count flexibility [V].
- Sora 2: joint audio + identity conditioning [R].

**(C) Likely design:** large DiT over a strong spacetime VAE, flow-matching/diffusion, GPT-based caption upsampling, trained for "world simulation" (emergent 3D consistency, object permanence). **Take-aways for you: variable-token training, aggressive recaptioning, scale.**

---

### 2.3 Runway (Gen-3 / Gen-4)

**(A) Overview.** The **creator/editor-first** platform. **Gen-3 Alpha** (2024) → **Gen-4** (2025) improved consistency and physics. Distinct features: **Act-One** (drive a character's facial performance from a webcam/video of an actor) [V], **Frames** (stylized image model), **Aleph** (in-context video editing — re-light, change environment, remove/add objects on an existing video) [V], plus classic tools: **Motion Brush**, **Director Mode camera controls**, **keyframes**.

- Strengths: **the best editing/controllability toolkit**; Act-One is a standout for character performance; strong creator workflow and API.
- Weaknesses: raw fidelity/physics a notch below Veo/Sora/Kling; short clips; consistency across long sequences still hard.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 4  | 4  | 4  | 4  | 5   | 4  |

**(B) Reverse-engineered pipeline [I].**
- Video DiT + 3D VAE + flow matching [I].
- **Act-One** = a **performance-transfer / portrait-animation model** (facial keypoints/expression codes from driving video → conditioning on target character) — conceptually adjacent to open work like LivePortrait / EMO / X-Portrait [I].
- **Motion Brush** = **region-conditioned motion** (user paints a region + direction → trajectory/optical-flow conditioning injected into the DiT), akin to DragNUWA / Tora [I].
- **Director Mode camera** = camera-trajectory conditioning (Plücker-ray embeddings) à la CameraCtrl / MotionCtrl [I].
- **Aleph** = in-context/instruction-based video editing — a model conditioned on source video + edit instruction [I].

**(C) Likely design:** DiT foundation + a **suite of control adapters** (motion, camera, identity, edit). **Runway's real lesson for you is product surface: expose motion brush, camera presets, keyframes, and editing — controllability is a product moat even at slightly lower raw fidelity.**

---

### 2.4 Kling AI (Kuaishou)

**(A) Overview.** Launched June 2024; iterated fast: **Kling 1.0 → 1.5 → 1.6 → 2.0 → 2.1** (and "Master" tiers). Consistently rated **near the top for motion realism and physical plausibility** among accessible tools. Features: up to ~**2-minute** generation, **Motion Brush**, **lip-sync**, **Elements / multi-image reference** (bring characters/objects), start+end **keyframes**, camera controls.

- Strengths: **excellent motion & physics**, strong human/animal dynamics, long durations, good consistency, aggressive iteration cadence, strong I2V.
- Weaknesses: occasional morphing on complex scenes; moderation + regional access; prompt adherence slightly behind Veo/Sora on abstract prompts.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 5  | 5  | 4  | 4  | 4   | 4  |

**(B) Reverse-engineered pipeline [R/I].**
- Kuaishou has publicly described Kling as a **DiT + 3D VAE latent diffusion** system with **3D spatiotemporal attention** [R, Kuaishou tech talks/marketing].
- **Elements/multi-reference** = subject-reference conditioning (image encoder features injected + identity preservation) [I].
- **Motion Brush / camera** = trajectory + camera conditioning as above [I].
- Strong motion likely from **large-scale short-video (Kuaishou platform) data** + motion-focused post-training [I].

**(C) Likely design:** large Video DiT, high-quality 3D VAE, flow matching, multi-reference conditioning, heavy motion-data curation. **Study Kling for motion realism and multi-image reference UX.**

---

### 2.5 Luma Dream Machine (Luma Labs)

**(A) Overview.** **Dream Machine** (June 2024), engine line **Ray1.6 → Ray2** (2025). Luma began as a **3D/NeRF** company, which shows in strong **3D-consistent camera motion**. Features: **keyframes** (start/end image interpolation), **extend**, **loop**, natural-language camera moves, image model (Photon).

- Strengths: fluid, aesthetically pleasing motion; good camera coherence; fast; friendly UX; strong keyframe interpolation.
- Weaknesses: prompt adherence and fine detail behind Veo/Sora/Kling; occasional physics slips; shorter clips.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 4  | 4  | 4  | 3  | 4   | 4  |

**(B) Reverse-engineered pipeline [I].** Video DiT + 3D VAE + flow matching; keyframe conditioning = condition on first+last latent frames and denoise the in-between [I]; camera coherence possibly aided by 3D-aware training or data from their NeRF heritage [A].

**(C) Likely design:** DiT foundation optimized for speed + camera coherence. **Study Luma for keyframe interpolation UX and camera fluidity.**

---

### 2.6 Pika (Pika Labs)

**(A) Overview.** Consumer/creator, **effects-first**. **Pika 1.0 → 1.5 (Pikaffects) → 2.0 (Scene Ingredients: bring your own characters/objects/scenes) → 2.1 → 2.2 (Pikaframes: keyframe transitions)**, plus Turbo. Known for viral **effects** (inflate, melt, explode, crush) and playful I2V.

- Strengths: fun/effects, ease of use, **Scene Ingredients** (composable user assets), fast, cheap.
- Weaknesses: lower raw fidelity/physics than the top tier; short clips; less "cinematic."

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 3  | 3  | 3  | 3  | 3   | 3  |

**(B) Reverse-engineered pipeline [I].** DiT/latent-diffusion foundation; **Pikaffects** = curated effect LoRAs / conditioned transformations; **Scene Ingredients** = multi-subject reference conditioning; **Pikaframes** = keyframe interpolation [I].

**(C) Take-away:** Pika shows the value of **packaged, named effects** and **user-asset compositing** for consumer engagement — a monetizable UX layer on top of a mid-tier model.

---

### 2.7 Hailuo AI (MiniMax)

**(A) Overview.** MiniMax's **Hailuo** line: **video-01**, **T2V/I2V-01**, **I2V-01-Live** (anime/illustration motion), **S2V-01** (subject reference), and **Hailuo 02** (2025). Punches above its price on **motion quality and prompt adherence**; strong with stylized/anime.

- Strengths: excellent motion for the cost, good prompt following, strong anime/stylized I2V, subject reference.
- Weaknesses: short clips, occasional artifacts, limited editing/camera controls.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 4  | 4  | 4  | 4  | 3  | 4  |

**(B) Reverse-engineered pipeline [R/I].** MiniMax is an LLM lab; Hailuo is a **DiT latent-video-diffusion** system [I]. Hailuo 02 has been described around an efficiency-oriented architecture (compute redistribution to hard regions) [R]. **S2V** = subject-reference identity conditioning [I]. **Take-away:** strong price/performance via efficient inference + good captions.

---

### 2.8 PixVerse (AIsphere)

**(A) Overview.** **PixVerse V2 → V3 → V3.5 → V4 → V4.5**: fast, effects-rich, popular for **anime** and social. Features: **lip-sync**, **effects templates**, **Character-to-Video** (consistent character from a reference), fast turnaround, mobile app.

- Strengths: speed, effects/templates, character reference, anime, low cost, good mobile UX.
- Weaknesses: fidelity/physics below top tier; short clips; consistency varies.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 3  | 4  | 3  | 4  | 3  | 3  |

**(B) Pipeline [I].** DiT + 3D VAE; **Character-to-Video** = subject-reference conditioning; **effects** = curated conditioned transforms/LoRAs. **Take-away:** template + effects marketplace UX drives consumer virality.

---

### 2.9 Vidu (Shengshu Technology + Tsinghua)

**(A) Overview.** From Shengshu / Tsinghua, authors of **U-ViT** (a ViT-based diffusion backbone that predates/parallels DiT) [V, U-ViT paper]. Vidu's signature is **"Reference-to-Video" multi-subject consistency** — supply up to **~7 reference subjects** (characters, objects, scenes) and Vidu keeps them consistent [V/R]. Line includes **Vidu Q1**.

- Strengths: **best-in-class multi-subject reference consistency** among accessible tools; fast; good for character-driven storytelling and ads.
- Weaknesses: raw cinematic fidelity below Veo/Sora/Kling; shorter clips.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 4  | 4  | 4  | 5  | 3  | 4  |

**(B) Pipeline [V/I].** **U-ViT/DiT** backbone + 3D VAE; **multi-reference conditioning** is the core research contribution (encode each subject, inject identity tokens, train the model to bind them) [I]. **Take-away:** Vidu is the reference implementation to emulate for **asset/character-driven video** — directly relevant to your KEYFRAME user-asset feature.

---

### 2.10 Seedance (ByteDance / Seed team)

**(A) Overview.** **Seedance 1.0 / 1.0 Pro** (2025) topped **Artificial Analysis** and VBench-style leaderboards in 2025 [R], often #1 for **overall quality + multi-shot consistency + prompt adherence** at competitive speed/cost. Part of ByteDance's **Doubao/Seed** stack (with **Seedream** image model and **SeedVR** restoration/upscaling).

- Strengths: **top-tier overall quality**, **native multi-shot storytelling with consistency**, strong motion, fast, cost-effective, excellent prompt adherence.
- Weaknesses: access/region; closed; moderation.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 5  | 5  | 5  | 5  | 4  | 5  |

**(B) Pipeline [R/I].** ByteDance published a **Seedance technical report** describing a **DiT** trained with **multi-stage pretraining + RLHF**, strong **data pipeline + recaptioning**, and **native multi-shot** generation with consistency; **SeedVR2** provides diffusion-based restoration/upscaling [R/V]. **Take-away:** Seedance is the current bar for **multi-shot narrative consistency** — study its multi-shot approach and its restoration model pairing.

---

### 2.11 Wan (Alibaba Tongyi Wanxiang) — **open weights**

**(A) Overview.** **Wan 2.1** open-sourced Feb 2025 (**1.3B** and **14B**), **Wan 2.2** later in 2025 introducing a **MoE (mixture-of-experts) DiT** with separate high-noise/low-noise experts [V]. Apache-2.0. Ships **T2V, I2V, VACE** (unified video editing/reference), and a strong **Wan-VAE**. The **1.3B model runs on a single consumer GPU (~8GB)** [V] — a gift for builders.

- Strengths: **best open model family for production**; permissive license; VACE gives editing/reference; strong motion; runs locally.
- Weaknesses: below Veo/Sora/Kling on raw fidelity; needs engineering for scale/speed.

| VQ | AM | MC | CC | CAM | PA |
|----|----|----|----|-----|----|
| 4  | 4  | 4  | 4  | 4  | 4  |

**(B) Design [V].** Flow-matching Video DiT, Wan-VAE (high compression), T5 (umT5) text encoder, 3D attention; Wan 2.2 adds MoE experts specialized by noise level. **VACE** unifies reference-to-video, inpainting, extension, and control. **Take-away: Wan 2.2 (14B) or 1.3B is the most likely foundation for your platform's self-hosted tier.**

---

### 2.12 CogVideoX (Zhipu AI / THUDM, Tsinghua) — **open weights**

**(A) Overview.** **CogVideoX-2B / 5B / 5B-I2V** and **CogVideoX1.5**; Apache-2.0; the **most-studied open reference implementation** with a detailed paper [V]. Introduced/popularized several now-standard tricks.

- Strengths: **best-documented architecture**; great for learning and fine-tuning; solid quality; strong Diffusers/ComfyUI support; big fine-tune/LoRA ecosystem.
- Weaknesses: below Wan/Hunyuan latest on fidelity/motion; short clips.

**(B) Design [V, from the paper] — read this to understand the whole field:**
- **3D causal VAE** (8×8 spatial, 4× temporal compression) [V].
- **Expert Transformer** with **Expert Adaptive LayerNorm** to handle the text-vs-video modality gap [V].
- **3D full attention** (joint spatial+temporal) for coherence [V].
- **Progressive training + a dedicated video-recaptioning pipeline** (they caption training videos densely with a VLM) [V].
- **3D RoPE** positional encoding [V].

**Take-away: CogVideoX is your textbook.** If you want to *understand* how Kling/Sora likely work, read and run CogVideoX first.

---

### 2.13 Mochi 1 (Genmo) — **open weights**

**(A) Overview.** **Mochi 1** (Oct 2024), Apache-2.0, **10B params** (largest open video model at release) [V]. Praised for **motion quality and prompt adherence**.

**(B) Design [V]:**
- **AsymmDiT (Asymmetric Diffusion Transformer)** — asymmetric handling of the (larger) visual stream vs the (smaller) text stream to save params/compute on text [V].
- **AsymmVAE** — **8×8 spatial, 6× temporal compression, 12-channel latent** (128× spatial-area reduction) [V].
- **Single T5-XXL** text encoder [V]; full 3D attention; flow matching [V].

**Take-away:** Mochi shows how to **spend parameters where they matter (video, not text)** — an efficiency pattern worth copying.

---

### 2.14 Honorable mentions you should also study (open)

- **HunyuanVideo (Tencent, 13B, open, Dec 2024) [V]** — currently one of the strongest *open* models; uses a **decoder-only MLLM text encoder**, dual/single-stream DiT (Flux-like), 3D VAE, flow matching. **Best open fidelity contender alongside Wan.** Also **HunyuanVideo-Avatar / HunyuanCustom** for identity.
- **LTX-Video (Lightricks) [V]** — **real-time-ish DiT** with a very high-compression VAE; the model to study for **latency/throughput**.
- **Open-Sora (HPC-AI Tech) & Open-Sora-Plan (PKU) [V]** — open reproductions of the Sora recipe; great architecture references and training code.
- **Stable Video Diffusion (Stability) [V]** — the image-to-video workhorse of 2023–24; still ubiquitous in ComfyUI.
- **AnimateDiff [V]** — motion-module adapters over SD; foundational for the LoRA/adapter era and still used for stylized/anime.
- **Allegro (Rhymes AI), Pyramid Flow, EasyAnimate (Alibaba), CausVid/Self-Forcing (autoregressive real-time) [V]** — worth knowing.

---

## 3. The canonical 15-stage generation pipeline (your reference diagram, made concrete)

Your requested pipeline maps to what a *production narrative* system does. Below, each stage lists **Inputs → Outputs → Models → Implementation → Open-source alternative**. Note a critical reality check first:

> **Reality check [I]:** monolithic models (Veo/Sora/Kling) do **NOT** literally run 15 discrete stages. The diffusion model *implicitly* handles scene/character/environment/camera/motion inside one denoising process. The explicit multi-stage pipeline is what **orchestration platforms** (and what *you* should build) do to get **controllable, long, multi-shot, on-brand** video from these models. So this pipeline is the **director/agent layer you build around the generators.**

```
                         ┌────────────────────────────────────────────┐
                         │  ORCHESTRATION / DIRECTOR LAYER (you build) │
                         └────────────────────────────────────────────┘
 User prompt ─► Prompt understanding ─► Scene planning ─► Shot planning ─► Storyboard
      │                                                                        │
      └────────────────────────── keyframe images (per shot) ◄────────────────┘
                                          │
        ┌──────────────── per-shot loop (parallelizable) ───────────────┐
        │  Character gen ─ Environment gen ─ Camera plan ─ Motion plan   │
        │                         │                                       │
        │                   VIDEO GENERATION (the diffusion model)        │
        │                         │                                       │
        │            Temporal consistency  ─►  Upscaling                  │
        └───────────────────────────────────────────────────────────────┘
                                          │
             Audio (VO + music + SFX) ─► Final render / mux / subtitles ─► Export
```

### Stage-by-stage

**1. Prompt understanding**
- *In:* raw user text/image/URL/assets. *Out:* structured intent (subjects, style, mood, aspect ratio, duration, brand constraints).
- *Models:* an **LLM** (GPT-4o/Claude/Gemini/Llama/Qwen) with function-calling → JSON. *Impl:* system prompt + JSON schema; extract entities, resolve references to uploaded assets. *OSS:* Qwen2.5/Llama-3.x + Outlines/Instructor for structured output.

**2. Scene planning**
- *In:* structured intent. *Out:* ordered list of scenes (setting, beat, duration). *Models:* LLM "screenwriter" agent. *Impl:* chain-of-thought → scene JSON. *OSS:* LangGraph/your own agent loop.

**3. Shot planning**
- *In:* scenes. *Out:* shots per scene (shot size, angle, camera move, subject action, lens). *Models:* LLM "cinematographer" agent (few-shot with film-grammar examples). *OSS:* same.

**4. Storyboard creation**
- *In:* shots. *Out:* **one keyframe image per shot** (visual anchor). *Models:* **T2I** (Flux, SDXL, Imagen, Seedream, GPT-image) with **character/style locking** (IP-Adapter/LoRA). *Impl:* generate first-frame per shot; reuse character reference for identity. *OSS:* **Flux.1-dev + IP-Adapter/PuLID + InstantID**; ComfyUI.

**5. Character generation**
- *In:* character brief + reference(s). *Out:* canonical character reference set (turnaround, expression sheet) + identity embedding. *Models:* T2I + **ID adapters** (PuLID/InstantID/PhotoMaker) or a per-character **LoRA/DreamBooth**. *OSS:* PuLID, InstantID, PhotoMaker, Flux LoRA training.

**6. Environment generation**
- *In:* setting brief. *Out:* background plate / establishing image / (optional) 3D or panorama. *Models:* T2I; optionally **panorama/3D** (e.g., pano diffusion, or a NeRF/3DGS plate for camera moves). *OSS:* SDXL/Flux; MVDream/Zero123 for 3D-ish; 3DGS for plates.

**7. Camera planning**
- *In:* shot's camera intent. *Out:* camera trajectory (path + FOV per frame) → **Plücker-ray embeddings** or preset tokens. *Models/Impl:* map film verbs (dolly/orbit/crane) to trajectories; feed as conditioning. *OSS:* **CameraCtrl, MotionCtrl, ReCamMaster**, Uni3C.

**8. Motion planning**
- *In:* subject action + camera. *Out:* motion conditioning: trajectories, optical-flow hints, or pose/skeleton sequences. *Models/Impl:* trajectory drawing (Motion Brush), pose from a driving video, or leave to the diffusion prior. *OSS:* **Tora (trajectory DiT), DragNUWA, DragAnything**; **ControlNet-pose / DWPose / Densepose** for human motion; **Champ/MimicMotion/Animate-Anyone** for pose-driven human video.

**9. Video generation (the core)**
- *In:* keyframe(s) + text + camera + motion + identity. *Out:* raw latent → decoded frames for the shot. *Models:* **Video DiT** (Wan/Hunyuan/CogVideoX self-hosted; or Veo/Kling/Seedance/Runway via API). *Impl:* I2V from the storyboard keyframe (huge consistency win vs pure T2V); start+end keyframe for controlled transitions. *OSS:* Wan 2.2, HunyuanVideo, CogVideoX1.5, LTX-Video.

**10. Temporal consistency**
- *In:* generated frames / adjacent shots. *Out:* flicker-free, identity-stable video. *Models/Impl:* mostly *intrinsic* to 3D-attention DiT; across shots, **carry the last frame of shot N as the first-frame condition of shot N+1**, reuse identity embeddings, fix seeds/style. Post-hoc: **optical-flow-guided smoothing**, deflicker. *OSS:* RAFT flow, FILM/RIFE interpolation, deflicker nodes.

**11. Upscaling**
- *In:* base-res frames (e.g., 720p). *Out:* 1080p/4K. *Models:* **diffusion video upscalers / restoration** (SeedVR2-style), latent upscalers, or per-frame image SR + temporal consistency. *OSS:* **SeedVR2, Real-ESRGAN, StableSR/AuraSR (per-frame), Topaz (commercial)**; add RIFE/FILM for FPS uplift.

**12. Audio generation**
- *In:* video + script + mood. *Out:* dialogue/VO, music, SFX, ambience. *Models:* **TTS** (ElevenLabs, or OSS: XTTS/F5-TTS/Kokoro), **music** (Suno/Udio, or OSS: MusicGen/Stable Audio), **video-to-SFX** (MMAudio, FoleyCrafter), **lip-sync** (LatentSync/Wav2Lip/OmniHuman). Native A/V (Veo 3/Sora 2) does this jointly. *OSS:* MMAudio, F5-TTS, MusicGen, LatentSync.

**13. Final rendering / mux / subtitles / export**
- *In:* video + audio + captions. *Out:* delivered file. *Models/Impl:* **FFmpeg** (mux, color, encode), **Whisper** for auto-subtitles, burn-in or sidecar SRT, brand overlays. *OSS:* FFmpeg, faster-whisper, ASS/SRT.

---

## 4. Animation system analysis (how motion is actually produced)

**The central truth [V/I]:** modern AI video does **not** rig skeletons, simulate cloth, or run fluid solvers. **Motion is learned end-to-end** — the diffusion model has seen millions of clips and *predicts plausible pixel/latent trajectories over time*. Walking, blinking, cloth, smoke, and water all emerge from the **learned spatio-temporal prior**, not from explicit physics engines. Explicit control is layered on top via conditioning.

| Motion type | How it's produced (frontier) [I] | Explicit-control OSS |
|---|---|---|
| Walking / running | Learned gait prior from data; I2V + pose conditioning for control | Animate-Anyone, Champ, MimicMotion, MagicAnimate (pose-driven) |
| Facial expressions | Learned; or driven by expression codes | LivePortrait, EMO, Runway Act-One, Hallo |
| Eye movement / blinking | Emergent micro-motion prior; audio-driven models add it | EMO, SadTalker, Hallo |
| Lip movement | Emergent, OR dedicated **audio→viseme** model | LatentSync, Wav2Lip, MuseTalk, OmniHuman-1 |
| Hand movement | Hardest — weak data → artifacts; pose/mesh conditioning helps | DWPose hands, mesh (SMPL-X) conditioning |
| Cloth simulation | Learned drape/flow prior (no solver) | — (intrinsic) |
| Hair simulation | Learned motion prior | — (intrinsic) |
| Water / smoke / fire | Learned fluid-like prior — a strength of big video models | — (intrinsic); strong in Kling/Veo |
| Crowd movement | Learned; consistency degrades with count | — (intrinsic) |

**Motion planning / trajectories / keyframes / interpolation / temporal coherence:**
- **Trajectory conditioning** — user/agent supplies motion paths → injected as conditioning. OSS: **Tora** (trajectory-oriented DiT), **DragNUWA**, **DragAnything**, **MOFA-Video**.
- **Keyframe generation + interpolation** — generate anchor frames (storyboard/T2I), then **condition the video model on start (+end) frames**; classic **frame interpolation** (RIFE, FILM, AMT) fills FPS. Pika Pikaframes / Luma keyframes / Kling start-end are productized versions of this.
- **Temporal coherence** — primarily from **3D/full attention** + **3D VAE** + **flow matching**; augmented by seed/style locking and cross-shot first-frame carryover.

**Engineering takeaway:** for *controllable* human motion (dance, sports, product demos), the winning pattern is **pose-driven I2V** (Animate-Anyone/Champ lineage): extract pose from a reference video with DWPose, condition the video DiT on the pose sequence + a character reference image. This gives you motion you can *direct*, not just sample.

---

## 5. Character consistency (the hardest, highest-value problem)

Consistency requirements escalate: **within a frame < across frames < across shots < across scenes < across a long video / multiple videos.** Intrinsic 3D-attention handles within-shot; everything longer needs explicit identity conditioning.

### Techniques, weakest→strongest

1. **Seed + prompt locking** — same seed/style/prompt. Cheap, fragile. [I]
2. **First-frame / keyframe conditioning (I2V)** — generate a canonical character image once, drive every shot as I2V from it, and **carry the last frame forward**. The **single most effective, cheapest** technique. [I]
3. **Reference-image conditioning (identity adapters)** — inject face/subject embeddings. OSS: **IP-Adapter, PuLID, InstantID, PhotoMaker** (images); **ID-Animator, ConsisID, Phantom, SkyReels-A2, HunyuanCustom** (video). This is what **Vidu "reference-to-video," Kling "elements," Runway Gen-4 references, Pika "scene ingredients"** are, productized. [I]
4. **Per-character LoRA / DreamBooth** — fine-tune a small adapter on 10–30 images of the character → strongest identity lock, at the cost of a training step per character. Best for **recurring brand mascots/talent**. [V technique]
5. **Multi-shot-native models** — Seedance/Sora generate several consistent shots in one pass by design. [R]

### The production recipe you should build (identity layer)

```
Character created once:
  reference images ──► ID embedding (ArcFace/CLIP)         ──┐
                  └──► optional per-character LoRA (trained)  ├─► "Character Asset"
                                                              │   (stored, reusable)
Per shot:
  Character Asset + shot keyframe (T2I w/ ID adapter)  ──► I2V video DiT
  last frame of shot N ──────────────────────────────► first-frame cond of shot N+1
```

- Store a **canonical reference set + ID embedding + (optional) LoRA** per character in your DB (see §12).
- Use **ID adapter for zero-shot**, upgrade to **LoRA for premium/recurring** characters.
- **Across scenes:** re-anchor from the canonical reference each scene (don't drift from carried frames indefinitely).

This section is the direct blueprint for KEYFRAME's user-asset/character feature — Vidu and HunyuanCustom are your closest open references.

---

## 6. Camera system (cinematic camera control)

**How it works [I]:** camera moves are produced either (a) **implicitly** from prompt words ("drone shot," "slow dolly in") that the model learned to associate with motion, or (b) **explicitly** via **camera-trajectory conditioning**. The explicit method encodes the camera path as **Plücker ray embeddings** (a 6-D ray per pixel per frame) and injects them into the DiT — this is the technique in **CameraCtrl** and **MotionCtrl** [V], and conceptually what Runway's **Director Mode** and Kling/Luma camera controls do [I].

| Move | Definition | Implementation |
|---|---|---|
| Pan / Tilt | rotate on axis | prompt verbs; or rotation-only trajectory |
| Dolly / Truck | translate in/side | translation trajectory (Plücker) |
| Zoom | change FOV | FOV schedule in camera params |
| Orbit / Arc | circle subject | circular trajectory (needs 3D consistency — Luma strength) |
| Crane / Jib | vertical + arc | 3D trajectory |
| Handheld | jitter | add noise to trajectory / learned "handheld" style |
| Tracking | follow subject | subject-locked trajectory (needs subject tracking) |
| Drone / Aerial | high, sweeping | learned prompt style + wide trajectory |

**OSS to build with:** **CameraCtrl**, **MotionCtrl**, **ReCamMaster** (re-shoot an existing video with a new camera path), **Uni3C**, **CamI2V**. For true 3D-consistent orbits, pairing with a **3DGS/NeRF plate** or a 3D-aware model gives the cleanest results. **Product pattern:** offer **named camera presets** (the LLM cinematographer picks; the user can override) that map to trajectories — this is far better UX than free-text and is what the market rewards.

---

## 7. Storyboard & Director layer (prompt → story → shots → video)

This is the **agentic brain** that turns a one-line prompt (or a URL, or a product) into a coherent multi-shot film. It is where you add the most differentiated value, and it's mostly **LLM orchestration**, not diffusion.

```
              ┌──────────────── DIRECTOR AGENT (LLM) ───────────────┐
 prompt/URL ─►│ 1 Interpreter → intent JSON                         │
   /product   │ 2 Screenwriter → scenes/beats                       │
              │ 3 Cinematographer → shot list (size/angle/move/lens)│
              │ 4 Art director → style bible + palette + refs       │
              │ 5 Continuity manager → character/asset bindings     │
              └──────────────────────────────────────────────────────┘
                                   │ structured "video plan" (JSON)
              ┌────────────────────▼─────────────────────┐
              │ Storyboard: per-shot keyframe (T2I + ID)  │
              └────────────────────┬─────────────────────┘
                                   │ approve/edit (human-in-loop)
                                   ▼
                        per-shot video generation (§3.9)
```

- **Scene decomposition / shot planning:** LLM with **few-shot film-grammar exemplars** and a strict JSON schema (scene → shots → {shot_size, angle, camera_move, action, dialogue, duration, lens}).
- **Director agents:** specialized roles (screenwriter, cinematographer, continuity) as separate prompts/tools; a **continuity manager** binds recurring characters/assets to their stored embeddings so identity persists across shots.
- **Narrative consistency:** maintain a **running "story state"** (characters present, time of day, location, wardrobe) passed to each shot's prompt; use it to keep environment/lighting/wardrobe consistent.
- **Human-in-the-loop:** let users approve/tweak the storyboard *before* the expensive video step — cuts cost and boosts satisfaction dramatically. (Runway/Flow-style.)

**OSS/tools:** any strong LLM + structured output (Instructor/Outlines), LangGraph or a hand-rolled state machine, T2I for storyboards. This layer is **cheap to run and huge for perceived quality** — invest here.

---

## 8. Asset integration (user images, logos, products, brand, URLs, docs)

This is the core of KEYFRAME's differentiation and a fast-growing frontier (Pika Scene Ingredients, Vidu references, Runway Gen-4 refs). Goal: **let a user upload assets and generate video that faithfully features them.**

### 8.1 Asset types → conditioning strategy

| Asset | Extract | Condition via |
|---|---|---|
| Person/character image | face/ID embedding (ArcFace) + full crop | ID adapter (PuLID/InstantID) → I2V; premium: LoRA |
| Product photo | segmented object (SAM), multi-view if available | subject-reference adapter; keep on first frame; inpaint into scenes |
| Logo | vectorize/segment; treat as rigid overlay | composite as overlay layer post-gen (don't let diffusion redraw it) **or** condition + region-lock |
| Brand kit (colors/fonts) | palette + type tokens | inject into T2I/storyboard prompt + post overlays |
| Reference video | pose/motion + style | pose-driven I2V (Champ/Animate-Anyone); style via IP-Adapter |
| URL | scrape (title, hero image, copy, colors) | feed to Director agent as intent + assets |
| Document (brief/script) | parse to script/scenes | feed to Screenwriter agent |

**Critical design rule [I]:** **logos and legible text should be composited as a deterministic overlay layer, not generated by diffusion** — diffusion mangles fine text/logos. Generate the scene, then **layer the exact logo/product cutout** with tracking (or keep it on a stable region). This is how you get brand-safe output. Products that need *pixel-exact* fidelity (a specific sneaker, a bottle label) should be **composited/inpainted**, with diffusion handling lighting integration only.

### 8.2 Data flow (upload → conditioned generation)

```
Upload ─► virus/NSFW scan ─► store (S3/R2) ─► type-detect
   │                                             │
   ├─ image ─► SAM segment + ArcFace/CLIP embed ─┤
   ├─ video ─► DWPose + keyframe + CLIP embed ────┤
   ├─ url   ─► scrape → text + hero img ──────────┤
   └─ doc   ─► parse → script ────────────────────┘
                                                  ▼
                              Asset record { id, type, uri, embeddings[], masks, meta }
                                                  │  (embeddings also indexed in a vector DB)
                                                  ▼
                        Director agent binds assets → shots → conditioning bundle
                                                  ▼
                       T2I storyboard (ID/ref adapters) → I2V video → composite overlays
```

### 8.3 Embedding & retrieval strategy

- Store **CLIP/SigLIP image embeddings** (semantic) **and** **ArcFace embeddings** (identity) per asset in a **vector index** (pgvector/Qdrant) — lets the Director "find the red sneaker asset" and lets you dedupe/reuse.
- Keep **raw asset + derived artifacts (mask, cutout, ID embedding, optional LoRA)** in object storage, referenced by DB row.
- **Reference conditioning at inference:** load ID adapters with the asset's embedding; for products, pass the segmented cutout to an inpaint/reference model; for exact brand elements, composite post-hoc.

**Open references to emulate:** **HunyuanCustom / Phantom / SkyReels-A2 / VACE** (subject-reference video), **IP-Adapter/PuLID/InstantID** (identity), **SAM 2** (segmentation/tracking for compositing), **Vidu** (product behavior to match).

---

## 9. Technology stack (what to actually build on)

Opinionated recommendations in **bold**; alternatives listed.

**Frontend.** **Next.js (React) + TypeScript + Tailwind + shadcn/ui**; timeline/editor with a canvas lib; **WebSockets/SSE** for job progress; video via HLS. (Vue/Nuxt fine if that's your team's strength.) *You already have a React app in KEYFRAME — keep it.*

**API / app backend.** Split by concern:
- **Node.js (NestJS or Fastify) + TypeScript** for the product API, auth, billing, orchestration, queue producers — pairs naturally with your existing JS scene-kit.
- **Python (FastAPI)** for the **ML inference services** (model servers) — this is where PyTorch lives. FastAPI is the default; it's async, typed, and the ML ecosystem is Python.
- **Go** only if you need a very high-throughput gateway/media service; optional.

**AI / inference stack.**
- **PyTorch** (core), **Hugging Face Diffusers** (pipelines for Wan/CogVideoX/Hunyuan/LTX), **Transformers** (text encoders), **Accelerate**.
- **ComfyUI** as a **programmable inference graph engine** — run it headless via its API for complex conditioned workflows (ControlNet + IP-Adapter + upscalers). Many teams ship ComfyUI graphs as their "render recipes."
- **Distributed/large-model inference:** **xDiT** (USP: Ulysses + Ring sequence parallelism for DiT), **context/sequence parallelism**, **FSDP** for the 14B-class models; **TeaCache/FBCache** for step-skipping; optional **TensorRT / torch.compile** for latency; **quantization** (fp8/int8, GGUF) to fit consumer GPUs.
- **LLM orchestration:** **vLLM** (or SGLang) to self-host the Director LLM (Qwen2.5/Llama-3.x); or call a hosted LLM. **Ray** for multi-node scheduling of GPU workloads.
- **Adjacent models:** SAM 2 (segmentation), DWPose (pose), ArcFace (ID), Whisper (subtitles), F5-TTS/MusicGen/MMAudio (audio), RIFE/FILM (interp), SeedVR2/Real-ESRGAN (upscale).

**Storage.** **Cloudflare R2 or S3** for assets/outputs (R2 = no egress fees, great for video delivery); **MinIO** for on-prem/dev. Serve via CDN with signed URLs.

**Databases.** **PostgreSQL** (primary, + **pgvector** for embeddings) for users/projects/jobs/assets; **Redis** for cache, rate-limits, job status, pub/sub; **MongoDB** only if you want schema-free document blobs (optional). Object metadata in Postgres, blobs in R2.

**Queues / jobs.** **BullMQ (Redis)** if your orchestration is Node — simple, great DX, priorities, retries. **Celery/RQ** if Python-centric. **Kafka/RabbitMQ** for high-scale event streaming between services (progress events, webhooks) — add later, not day one. GPU jobs go on **dedicated priority queues per model/tier**.

**GPU infrastructure.**
- Train/large inference: **H100/H200** (or **B200** as available); **A100 80GB** for cost-sensitive inference; **L40S/L4/RTX 4090/5090** for the small (1.3B) tier and previews.
- **Multi-GPU inference** for 14B+ via sequence/tensor parallel (xDiT/FSDP). Distributed serving with **Ray Serve** or Kubernetes + KEDA autoscaling on queue depth.
- **Serverless GPU** (Modal, RunPod, Replicate, Baseten, Fal) to start — pay-per-second, scale-to-zero, no cluster ops. Move to reserved/owned GPUs once volume justifies it. **Recommendation: launch on serverless GPU + API models; internalize as you scale.**

---

## 10. Video production pipeline & why some AI video looks "cinematic"

### 10.1 The full pipeline's contribution to perceived quality

| Stage | Contribution to "premium" feel |
|---|---|
| Prompt → dense caption | Prompt adherence, richness — biggest cheap win |
| Storyboard/shot list | Composition, film grammar, intentionality |
| Keyframes (great first frames) | Sets fidelity ceiling; I2V inherits the keyframe's quality |
| Motion | Believability; bad motion = instant "AI slop" tell |
| Rendering/upscale | Sharpness, detail, resolution |
| Voice/music/SFX | **Massively** raises perceived production value (often the #1 uplift for the effort) |
| Subtitles/graphics/brand | Polish, professionalism, accessibility |
| Color grade + export | The "film look" |

### 10.2 What actually makes it look cinematic (and how to get each)

- **Depth of field / bokeh** — condition prompts with lens language ("85mm, f/1.4, shallow depth of field"); big models render it natively. You can also add post DoF if you have a depth map.
- **Motion blur** — comes from the temporal prior; reinforce via prompt; avoid over-interpolation which *removes* it.
- **Color grading / HDR** — apply a **post LUT** (teal-orange, filmic) in FFmpeg/OpenColorIO; this single step makes flat AI output look graded. Huge ROI, near-zero cost.
- **Lighting** — prompt for motivated light ("golden hour, rim light, volumetric"); Veo/Kling excel because their data is cinematic.
- **Composition** — the **storyboard/shot-planner** enforces rule-of-thirds, headroom, leading lines via film-grammar exemplars.
- **Lens simulation** — prompt lens/focal length; optionally add vignette, chromatic aberration, film grain in post (subtle grain hides AI artifacts — a pro trick).
- **Camera language** — deliberate, motivated moves (§6) instead of random drift.
- **Scene transitions** — cut/dissolve/match-cut via the render layer; match-cuts (carry composition across shots) read as intentional and premium.
- **Consistent 24fps + slight grain + graded LUT + real audio** is a shockingly effective "cheap cinematic" stack you can apply to *any* base model.

**Benchmarks to track:** **VBench / VBench++** (16 disentangled dimensions), **Artificial Analysis Video Arena** (human-pref Elo — Seedance/Veo/Kling/Sora trade the top spots), **Movie Gen Bench** (Meta). Use these to pick your API models and to regression-test your own pipeline.

---

## 11. Open-source ecosystem (curated, with use-cases)

⭐ = approximate GitHub stars in early 2026 (they move fast — verify). Maintenance as observed.

### Foundation video models
| Project | License | ⭐ (approx) | Status | Use case |
|---|---|---|---|---|
| **Wan 2.1/2.2 (Alibaba)** | Apache-2.0 | ~10k+ | Active | **Primary production foundation** (1.3B local, 14B quality); T2V/I2V/VACE |
| **HunyuanVideo (Tencent)** | Custom (permissive-ish) | ~9k+ | Active | Top open fidelity; MLLM text encoder; avatar/custom variants |
| **CogVideoX / 1.5 (THUDM)** | Apache-2.0 | ~11k+ | Active | **Best-documented reference**; easy fine-tune/LoRA |
| **Mochi 1 (Genmo)** | Apache-2.0 | ~4k+ | Active | AsymmDiT/VAE reference; strong motion |
| **LTX-Video (Lightricks)** | Custom OpenRail-ish | ~7k+ | Active | **Real-time/low-latency** DiT; previews |
| **Open-Sora (HPC-AI)** | Apache-2.0 | ~27k+ | Active | Full Sora-style **training** recipe/code |
| **Open-Sora-Plan (PKU)** | MIT/Apache | ~12k+ | Active | Sora reproduction; research |
| **Stable Video Diffusion** | Stability license | (in generative-models) | Maintained | Classic I2V; ComfyUI staple |
| **AnimateDiff** | Apache-2.0 | ~11k+ | Maintained | Motion modules over SD; anime/stylized |
| **Allegro (Rhymes)** | Apache-2.0 | ~1k+ | Slower | Alt open T2V |

### Control / consistency / motion / camera / identity
| Project | Purpose | Notes |
|---|---|---|
| **IP-Adapter / PuLID / InstantID / PhotoMaker** | Identity/reference conditioning (image) | Backbone of character consistency |
| **ConsisID / ID-Animator / Phantom / SkyReels-A2 / HunyuanCustom** | Subject-consistent **video** | Emulate Vidu/Kling refs |
| **Animate-Anyone / Champ / MimicMotion / MagicAnimate** | Pose-driven human video | Controllable motion |
| **Tora / DragNUWA / DragAnything / MOFA-Video** | Trajectory/drag motion control | Motion Brush equivalents |
| **CameraCtrl / MotionCtrl / ReCamMaster / Uni3C / CamI2V** | Camera-trajectory control | Director Mode equivalents |
| **LivePortrait / EMO / Hallo / SadTalker** | Portrait/face animation | Act-One equivalents |
| **LatentSync / MuseTalk / Wav2Lip / OmniHuman-1** | Lip-sync | Talking-head/dubbing |
| **SAM 2** | Segment + track | Product/logo compositing |
| **DWPose / Sapiens** | Pose/human parsing | Motion conditioning |
| **RIFE / FILM / AMT** | Frame interpolation | FPS uplift, smoothing |
| **SeedVR2 / Real-ESRGAN / AuraSR** | Upscale/restore | Finishing |
| **MMAudio / FoleyCrafter** | Video→SFX/foley | Audio |
| **F5-TTS / XTTS / Kokoro / MusicGen / Stable Audio** | TTS / music | Audio |

### Infra / orchestration
**ComfyUI** (inference graphs), **Diffusers** (pipelines), **xDiT** (distributed DiT inference), **vLLM/SGLang** (LLM serving), **Ray** (scheduling), **faster-whisper** (subtitles), **FFmpeg** (everything mux/encode/grade).

---

## 12. Production-grade architecture for an AI video SaaS (KEYFRAME-class)

Supports **text/image/URL/asset/logo/product/story → video**.

### 12.1 System architecture

```
        ┌──────────── CLIENT (Next.js/React) ───────────┐
        │  editor · storyboard approve · asset uploader  │
        └───────────────┬───────────────▲───────────────┘
                        │ REST/GraphQL   │ SSE/WebSocket (progress)
                ┌───────▼───────────────┴────────┐
                │   API GATEWAY (NestJS/Fastify)  │  auth (JWT/OAuth), rate-limit,
                │   billing (Stripe), quotas       │  webhooks, signed upload URLs
                └───┬───────────┬───────────┬──────┘
                    │           │           │
         ┌──────────▼──┐  ┌─────▼──────┐  ┌─▼───────────────┐
         │ Postgres    │  │  Redis     │  │  Object store    │
         │ +pgvector   │  │ cache/queue│  │  (R2/S3) + CDN   │
         └─────────────┘  └─────┬──────┘  └─────────────────┘
                                 │ BullMQ jobs (priority per tier/model)
        ┌────────────────────────▼──────────────────────────────┐
        │            ORCHESTRATOR / DIRECTOR SERVICE (Node+LLM)   │
        │  builds video-plan → fans out per-shot jobs → assembles │
        └───┬───────────────┬───────────────┬───────────────┬────┘
            │               │               │               │
     ┌──────▼─────┐  ┌──────▼─────┐  ┌──────▼─────┐  ┌───────▼──────┐
     │ T2I worker │  │ Video-gen  │  │ Audio      │  │ Finishing    │
     │ (storyboard│  │ workers    │  │ workers    │  │ workers      │
     │  +ID adapt)│  │ (Wan/Hunyuan│ │ (TTS/music │  │ (upscale/    │
     │  GPU       │  │  or API)   │  │ /SFX/lipsync)│ │  interp/mux) │
     └────────────┘  └──────┬─────┘  └────────────┘  └──────────────┘
                            │  (GPU pool: K8s+KEDA or serverless GPU)
                     ┌──────▼──────────────────────────┐
                     │  Model servers (FastAPI+PyTorch, │
                     │  Diffusers/ComfyUI, xDiT multi-GPU)│
                     └──────────────────────────────────┘
```

### 12.2 Database design (core tables)

```sql
users(id, email, plan, credits, created_at)
projects(id, user_id, title, aspect_ratio, status, created_at)
assets(id, user_id, type[image|video|logo|product|url|doc], uri, mime,
       meta jsonb, mask_uri, cutout_uri, created_at)
asset_embeddings(id, asset_id, kind[clip|arcface], vector vector(768))  -- pgvector
characters(id, user_id, name, ref_asset_ids uuid[], id_embedding vector(512),
           lora_uri, created_at)              -- reusable identity
video_plans(id, project_id, plan jsonb, status, approved_at)  -- director output
scenes(id, plan_id, idx, setting, duration, story_state jsonb)
shots(id, scene_id, idx, shot_size, angle, camera_move, action, dialogue,
      lens, keyframe_uri, duration, character_ids uuid[])
jobs(id, project_id, shot_id, type, model, tier, status, priority, gpu,
     cost_credits, input jsonb, output_uri, error, created_at, updated_at)
renders(id, project_id, uri, resolution, fps, has_audio, subtitle_uri, created_at)
usage_events(id, user_id, job_id, credits, gpu_seconds, model, created_at)
```

Indexes: `jobs(status, priority)`, `assets(user_id)`, HNSW on `asset_embeddings.vector` and `characters.id_embedding`.

### 12.3 API design (REST sketch)

```
POST /v1/assets                 → presigned upload; returns asset_id (async processing)
POST /v1/characters             → create reusable character from asset_ids
POST /v1/projects               → {input: text|image|url|asset_ids, aspect, duration, style}
POST /v1/projects/:id/plan      → run Director → returns storyboard (shots + keyframes)
PATCH /v1/projects/:id/plan     → user edits/approves storyboard
POST /v1/projects/:id/render    → enqueue generation (returns job graph)
GET  /v1/jobs/:id               → status/progress (also SSE: /v1/jobs/:id/events)
GET  /v1/projects/:id/renders   → outputs
POST /v1/webhooks               → register completion callbacks
```
Design notes: **idempotency keys** on POST; **credit pre-authorization** before enqueue; **per-tier priority**; **signed CDN URLs** for delivery; webhooks + SSE for progress.

### 12.4 Processing pipeline / queue architecture

- **Two-phase job graph:** Phase A = *plan* (cheap, LLM+T2I, human approves) → Phase B = *render* (expensive GPU, fan-out per shot, fan-in assemble).
- **Queues by model & tier:** `preview` (LTX/1.3B, cheap, fast) vs `standard` (Wan-14B/Hunyuan) vs `premium` (Veo/Seedance/Kling API). Separate `audio`, `upscale`, `finishing` queues.
- **Fan-out/fan-in:** orchestrator emits N shot jobs; a **completion aggregator** stitches shots + audio when all succeed (saga pattern with compensation on failure — refund credits, mark partial).
- **Backpressure & autoscaling:** **KEDA scales GPU workers on queue depth**; per-user concurrency caps; retries with exponential backoff; dead-letter queue for poison jobs.
- **Cost control:** cache T2I keyframes & embeddings; reuse character LoRAs; TeaCache on diffusion; scale-to-zero on serverless GPU for spiky load.

### 12.5 Agent architecture (the Director)

```
Interpreter → Screenwriter → Cinematographer → ArtDirector → ContinuityManager
     (each = LLM call w/ JSON schema; ContinuityManager binds characters↔embeddings)
                         │
                shared "StoryState" (blackboard) persisted per project
```
Keep agents **stateless functions over a persisted blackboard** (StoryState in Postgres) so runs are resumable and debuggable. Human-in-the-loop gate after storyboard.

### 12.6 Scalability strategy

1. **Start hosted:** API models (Veo/Kling/Seedance/Runway) + serverless GPU (Modal/Fal/Replicate) for OSS models. Zero cluster ops; validate product-market fit.
2. **Internalize hot paths:** self-host Wan/Hunyuan on reserved H100s once volume makes API/serverless costlier than owned GPUs; keep premium output on APIs.
3. **Multi-GPU for 14B+:** xDiT sequence parallelism; batch previews on cheap GPUs.
4. **Multi-region storage + CDN**; queue-depth autoscaling; observability (traces per job, GPU-second accounting, per-model quality regression on VBench).
5. **Model portability:** wrap every generator behind a **uniform `generate(shot_spec) → clip` interface** so you can hot-swap OSS/API models per tier without touching orchestration.

---

## 13. Competitive analysis

Relative, 2025–2026, field-normalized (5 = best available). Judgments from benchmarks + community consensus, not vendor numbers.

### 13.1 Quality & capability

| Platform | Video Q | Motion | Consistency | Prompt adher. | Camera | Native audio | Max len | Open? |
|---|---|---|---|---|---|---|---|---|
| Veo 3 | 5 | 5 | 5 | 5 | 5 | **Yes** | ~8s (ext) | No |
| Sora 2 | 5 | 5 | 5 | 5 | 4 | **Yes** | long | No |
| Seedance 1.0 | 5 | 5 | 5 | 5 | 4 | partial | multi-shot | No |
| Kling 2.x | 5 | 5 | 4 | 4 | 4 | partial | ~2min | No |
| Runway Gen-4 | 4 | 4 | 4 | 4 | 5 | partial | short | No |
| Hailuo 02 | 4 | 4 | 4 | 4 | 3 | partial | short | No |
| Luma Ray2 | 4 | 4 | 4 | 4 | 4 | partial | short | No |
| Vidu | 4 | 4 | 5(refs) | 4 | 3 | no | short | No |
| PixVerse 4.5 | 3 | 4 | 4 | 3 | 3 | partial | short | No |
| Pika 2.2 | 3 | 3 | 3 | 3 | 3 | partial | short | No |
| Wan 2.2 | 4 | 4 | 4 | 4 | 4 | no | short | **Yes** |
| HunyuanVideo | 4 | 4 | 4 | 4 | 3 | no | short | **Yes** |
| CogVideoX1.5 | 3 | 3 | 4 | 4 | 3 | no | short | **Yes** |
| Mochi 1 | 3 | 4 | 3 | 4 | 3 | no | short | **Yes** |

### 13.2 Business / product

| Platform | Cost | Speed | Asset/ref support | Editing tools | API | Commercial-ready |
|---|---|---|---|---|---|---|
| Veo 3 | $$$ | Med | Med | Low (Flow) | Yes (Vertex/Gemini) | High |
| Sora 2 | $$$ | Med | Med (cameo) | Low | Emerging | High |
| Seedance | $$ | Fast | Med | Low | Yes (Volc/BytePlus) | High |
| Kling | $$ | Med | **High** (elements) | Med (brush/lipsync) | Yes | High |
| Runway | $$ | Med | High (refs) | **High** (Act-One/Aleph) | Yes | High |
| Hailuo | $ | Fast | Med (S2V) | Low | Yes | Med-High |
| Luma | $ | Fast | Med (keyframes) | Med | Yes | High |
| Vidu | $ | Fast | **High** (7 refs) | Low | Yes | Med-High |
| PixVerse | $ | **Fast** | High (char) | Med (effects) | Yes | Med |
| Pika | $ | Fast | High (ingredients) | Med (effects) | Limited | Med |
| Wan/Hunyuan/Cog/Mochi | **self-host** | varies | via adapters | via ComfyUI | self | **you own it** |

---

## 14. Final recommendations (how to build KEYFRAME to compete)

### 14.1 What architecture to build
A **hybrid orchestration platform**, not a monolithic model. Your moat is the **Director/agent layer + asset/brand fidelity + finishing pipeline** wrapped around a **portable generator abstraction** that swaps between **self-hosted OSS (Wan 2.2 / HunyuanVideo)** and **premium APIs (Veo / Seedance / Kling / Runway)** per tier and per shot. This is exactly the shape your existing KEYFRAME "scene-kit" instinct points at — the deterministic kit is the finishing/orchestration layer; the LLM only writes the plan (consistent with your saved project notes).

### 14.2 What open-source to use
- **Foundation:** **Wan 2.2** (14B for quality, 1.3B for previews) + **HunyuanVideo** as a second option; **LTX-Video** for real-time previews.
- **Consistency:** **PuLID/InstantID** (image ID) → **HunyuanCustom/Phantom/VACE** (video subject) → **per-character LoRA** for premium recurring characters.
- **Motion/camera:** **Animate-Anyone/Champ** (pose-driven), **Tora** (trajectory), **CameraCtrl/MotionCtrl** (camera).
- **Finishing:** **SeedVR2/Real-ESRGAN** (upscale), **RIFE/FILM** (interp), **MMAudio + F5-TTS + MusicGen** (audio), **LatentSync** (lip-sync), **Whisper** (subs), **FFmpeg + LUTs** (grade/mux).
- **Infra:** **Diffusers + ComfyUI + xDiT + vLLM + Ray + BullMQ + Postgres/pgvector + R2**.

### 14.3 Which models to combine (the KEYFRAME recipe)
```
LLM Director (Qwen2.5/Claude) → dense captions + shot plan
   → Flux + PuLID  (storyboard keyframes, identity-locked)
   → Wan 2.2 I2V   (per-shot video, first-frame carryover for consistency)
      └ premium tier routes to Veo/Seedance/Kling API instead
   → SeedVR2 upscale → RIFE interp
   → F5-TTS + MusicGen + MMAudio + LatentSync (audio)
   → composite exact logos/products as overlays (never diffusion-drawn)
   → FFmpeg grade (film LUT + grain) + mux + Whisper subs → export
```

### 14.4 Which features matter most (in order)
1. **Prompt upsampling + dense captioning** (biggest quality/$ — confirmed by Sora's own report).
2. **Storyboard approval loop** (perceived quality + cost control + trust).
3. **Character/asset consistency** (I2V first-frame carryover + ID adapters + optional LoRA) — your differentiator.
4. **Brand-exact compositing** for logos/products (don't let diffusion draw them).
5. **Audio (VO/music/SFX)** — the cheapest large jump in "production value."
6. **Cinematic finishing** (LUT + grain + 24fps + graded export).
7. **Camera presets** mapped by the LLM cinematographer.

### 14.5 Mistakes to avoid
- **Don't build your own foundation model** early — fine-tune/adapt Wan/Hunyuan; use APIs for premium. Training a frontier video model is a $10M+ / data-moat game.
- **Don't let diffusion render logos/legible text/exact products** — composite them.
- **Don't rely on pure T2V for consistency** — always go through a **keyframe → I2V** path.
- **Don't skip prompt upsampling** — short user prompts underperform badly.
- **Don't over-interpolate** — it kills motion blur and looks uncanny.
- **Don't ignore the VAE/upscaler** — finishing is where "AI slop" becomes "premium."
- **Don't build one giant queue** — separate tiers/models or previews will starve behind premium renders.
- **Don't store blobs in Postgres** — object store + DB pointers.
- **Don't ship without moderation/watermarking/provenance** (C2PA/SynthID-style) — legal/brand necessity.

### 14.6 Features that create the biggest *quality* jumps (ranked ROI)
1. Prompt upsampling (LLM) — ★★★★★, trivial cost.
2. Keyframe→I2V pipeline instead of T2V — ★★★★★.
3. Film-LUT + grain + 24fps finishing — ★★★★☆, near-zero cost.
4. Real audio layer — ★★★★☆.
5. ID-adapter/LoRA character locking — ★★★★☆.
6. Diffusion upscaler (SeedVR2) — ★★★☆☆.
7. Camera-trajectory control — ★★★☆☆.

---

## 15. Key references (starting bibliography)

**Papers / reports [V]:** Sora technical report ("Video generation models as world simulators"), DiT (Peebles & Xie 2023), Latent Diffusion (Rombach 2022), CogVideoX (2024), Mochi 1 / AsymmDiT (Genmo 2024), HunyuanVideo (Tencent 2024), Movie Gen (Meta 2024), Stable Video Diffusion (Stability 2023), Lumiere (Space-Time U-Net, Google 2024), VideoPoet (Google 2024), U-ViT (Shengshu/Tsinghua), Flow Matching / Rectified Flow (Lipman 2022; Liu 2022), VBench / VBench++ (2024), Seedance technical report (ByteDance 2025), Wan technical report (Alibaba 2025), CameraCtrl / MotionCtrl, Animate-Anyone, Tora, IP-Adapter, InstantID/PuLID, SAM 2, EMO/LivePortrait, MMAudio.

**Repos [V]:** github.com/Wan-Video/Wan2.1 · Tencent-Hunyuan/HunyuanVideo · THUDM/CogVideo · genmoai/mochi · Lightricks/LTX-Video · hpcaitech/Open-Sora · PKU-YuanGroup/Open-Sora-Plan · comfyanonymous/ComfyUI · huggingface/diffusers · xdit-project/xDiT · guoyww/AnimateDiff · tencent-ailab/IP-Adapter · cubiq/PuLID · MooreThreads/Moore-AnimateAnyone · hehao13/CameraCtrl · vllm-project/vllm.

**Benchmarks [V]:** VBench (Hugging Face leaderboard), Artificial Analysis Video Arena, Movie Gen Bench.

> **Confidence reminder:** closed-model internals (§2.1–2.10) are **[I]/[R]** triangulations from public research lineage + open analogues + behavior. Open models (§2.11–2.14) and OSS (§11) are **[V]**. Treat the closed-model architecture claims as high-quality hypotheses to validate, not gospel — but the *build recommendations* (§12–14) rest on the [V] open stack and are directly actionable.

*End of report.*


