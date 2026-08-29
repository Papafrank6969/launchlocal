import { describe, it, expect } from "vitest";
import { buildFunnel, funnelEventsByDay, FUNNEL_STAGE_KEYS } from "./funnel";
import type { FunnelEvent, FunnelLead } from "./funnel";

const lead = (over: Partial<FunnelLead>): FunnelLead => ({
  id: "L1",
  websiteStatus: "NONE",
  outreachStatus: "NEW",
  ...over,
});

const event = (over: Partial<FunnelEvent>): FunnelEvent => ({
  type: "LEAD_CONTACTED",
  leadId: null,
  siteId: null,
  createdAt: "2026-08-25T12:00:00.000Z",
  ...over,
});

describe("buildFunnel", () => {
  // Fixture:
  //  L1 HAS_SITE, NEW          -> found only
  //  L2 NONE, NEW              -> opportunity
  //  L3 NONE, CONTACTED        -> advanced by status only (pre-events era)
  //  L4 POOR, RESPONDED        -> status-only responded
  //  L5 NONE, WON              -> status-only won
  //  L6 NONE, NEW + event      -> contacted by event only
  //  L7 NONE, CONTACTED + event-> both sources (must count once)
  //  L8 NONE, NEW + events     -> contacted + responded by events
  const leads: FunnelLead[] = [
    lead({ id: "L1", websiteStatus: "HAS_SITE", outreachStatus: "NEW" }),
    lead({ id: "L2", websiteStatus: "NONE", outreachStatus: "NEW" }),
    lead({ id: "L3", websiteStatus: "NONE", outreachStatus: "CONTACTED" }),
    lead({ id: "L4", websiteStatus: "POOR", outreachStatus: "RESPONDED" }),
    lead({ id: "L5", websiteStatus: "NONE", outreachStatus: "WON" }),
    lead({ id: "L6", websiteStatus: "NONE", outreachStatus: "NEW" }),
    lead({ id: "L7", websiteStatus: "NONE", outreachStatus: "CONTACTED" }),
    lead({ id: "L8", websiteStatus: "NONE", outreachStatus: "NEW" }),
  ];
  const events: FunnelEvent[] = [
    event({ type: "LEAD_CONTACTED", leadId: "L6" }),
    event({ type: "LEAD_CONTACTED", leadId: "L7" }),
    event({ type: "LEAD_CONTACTED", leadId: "L8" }),
    event({ type: "LEAD_RESPONDED", leadId: "L8" }),
  ];

  it("returns the five stages in order", () => {
    const funnel = buildFunnel(leads, events);
    expect(funnel.map((s) => s.key)).toEqual(FUNNEL_STAGE_KEYS);
  });

  it("counts each stage from the union of events and current status", () => {
    const counts = Object.fromEntries(buildFunnel(leads, events).map((s) => [s.key, s.count]));
    expect(counts).toEqual({
      found: 8,
      opportunity: 7, // L1 has a site
      contacted: 6, // L3,L4,L5 (status) + L6,L7,L8 (event, union)
      responded: 3, // L4,L5 (status) + L8 (event)
      won: 1, // L5 (status only), L8 removed, no LEAD_WON event
    });
  });

  it("dedupes a lead present in both the event and the current status", () => {
    // L7 has a LEAD_CONTACTED event AND is currently CONTACTED -> counts once.
    const contacted = buildFunnel(leads, events)[2].count;
    expect(contacted).toBe(6);
  });

  it("still counts a WON lead with no events in contacted/responded/won", () => {
    const wonOnly = buildFunnel([lead({ id: "X", websiteStatus: "NONE", outreachStatus: "WON" })], []);
    const [found, opportunity, contacted, responded, won] = wonOnly.map((s) => s.count);
    expect(found).toBe(1);
    expect(opportunity).toBe(1);
    expect(contacted).toBe(1);
    expect(responded).toBe(1);
    expect(won).toBe(1);
  });

  it("computes ofPreviousPct for each stage", () => {
    const funnel = buildFunnel(leads, events);
    // found has no pct; the rest are round(count / previous * 100).
    expect(funnel[0].ofPreviousPct).toBeNull();
    expect(funnel[1].ofPreviousPct).toBe(88); // 7/8
    expect(funnel[2].ofPreviousPct).toBe(86); // 6/7
    expect(funnel[3].ofPreviousPct).toBe(50); // 3/6
    expect(funnel[4].ofPreviousPct).toBe(33); // 1/3
  });

  it("returns 0 pct (not NaN) when the previous stage is 0", () => {
    const funnel = buildFunnel([lead({ id: "Y", websiteStatus: "HAS_SITE", outreachStatus: "NEW" })], []);
    const [found, opportunity, contacted, responded, won] = funnel;
    expect(found.ofPreviousPct).toBeNull();
    expect(opportunity.ofPreviousPct).toBe(0); // 0/1
    expect(contacted.ofPreviousPct).toBe(0); // 0/0
    expect(responded.ofPreviousPct).toBe(0); // 0/0
    expect(won.ofPreviousPct).toBe(0); // 0/0
    for (const s of funnel.slice(1)) expect(Number.isFinite(s.ofPreviousPct)).toBe(true);
  });

  it("is monotonic — each stage count is <= the previous", () => {
    const funnel = buildFunnel(leads, events);
    for (let i = 1; i < funnel.length; i++) {
      expect(funnel[i].count).toBeLessThanOrEqual(funnel[i - 1].count);
    }
  });

  it("stays monotonic when a lead has a site and an advanced status (regression)", () => {
    // A HAS_SITE/WON lead used to be excluded from `opportunity` while still
    // counted in the lower stages, inflating them above the stage above.
    const funnel = buildFunnel(
      [
        lead({ id: "W1", websiteStatus: "HAS_SITE", outreachStatus: "WON" }),
        lead({ id: "W2", websiteStatus: "HAS_SITE", outreachStatus: "WON" }),
        lead({ id: "N1", websiteStatus: "NONE", outreachStatus: "NEW" }),
      ],
      [],
    );
    const counts = Object.fromEntries(funnel.map((s) => [s.key, s.count]));
    expect(counts).toEqual({
      found: 3,
      opportunity: 3, // fresh NONE + the two engaged HAS_SITE/WON leads
      contacted: 2,
      responded: 2,
      won: 2,
    });
    for (let i = 1; i < funnel.length; i++) {
      expect(funnel[i].count).toBeLessThanOrEqual(funnel[i - 1].count);
    }
  });
});

describe("funnelEventsByDay", () => {
  const now = new Date("2026-08-29T10:00:00.000Z");

  it("buckets events per day with the four funnel types separated, oldest first", () => {
    const events: FunnelEvent[] = [
      event({ type: "LEAD_CONTACTED", leadId: "L6", createdAt: "2026-08-25T12:00:00.000Z" }),
      event({ type: "LEAD_RESPONDED", leadId: "L8", createdAt: "2026-08-25T14:00:00.000Z" }),
      event({ type: "LEAD_WON", leadId: "L5", createdAt: "2026-08-27T09:00:00.000Z" }),
      event({ type: "CONTACT_SUBMITTED", siteId: "S1", leadId: null, createdAt: "2026-08-27T11:00:00.000Z" }),
      event({ type: "LEAD_CONTACTED", leadId: "L7", createdAt: "2026-08-28T23:00:00.000Z" }),
    ];
    const rows = funnelEventsByDay(events, 7, now);

    expect(rows).toHaveLength(7);
    expect(rows).toEqual([
      { date: "Aug 23", contacted: 0, responded: 0, won: 0, contactForm: 0 },
      { date: "Aug 24", contacted: 0, responded: 0, won: 0, contactForm: 0 },
      { date: "Aug 25", contacted: 1, responded: 1, won: 0, contactForm: 0 },
      { date: "Aug 26", contacted: 0, responded: 0, won: 0, contactForm: 0 },
      { date: "Aug 27", contacted: 0, responded: 0, won: 1, contactForm: 1 },
      { date: "Aug 28", contacted: 1, responded: 0, won: 0, contactForm: 0 },
      { date: "Aug 29", contacted: 0, responded: 0, won: 0, contactForm: 0 },
    ]);
  });

  it("includes days with no events as zeros", () => {
    const rows = funnelEventsByDay(
      [event({ type: "LEAD_CONTACTED", leadId: "L6", createdAt: "2026-08-25T12:00:00.000Z" })],
      7,
      now,
    );
    // The empty middle days are present, not skipped.
    expect(rows[1].contacted).toBe(0);
    expect(rows[3].contacted).toBe(0);
    expect(rows[3].responded).toBe(0);
    expect(rows[3].won).toBe(0);
    expect(rows[3].contactForm).toBe(0);
  });

  it("excludes events outside the window and non-funnel event types", () => {
    const events: FunnelEvent[] = [
      event({ type: "LEAD_CONTACTED", leadId: "L6", createdAt: "2026-08-20T12:00:00.000Z" }), // before window
      event({ type: "LEAD_CONTACTED", leadId: "L7", createdAt: "2026-08-30T12:00:00.000Z" }), // after window
      event({ type: "SITE_VIEW", leadId: null, siteId: "S1", createdAt: "2026-08-26T12:00:00.000Z" }), // not a funnel type
    ];
    const rows = funnelEventsByDay(events, 7, now);
    const total = rows.reduce((acc, r) => acc + r.contacted + r.responded + r.won + r.contactForm, 0);
    expect(total).toBe(0);
  });
});
