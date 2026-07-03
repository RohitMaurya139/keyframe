import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";
import { SAMPLE_STORYBOARD, type Storyboard } from "./storyboard";

// Defaults; the server overrides width/height/fps via --props (props.json).
const DEF_FPS = 30;
const DEF_W = 1280;
const DEF_H = 720;

type FilmProps = { storyboard: Storyboard; width?: number; height?: number; fps?: number };

const framesFor = (sb: Storyboard, fps: number) => {
  const end = Math.max(...sb.scenes.map((s) => s.start + s.duration));
  return Math.max(1, Math.round(end * fps));
};

const Film: React.FC<FilmProps> = ({ storyboard, fps }) => <Video storyboard={storyboard} fps={fps ?? DEF_FPS} />;

// The server writes the storyboard (same contract as scene_kit's JSON) + dims to props.json
// and passes it to `remotion render`. The LLM/orchestrator layer is unchanged — only this
// renderer consumes the contract.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Film"
      component={Film}
      durationInFrames={framesFor(SAMPLE_STORYBOARD, DEF_FPS)}
      fps={DEF_FPS}
      width={DEF_W}
      height={DEF_H}
      defaultProps={{ storyboard: SAMPLE_STORYBOARD } as FilmProps}
      calculateMetadata={({ props }) => {
        const fps = props.fps ?? DEF_FPS;
        return {
          durationInFrames: framesFor(props.storyboard, fps),
          width: props.width ?? DEF_W,
          height: props.height ?? DEF_H,
          fps,
        };
      }}
    />
  );
};
