import { Composition, registerRoot } from "remotion";
import { durationFor, FPS, Post, type PostProps } from "./Post";

const sample: PostProps = {
  audience: "barber",
  hook: "What a barber website needs, in plain words",
  beats: [
    "Your services with prices, listed plain",
    "A gallery of your cuts",
    "Hours, address and a map",
    "A link to the booking app you already use",
    'Want one built for you? DM "SITE"',
  ],
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
