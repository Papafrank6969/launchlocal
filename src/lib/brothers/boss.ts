import type { BrotherContext } from "../agentTypes";
import { scrubDraft } from "./draftText";

// The Big Boss: runs last on every tick (every 15 min) and watches both houses.
// He only thinks (one Sonnet call) when the house state changed since he last
// looked, so a quiet day costs a few cents. He can write Frank a note and switch
// a brother off. He can never switch one on, approve anything, or spend money.

export const NOTE_MAX = 600;

/** Frank's goal (2026-10-09): $10k from $1k sites by March 31, 2027, which needs ~10 DMs a day. Dates are ET midnights. */
export const GOAL = { start: new Date("2026-10-09T04:00:00Z"), end: new Date("2027-04-01T04:00:00Z"), target: 10_000, price: 1_000, dmsPerDay: 10 };

/** Snapshot line for the goal. Pass the ET day start, so it only changes once a day or when a sale lands. */
export function goalLine(sales: number, dmsYesterday: number, dmsLast7: number, dayStart: Date): string {
  const span = GOAL.end.getTime() - GOAL.start.getTime();
  const share = Math.min(1, Math.max(0, (dayStart.getTime() - GOAL.start.getTime()) / span));
  const expected = Math.floor((GOAL.target / GOAL.price) * share);
  const daysLeft = Math.max(0, Math.round((GOAL.end.getTime() - dayStart.getTime()) / 86_400_000));
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
  return [
    `Goal: ${usd(sales * GOAL.price)} of ${usd(GOAL.target)} by Mar 31 (${sales} sites sold at ${usd(GOAL.price)}; on pace means ${expected} by now; ${daysLeft} days left).`,
    `DMs sent yesterday: ${dmsYesterday}, last 7 days: ${dmsLast7} (pace: ${GOAL.dmsPerDay} a day).`,
  ].join(" ");
}

export type BossInput = {
  /** Deterministic picture of both houses. No timestamps or spend figures, so it only changes when something happens. */
  snapshot: string;
  lastSnapshot: string | null;
  /** His last note to Frank, so he doesn't send the same one again. */
  lastNote: string | null;
  /** Brothers he may switch off (everyone but himself). */
  brotherIds: string[];
  saveSnapshot(snapshot: string): Promise<void>;
  disable(id: string): Promise<void>;
};

const SYSTEM = `You are the Big Boss of LaunchLocal's agent houses. Frank (the human owner) builds simple websites for independent auto detailers and tattoo artists.
The Frat House finds leads and drafts Instagram DMs for Frank to send by hand; its Gambler brother files daily paper sports picks Frank asked for. The Villa writes, renders and posts one TikTok/Reels video a day.
Every brother runs every 15 minutes and does work only when there is some. You see the state of both houses and what changed.
Frank's goal: $10,000 from $1,000 sites by March 31, 2027, which takes about 10 DMs sent a day. The Goal line shows where he stands. On Mondays, and on the day a sale comes in, include one line on the goal in your note: on pace or behind, and the one thing to do about it (usually send more DMs). Other days, only mention it if no DMs went out yesterday.
Your two powers:
- note: a short message to Frank, only when he needs to know or do something (a brother keeps erroring, posts stopped going out, drafts are piling up waiting on him, budget nearly used). Plain words, under ${NOTE_MAX} characters. No em dashes, no emoji. Use null when nothing needs his attention; most of the time nothing does. Never repeat your last note: only write again if something new happened or a problem got clearly worse.
- disable: switch a brother off, only if he is repeatedly erroring or doing something harmful (e.g. Poster failing every post). Frank turns him back on. Leave it empty almost always.
Reply with only JSON: {"note": string | null, "disable": [{"id": string, "reason": string}]}`;

export async function bossJob(input: BossInput, ctx: BrotherContext): Promise<string> {
  if (input.snapshot === input.lastSnapshot) return "all quiet";

  await ctx.setNow("checking on both houses");
  const reply = await ctx.ask({
    system: SYSTEM,
    prompt: `Your last note to Frank:\n${input.lastNote ?? "(none)"}\n\nLast time you looked:\n${input.lastSnapshot ?? "(first look)"}\n\nNow:\n${input.snapshot}`,
    maxTokens: 500,
  });
  // Saved only after he's actually looked, so a failed call retries next tick.
  await input.saveSnapshot(input.snapshot);

  const { note, disabled } = parseBossReply(reply, input.brotherIds);
  for (const d of disabled) await input.disable(d.id);
  const body = [note, ...disabled.map((d) => `Switched off ${d.id}: ${d.reason}`)].filter(Boolean).join("\n\n");
  if (body) await ctx.propose({ kind: "NOTE", title: "From the Boss", body });

  const parts = [note ? "wrote Frank a note" : "nothing for Frank", ...disabled.map((d) => `switched off ${d.id}`)];
  return parts.join(", ");
}

/** Bad JSON or unknown ids are dropped, never acted on. */
export function parseBossReply(reply: string, brotherIds: string[]): { note: string | null; disabled: { id: string; reason: string }[] } {
  let raw: { note?: unknown; disable?: unknown } | null = null;
  try {
    raw = JSON.parse(reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1));
  } catch {
    // unreadable reply: no note, nobody switched off
  }
  const note = typeof raw?.note === "string" && raw.note.trim() ? scrubDraft(raw.note).slice(0, NOTE_MAX) : null;
  const disabled = (Array.isArray(raw?.disable) ? raw.disable : [])
    .filter((d): d is { id: string; reason?: unknown } => typeof d?.id === "string" && brotherIds.includes(d.id))
    .map((d) => ({ id: d.id, reason: typeof d.reason === "string" ? scrubDraft(d.reason).slice(0, 200) : "no reason given" }));
  return { note, disabled };
}
