import { describe, it, expect } from "vitest";
import { suggestedServices } from "./serviceSuggestions";

describe("suggestedServices", () => {
  it("returns an empty list for no category", () => {
    expect(suggestedServices(null)).toEqual([]);
    expect(suggestedServices(undefined)).toEqual([]);
    expect(suggestedServices("")).toEqual([]);
    expect(suggestedServices("   ")).toEqual([]);
  });

  it("matches an exact known category", () => {
    expect(suggestedServices("plumber")).toEqual(["Drain cleaning", "Water heater repair", "Leak detection", "Repiping"]);
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
});
