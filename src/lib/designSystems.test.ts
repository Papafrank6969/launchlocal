import { describe, it, expect } from "vitest";
import { meetsAA } from "./contrast";
import {
  DESIGN_SYSTEMS,
  DEFAULT_DESIGN_SYSTEM_ID,
  getDesignSystem,
  deterministicDesignSystem,
} from "./designSystems";

describe("getDesignSystem", () => {
  it("returns the matching system by id", () => {
    expect(getDesignSystem("midnight-dining")?.name).toBe("Midnight Dining");
  });

  it("falls back to the default system for an unknown id", () => {
    expect(getDesignSystem("does-not-exist")?.id).toBe(DEFAULT_DESIGN_SYSTEM_ID);
  });

  it("falls back to the default system when no id is given", () => {
    expect(getDesignSystem()?.id).toBe(DEFAULT_DESIGN_SYSTEM_ID);
    expect(getDesignSystem(null)?.id).toBe(DEFAULT_DESIGN_SYSTEM_ID);
  });
});

describe("deterministicDesignSystem", () => {
  it("routes new luxury-tier categories to their intended system", () => {
    expect(deterministicDesignSystem("Aurelia", "fine jewelry").id).toBe("gilded-atelier");
    expect(deterministicDesignSystem("Noir & Co.", "fine dining").id).toBe("midnight-dining");
    expect(deterministicDesignSystem("Meridian", "interior design").id).toBe("considered-modern");
  });

  it("matches an exact category before falling back to a substring match", () => {
    // Regression: "hair salon" must hit its own literal entry
    // (friendly-approachable) rather than being shadowed by the earlier,
    // shorter "salon" entry (minimal-luxury) via substring matching.
    expect(deterministicDesignSystem("Snip Studio", "hair salon").id).toBe("friendly-approachable");
    expect(deterministicDesignSystem("The Gilded Chair", "salon").id).toBe("minimal-luxury");
  });

  it("is a pure function of business name + category — same input always wins the same system", () => {
    const a = deterministicDesignSystem("Ada's Diner", null);
    const b = deterministicDesignSystem("Ada's Diner", null);
    expect(a.id).toBe(b.id);
  });

  it("falls back to a hashed pick spread across the catalog when the category is unknown", () => {
    const picks = new Set(
      ["Acme Co", "Bravo LLC", "Charlie Inc", "Delta Group", "Echo Partners"].map(
        (name) => deterministicDesignSystem(name, "some totally unmatched category").id
      )
    );
    // Not every name should collapse onto the same system — the hash should spread picks out.
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe("DESIGN_SYSTEMS catalog integrity", () => {
  it("gives every system a unique id", () => {
    const ids = DESIGN_SYSTEMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("passes WCAG AA (normal text) for primary-on-light and dark-on-light body text", () => {
    for (const system of DESIGN_SYSTEMS) {
      expect(meetsAA(system.colorPrimary, system.colorNeutralLight)).toBe(true);
      expect(meetsAA(system.colorNeutralDark, system.colorNeutralLight)).toBe(true);
    }
  });
});

describe("beauty-tech niche routing", () => {
  it("routes nail, lash, and brow technicians to the dedicated Studio Beauty system", () => {
    expect(deterministicDesignSystem("Glow Bar", "nail technician").id).toBe("studio-beauty");
    expect(deterministicDesignSystem("Lash Loft", "lash technician").id).toBe("studio-beauty");
    expect(deterministicDesignSystem("Arch & Brow", "brow technician").id).toBe("studio-beauty");
  });

  it("does not shadow the generic 'salon'/'beauty' systems, which stay on Minimal Luxury", () => {
    expect(deterministicDesignSystem("The Cutting Room", "salon").id).toBe("minimal-luxury");
    expect(deterministicDesignSystem("Glow Studio", "beauty").id).toBe("minimal-luxury");
  });
});
