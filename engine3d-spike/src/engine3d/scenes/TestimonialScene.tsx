// TestimonialScene — Template "Testimonial / Social Proof". A row of quote cards with author,
// avatar and an animated 5-star rating that fills in. Cards reveal staggered.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Scene } from "../../storyboard";
import type { Theme } from "../core/theme";
import { useDomFonts } from "../core/domfont";
import { SceneStage } from "../components/SceneStage";

const EO = Easing.out(Easing.cubic);
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const STAR = "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z";

type T = { quote: string; author: string; role?: string };
function quotes(scene: Scene): T[] {
  if (scene.features?.length) return scene.features.slice(0, 3).map((f) => ({ quote: f.title, author: f.desc || "" }));
  return [
    { quote: "We turned our landing page into a launch video in minutes.", author: "Priya S.", role: "Head of Growth" },
    { quote: "It's like having a motion designer on the team, 24/7.", author: "Marcus L.", role: "Founder" },
    { quote: "Every video comes out on-brand and on-message.", author: "Dana R.", role: "Marketing Lead" },
  ];
}

const Stars: React.FC<{ theme: Theme; at: number }> = ({ theme, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const filled = interpolate(frame, [at, at + Math.round(0.6 * fps)], [0, 5], C);
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill={i < filled ? theme.accent : "none"} stroke={theme.accent} strokeWidth={1.5} strokeLinejoin="round" style={{ opacity: i < filled ? 1 : 0.35 }}>
          <path d={STAR} />
        </svg>
      ))}
    </div>
  );
};

const Overlay: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grad = `linear-gradient(100deg, ${theme.accent}, ${theme.accent2})`;
  const list = quotes(scene);
  const hOp = interpolate(frame, [4, 18], [0, 1], C);
  const hY = interpolate(frame, [4, 22], [22, 0], { ...C, easing: EO });

  return (
    <AbsoluteFill style={{ fontFamily: "KFBody, Inter, sans-serif", color: theme.ink, padding: "6% 6%", perspective: 1400 }}>
      <div style={{ textAlign: "center", marginBottom: 34 }}>
        {scene.kicker ? (
          <span style={{ display: "inline-flex", gap: 9, alignItems: "center", padding: "7px 15px", borderRadius: 999, background: "rgba(120,150,255,0.12)", border: `1px solid ${theme.line}`, color: theme.particle, font: "700 13px/1 KFBody", letterSpacing: "0.18em", textTransform: "uppercase", opacity: interpolate(frame, [2, 12], [0, 1], C) }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.accent }} />{scene.kicker}
          </span>
        ) : null}
        <h1 style={{ margin: "12px 0 0", font: "800 50px/1.05 KFDisplay, KFBody", letterSpacing: "-0.02em", opacity: hOp, transform: `translateY(${hY}px)` }}>
          {accentize(scene.headline, scene.emphasis, grad)}
        </h1>
      </div>

      <div style={{ display: "flex", gap: 22, flex: 1, alignItems: "center" }}>
        {list.map((t, i) => {
          const at = Math.round(0.6 * fps) + i * Math.round(0.22 * fps);
          const op = interpolate(frame, [at, at + 14], [0, 1], C);
          const y = interpolate(frame, [at, at + 16], [26, 0], { ...C, easing: EO });
          return (
            <div key={i} style={{ flex: 1, padding: "26px 26px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.line}`, backdropFilter: "blur(8px)", opacity: op, transform: `translateY(${y}px)`, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 230 }}>
              <div>
                <Stars theme={theme} at={at + Math.round(0.25 * fps)} />
                <div style={{ font: "600 21px/1.4 KFDisplay, KFBody", color: theme.ink }}>“{t.quote}”</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 40, display: "grid", placeItems: "center", background: grad, color: "#0A0E1A", font: "800 17px/1 KFDisplay, KFBody" }}>{(t.author || "•").trim().charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{ font: "700 16px/1.1 KFBody", color: theme.ink }}>{t.author}</div>
                  {t.role ? <div style={{ font: "500 13px/1.2 KFBody", color: theme.dim }}>{t.role}</div> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

function accentize(headline: string, emphasis: string | undefined, grad: string) {
  if (!emphasis || !headline.includes(emphasis)) return headline;
  const [a, b] = headline.split(emphasis);
  const acc = { background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties;
  return (<>{a}<span style={acc}>{emphasis}</span>{b}</>);
}

export const TestimonialScene: React.FC<{ scene: Scene; theme: Theme; durationInFrames: number }> = ({ scene, theme, durationInFrames }) => {
  useDomFonts();
  return (
    <SceneStage theme={theme} cameraKind="punch-in" durationInFrames={durationInFrames} domOverlay={<Overlay scene={scene} theme={theme} />}>
      <></>
    </SceneStage>
  );
};
