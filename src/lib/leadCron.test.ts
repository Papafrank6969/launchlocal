import { describe, it, expect } from "vitest";
import {
  qualifies,
  selectNewLeads,
  summarizeRun,
  DAILY_LEAD_GOAL,
  MAX_SEARCHES_PER_RUN,
  type CandidateBusiness,
} from "./leadCron";

function biz(overrides: Partial<CandidateBusiness> = {}): CandidateBusiness {
  return {
    placeId: "place-1",
    name: "Test Business",
    address: "1 Main St",
    phone: "(555) 000-1111",
    websiteStatus: "NONE",
    ...overrides,
  };
}

describe("qualifies", () => {
  it("returns false for HAS_SITE regardless of phone", () => {
    expect(qualifies(biz({ websiteStatus: "HAS_SITE", phone: "(555) 000-1111" }))).toBe(false);
  });

  it("returns true for NONE with a phone", () => {
    expect(qualifies(biz({ websiteStatus: "NONE", phone: "(555) 000-1111" }))).toBe(true);
  });

  it("returns true for POOR with a phone", () => {
    expect(qualifies(biz({ websiteStatus: "POOR", phone: "(555) 000-1111" }))).toBe(true);
  });

  it("returns false when phone is missing", () => {
    expect(qualifies(biz({ phone: undefined }))).toBe(false);
  });

  it("returns false when phone is an empty string", () => {
    expect(qualifies(biz({ phone: "" }))).toBe(false);
  });
});

describe("selectNewLeads", () => {
  it("includes candidates that qualify and are not known", () => {
    const fresh = selectNewLeads([biz({ placeId: "p1" }), biz({ placeId: "p2" })], new Set(["old"]));
    expect(fresh.map((b) => b.placeId)).toEqual(["p1", "p2"]);
  });

  it("excludes candidates with a known placeId", () => {
    const fresh = selectNewLeads([biz({ placeId: "p1" }), biz({ placeId: "p2" })], new Set(["p2"]));
    expect(fresh.map((b) => b.placeId)).toEqual(["p1"]);
  });

  it("excludes null placeId candidates", () => {
    const fresh = selectNewLeads([biz({ placeId: null }), biz({ placeId: "p2" })], new Set());
    expect(fresh.map((b) => b.placeId)).toEqual(["p2"]);
  });

  it("dedupes within the batch by placeId", () => {
    const fresh = selectNewLeads([biz({ placeId: "p1" }), biz({ placeId: "p1" }), biz({ placeId: "p2" })], new Set());
    expect(fresh.map((b) => b.placeId)).toEqual(["p1", "p2"]);
  });

  it("excludes candidates that do not qualify", () => {
    const fresh = selectNewLeads(
      [
        biz({ placeId: "p1", websiteStatus: "HAS_SITE" }),
        biz({ placeId: "p2", phone: undefined }),
        biz({ placeId: "p3", websiteStatus: "POOR" }),
      ],
      new Set()
    );
    expect(fresh.map((b) => b.placeId)).toEqual(["p3"]);
  });
});

describe("summarizeRun", () => {
  it("reports the goal met with areas", () => {
    const s = summarizeRun({ added: 25, searches: 4, goal: DAILY_LEAD_GOAL, areasHit: ["Manhattan, NY barber", "Manhattan, NY salon"] });
    expect(s).toContain("added 25/25 in 4 searches");
    expect(s).toContain("Manhattan, NY barber");
    expect(s).toContain("Manhattan, NY salon");
  });

  it("flags the search cap hit when under goal after MAX_SEARCHES_PER_RUN", () => {
    const s = summarizeRun({ added: 18, searches: MAX_SEARCHES_PER_RUN, goal: DAILY_LEAD_GOAL, areasHit: ["Harlem, NY barber"] });
    expect(s).toContain("added 18/25 (search cap hit)");
    expect(s).toContain("Harlem, NY barber");
  });

  it("handles no areas hit", () => {
    const s = summarizeRun({ added: 0, searches: MAX_SEARCHES_PER_RUN, goal: DAILY_LEAD_GOAL, areasHit: [] });
    expect(s).toContain("none");
  });
});
