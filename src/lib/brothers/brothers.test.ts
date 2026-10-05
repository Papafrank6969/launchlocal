import { describe, it, expect } from "vitest";
import { scoutJob, SCOUT_PICKS } from "./scout";
import { rushChairJob, RUSH_CHAIR_DRAFTS } from "./rushChair";
import { followUpJob } from "./followUp";
import { builderJob, BUILDER_PROPOSALS } from "./builder";
import { treasurerJob } from "./treasurer";
import { PENDING_PAUSE } from "./draftText";
import { leadToDraftSite } from "../leadToSite";
import type { BacklogLead } from "../leadBacklog";
import type { QueueLead } from "../outreachQueue";
import type { FollowUpQueueLead } from "../followUpQueue";
import { fakeCtx } from "./testCtx";

const NOW = new Date("2026-10-04T18:00:00Z");
const GOOD = "Hey there, saw your shop on Google and figured I'd reach out. Want a free mockup?";

function backlogLead(i: number, over: Partial<BacklogLead> = {}): BacklogLead {
  return {
    id: `l${i}`, name: `Shop ${i}`, category: "barber", city: "Massapequa", websiteStatus: "NONE", outreachStatus: "NEW",
    instagramHandle: null, rating: 4.5, reviewCount: i * 10, createdAt: "2026-09-01T00:00:00Z", sites: [], ...over,
  };
}
const queueLead = (i: number, over: Partial<QueueLead> = {}): QueueLead => ({ ...backlogLead(i), instagramHandle: `shop${i}`, ...over });
const followLead = (i: number, over: Partial<FollowUpQueueLead> = {}): FollowUpQueueLead => ({
  id: `f${i}`, name: `Shop ${i}`, category: "barber", city: "Bayside", instagramHandle: `shop${i}`, outreachStatus: "CONTACTED",
  followUpAt: "2026-10-01T00:00:00Z", followUpCount: 0, sites: [], ...over,
});
const replyFor = (ids: string[], text = GOOD) => JSON.stringify(ids.map((id) => ({ id, text })));

describe("scoutJob", () => {
  it("ranks by opportunityScore and files one NOTE with the top picks", async () => {
    const leads = Array.from({ length: 14 }, (_, i) => backlogLead(i, i === 13 ? { instagramHandle: "shop13" } : {}));
    const f = fakeCtx(JSON.stringify([{ id: "l13", why: "Most reviews — well established" }]));
    expect(await scoutJob({ leads, filedToday: false }, f.ctx)).toBe(`ranked ${SCOUT_PICKS} leads`);
    expect(f.asks).toHaveLength(1);
    expect(f.proposals).toHaveLength(1);
    const lines = f.proposals[0].body.split("\n");
    expect(lines).toHaveLength(SCOUT_PICKS);
    expect(lines[0]).toMatch(/^1\. Shop 13 .*Most reviews, well established$/); // handle bonus ranks it first; dash scrubbed
    expect(f.proposals[0].kind).toBe("NOTE");
  });
  it("skips HAS_SITE (score 0), files nothing with no leads, and files once per day", async () => {
    const empty = fakeCtx();
    expect(await scoutJob({ leads: [backlogLead(1, { websiteStatus: "HAS_SITE" })], filedToday: false }, empty.ctx)).toBe("no untouched leads to rank");
    expect(empty.asks).toHaveLength(0);
    const again = fakeCtx();
    expect(await scoutJob({ leads: [backlogLead(1)], filedToday: true }, again.ctx)).toBe("already filed today");
    expect(again.proposals).toHaveLength(0);
  });
  it("still files the picks (without reasons) if Claude fails", async () => {
    const f = fakeCtx(new Error("overloaded"));
    await scoutJob({ leads: [backlogLead(1)], filedToday: false }, f.ctx);
    expect(f.proposals[0].body).toMatch(/^1\. Shop 1 \(barber, Massapequa\) · score \d+$/);
  });
});

describe("rushChairJob", () => {
  const base = { pendingDrafts: 0, previewBase: "https://launchlocal.test" };
  it(`one call, up to ${RUSH_CHAIR_DRAFTS} DM drafts, each tied to its lead`, async () => {
    const leads = Array.from({ length: 11 }, (_, i) => queueLead(i));
    const f = fakeCtx(replyFor(leads.map((l) => l.id)));
    expect(await rushChairJob({ ...base, leads }, f.ctx)).toBe(`drafted ${RUSH_CHAIR_DRAFTS} DMs (${RUSH_CHAIR_DRAFTS} written, 0 template)`);
    expect(f.asks).toHaveLength(1);
    expect(f.proposals).toHaveLength(RUSH_CHAIR_DRAFTS);
    expect(f.proposals.every((p) => p.kind === "DM_DRAFT" && p.leadId && p.body === GOOD)).toBe(true);
  });
  it("passes the preview link only for leads with a site, and the template keeps it", async () => {
    const leads = [queueLead(1, { sites: [{ id: "s1", slug: "shop-1", status: "PUBLISHED" }] }), queueLead(2)];
    const f = fakeCtx("not json");
    await rushChairJob({ ...base, leads }, f.ctx);
    expect(f.asks[0].prompt).toContain("https://launchlocal.test/s/shop-1");
    const withSite = f.proposals.find((p) => p.leadId === "l1")!;
    expect(withSite.title).toBe("DM for Shop 1 (template)");
    expect(withSite.body).toContain("https://launchlocal.test/s/shop-1");
    expect(withSite.body).not.toMatch(/[—–]/);
  });
  it(`pauses at ${PENDING_PAUSE} waiting drafts: no call, no drafts`, async () => {
    const f = fakeCtx();
    expect(await rushChairJob({ ...base, pendingDrafts: PENDING_PAUSE, leads: [queueLead(1)] }, f.ctx)).toMatch(/^paused/);
    expect(f.asks).toHaveLength(0);
    expect(f.proposals).toHaveLength(0);
    expect(f.nows[0]).toContain("waiting on Frank");
  });
  it("no handles → nothing to do, no call", async () => {
    const f = fakeCtx();
    expect(await rushChairJob({ ...base, leads: [queueLead(1, { instagramHandle: null })] }, f.ctx)).toBe("nothing new to draft (no undrafted NEW leads with a handle)");
    expect(f.asks).toHaveLength(0);
  });
});

describe("followUpJob", () => {
  const base = { pendingDrafts: 0, previewBase: "https://launchlocal.test", now: NOW };
  it("drafts only leads that are due and under the follow-up cap", async () => {
    const leads = [followLead(1), followLead(2, { followUpAt: "2026-10-09T00:00:00Z" }), followLead(3, { followUpCount: 2 })];
    const f = fakeCtx(replyFor(["f1"]));
    expect(await followUpJob({ ...base, leads }, f.ctx)).toBe("drafted 1 follow-ups (1 written, 0 template)");
    expect(f.proposals.map((p) => [p.kind, p.leadId])).toEqual([["FOLLOW_UP_DRAFT", "f1"]]);
  });
  it("pauses when too many are waiting and does nothing when none are due", async () => {
    expect(await followUpJob({ ...base, pendingDrafts: PENDING_PAUSE, leads: [followLead(1)] }, fakeCtx().ctx)).toMatch(/^paused/);
    const f = fakeCtx();
    expect(await followUpJob({ ...base, leads: [] }, f.ctx)).toBe("nothing new to draft (no undrafted follow-ups due)");
    expect(f.asks).toHaveLength(0);
  });
});

describe("builderJob", () => {
  const lead = (i: number) => ({ id: `b${i}`, name: `Shop ${i}`, category: "barber", city: "Bayside", rating: 4.8, reviewCount: 40, placeId: `p${i}` });
  it(`proposes up to ${BUILDER_PROPOSALS} SITE_DRAFTs whose body round-trips to leadToDraftSite, with no Claude call`, async () => {
    const leads = Array.from({ length: 5 }, (_, i) => lead(i));
    const f = fakeCtx();
    expect(await builderJob({ leads }, f.ctx)).toBe(`proposed ${BUILDER_PROPOSALS} draft sites`);
    expect(f.asks).toHaveLength(0);
    expect(f.proposals).toHaveLength(BUILDER_PROPOSALS);
    expect(JSON.parse(f.proposals[0].body)).toEqual({ leadId: "b0", preview: leadToDraftSite(leads[0]) });
    expect(f.proposals[0]).toMatchObject({ kind: "SITE_DRAFT", leadId: "b0", title: "Draft site for Shop 0" });
  });
  it("no warm leads → nothing", async () => {
    const f = fakeCtx();
    expect(await builderJob({ leads: [] }, f.ctx)).toBe("nothing to propose (no warm leads without a site or proposal)");
    expect(f.proposals).toHaveLength(0);
  });
});

describe("treasurerJob", () => {
  const input = {
    dayLabel: "Oct 3",
    filedToday: false,
    budgetMicros: 1_000_000,
    runs: [
      { agentId: "scout", outcome: "OK", costMicros: 1_500 },
      { agentId: "rush-chair", outcome: "OK", costMicros: 4_000 },
      { agentId: "rush-chair", outcome: "ERROR", costMicros: 500 },
    ],
    pending: [{ kind: "DM_DRAFT", count: 5 }, { kind: "NOTE", count: 0 }],
    events: [{ type: "LEAD_FOUND" }, { type: "LEAD_FOUND" }, { type: "LEAD_CONTACTED" }],
  };
  it("writes the numbers with no Claude call", async () => {
    const f = fakeCtx();
    expect(await treasurerJob(input, f.ctx)).toBe("digest for Oct 3: $0.006 spent");
    expect(f.asks).toHaveLength(0);
    expect(f.proposals[0]).toMatchObject({ kind: "NOTE", title: "Daily digest, Oct 3" });
    expect(f.proposals[0].body.split("\n")).toEqual([
      "Spend: $0.006 of $1.00",
      "",
      "Runs:",
      "- rush-chair: 2 runs, $0.005, 1 error",
      "- scout: 1 run, $0.002",
      "",
      "Funnel: 2 leads found · 1 contacted · 0 replied · 0 won · 0 sites published",
      "",
      "Waiting on you: 5 (5 DM_DRAFT)",
    ]);
  });
  it("files once per day, and says none on a quiet day", async () => {
    expect(await treasurerJob({ ...input, filedToday: true }, fakeCtx().ctx)).toBe("already filed today");
    const f = fakeCtx();
    await treasurerJob({ ...input, runs: [], events: [], pending: [] }, f.ctx);
    expect(f.proposals[0].body).toContain("- none");
    expect(f.proposals[0].body).toContain("Waiting on you: 0");
  });
});
