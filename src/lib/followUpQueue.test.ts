import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isEligibleForFollowUp,
  compareFollowUpLeads,
  buildFollowUpQueue,
  resolveFollowUpKey,
  followUpActionAdvances,
  followUpPatchForAction,
  FOLLOW_UP_KEYS,
  MAX_FOLLOW_UPS,
  FOLLOW_UP_AGAIN_DAYS,
  type FollowUpQueueLead,
} from "./followUpQueue";

const NOW = new Date("2026-08-29T12:00:00Z");

function lead(overrides: Partial<FollowUpQueueLead> = {}): FollowUpQueueLead {
  return {
    id: "l1",
    name: "Bella Lash Studio",
    category: "lash technician",
    city: "Austin, TX",
    instagramHandle: "@bellalash",
    outreachStatus: "CONTACTED",
    followUpAt: "2026-08-28T00:00:00Z", // overdue relative to NOW
    followUpCount: 0,
    sites: [],
    ...overrides,
  };
}

describe("isEligibleForFollowUp", () => {
  it("accepts a contacted lead whose follow-up date has passed", () => {
    expect(isEligibleForFollowUp(lead(), NOW)).toBe(true);
  });

  it("rejects anything but CONTACTED", () => {
    for (const outreachStatus of ["NEW", "RESPONDED", "WON", "LOST"] as const) {
      expect(isEligibleForFollowUp(lead({ outreachStatus }), NOW)).toBe(false);
    }
  });

  it("rejects a lead with no Instagram handle", () => {
    expect(isEligibleForFollowUp(lead({ instagramHandle: null }), NOW)).toBe(false);
  });

  it("rejects a lead whose handle is blank whitespace", () => {
    expect(isEligibleForFollowUp(lead({ instagramHandle: "   " }), NOW)).toBe(false);
  });

  it("rejects a lead with no follow-up date set", () => {
    expect(isEligibleForFollowUp(lead({ followUpAt: null }), NOW)).toBe(false);
  });

  it("rejects a lead whose follow-up date is still in the future", () => {
    expect(isEligibleForFollowUp(lead({ followUpAt: "2026-09-01T00:00:00Z" }), NOW)).toBe(false);
  });

  it("rejects a lead that's already been bumped past the cap", () => {
    expect(isEligibleForFollowUp(lead({ followUpCount: MAX_FOLLOW_UPS }), NOW)).toBe(false);
    expect(isEligibleForFollowUp(lead({ followUpCount: MAX_FOLLOW_UPS - 1 }), NOW)).toBe(true);
  });
});

describe("compareFollowUpLeads", () => {
  it("puts the most overdue lead first", () => {
    const older = lead({ id: "a", followUpAt: "2026-08-01T00:00:00Z" });
    const newer = lead({ id: "b", followUpAt: "2026-08-20T00:00:00Z" });
    expect(compareFollowUpLeads(older, newer)).toBeLessThan(0);
    expect(compareFollowUpLeads(newer, older)).toBeGreaterThan(0);
  });
});

describe("buildFollowUpQueue", () => {
  it("drops ineligible leads and orders the rest by most overdue", () => {
    const queue = buildFollowUpQueue(
      [
        lead({ id: "new", outreachStatus: "NEW" }),
        lead({ id: "not-due", followUpAt: "2026-09-01T00:00:00Z" }),
        lead({ id: "oldest", followUpAt: "2026-08-10T00:00:00Z" }),
        lead({ id: "newest-overdue", followUpAt: "2026-08-27T00:00:00Z" }),
      ],
      NOW,
    );
    expect(queue.map((l) => l.id)).toEqual(["oldest", "newest-overdue"]);
  });

  it("returns an empty queue when nothing is eligible", () => {
    expect(buildFollowUpQueue([lead({ instagramHandle: null })], NOW)).toEqual([]);
  });
});

describe("resolveFollowUpKey", () => {
  it("maps every legend key to its action", () => {
    for (const { key, action } of FOLLOW_UP_KEYS) {
      expect(resolveFollowUpKey(key)).toBe(action);
    }
  });

  it("returns null for an unbound key", () => {
    expect(resolveFollowUpKey("x")).toBeNull();
  });
});

describe("followUpActionAdvances", () => {
  it("advances on bump, skip, replied and giveUp", () => {
    expect(followUpActionAdvances("bump")).toBe(true);
    expect(followUpActionAdvances("skip")).toBe(true);
    expect(followUpActionAdvances("replied")).toBe(true);
    expect(followUpActionAdvances("giveUp")).toBe(true);
  });

  it("stays put on open", () => {
    expect(followUpActionAdvances("open")).toBe(false);
  });
});

describe("followUpPatchForAction", () => {
  afterEach(() => vi.useRealTimers());

  it("bumps the follow-up date FOLLOW_UP_AGAIN_DAYS out and counts the touch", () => {
    const patch = followUpPatchForAction("bump", { followUpCount: 0 }, NOW);
    const expected = new Date(NOW);
    expected.setDate(expected.getDate() + FOLLOW_UP_AGAIN_DAYS);
    expect(patch).toEqual({ followUpAt: expected.toISOString(), followUpCount: 1 });
  });

  it("carries the existing follow-up count forward on a second bump", () => {
    const patch = followUpPatchForAction("bump", { followUpCount: 1 }, NOW);
    expect(patch?.followUpCount).toBe(2);
  });

  it("marks replied as RESPONDED and clears the follow-up date", () => {
    expect(followUpPatchForAction("replied", { followUpCount: 0 })).toEqual({
      outreachStatus: "RESPONDED",
      followUpAt: null,
    });
  });

  it("marks giveUp as LOST and clears the follow-up date", () => {
    expect(followUpPatchForAction("giveUp", { followUpCount: 0 })).toEqual({
      outreachStatus: "LOST",
      followUpAt: null,
    });
  });

  it("returns null for open and skip — the lead is untouched", () => {
    expect(followUpPatchForAction("open", { followUpCount: 0 })).toBeNull();
    expect(followUpPatchForAction("skip", { followUpCount: 0 })).toBeNull();
  });

  it("defaults to the current time when no clock is passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T00:00:00Z"));
    const patch = followUpPatchForAction("bump", { followUpCount: 0 });
    expect(patch?.followUpAt).toBe("2026-09-01T00:00:00.000Z");
  });
});
