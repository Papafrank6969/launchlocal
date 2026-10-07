import { Composition, registerRoot } from "remotion";
import { durationFor, FPS, Post, type PostProps } from "./Post";
import { TRACKS } from "./music";

const sample: PostProps = {
  audience: "barber",
  hook: "POV: your link in bio is a dead Linktree",
  beats: [
    "Clients want your prices without the DM",
    "Your cuts in a real gallery",
    "Hours and a map, not 'where u at'",
    "Your booking app, one tap away",
    `DM "SITE" and I'll build yours`,
  ],
  music: TRACKS[0],
};

function Root() {
  return (
    <Composition
      id="Post"
      component={Post}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={durationFor(sample.beats.length)}
      defaultProps={sample}
      calculateMetadata={({ props }) => ({ durationInFrames: durationFor(props.beats.length) })}
    />
  );
}

registerRoot(Root);
