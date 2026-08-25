import { describe, it, expect } from "vitest";
import { suggestedServices, TRADE_OPTIONS, resolveTradeId, getServicesForTrades } from "./serviceSuggestions";

describe("suggestedServices", () => {
  it("returns an empty list for no category", () => {
    expect(suggestedServices(null)).toEqual([]);
    expect(suggestedServices(undefined)).toEqual([]);
    expect(suggestedServices("")).toEqual([]);
    expect(suggestedServices("   ")).toEqual([]);
  });

  it("matches an exact known category", () => {
    expect(suggestedServices("plumber")).toEqual([
      "Drain cleaning",
      "Water heater repair",
      "Leak detection",
      "Repiping",
      "Fixture installation",
    ]);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(suggestedServices("  Plumber  ")).toEqual(suggestedServices("plumber"));
  });

  it("matches an exact category before falling back to a substring match", () => {
    // "hair salon" has its own literal entry (shared with "salon") — regression
    // guard for the same exact-vs-substring class of bug as design systems.
    expect(suggestedServices("hair salon")).toEqual(suggestedServices("salon"));
  });

  it("falls back to a substring match for an unlisted specific category", () => {
    expect(suggestedServices("mobile auto repair")).toEqual(suggestedServices("auto repair"));
  });

  it("falls back to generic suggestions for a totally unmatched category", () => {
    expect(suggestedServices("underwater basket weaving")).toEqual([
      "Consultations",
      "Custom quotes",
      "Free estimates",
      "Ongoing support",
    ]);
  });

  it("groups synonym categories onto the same suggestion list", () => {
    expect(suggestedServices("realtor")).toEqual(suggestedServices("real estate"));
    expect(suggestedServices("interior designer")).toEqual(suggestedServices("interior design"));
  });

  it("covers newly-added categories that have no design-system counterpart", () => {
    expect(suggestedServices("barber")).toEqual([
      "Haircuts",
      "Beard trims",
      "Hot towel shaves",
      "Kids' cuts",
      "Walk-ins welcome",
    ]);
    expect(suggestedServices("pest control")).toContain("Termite treatment");
  });

  it("keeps 'barbershop' and 'tattoo shop' matching their own exact entry, not a shorter substring", () => {
    // Regression: "barbershop" contains "barber", "tattoo shop" contains
    // "tattoo" — both must resolve via the exact-match pass since each also
    // has its own literal category entry, same as the "hair salon" case.
    expect(suggestedServices("barbershop")).toEqual(suggestedServices("barber"));
    expect(suggestedServices("tattoo shop")).toEqual(suggestedServices("tattoo"));
  });

  it("falls back to a substring match for an unlisted variant of a new category", () => {
    expect(suggestedServices("mobile pet grooming")).toEqual(suggestedServices("pet grooming"));
  });
});

describe("TRADE_OPTIONS", () => {
  it("gives every trade a unique id", () => {
    const ids = TRADE_OPTIONS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is sorted alphabetically by label", () => {
    const labels = TRADE_OPTIONS.map((t) => t.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("joins a 2-alias group's label with a slash, and special-cases HVAC", () => {
    expect(TRADE_OPTIONS.find((t) => t.id === "event")?.label).toBe("Event / Party");
    expect(TRADE_OPTIONS.find((t) => t.id === "hvac contractor")?.label).toBe("HVAC Contractor");
  });
});

describe("resolveTradeId", () => {
  it("returns null for no category", () => {
    expect(resolveTradeId(null)).toBeNull();
    expect(resolveTradeId("")).toBeNull();
  });

  it("resolves free text to the matching trade id", () => {
    expect(resolveTradeId("electrician")).toBe("electrician");
    expect(resolveTradeId("mobile auto repair")).toBe("auto repair");
  });

  it("returns null (not a fabricated trade) for an unmatched category", () => {
    expect(resolveTradeId("underwater basket weaving")).toBeNull();
  });
});

describe("getServicesForTrades", () => {
  it("returns an empty list for no trades selected", () => {
    expect(getServicesForTrades([])).toEqual([]);
  });

  it("unions services across multiple selected trades in selection order", () => {
    const result = getServicesForTrades(["plumber", "electrician"]);
    expect(result.slice(0, 5)).toEqual(suggestedServices("plumber"));
    expect(result.slice(5)).toEqual(suggestedServices("electrician"));
  });

  it("dedupes services that appear in more than one selected trade's list", () => {
    // Both groups include "Custom design" as a suggestion.
    const result = getServicesForTrades(["jewelry", "fine jewelry"]);
    expect(result.filter((s) => s === "Custom design")).toHaveLength(1);
  });

  it("ignores an unknown trade id rather than throwing", () => {
    expect(getServicesForTrades(["not-a-real-trade", "plumber"])).toEqual(suggestedServices("plumber"));
  });
});
