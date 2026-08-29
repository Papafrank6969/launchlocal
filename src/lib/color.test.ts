import { describe, it, expect } from "vitest";
import { hexToHsl, hslToHex, hueOf, hueDistance, rotateHue, adjustLightnessToContrast } from "./color";
import { contrastRatio } from "./contrast";

describe("hex <-> hsl", () => {
  it("round-trips a range of colors within 2/255 per channel", () => {
    for (const hex of ["#000000", "#ffffff", "#A34F27", "#22548C", "#AE7680", "#F3EDE1", "#2B2320"]) {
      const back = hslToHex(hexToHsl(hex));
      const a = parseInt(hex.slice(1), 16);
      const b = parseInt(back.slice(1), 16);
      for (const shift of [16, 8, 0]) {
        expect(Math.abs(((a >> shift) & 255) - ((b >> shift) & 255))).toBeLessThanOrEqual(2);
      }
    }
  });

  it("reads a known hue", () => {
    expect(Math.round(hueOf("#ff0000"))).toBe(0);
    expect(Math.round(hueOf("#00ff00"))).toBe(120);
    expect(Math.round(hueOf("#0000ff"))).toBe(240);
  });

  it("treats a grey as hue 0 with no saturation", () => {
    const hsl = hexToHsl("#808080");
    expect(hsl.s).toBe(0);
  });
});

describe("hueDistance", () => {
  it("is the shortest angle, wrapping at 360", () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(90, 90)).toBe(0);
  });
});

describe("rotateHue", () => {
  it("shifts hue by the given degrees and keeps lightness", () => {
    const before = hexToHsl("#AE7680");
    const after = hexToHsl(rotateHue("#AE7680", 40));
    expect(Math.round(hueDistance(after.h, before.h + 40))).toBeLessThanOrEqual(1);
    expect(Math.abs(after.l - before.l)).toBeLessThan(0.02);
  });
});

describe("adjustLightnessToContrast", () => {
  it("leaves a color alone when it already clears the bar", () => {
    expect(adjustLightnessToContrast("#22548C", "#F4F6F8", 3)).toBe("#22548C");
  });

  it("darkens a too-light color until it clears 3:1 on a light bg", () => {
    const fixed = adjustLightnessToContrast("#EAD9A0", "#FBF3F0", 3);
    expect(contrastRatio(fixed, "#FBF3F0")).toBeGreaterThanOrEqual(3);
  });
});
