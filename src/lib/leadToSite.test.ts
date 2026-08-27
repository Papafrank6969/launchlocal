import { describe, it, expect } from "vitest";
import { leadToDraftSite } from "./leadToSite";

const lead = (over: Partial<Parameters<typeof leadToDraftSite>[0]> = {}) => ({
  name: "Bella Lash Studio",
  category: "lash technician",
  city: "Austin, TX",
  address: "4012 Marathon Blvd, Austin, TX",
  phone: "(512) 555-0142",
  email: null,
  instagramHandle: "@bellalash",
  rating: 4.9,
  reviewCount: 214,
  placeId: "ChIJabc123",
  ...over,
});

describe("leadToDraftSite", () => {
  it("maps the Google-sourced fields straight through", () => {
    const d = leadToDraftSite(lead());
    expect(d).toMatchObject({
      businessName: "Bella Lash Studio",
      category: "lash technician",
      address: "4012 Marathon Blvd, Austin, TX",
      phone: "(512) 555-0142",
      instagramHandle: "@bellalash",
      rating: 4.9,
      reviewCount: 214,
      googlePlaceId: "ChIJabc123",
    });
  });

  it("seeds up to 5 category-typical service names", () => {
    const d = leadToDraftSite(lead());
    expect(d.serviceNames.length).toBeGreaterThan(0);
    expect(d.serviceNames.length).toBeLessThanOrEqual(5);
    expect(d.serviceNames.every((s) => typeof s === "string" && s.length > 0)).toBe(true);
  });

  it("builds a starting-point tagline from category + city", () => {
    expect(leadToDraftSite(lead()).tagline).toBe("Your trusted lash technician in Austin, TX");
  });

  it("leaves the tagline blank when category or city is missing", () => {
    expect(leadToDraftSite(lead({ category: "" })).tagline).toBe("");
    expect(leadToDraftSite(lead({ city: "  " })).tagline).toBe("");
  });

  it("never fabricates copy — no about/story/guarantee in the output", () => {
    const d = leadToDraftSite(lead()) as Record<string, unknown>;
    expect(d.about).toBeUndefined();
    expect(d.story).toBeUndefined();
    expect(d.guaranteeText).toBeUndefined();
  });

  it("normalises blank contact fields to null", () => {
    const d = leadToDraftSite(lead({ phone: "   ", email: "", instagramHandle: null, address: null }));
    expect(d.phone).toBeNull();
    expect(d.email).toBeNull();
    expect(d.instagramHandle).toBeNull();
    expect(d.address).toBeNull();
  });

  it("handles a missing rating without producing NaN", () => {
    const d = leadToDraftSite(lead({ rating: null, reviewCount: null }));
    expect(d.rating).toBeNull();
    expect(d.reviewCount).toBeNull();
  });
});
