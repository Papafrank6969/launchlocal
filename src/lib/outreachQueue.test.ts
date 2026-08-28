import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isEligibleForQueue,
  compareQueueLeads,
  buildOutreachQueue,
  resolveQueueKey,
  actionAdvances,
  outreachPatchForAction,
  pacingLevel,
  QUEUE_KEYS,
  SEND_FOLLOW_UP_DAYS,
  PACING_CAUTION,
  PACING_LIMIT,
  type QueueLead,
} from "./outreachQueue";

function lead(overrides: Partial<QueueLead> = {}): QueueLead {
  return {
    id: "l1",
    name: "Bella Lash Studio",
    category: "lash technician",
    city: "Austin, TX",
    websiteStatus: "NONE",
    instagramHandle: "@bellalash",
    rating: 4.8,
    createdAt: "2026-08-01T00:00:00Z",
    sites: [],
    ...overrides,
  };
}

describe("isEligibleForQueue", () => {
  it("accepts an untouched lead with a handle and no real site", () => {
    expect(isEligibleForQueue(lead())).toBe(true);
  });

  it("rejects a lead that already has a real website", () => {
    expect(isEligibleForQueue(lead({ websiteStatus: "HAS_SITE" }))).toBe(false);
  });

  it("rejects a lead with no Instagram handle", () => {
    expect(isEligibleForQueue(lead({ instagramHandle: null }))).toBe(false);
  });

  it("rejects a lead whose handle is blank whitespace", () => {
    expect(isEligibleForQueue(lead({ instagramHandle: "   " }))).toBe(false);
  });

  it("keeps a POOR-website lead — a weak site is still an opportunity", () => {
    expect(isEligibleForQueue(lead({ websiteStatus: "POOR" }))).toBe(true);
  });
});

describe("compareQueueLeads", () => {
  it("puts a lead with a drafted site ahead of one without", () => {
    const withSite = lead({ id: "a", sites: [{ id: "s", slug: "a", status: "DRAFT" }] });
    const without = lead({ id: "b", sites: [] });
    expect(compareQueueLeads(withSite, without)).toBeLessThan(0);
    expect(compareQueueLeads(without, withSite)).toBeGreaterThan(0);
  });

  it("orders by rating when site status is equal", () => {
    const hi = lead({ id: "a", rating: 4.9 });
    const lo = lead({ id: "b", rating: 4.1 });
    expect(compareQueueLeads(hi, lo)).toBeLessThan(0);
  });

  it("treats a missing rating as worst", () => {
    const rated = lead({ id: "a", rating: 3.2 });
    const unrated = lead({ id: "b", rating: null });
    expect(compareQueueLeads(rated, unrated)).toBeLessThan(0);
  });

  it("breaks a full tie by oldest lead first", () => {
    const older = lead({ id: "a", createdAt: "2026-07-01T00:00:00Z" });
    const newer = lead({ id: "b", createdAt: "2026-08-01T00:00:00Z" });
    expect(compareQueueLeads(older, newer)).toBeLessThan(0);
  });
});

describe("buildOutreachQueue", () => {
  it("drops ineligible leads and orders the rest", () => {
    const queue = buildOutreachQueue([
      lead({ id: "has-site", websiteStatus: "HAS_SITE" }),
      lead({ id: "no-handle", instagramHandle: "" }),
      lead({ id: "plain", rating: 4.0 }),
      lead({ id: "drafted", rating: 3.0, sites: [{ id: "s", slug: "d", status: "DRAFT" }] }),
      lead({ id: "top-rated", rating: 5.0 }),
    ]);
    expect(queue.map((l) => l.id)).toEqual(["drafted", "top-rated", "plain"]);
  });

  it("returns an empty queue when nothing is eligible", () => {
    expect(buildOutreachQueue([lead({ instagramHandle: null })])).toEqual([]);
  });
});

describe("resolveQueueKey", () => {
  it("maps every legend key to its action", () => {
    for (const { key, action } of QUEUE_KEYS) {
      expect(resolveQueueKey(key)).toBe(action);
    }
  });

  it("returns null for an unbound key", () => {
    expect(resolveQueueKey("x")).toBeNull();
  });
});

describe("actionAdvances", () => {
  it("advances on send, skip and reject", () => {
    expect(actionAdvances("send")).toBe(true);
    expect(actionAdvances("skip")).toBe(true);
    expect(actionAdvances("reject")).toBe(true);
  });

  it("stays put on open", () => {
    expect(actionAdvances("open")).toBe(false);
  });
});

describe("outreachPatchForAction", () => {
  afterEach(() => vi.useRealTimers());

  it("marks send as CONTACTED with a follow-up SEND_FOLLOW_UP_DAYS out", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    const patch = outreachPatchForAction("send", now);
    expect(patch?.outreachStatus).toBe("CONTACTED");
    const expected = new Date(now);
    expected.setDate(expected.getDate() + SEND_FOLLOW_UP_DAYS);
    expect(patch?.followUpAt).toBe(expected.toISOString());
  });

  it("marks reject as LOST with no follow-up", () => {
    expect(outreachPatchForAction("reject")).toEqual({ outreachStatus: "LOST" });
  });

  it("returns null for open and skip — the lead is untouched", () => {
    expect(outreachPatchForAction("open")).toBeNull();
    expect(outreachPatchForAction("skip")).toBeNull();
  });

  it("defaults to the current time when no clock is passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T00:00:00Z"));
    const patch = outreachPatchForAction("send");
    expect(patch?.followUpAt).toBe("2026-08-31T00:00:00.000Z");
  });
});

describe("pacingLevel", () => {
  it("is ok below the caution threshold", () => {
    expect(pacingLevel(0)).toBe("ok");
    expect(pacingLevel(PACING_CAUTION - 1)).toBe("ok");
  });

  it("warns from the caution threshold up to the limit", () => {
    expect(pacingLevel(PACING_CAUTION)).toBe("caution");
    expect(pacingLevel(PACING_LIMIT - 1)).toBe("caution");
  });

  it("flags the limit once reached", () => {
    expect(pacingLevel(PACING_LIMIT)).toBe("limit");
    expect(pacingLevel(PACING_LIMIT + 10)).toBe("limit");
  });
});
