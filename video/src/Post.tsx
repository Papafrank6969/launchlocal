import type React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

// One SocialPost spec as a 9:16 kinetic-text video. Code-made motion graphics
// only: no people, no stock footage, no AI imagery (BRAND-AND-COMPLIANCE-STANDARDS).

const { fontFamily } = loadFont("normal", { weights: ["600", "800", "900"], subsets: ["latin"] });

export type PostProps = {
  audience: string;
  hook: string;
  beats: string[];
  /** Royalty-free track (music.ts), streamed at render time; starts at its drop. */
  music?: { url: string; startSec: number };
};

export const FPS = 30;
// Fast on purpose: short-form viewers swipe in under 2 s.
export const HOOK_FRAMES = 48;
export const BEAT_FRAMES = 54;
export const END_FRAMES = 42;

export const durationFor = (beats: number) => HOOK_FRAMES + beats * BEAT_FRAMES + END_FRAMES;

const INK = "#0b1020";
const PAPER = "#f8f5ef";
const ACCENT: Record<string, string> = {
  lash: "#f472b6",
  nail: "#34d399", // no purple (BRAND-AND-COMPLIANCE-STANDARDS)
  brow: "#f59e0b",
  barber: "#38bdf8",
};

// TikTok/Reels draw their UI over the bottom ~22% and right ~14%; text stays clear.
const SAFE = { top: 260, left: 80, right: 170, bottom: 460 };

// Words slam in one by one; the last word is the punchline, in the accent.
function Hook({ text, accent }: { text: string; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <AbsoluteFill style={{ padding: `${SAFE.top + 80}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`, justifyContent: "center" }}>
      <div style={{ fontSize: 112, fontWeight: 900, lineHeight: 1.02, color: PAPER, letterSpacing: -3 }}>
        {words.map((w, i) => {
          const s = spring({ frame: frame - i * 2, fps, config: { damping: 11, stiffness: 260 } });
          return (
            <span key={i} style={{ display: "inline-block", marginRight: 24, opacity: Math.min(1, s * 2), transform: `scale(${1.4 - 0.4 * s})`, color: i === words.length - 1 ? accent : PAPER }}>
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// A generic site drawn in code (no real business). Each beat lights up the
// part of the site it talks about, matched by keyword.
const SECTIONS = ["url", "hero", "services", "gallery", "map", "reviews", "faq", "book", "contact"] as const;
type Section = (typeof SECTIONS)[number];
const FOCUS: [RegExp, Section][] = [
  [/domain|url|link to their|own site/i, "url"],
  [/book/i, "book"],
  [/servic|price|menu|cost/i, "services"],
  [/photo|gallery|cuts|work|sets|style/i, "gallery"],
  [/hour|address|map|location|where/i, "map"],
  [/review/i, "reviews"],
  [/faq|question/i, "faq"],
  [/contact|phone|email|form|call/i, "contact"],
];
export function focusFor(text: string): Section | null {
  return FOCUS.find(([re]) => re.test(text))?.[1] ?? null;
}

function Phone({ focus, accent, enter }: { focus: Section | null; accent: string; enter: number }) {
  const block = (id: Section, h: number, children?: React.ReactNode) => {
    const on = focus === id;
    return (
      <div
        style={{
          height: h,
          borderRadius: 14,
          marginBottom: 12,
          background: on ? accent : "rgba(248,245,239,0.09)",
          boxShadow: on ? `0 0 0 6px ${accent}55, 0 18px 40px ${accent}66` : "none",
          transform: on ? "scale(1.06)" : "none",
          transition: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
        }}
      >
        {children}
      </div>
    );
  };
  const bar = (w: number, dark?: boolean) => <div style={{ height: 12, width: w, borderRadius: 6, background: dark ? "rgba(11,16,32,0.55)" : "rgba(248,245,239,0.25)" }} />;
  const dark = (id: Section) => focus === id;
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left + 150,
        top: 820,
        width: 470,
        height: 900,
        borderRadius: 56,
        border: "10px solid rgba(248,245,239,0.18)",
        background: "#121a33",
        padding: 26,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 200}px)`,
        overflow: "hidden",
      }}
    >
      {block("url", 44, <><div style={{ width: 12, height: 12, borderRadius: 6, background: dark("url") ? INK : "rgba(248,245,239,0.3)" }} />{bar(220, dark("url"))}</>)}
      {block("hero", 150, <div>{bar(260)}<div style={{ height: 10 }} />{bar(180)}</div>)}
      {block("services", 120, <div>{bar(200, dark("services"))}<div style={{ height: 10 }} />{bar(240, dark("services"))}<div style={{ height: 10 }} />{bar(170, dark("services"))}</div>)}
      {block(
        "gallery",
        110,
        <>{[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 80, borderRadius: 10, background: dark("gallery") ? "rgba(11,16,32,0.4)" : "rgba(248,245,239,0.16)" }} />)}</>,
      )}
      {block("map", 90, <><div style={{ width: 70, height: 60, borderRadius: 10, background: dark("map") ? "rgba(11,16,32,0.4)" : "rgba(248,245,239,0.16)" }} />{bar(150, dark("map"))}</>)}
      {block("reviews", 56, <>{bar(60, dark("reviews"))}{bar(140, dark("reviews"))}</>)}
      {block("faq", 50, bar(230, dark("faq")))}
      {block("book", 58, <div style={{ margin: "0 auto", fontSize: 26, fontWeight: 800, color: dark("book") ? INK : "rgba(248,245,239,0.5)" }}>Book now</div>)}
      {block("contact", 60, bar(190, dark("contact")))}
    </div>
  );
}

// Caption-style: words pop in on a fast stagger, the longest word gets the accent.
function Beat({ text, index, total, accent }: { text: string; index: number; total: number; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = interpolate(frame, [BEAT_FRAMES - 6, BEAT_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const last = index === total - 1;
  const words = text.split(" ");
  const key = words.reduce((a, w, i) => (w.length > words[a].length ? i : a), 0);
  return (
    <AbsoluteFill style={{ padding: `${SAFE.top}px ${SAFE.right}px 0 ${SAFE.left}px` }}>
      <div
        style={{
          fontSize: last ? 88 : 80,
          fontWeight: 900,
          lineHeight: 1.06,
          letterSpacing: -2,
          color: last ? INK : PAPER,
          background: last ? accent : "transparent",
          padding: last ? "28px 36px" : 0,
          borderRadius: last ? 28 : 0,
          opacity: 1 - exit,
          transform: `translateY(${-exit * 60}px)`,
        }}
      >
        {words.map((w, i) => {
          const s = spring({ frame: frame - i * 2, fps, config: { damping: 12, stiffness: 300 } });
          return (
            <span key={i} style={{ display: "inline-block", marginRight: 20, opacity: Math.min(1, s * 2), transform: `translateY(${(1 - s) * 40}px) scale(${1.25 - 0.25 * s})`, color: !last && i === key ? accent : undefined }}>
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function EndCard({ accent }: { accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 220 } });
  // Fades out at the very end so the replay loops cleanly into the hook.
  const out = interpolate(frame, [END_FRAMES - 8, END_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px` }}>
      <div style={{ opacity: s * out, transform: `scale(${1.3 - 0.3 * s})`, textAlign: "center" }}>
        <div style={{ fontSize: 110, fontWeight: 800, color: PAPER, letterSpacing: -3 }}>
          Scale <span style={{ color: accent }}>Strategies</span>
        </div>
        <div style={{ fontSize: 44, fontWeight: 600, color: PAPER, opacity: 0.75, marginTop: 20 }}>Websites for lash, nail, brow and barber pros</div>
      </div>
    </AbsoluteFill>
  );
}

function PhoneTrack({ beats, accent }: { beats: string[]; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const i = Math.min(beats.length - 1, Math.floor(frame / BEAT_FRAMES));
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const out = interpolate(frame, [beats.length * BEAT_FRAMES - 10, beats.length * BEAT_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // CTA beat: the whole site, booking button lit.
  const focus = i === beats.length - 1 ? "book" : focusFor(beats[i]);
  return <Phone focus={focus} accent={accent} enter={enter * out} />;
}

/** Frame index of every hard cut (hook -> beats -> end card). */
export function cutsFor(beats: number): number[] {
  return Array.from({ length: beats + 1 }, (_, i) => HOOK_FRAMES + i * BEAT_FRAMES);
}

export function Post({ audience, hook, beats, music }: PostProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const accent = ACCENT[audience] ?? ACCENT.lash;
  const drift = Math.sin(frame / 18) * 90;
  // Punch-zoom and a white flash on each cut, the editing style short-form uses.
  const since = Math.min(frame, ...cutsFor(beats.length).map((c) => (frame >= c ? frame - c : Infinity)));
  const punch = 1 + 0.08 * Math.max(0, 1 - since / 7);
  const flash = Math.max(0, 0.35 - since * 0.12);
  return (
    <AbsoluteFill style={{ background: INK, fontFamily }}>
      {music && (
        <Audio
          src={music.url}
          startFrom={Math.round(music.startSec * fps)}
          volume={(f) => interpolate(f, [0, 6, durationInFrames - 20, durationInFrames], [0, 0.9, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <div
          style={{
            position: "absolute",
            width: 900,
            height: 900,
            borderRadius: "50%",
            background: accent,
            opacity: 0.16,
            top: -300 + drift,
            right: -380 - drift,
          }}
        />
        <Sequence durationInFrames={HOOK_FRAMES}>
          <Hook text={hook} accent={accent} />
        </Sequence>
        {beats.map((b, i) => (
          <Sequence key={i} from={HOOK_FRAMES + i * BEAT_FRAMES} durationInFrames={BEAT_FRAMES}>
            <Beat text={b} index={i} total={beats.length} accent={accent} />
          </Sequence>
        ))}
        <Sequence from={HOOK_FRAMES} durationInFrames={beats.length * BEAT_FRAMES}>
          <PhoneTrack beats={beats} accent={accent} />
        </Sequence>
        <Sequence from={HOOK_FRAMES + beats.length * BEAT_FRAMES}>
          <EndCard accent={accent} />
        </Sequence>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: PAPER, opacity: flash }} />
      {/* Progress bar: shows the video is short, so viewers stay to the end. */}
      <div style={{ position: "absolute", top: 0, left: 0, height: 12, width: `${(100 * frame) / durationInFrames}%`, background: accent }} />
    </AbsoluteFill>
  );
}
