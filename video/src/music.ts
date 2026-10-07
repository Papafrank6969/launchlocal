// Royalty-free beats from Mixkit (mixkit.co/license, Stock Music Free License).
// Streamed from Mixkit at render time, not committed: the repo is public and we
// shouldn't redistribute the files. startSec skips each track's intro so the
// video opens on the drop.
export const TRACKS = [
  { url: "https://assets.mixkit.co/music/404/404.mp3", startSec: 10 },
  { url: "https://assets.mixkit.co/music/412/412.mp3", startSec: 11 },
  { url: "https://assets.mixkit.co/music/364/364.mp3", startSec: 16 },
  { url: "https://assets.mixkit.co/music/410/410.mp3", startSec: 18 },
  { url: "https://assets.mixkit.co/music/258/258.mp3", startSec: 12 },
  { url: "https://assets.mixkit.co/music/445/445.mp3", startSec: 14 },
];

/** Same post, same track (re-renders match); different posts spread across tracks. */
export function trackFor(postId: string) {
  let h = 0;
  for (const c of postId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TRACKS[h % TRACKS.length];
}
