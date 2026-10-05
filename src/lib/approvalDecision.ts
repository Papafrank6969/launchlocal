import type { ApprovalKind } from "./agentTypes";
import type { OutreachStatus } from "./outreachStatus";
import { outreachPatchForAction } from "./outreachQueue";
import { followUpPatchForAction } from "./followUpQueue";
import { scrubDraft } from "./brothers/draftText";

// What Frank's click on an approval card does (docs/FRAT-HOUSE-APPROVALS-PLAN.md §1).
// Pure: the route loads the rows, calls decide(), then applies the result.

export const SENT_BODY_MAX = 1000;

export type ApprovalAction = "sent" | "reject" | "notFit" | "giveUp" | "create" | "done";

export const ACTIONS: Record<ApprovalKind, ApprovalAction[]> = {
  DM_DRAFT: ["sent", "reject", "notFit"],
  FOLLOW_UP_DRAFT: ["sent", "reject", "giveUp"],
  SITE_DRAFT: ["create", "reject"],
  NOTE: ["done"],
};

export type LeadPatch = { outreachStatus?: OutreachStatus; followUpAt?: string | null; followUpCount?: number };

export type Decision =
  | { ok: true; state: "APPROVED" | "REJECTED"; body?: string; leadPatch: LeadPatch | null; createSite: boolean }
  | { ok: false; status: 400 | 409; error: string };

// The lead status a draft was written for. Acting on it after the lead moved on is stale.
const EXPECTED: Partial<Record<ApprovalKind, OutreachStatus>> = { DM_DRAFT: "NEW", FOLLOW_UP_DRAFT: "CONTACTED" };

export function decide(
  approval: { kind: ApprovalKind; state: string },
  lead: { name: string; outreachStatus: OutreachStatus; followUpCount: number } | null,
  action: unknown,
  editedBody: unknown,
  now: Date,
): Decision {
  if (approval.state !== "PENDING") return { ok: false, status: 409, error: "Already decided" };
  if (typeof action !== "string" || !ACTIONS[approval.kind].includes(action as ApprovalAction)) {
    return { ok: false, status: 400, error: `Can't ${String(action)} a ${approval.kind}` };
  }
  const a = action as ApprovalAction;
  if (a === "reject") return { ok: true, state: "REJECTED", leadPatch: null, createSite: false };
  if (a === "done") return { ok: true, state: "APPROVED", leadPatch: null, createSite: false };

  if (!lead) return { ok: false, status: 409, error: "Lead no longer exists" };
  if (a === "create") return { ok: true, state: "APPROVED", leadPatch: null, createSite: true };

  const expected = EXPECTED[approval.kind];
  if (expected && lead.outreachStatus !== expected) {
    return { ok: false, status: 409, error: `${lead.name} is already ${lead.outreachStatus}` };
  }

  if (a === "notFit") return { ok: true, state: "REJECTED", leadPatch: outreachPatchForAction("reject", now), createSite: false };
  if (a === "giveUp") return { ok: true, state: "REJECTED", leadPatch: followUpPatchForAction("giveUp", lead, now), createSite: false };

  // sent
  let body: string | undefined;
  if (editedBody !== undefined) {
    if (typeof editedBody !== "string") return { ok: false, status: 400, error: "Message must be text" };
    body = scrubDraft(editedBody);
    if (!body) return { ok: false, status: 400, error: "Message is empty" };
    if (body.length > SENT_BODY_MAX) return { ok: false, status: 400, error: `Message is over ${SENT_BODY_MAX} characters` };
  }
  const leadPatch =
    approval.kind === "DM_DRAFT" ? outreachPatchForAction("send", now) : followUpPatchForAction("bump", lead, now);
  return { ok: true, state: "APPROVED", body, leadPatch, createSite: false };
}
