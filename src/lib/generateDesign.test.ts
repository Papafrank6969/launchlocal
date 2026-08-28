import { describe, it, expect, vi, afterEach } from "vitest";
import { chooseDesign } from "./generateDesign";
import { variantsOf } from "./designSystems";
import { hueOf, hueDistance } from "./color";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("chooseDesign (deterministic fallback, no ANTHROPIC_API_KEY)", () => {
  it("returns a system, a rationale, and an in-range variant index", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const choice = await chooseDesign({ businessName: "Lash Loft", category: "lash technician" });
    expect(choice.system.id).toBe("studio-beauty");
    expect(choice.aiGenerated).toBe(false);
    expect(choice.variant).toBeGreaterThanOrEqual(0);
    expect(choice.variant).toBeLessThan(variantsOf(choice.system).length);
  });

  it("is stable for the same business", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const a = await chooseDesign({ businessName: "Lash Loft", category: "lash technician" });
    const b = await chooseDesign({ businessName: "Lash Loft", category: "lash technician" });
    expect(a.variant).toBe(b.variant);
  });

  it("biases the variant accent toward a supplied dominant hue", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    // studio-beauty's accents all sit in the warm band, so a green-ish photo
    // hue should still land on the greenest/coolest end of its range.
    const choice = await chooseDesign({
      businessName: "Verdant Nails",
      category: "nail salon",
      dominantHue: 150,
    });
    const variants = variantsOf(choice.system);
    const pickedDist = hueDistance(hueOf(variants[choice.variant].colorAccent), 150);
    const bestDist = Math.min(...variants.map((v) => hueDistance(hueOf(v.colorAccent), 150)));
    // Within one variant's hue spacing of the true nearest (the name jitter can
    // bump it to an adjacent variant, never across the whole range).
    expect(pickedDist).toBeLessThanOrEqual(bestDist + 45);
    expect(choice.rationale).toMatch(/photo/i);
  });

  it("two same-niche shops with different names can land on different variants", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const names = ["Lash Loft", "Blink Bar", "Fringe Studio", "Wink & Co", "Flutter Room"];
    const variants = new Set<number>();
    for (const businessName of names) {
      variants.add((await chooseDesign({ businessName, category: "lash technician" })).variant);
    }
    expect(variants.size).toBeGreaterThan(1);
  });
});
