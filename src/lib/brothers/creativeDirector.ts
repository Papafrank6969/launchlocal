import type { BrotherContext } from "../agentTypes";
import { scrubDraft } from "./draftText";

// The Villa's first brother (docs/VILLA-PLAN.md): writes one LaunchLocal promo
// post spec a day. The Editor renders it, the Poster publishes it.

export const AUDIENCES = ["lash", "nail", "brow", "barber"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const PILLARS = ["how-to", "myth", "demo", "behind-the-scenes"] as const;

export const HOOK_MAX = 55;
export const BEAT_MAX = 60;
export const BEATS_MIN = 3;
export const BEATS_MAX = 5;
export const CAPTION_MAX = 500;
export const HASHTAGS_MAX = 5;
const RECENT = 14;

export type PostSpec = { hook: string; beats: string[]; caption: string; hashtags: string[] };
export type NewPost = { audience: Audience; pillar: string; spec: PostSpec };

export type CreativeDirectorInput = {
  draftedToday: boolean;
  dayIndex: number; // days since epoch (ET), rotates the audience
  recent: { audience: string; pillar: string; hook: string }[]; // newest first
  save(post: NewPost): Promise<void>;
};

// What a LaunchLocal site actually has (prisma Site model + src/components/site).
// Posts may only claim these; update when the builder gains a feature.
export const SITE_FEATURES =
  "services with prices, a photo gallery, hours, address with a map, phone and email, an FAQ, real Google reviews (only if the business has them), a link to the booking app they already use, a contact form, a link to their Instagram, their own domain";

const SYSTEM = `You write short-form video posts (TikTok + Instagram Reels) for Scale Strategies, Frank's Instagram and TikTok. Frank builds simple booking websites for independent lash techs, nail techs, brow artists and barbers.
The video is code-made motion graphics over a hip-hop beat: big on-screen text lines, a fast cut every 2 seconds. No people, no voiceover.
Who watches: techs and barbers in their 20s who run their business from their phone. Write like one of them texting a friend, not like a marketer or a business coach.
Formats that work on them: "POV: ...", "things nobody tells you about ...", "stop ...", "if your link in bio is ...", a relatable annoyance from their day (the same price question in DMs, "where are you located", a Linktree with 9 links). Pick one and commit.
Rules, all strict:
- Never mention a real business, person, client or result. No numbers about clients, bookings, money or growth. No testimonials. No guarantees.
- No outcome or speed claims: never say a site gets more clients, more bookings, faster bookings or more trust, and never say how fast Frank builds. Describe what the site has, not what it will do for them.
- The site has ONLY these features, mention no others (no tipping, payments, checkout, scheduling system, reminders, apps): ${SITE_FEATURES}. Owners keep their Instagram.
- Sentence case: capitalize the first word of every line. Spell words out ("you", "your", never "u" or "ur"). Casual and short: contractions, everyday words a 25 year old uses, sounds like a friend not an ad. Nothing a 50 year old says ("folks", "online presence", "take your business to the next level"). No em dashes. No emoji. No profanity. No hype ("game changer", "level up", "unlock").
- hook: under ${HOOK_MAX} characters, stops the scroll in the first second. Make it a little bold or relatable, never a plain statement.
- beats: ${BEATS_MIN} to ${BEATS_MAX} on-screen lines, each under ${BEAT_MAX} characters, building to the last one which says what to do next (e.g. DM "SITE").
- caption: under ${CAPTION_MAX} characters, one or two short lines, same voice, ends with a question or "DM SITE".
- hashtags: up to ${HASHTAGS_MAX}, no "#", lowercase, niche ones.`;

/** Same audience all day, a different one each day. */
export function audienceFor(dayIndex: number): Audience {
  return AUDIENCES[((dayIndex % AUDIENCES.length) + AUDIENCES.length) % AUDIENCES.length];
}

/** The pillar used least recently (never used first). */
export function pickPillar(recentPillars: string[]): string {
  let best: string = PILLARS[0];
  let bestAge = -1;
  for (const p of PILLARS) {
    const i = recentPillars.indexOf(p);
    const age = i === -1 ? Infinity : i;
    if (age > bestAge) {
      best = p;
      bestAge = age;
    }
  }
  return best;
}

// Claims the sites can't back up. Public posts, so enforced in code, not just the prompt.
const BANNED = /\b(tipping|tip jar|add a tip|payments?|checkout|pay online|deposits?|reminders?|fees?|middleman|guarantee\w*|more (clients|bookings|money|customers)|faster|in minutes|overnight)\b/i;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = scrubDraft(v);
  return s.length > 0 && s.length <= max ? s : null;
};

/** Reads a spec out of a reply (fences/prose tolerated) and enforces every limit, or null. */
export function parseSpec(reply: string): PostSpec | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const hook = clean(raw.hook, HOOK_MAX);
  const caption = clean(raw.caption, CAPTION_MAX);
  if (!hook || !caption || !Array.isArray(raw.beats) || !Array.isArray(raw.hashtags)) return null;
  const beats = raw.beats.map((b) => clean(b, BEAT_MAX));
  if (beats.length < BEATS_MIN || beats.length > BEATS_MAX || beats.some((b) => b === null)) return null;
  const hashtags = raw.hashtags
    .filter((h): h is string => typeof h === "string")
    .map((h) => h.replace(/^#/, "").toLowerCase().replace(/[^a-z0-9_]/g, ""))
    .filter(Boolean)
    .slice(0, HASHTAGS_MAX);
  if (BANNED.test([hook, ...(beats as string[]), caption].join(" "))) return null;
  return { hook, beats: beats as string[], caption, hashtags };
}

export async function creativeDirectorJob(input: CreativeDirectorInput, ctx: BrotherContext): Promise<string> {
  if (input.draftedToday) return "already wrote today's post";
  const audience = audienceFor(input.dayIndex);
  const recent = input.recent.slice(0, RECENT);
  const pillar = pickPillar(recent.map((r) => r.pillar));

  const who = audience === "barber" ? "barbers" : `${audience} techs`;
  await ctx.setNow(`writing a ${pillar} post for ${who}`);
  const reply = await ctx.ask({
    system: SYSTEM,
    prompt: `Audience: independent ${who}.
Pillar: ${pillar}.
Recent hooks (don't repeat these angles):\n${recent.map((r) => `- ${r.hook}`).join("\n") || "- none yet"}

Reply with only JSON: {"hook": "...", "beats": ["..."], "caption": "...", "hashtags": ["..."]}`,
    maxTokens: 2000, // Sonnet thinks first; 700 truncated the JSON
  });

  const spec = parseSpec(reply);
  if (!spec) return "reply broke the post rules, skipped (tries again next run)";
  await input.save({ audience, pillar, spec });
  return `wrote a ${pillar} post for ${audience}: "${spec.hook}"`;
}
