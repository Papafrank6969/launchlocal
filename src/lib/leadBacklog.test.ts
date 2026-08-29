import { describe, it, expect } from "vitest";
import {
  filterLeads,
  opportunityScore,
  sortLeads,
  leadFacets,
  activeFilterCount,
  parseStoredFilters,
  DEFAULT_LEAD_FILTERS,
  LEAD_SORT_OPTIONS,
  type BacklogLead,
} from "./leadBacklog";

function lead(overrides: Partial<BacklogLead> = {}): BacklogLead {
  return {
    id: "l1",
    name: "Bella Lash Studio",
    category: "lash technician",
    city: "Austin, TX",
    websiteStatus: "NONE",
    outreachStatus: "NEW",
    instagramHandle: null,
    rating: 4.5,
    reviewCount: 12,
    createdAt: "2026-08-01T00:00:00Z",
    sites: [],
    ...overrides,
  };
}

describe("filterLeads", () => {
  it("defaults keep NEW leads with no real website and drop the rest", () => {
    const leads = [
      lead({ id: "keep", websiteStatus: "NONE", outreachStatus: "NEW" }),
      lead({ id: "won", outreachStatus: "WON" }),
      lead({ id: "site", websiteStatus: "HAS_SITE" }),
      lead({ id: "poor", websiteStatus: "POOR", outreachStatus: "NEW" }),
    ];
    const out = filterLeads(leads, DEFAULT_LEAD_FILTERS);
    expect(out.map((l) => l.id)).toEqual(["keep", "poor"]);
  });

  it("workState unworked selects only NEW", () => {
    const leads = [
      lead({ id: "a", outreachStatus: "NEW" }),
      lead({ id: "b", outreachStatus: "CONTACTED" }),
      lead({ id: "c", outreachStatus: "RESPONDED" }),
      lead({ id: "d", outreachStatus: "WON" }),
      lead({ id: "e", outreachStatus: "LOST" }),
    ];
    const out = filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, workState: "unworked" });
    expect(out.map((l) => l.id)).toEqual(["a"]);
  });

  it("workState in-progress selects CONTACTED and RESPONDED", () => {
    const leads = [
      lead({ id: "a", outreachStatus: "NEW" }),
      lead({ id: "b", outreachStatus: "CONTACTED" }),
      lead({ id: "c", outreachStatus: "RESPONDED" }),
      lead({ id: "d", outreachStatus: "WON" }),
      lead({ id: "e", outreachStatus: "LOST" }),
    ];
    const out = filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, workState: "in-progress" });
    expect(out.map((l) => l.id)).toEqual(["b", "c"]);
  });

  it("workState won selects only WON", () => {
    const out = filterLeads(
      [lead({ id: "d", outreachStatus: "WON" }), lead({ id: "a", outreachStatus: "NEW" })],
      { ...DEFAULT_LEAD_FILTERS, workState: "won" },
    );
    expect(out.map((l) => l.id)).toEqual(["d"]);
  });

  it("workState lost selects only LOST", () => {
    const out = filterLeads(
      [lead({ id: "e", outreachStatus: "LOST" }), lead({ id: "a", outreachStatus: "NEW" })],
      { ...DEFAULT_LEAD_FILTERS, workState: "lost" },
    );
    expect(out.map((l) => l.id)).toEqual(["e"]);
  });

  it("workState all applies no constraint", () => {
    const leads = [
      lead({ id: "a", outreachStatus: "NEW" }),
      lead({ id: "d", outreachStatus: "WON" }),
    ];
    const out = filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, workState: "all" });
    expect(out.map((l) => l.id)).toEqual(["a", "d"]);
  });

  it("website opportunities excludes HAS_SITE and keeps NONE and POOR", () => {
    const leads = [
      lead({ id: "none", websiteStatus: "NONE" }),
      lead({ id: "poor", websiteStatus: "POOR" }),
      lead({ id: "site", websiteStatus: "HAS_SITE" }),
    ];
    const out = filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, website: "opportunities" });
    expect(out.map((l) => l.id)).toEqual(["none", "poor"]);
  });

  it("website none/poor/has-site match exactly", () => {
    const leads = [
      lead({ id: "none", websiteStatus: "NONE" }),
      lead({ id: "poor", websiteStatus: "POOR" }),
      lead({ id: "site", websiteStatus: "HAS_SITE" }),
    ];
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, website: "none" }).map((l) => l.id)).toEqual(["none"]);
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, website: "poor" }).map((l) => l.id)).toEqual(["poor"]);
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, website: "has-site" }).map((l) => l.id)).toEqual(["site"]);
  });

  it("city matches case-insensitively and exactly", () => {
    const leads = [
      lead({ id: "a", city: "Austin, TX" }),
      lead({ id: "b", city: "austin, tx" }),
      lead({ id: "c", city: "Austin" }),
    ];
    const out = filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, city: "AUSTIN, TX" });
    expect(out.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("trade matches case-insensitively, exactly, not as substring", () => {
    const leads = [
      lead({ id: "barber", category: "barber" }),
      lead({ id: "barbershop", category: "barbershop" }),
      lead({ id: "Lash Technician", category: "Lash Technician" }),
    ];
    const out = filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, trade: "barber" });
    expect(out.map((l) => l.id)).toEqual(["barber"]);
    const out2 = filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, trade: "lash technician" });
    expect(out2.map((l) => l.id)).toEqual(["Lash Technician"]);
  });

  it("hasHandle tri-state treats whitespace handle as no handle", () => {
    const leads = [
      lead({ id: "has", instagramHandle: "@bella" }),
      lead({ id: "none", instagramHandle: null }),
      lead({ id: "ws", instagramHandle: "   " }),
    ];
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, hasHandle: "yes" }).map((l) => l.id)).toEqual(["has"]);
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, hasHandle: "no" }).map((l) => l.id)).toEqual(["none", "ws"]);
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, hasHandle: "all" })).toHaveLength(3);
  });

  it("hasDraft tri-state", () => {
    const drafted = lead({ id: "a", sites: [{ id: "s1", slug: "bella", status: "DRAFT" }] });
    const none = lead({ id: "b" });
    const noneArr = [drafted, none];
    expect(filterLeads(noneArr, { ...DEFAULT_LEAD_FILTERS, hasDraft: "yes" }).map((l) => l.id)).toEqual(["a"]);
    expect(filterLeads(noneArr, { ...DEFAULT_LEAD_FILTERS, hasDraft: "no" }).map((l) => l.id)).toEqual(["b"]);
  });

  it("nameQuery matches substring case-insensitively; whitespace means no constraint", () => {
    const leads = [
      lead({ id: "a", name: "Bella Lash Studio" }),
      lead({ id: "b", name: "Nail Bella" }),
      lead({ id: "c", name: "Something Else" }),
    ];
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, nameQuery: "bella" }).map((l) => l.id)).toEqual(["a", "b"]);
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, nameQuery: "BELLA" }).map((l) => l.id)).toEqual(["a", "b"]);
    expect(filterLeads(leads, { ...DEFAULT_LEAD_FILTERS, nameQuery: "   " })).toHaveLength(3);
  });

  it("combines independent filters with AND", () => {
    const leads = [
      lead({ id: "a", city: "Austin, TX", outreachStatus: "NEW", websiteStatus: "NONE", instagramHandle: "@a" }),
      lead({ id: "b", city: "Austin, TX", outreachStatus: "NEW", websiteStatus: "NONE" }),
      lead({ id: "c", city: "Dallas, TX", outreachStatus: "NEW", websiteStatus: "NONE" }),
    ];
    const out = filterLeads(leads, {
      ...DEFAULT_LEAD_FILTERS,
      city: "austin, tx",
      hasHandle: "yes",
    });
    expect(out.map((l) => l.id)).toEqual(["a"]);
  });

  it("preserves input order", () => {
    const leads = [
      lead({ id: "z", websiteStatus: "NONE" }),
      lead({ id: "a", websiteStatus: "NONE" }),
      lead({ id: "m", websiteStatus: "NONE" }),
    ];
    const out = filterLeads(leads, DEFAULT_LEAD_FILTERS);
    expect(out.map((l) => l.id)).toEqual(["z", "a", "m"]);
  });
});

describe("opportunityScore", () => {
  it("returns exactly 0 for a HAS_SITE lead regardless of other fields", () => {
    const l = lead({
      websiteStatus: "HAS_SITE",
      rating: 4.9,
      reviewCount: 999,
      instagramHandle: "@x",
      sites: [{ id: "s", slug: "x", status: "DRAFT" }],
    });
    expect(opportunityScore(l)).toBe(0);
  });

  it("scores NONE higher than POOR at otherwise-equal inputs", () => {
    const base = { rating: 4.0, reviewCount: 10, instagramHandle: null, sites: [] };
    const none = opportunityScore(lead({ ...base, websiteStatus: "NONE" }));
    const poor = opportunityScore(lead({ ...base, websiteStatus: "POOR" }));
    expect(none).toBeGreaterThan(poor);
  });

  it("is monotonic non-decreasing in reviewCount", () => {
    const base = { websiteStatus: "NONE" as const, rating: 4.0, instagramHandle: null, sites: [] };
    const points = [0, 9, 99, 999, 100000].map((n) => opportunityScore(lead({ ...base, reviewCount: n })));
    for (let i = 1; i < points.length; i++) expect(points[i]).toBeGreaterThanOrEqual(points[i - 1]);
  });

  it("handles null rating and reviewCount without throwing and stays in range", () => {
    const score = opportunityScore(lead({ rating: null, reviewCount: null }));
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("adding a draft site raises the score by 8 below the clamp", () => {
    const base = lead({ websiteStatus: "NONE", rating: null, reviewCount: 0, instagramHandle: null, sites: [] });
    expect(opportunityScore(lead({ ...base, sites: [{ id: "s", slug: "x", status: "DRAFT" }] }))).toBe(
      opportunityScore(base) + 8,
    );
  });

  it("adding a handle raises the score by 6 below the clamp", () => {
    const base = lead({ websiteStatus: "NONE", rating: null, reviewCount: 0, sites: [] });
    expect(opportunityScore(lead({ ...base, instagramHandle: "@x" }))).toBe(opportunityScore(base) + 6);
  });

  it("clamps a deliberately maxed-out lead at 100", () => {
    const score = opportunityScore(
      lead({
        websiteStatus: "NONE",
        rating: 4.0,
        reviewCount: 1000000,
        instagramHandle: "@x",
        sites: [{ id: "s", slug: "x", status: "DRAFT" }],
      }),
    );
    expect(score).toBe(100);
  });

  it("pins three concrete fixture scores to the formula", () => {
    // base 55 (NONE) + reviews(12): round(min(25, 8*log10(13))) = round(8*1.1139)=round(8.91)=9
    // + rating 4.5 -> 10, no handle, no site => 55+9+10 = 74
    expect(opportunityScore(lead({ websiteStatus: "NONE", rating: 4.5, reviewCount: 12, instagramHandle: null, sites: [] }))).toBe(74);

    // base 40 (POOR) + reviews(0): 0 + rating 4.1 -> 10 + handle -> 6 + site -> 8 => 40+0+10+6+8 = 64
    expect(
      opportunityScore(
        lead({
          websiteStatus: "POOR",
          rating: 4.1,
          reviewCount: 0,
          instagramHandle: "@x",
          sites: [{ id: "s", slug: "x", status: "DRAFT" }],
        }),
      ),
    ).toBe(64);

    // base 55 (NONE) + reviews(9): round(8*log10(10))=8 + rating 4.9 -> 3 => 55+8+3 = 66
    expect(opportunityScore(lead({ websiteStatus: "NONE", rating: 4.9, reviewCount: 9, instagramHandle: null, sites: [] }))).toBe(66);
  });
});

describe("sortLeads", () => {
  it("newest orders by createdAt descending", () => {
    const leads = [
      lead({ id: "a", createdAt: "2026-08-01T00:00:00Z" }),
      lead({ id: "b", createdAt: "2026-08-03T00:00:00Z" }),
      lead({ id: "c", createdAt: "2026-08-02T00:00:00Z" }),
    ];
    expect(sortLeads(leads, "newest").map((l) => l.id)).toEqual(["b", "c", "a"]);
  });

  it("opportunity orders by score descending", () => {
    const low = lead({ id: "low", websiteStatus: "NONE", rating: null, reviewCount: 0 });
    const high = lead({
      id: "high",
      websiteStatus: "NONE",
      rating: 4.0,
      reviewCount: 999,
      instagramHandle: "@x",
      sites: [{ id: "s", slug: "x", status: "DRAFT" }],
    });
    expect(sortLeads([low, high], "opportunity").map((l) => l.id)).toEqual(["high", "low"]);
  });

  it("rating orders descending with nulls last", () => {
    const a = lead({ id: "a", rating: 3.0 });
    const b = lead({ id: "b", rating: 4.7 });
    const c = lead({ id: "c", rating: null });
    const d = lead({ id: "d", rating: 4.0 });
    expect(sortLeads([c, a, d, b], "rating").map((l) => l.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("name orders A-Z case-insensitively", () => {
    const leads = [lead({ id: "b", name: "zebra" }), lead({ id: "a", name: "Alpha" }), lead({ id: "c", name: "beta" })];
    expect(sortLeads(leads, "name").map((l) => l.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the input array", () => {
    const leads = [
      lead({ id: "a", createdAt: "2026-08-01T00:00:00Z" }),
      lead({ id: "b", createdAt: "2026-08-03T00:00:00Z" }),
    ];
    const before = leads.map((l) => l.id);
    sortLeads(leads, "newest");
    expect(leads.map((l) => l.id)).toEqual(before);
  });

  it("is stable on ties (equal scores keep input order)", () => {
    const a = lead({ id: "a", websiteStatus: "NONE", rating: null, reviewCount: 0 });
    const b = lead({ id: "b", websiteStatus: "NONE", rating: null, reviewCount: 0 });
    expect(sortLeads([a, b], "opportunity").map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("leadFacets", () => {
  it("dedupes case-insensitively, sorts, and title-cases trades", () => {
    const leads = [
      lead({ id: "a", city: "Austin, TX", category: "lash technician" }),
      lead({ id: "b", city: "austin, tx", category: "Lash Technician" }),
      lead({ id: "c", city: "Dallas, TX", category: "nail technician" }),
      lead({ id: "d", city: "dallas, tx", category: "barber" }),
    ];
    const { cities, trades } = leadFacets(leads);
    expect(cities).toEqual(["Austin, TX", "Dallas, TX"]);
    expect(trades).toEqual(["Barber", "Lash Technician", "Nail Technician"]);
  });
});

describe("activeFilterCount", () => {
  it("returns 0 for defaults", () => {
    expect(activeFilterCount(DEFAULT_LEAD_FILTERS)).toBe(0);
  });

  it("increments per changed dimension", () => {
    expect(activeFilterCount({ ...DEFAULT_LEAD_FILTERS, workState: "won" })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_LEAD_FILTERS, city: "Austin, TX", hasHandle: "yes" })).toBe(2);
  });

  it("treats whitespace nameQuery as 0", () => {
    expect(activeFilterCount({ ...DEFAULT_LEAD_FILTERS, nameQuery: "   " })).toBe(0);
  });

  it("counts a real nameQuery", () => {
    expect(activeFilterCount({ ...DEFAULT_LEAD_FILTERS, nameQuery: "bella" })).toBe(1);
  });
});

describe("LEAD_SORT_OPTIONS", () => {
  it("lists all four sort keys with labels", () => {
    expect(LEAD_SORT_OPTIONS.map((o) => o.key)).toEqual(["newest", "opportunity", "rating", "name"]);
  });
});

describe("parseStoredFilters", () => {
  it("returns defaults for null input", () => {
    expect(parseStoredFilters(null)).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
  });

  it("round-trips a valid blob", () => {
    const raw = JSON.stringify({
      filters: {
        workState: "in-progress",
        website: "none",
        city: "Austin, TX",
        trade: "barber",
        hasHandle: "yes",
        hasDraft: "no",
        nameQuery: "Bella",
      },
      sortKey: "opportunity",
    });
    expect(parseStoredFilters(raw)).toEqual({
      filters: {
        workState: "in-progress",
        website: "none",
        city: "Austin, TX",
        trade: "barber",
        hasHandle: "yes",
        hasDraft: "no",
        nameQuery: "Bella",
      },
      sortKey: "opportunity",
    });
  });

  it("falls back to defaults when a filters key is missing", () => {
    const raw = JSON.stringify({ filters: { workState: "won" }, sortKey: "rating" });
    expect(parseStoredFilters(raw)).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
  });

  it("falls back to defaults when an extra key is present", () => {
    const raw = JSON.stringify({
      filters: { ...DEFAULT_LEAD_FILTERS, bogus: "x" },
      sortKey: "newest",
      extra: true,
    });
    expect(parseStoredFilters(raw)).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
  });

  it("rejects an invalid enum value per-dimension and falls back to defaults", () => {
    const raw = JSON.stringify({
      filters: { ...DEFAULT_LEAD_FILTERS, workState: "bogus" },
      sortKey: "newest",
    });
    expect(parseStoredFilters(raw)).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
  });

  it("rejects an invalid sortKey and falls back to defaults", () => {
    const raw = JSON.stringify({ filters: DEFAULT_LEAD_FILTERS, sortKey: "bogus-sort" });
    expect(parseStoredFilters(raw)).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
  });

  it("returns defaults for garbage and non-object JSON", () => {
    expect(parseStoredFilters("not json at all {")).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
    expect(parseStoredFilters('"just a string"')).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
    expect(parseStoredFilters("[1,2,3]")).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
  });

  it("stores a city/trade of whitespace-only as null instead of rejecting", () => {
    const raw = JSON.stringify({
      filters: { ...DEFAULT_LEAD_FILTERS, city: "   " },
      sortKey: "newest",
    });
    const out = parseStoredFilters(raw);
    expect(out).toEqual({ filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" });
  });
});
