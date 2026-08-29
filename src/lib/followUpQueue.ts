import type { OutreachStatus } from "./outreachStatus";

/** The minimum a lead needs for the follow-up console to work it. */
export type FollowUpQueueLead = {
  id: string;
  name: string;
  category: string;
  city: string;
  instagramHandle: string | null;
  outreachStatus: OutreachStatus;
  followUpAt: string | null;
  followUpCount: number;
  sites?: { id: string; slug: string; status: string }[];
};

/** Stop resurfacing a lead after this many follow-up touches — a cold DM that
 *  hasn't landed after 2 bumps needs a human decision, not a 3rd nudge. */
export const MAX_FOLLOW_UPS = 2;

/** How far out the next follow-up is pushed after a bump. */
export const FOLLOW_UP_AGAIN_DAYS = 4;

/**
 * A lead belongs in the follow-up queue when it's mid-outreach (CONTACTED),
 * its follow-up date has actually arrived, it still has a handle to DM, and
 * it hasn't already been bumped past the cap.
 */
export function isEligibleForFollowUp(lead: FollowUpQueueLead, now: Date = new Date()): boolean {
  if (lead.outreachStatus !== "CONTACTED") return false;
  if (!lead.instagramHandle || !lead.instagramHandle.trim()) return false;
  if (!lead.followUpAt) return false;
  if (new Date(lead.followUpAt).getTime() > now.getTime()) return false;
  if (lead.followUpCount >= MAX_FOLLOW_UPS) return false;
  return true;
}

/** Most overdue first — the ones that have been waiting longest need the touch most. */
export function compareFollowUpLeads(a: FollowUpQueueLead, b: FollowUpQueueLead): number {
  const aDue = a.followUpAt ? new Date(a.followUpAt).getTime() : 0;
  const bDue = b.followUpAt ? new Date(b.followUpAt).getTime() : 0;
  return aDue - bDue;
}

/** Filter to eligible leads, then order them for the console. */
export function buildFollowUpQueue(leads: FollowUpQueueLead[], now: Date = new Date()): FollowUpQueueLead[] {
  return leads.filter((l) => isEligibleForFollowUp(l, now)).sort(compareFollowUpLeads);
}

export type FollowUpAction = "open" | "bump" | "skip" | "replied" | "giveUp";

/** Keyboard shortcuts for the follow-up console, in the order the legend lists them. */
export const FOLLOW_UP_KEYS: { key: string; action: FollowUpAction; label: string }[] = [
  { key: "Enter", action: "open", label: "Open DM + copy message" },
  { key: "1", action: "bump", label: "Followed up — next" },
  { key: "2", action: "skip", label: "Skip — next" },
  { key: "3", action: "replied", label: "They replied — next" },
  { key: "4", action: "giveUp", label: "Give up — next" },
];

const KEY_TO_ACTION: Record<string, FollowUpAction> = Object.fromEntries(
  FOLLOW_UP_KEYS.map(({ key, action }) => [key, action]),
);

export function resolveFollowUpKey(key: string): FollowUpAction | null {
  return KEY_TO_ACTION[key] ?? null;
}

/** "open" stays on the current lead; every other action moves to the next one. */
export function followUpActionAdvances(action: FollowUpAction): boolean {
  return action !== "open";
}

/**
 * The lead PATCH an action implies:
 * - "bump" stays CONTACTED, pushes followUpAt out again, and counts the touch
 *   (capped by MAX_FOLLOW_UPS via isEligibleForFollowUp on the next fetch).
 * - "replied" and "giveUp" leave the follow-up loop entirely, clearing
 *   followUpAt so the lead also drops off Pipeline's overdue count.
 * - "skip" and "open" don't touch the lead.
 */
export function followUpPatchForAction(
  action: FollowUpAction,
  lead: Pick<FollowUpQueueLead, "followUpCount">,
  now: Date = new Date(),
): { outreachStatus?: OutreachStatus; followUpAt?: string | null; followUpCount?: number } | null {
  if (action === "bump") {
    const next = new Date(now);
    next.setDate(next.getDate() + FOLLOW_UP_AGAIN_DAYS);
    return { followUpAt: next.toISOString(), followUpCount: lead.followUpCount + 1 };
  }
  if (action === "replied") return { outreachStatus: "RESPONDED", followUpAt: null };
  if (action === "giveUp") return { outreachStatus: "LOST", followUpAt: null };
  return null;
}
