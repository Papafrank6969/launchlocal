import { describe, it, expect } from "vitest";
import { ACTIONS, decide, SENT_BODY_MAX } from "./approvalDecision";
import { SEND_FOLLOW_UP_DAYS } from "./outreachQueue";
import { FOLLOW_UP_AGAIN_DAYS } from "./followUpQueue";
import type { ApprovalKind } from "./agentTypes";

const NOW = new Date("2026-10-04T18:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const pending = (kind: ApprovalKind) => ({ kind, state: "PENDING" });
const newLead = { name: "Fade Lab", outreachStatus: "NEW" as const, followUpCount: 0 };
const contacted = { name: "Shear Joy", outreachStatus: "CONTACTED" as const, followUpCount: 1 };

describe("decide: DM_DRAFT", () => {
  it("sent → APPROVED, lead CONTACTED with follow-up exactly 3 days out", () => {
    const d = decide(pending("DM_DRAFT"), newLead, "sent", undefined, NOW);
    expect(d).toMatchObject({ ok: true, state: "APPROVED", createSite: false, body: undefined });
    if (!d.ok) throw new Error();
    expect(d.leadPatch!.outreachStatus).toBe("CONTACTED");
    expect(new Date(d.leadPatch!.followUpAt!).getTime() - NOW.getTime()).toBe(SEND_FOLLOW_UP_DAYS * DAY);
  });
  it("reject leaves the lead alone; notFit marks it LOST", () => {
    expect(decide(pending("DM_DRAFT"), newLead, "reject", undefined, NOW)).toEqual({ ok: true, state: "REJECTED", leadPatch: null, createSite: false });
    expect(decide(pending("DM_DRAFT"), newLead, "notFit", undefined, NOW)).toMatchObject({ ok: true, state: "REJECTED", leadPatch: { outreachStatus: "LOST" } });
  });
  it("stale: a lead that's no longer NEW → 409 naming the lead", () => {
    expect(decide(pending("DM_DRAFT"), contacted, "sent", undefined, NOW)).toEqual({ ok: false, status: 409, error: "Shear Joy is already CONTACTED" });
    expect(decide(pending("DM_DRAFT"), contacted, "notFit", undefined, NOW)).toMatchObject({ ok: false, status: 409 });
    expect(decide(pending("DM_DRAFT"), contacted, "reject", undefined, NOW)).toMatchObject({ ok: true }); // reject always works
  });
});

describe("decide: edited body on sent", () => {
  const sent = (body: unknown) => decide(pending("DM_DRAFT"), newLead, "sent", body, NOW);
  it("is scrubbed and stored", () => {
    expect(sent("Hey — want a free mockup?")).toMatchObject({ ok: true, body: "Hey, want a free mockup?" });
  });
  it("empty, non-text or too long → 400", () => {
    expect(sent("   ")).toMatchObject({ ok: false, status: 400 });
    expect(sent(42)).toMatchObject({ ok: false, status: 400 });
    expect(sent("x".repeat(SENT_BODY_MAX + 1))).toMatchObject({ ok: false, status: 400 });
    expect(sent("x".repeat(SENT_BODY_MAX))).toMatchObject({ ok: true });
  });
});

describe("decide: FOLLOW_UP_DRAFT", () => {
  it("sent → bump: count +1, next follow-up 4 days out", () => {
    const d = decide(pending("FOLLOW_UP_DRAFT"), contacted, "sent", undefined, NOW);
    if (!d.ok) throw new Error(d.error);
    expect(d.leadPatch!.followUpCount).toBe(2);
    expect(new Date(d.leadPatch!.followUpAt!).getTime() - NOW.getTime()).toBe(FOLLOW_UP_AGAIN_DAYS * DAY);
    expect(d.leadPatch!.outreachStatus).toBeUndefined();
  });
  it("giveUp → lead LOST, follow-up cleared; stale if no longer CONTACTED", () => {
    expect(decide(pending("FOLLOW_UP_DRAFT"), contacted, "giveUp", undefined, NOW)).toMatchObject({
      ok: true, state: "REJECTED", leadPatch: { outreachStatus: "LOST", followUpAt: null },
    });
    expect(decide(pending("FOLLOW_UP_DRAFT"), newLead, "sent", undefined, NOW)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("decide: SITE_DRAFT and NOTE", () => {
  it("create → APPROVED + createSite, at any lead status", () => {
    expect(decide(pending("SITE_DRAFT"), contacted, "create", undefined, NOW)).toEqual({ ok: true, state: "APPROVED", leadPatch: null, createSite: true });
  });
  it("done on a NOTE needs no lead", () => {
    expect(decide(pending("NOTE"), null, "done", undefined, NOW)).toEqual({ ok: true, state: "APPROVED", leadPatch: null, createSite: false });
  });
});

describe("decide: guards", () => {
  it("already decided → 409", () => {
    expect(decide({ kind: "DM_DRAFT", state: "APPROVED" }, newLead, "sent", undefined, NOW)).toEqual({ ok: false, status: 409, error: "Already decided" });
  });
  it("an action that doesn't fit the kind → 400", () => {
    expect(decide(pending("DM_DRAFT"), newLead, "create", undefined, NOW)).toMatchObject({ ok: false, status: 400 });
    expect(decide(pending("NOTE"), null, "sent", undefined, NOW)).toMatchObject({ ok: false, status: 400 });
    expect(decide(pending("NOTE"), null, undefined, undefined, NOW)).toMatchObject({ ok: false, status: 400 });
  });
  it("lead actions on a deleted lead → 409, reject still works", () => {
    for (const [kind, action] of [["DM_DRAFT", "sent"], ["FOLLOW_UP_DRAFT", "giveUp"], ["SITE_DRAFT", "create"]] as const) {
      expect(decide(pending(kind), null, action, undefined, NOW)).toEqual({ ok: false, status: 409, error: "Lead no longer exists" });
      expect(decide(pending(kind), null, "reject", undefined, NOW)).toMatchObject({ ok: true, state: "REJECTED" });
    }
  });
  it("every kind has at least one action", () => {
    for (const actions of Object.values(ACTIONS)) expect(actions.length).toBeGreaterThan(0);
  });
});
