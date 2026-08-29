import type { OutreachStatus } from "./outreachStatus";

/** The minimum a lead needs for the outreach console to work it. */
export type QueueLead = {
  id: string;
  name: string;
  category: string;
  city: string;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
  instagramHandle: string | null;
  rating: number | null;
  createdAt: string;
  sites?: { id: string; slug: string; status: string }[];
};

/**
 * A lead belongs in the Instagram outreach queue when it's untouched, has a
 * handle to DM, and still needs a site. Leads that already have a real website
 * aren't opportunities; leads past NEW are already in the pipeline.
 */
export function isEligibleForQueue(lead: QueueLead): boolean {
  if (lead.websiteStatus === "HAS_SITE") return false;
  if (!lead.instagramHandle || !lead.instagramHandle.trim()) return false;
  return true;
}

function hasDraftSite(lead: QueueLead): boolean {
  return (lead.sites?.length ?? 0) > 0;
}

/**
 * Best lead first: ones with a site already built (the pitch is a live link,
 * not a maybe), then higher-rated businesses, then oldest leads so nothing
 * rots at the bottom of the list.
 */
export function compareQueueLeads(a: QueueLead, b: QueueLead): number {
  const draftDelta = Number(hasDraftSite(b)) - Number(hasDraftSite(a));
  if (draftDelta !== 0) return draftDelta;

  const ratingDelta = (b.rating ?? -1) - (a.rating ?? -1);
  if (ratingDelta !== 0) return ratingDelta;

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/** Filter to eligible leads, then order them for the console. */
export function buildOutreachQueue(leads: QueueLead[]): QueueLead[] {
  return leads.filter(isEligibleForQueue).sort(compareQueueLeads);
}

export type QueueAction = "open" | "send" | "skip" | "reject";

/** Keyboard shortcuts for the console, in the order the legend lists them. */
export const QUEUE_KEYS: { key: string; action: QueueAction; label: string }[] = [
  { key: "Enter", action: "open", label: "Open DM + copy message" },
  { key: "1", action: "send", label: "Mark sent — next" },
  { key: "2", action: "skip", label: "Skip — next" },
  { key: "3", action: "reject", label: "Not a fit — next" },
];

const KEY_TO_ACTION: Record<string, QueueAction> = Object.fromEntries(
  QUEUE_KEYS.map(({ key, action }) => [key, action]),
);

export function resolveQueueKey(key: string): QueueAction | null {
  return KEY_TO_ACTION[key] ?? null;
}

/** "open" stays on the current lead; the other three move to the next one. */
export function actionAdvances(action: QueueAction): boolean {
  return action !== "open";
}

/** How far out a follow-up is set when a DM is marked sent. */
export const SEND_FOLLOW_UP_DAYS = 3;

/**
 * The lead PATCH an action implies. "open" and "skip" don't touch the lead;
 * "send" advances it to CONTACTED with a follow-up, "reject" marks it LOST.
 */
export function outreachPatchForAction(
  action: QueueAction,
  now: Date = new Date(),
): { outreachStatus?: OutreachStatus; followUpAt?: string } | null {
  if (action === "send") {
    const followUp = new Date(now);
    followUp.setDate(followUp.getDate() + SEND_FOLLOW_UP_DAYS);
    return { outreachStatus: "CONTACTED", followUpAt: followUp.toISOString() };
  }
  if (action === "reject") return { outreachStatus: "LOST" };
  return null;
}

/** A human sends maybe 20–40 cold DMs a day before Instagram starts limiting. */
export const PACING_CAUTION = 25;
export const PACING_LIMIT = 40;

export type PacingLevel = "ok" | "caution" | "limit";

export function pacingLevel(sent: number): PacingLevel {
  if (sent >= PACING_LIMIT) return "limit";
  if (sent >= PACING_CAUTION) return "caution";
  return "ok";
}
