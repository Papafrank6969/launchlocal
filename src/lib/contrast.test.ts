import { describe, it, expect } from "vitest";
import { contrastRatio, meetsAA, readableTextColor } from "./contrast";

describe("contrastRatio", () => {
  it("returns the max ratio (21) for pure black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("returns 1 for identical colors", () => {
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("is symmetric regardless of argument order", () => {
    const a = contrastRatio("#1E3A5F", "#F4F6F8");
    const b = contrastRatio("#F4F6F8", "#1E3A5F");
    expect(a).toBeCloseTo(b, 10);
  });

  it("expands 3-digit hex shorthand the same as its 6-digit form", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(contrastRatio("#000000", "#ffffff"), 5);
  });
});

describe("meetsAA", () => {
  it("passes normal text at >= 4.5:1", () => {
    expect(meetsAA("#1C2B3A", "#F7F5F0")).toBe(true);
  });

  it("fails normal text below 4.5:1 even when it clears the large-text bar", () => {
    // ~3.3:1 — clears the 3:1 large-text bar but not the 4.5:1 normal-text bar.
    expect(meetsAA("#A9822F", "#FAF7F2")).toBe(false);
    expect(meetsAA("#A9822F", "#FAF7F2", true)).toBe(true);
  });
});

describe("readableTextColor", () => {
  it("picks white text on a dark background", () => {
    expect(readableTextColor("#0C0C0B")).toBe("#ffffff");
  });

  it("picks black text on a light background", () => {
    expect(readableTextColor("#F7F5F0")).toBe("#000000");
  });

  it("always returns a color that meets the AA large-text bar against the background", () => {
    // The whole point of this function is to be a safe fallback for arbitrary
    // per-business primary colors, so this must hold for anything it's given.
    const sampleColors = ["#1E3A5F", "#C13F1A", "#2F4A3C", "#B5765A", "#7A3A1D", "#2F72B8"];
    for (const bg of sampleColors) {
      const text = readableTextColor(bg);
      expect(meetsAA(bg, text, true)).toBe(true);
    }
  });
});
