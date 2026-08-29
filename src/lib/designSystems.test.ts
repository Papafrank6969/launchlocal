import { describe, it, expect } from "vitest";
import { meetsAA, contrastRatio } from "./contrast";
import {
  DESIGN_SYSTEMS,
  DEFAULT_DESIGN_SYSTEM_ID,
  VARIANT_COUNT,
  getDesignSystem,
  deterministicDesignSystem,
  variantsOf,
  applyColorVariant,
  pickColorVariant,
} from "./designSystems";
import { hueOf, hueDistance } from "./color";

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

  it("passes WCAG AA (normal text) for dark-mode body text (light neutral on dark neutral)", () => {
    // The site chrome swaps --site-bg/--site-fg to these in .dark — body copy
    // has to stay readable in both modes, not just light.
    for (const system of DESIGN_SYSTEMS) {
      expect(meetsAA(system.colorNeutralLight, system.colorNeutralDark)).toBe(true);
    }
  });

  it("keeps the accent color at the 3:1 large-text / UI bar against its neutral", () => {
    // Accent is decoration only (split-variant service-card top border) — never
    // body text, and eyebrows use the primary color. It only ever sits on one
    // neutral at a time depending on theme, so it has to clear 3:1 (WCAG
    // large-text / non-text-contrast) against at least one of them.
    for (const system of DESIGN_SYSTEMS) {
      const onLight = contrastRatio(system.colorAccent, system.colorNeutralLight);
      const onDark = contrastRatio(system.colorAccent, system.colorNeutralDark);
      expect(Math.max(onLight, onDark)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("color variants (per-business accent + paper)", () => {
  it("gives every system exactly VARIANT_COUNT variants, index 0 = the base palette", () => {
    for (const system of DESIGN_SYSTEMS) {
      const variants = variantsOf(system);
      expect(variants).toHaveLength(VARIANT_COUNT);
      expect(variants[0].colorAccent).toBe(system.colorAccent);
      expect(variants[0].colorNeutralLight).toBe(system.colorNeutralLight);
      expect(variants[0].colorNeutralDark).toBe(system.colorNeutralDark);
      expect(variants[0].name.length).toBeGreaterThan(0);
    }
  });

  it("every system × every variant still passes the catalog's WCAG AA gate", () => {
    // This is the safety boundary: a variant can never ship a palette the base
    // catalog test would reject. Same four assertions, run across all 6 × 12.
    for (const system of DESIGN_SYSTEMS) {
      variantsOf(system).forEach((v, idx) => {
        const where = `${system.id} variant ${idx} (${v.name})`;
        expect(meetsAA(system.colorPrimary, v.colorNeutralLight), `primary-on-light ${where}`).toBe(true);
        expect(meetsAA(v.colorNeutralDark, v.colorNeutralLight), `dark-on-light ${where}`).toBe(true);
        expect(meetsAA(v.colorNeutralLight, v.colorNeutralDark), `dark-mode body ${where}`).toBe(true);
        const onLight = contrastRatio(v.colorAccent, v.colorNeutralLight);
        const onDark = contrastRatio(v.colorAccent, v.colorNeutralDark);
        expect(Math.max(onLight, onDark), `accent 3:1 ${where}`).toBeGreaterThanOrEqual(3);
      });
    }
  });

  it("keeps neutralDark fixed and moves the accent hue for non-base variants", () => {
    for (const system of DESIGN_SYSTEMS) {
      const variants = variantsOf(system);
      const baseHue = hueOf(system.colorAccent);
      for (let i = 1; i < variants.length; i++) {
        expect(variants[i].colorNeutralDark).toBe(system.colorNeutralDark);
        expect(hueDistance(hueOf(variants[i].colorAccent), baseHue)).toBeGreaterThan(3);
      }
      // At least a couple of distinct accent hues across the set.
      const hues = new Set(variants.map((v) => Math.round(hueOf(v.colorAccent) / 10)));
      expect(hues.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("never gives two variants of the same system the same name", () => {
    // Regression: hueName() buckets hue into coarse ranges, so two of the 6
    // rotated variants can land in the same bucket (e.g. two "Terracotta")
    // and be indistinguishable in the swatch picker's tooltip/aria-label.
    for (const system of DESIGN_SYSTEMS) {
      const names = variantsOf(system).map((v) => v.name);
      expect(new Set(names).size, `${system.id}: ${names.join(", ")}`).toBe(names.length);
    }
  });

  it("applyColorVariant is a no-op for index 0, null, or out of range", () => {
    const system = getDesignSystem("studio-beauty");
    expect(applyColorVariant(system, 0)).toBe(system);
    expect(applyColorVariant(system, null)).toBe(system);
    expect(applyColorVariant(system, 99)).toBe(system);
    expect(applyColorVariant(system, 1).colorAccent).not.toBe(system.colorAccent);
  });

  it("pickColorVariant picks the nearest accent hue when a dominant hue is known", () => {
    const system = getDesignSystem("studio-beauty");
    const variants = variantsOf(system);
    for (const target of [10, 90, 200, 300]) {
      const idx = pickColorVariant(system, { dominantHue: target });
      const chosen = hueDistance(hueOf(variants[idx].colorAccent), target);
      for (const v of variants) {
        expect(chosen).toBeLessThanOrEqual(hueDistance(hueOf(v.colorAccent), target) + 0.001);
      }
    }
  });

  it("pickColorVariant spreads same-hue same-niche shops via a name jitter", () => {
    const system = getDesignSystem("studio-beauty");
    // Every warm-toned studio photo reads ~hue 25; without the jitter they'd all
    // collapse onto one variant.
    const picks = new Set(
      ["Lisa's Nails", "Lash Genie", "Ruvé Nail Salon", "Blink Bar", "Gilded Lash"].map((businessName) =>
        pickColorVariant(system, { dominantHue: 25, businessName }),
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it("pickColorVariant falls back to a stable in-range hash of the business name", () => {
    const system = getDesignSystem("studio-beauty");
    const a = pickColorVariant(system, { businessName: "Lash & Co" });
    const b = pickColorVariant(system, { businessName: "Lash & Co" });
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(VARIANT_COUNT);
    const spread = new Set(
      ["Lash Loft", "Brow Bar", "Nail Nook", "Glow Studio", "Wink"].map((n) =>
        pickColorVariant(system, { businessName: n }),
      ),
    );
    expect(spread.size).toBeGreaterThan(1);
  });
});

describe("category routing coverage", () => {
  // Each of these was previously falling through to the hashed fallback (a
  // roofer could land on Warm Editorial's bakery fonts). They now route to a
  // system whose aesthetic actually fits the trade.
  const cases: [category: string, expectedId: string][] = [
    ["barber", "crafted-artisan"],
    ["barbershop", "crafted-artisan"],
    ["chiropractor", "friendly-approachable"],
    ["pet grooming", "friendly-approachable"],
    ["daycare", "friendly-approachable"],
    ["roofing", "technical-precision"],
    ["house painter", "technical-precision"],
    ["locksmith", "technical-precision"],
    ["moving company", "technical-precision"],
    ["pest control", "technical-precision"],
    ["yoga studio", "playful-bold"],
    ["martial arts", "playful-bold"],
    ["tailor", "minimal-luxury"],
    ["med spa", "minimal-luxury"],
    ["wedding planner", "minimal-luxury"],
    ["tattoo shop", "studio-beauty"],
    ["tree service", "natural-organic"],
    ["screen printing", "crafted-artisan"],
    ["coffee roaster", "crafted-artisan"],
    ["cocktail bar", "midnight-dining"],
    ["architecture firm", "considered-modern"],
    ["photography studio", "considered-modern"],
    ["bookstore", "warm-editorial"],
    ["bookkeeping", "sharp-corporate"],
    ["watch repair", "gilded-atelier"],
  ];

  it.each(cases)("routes %s to %s", (category, expectedId) => {
    expect(deterministicDesignSystem("Acme", category).id).toBe(expectedId);
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
