import { describe, it, expect } from "vitest";
import { LEAD_TARGETS, rotateTargets, type LeadTarget } from "./leadTargets";

describe("LEAD_TARGETS", () => {
  it("has exactly 94 entries", () => {
    expect(LEAD_TARGETS).toHaveLength(94);
  });

  it("every entry's category is barber or salon", () => {
    for (const t of LEAD_TARGETS) {
      expect(["barber", "salon"]).toContain(t.category);
    }
  });

  it("orders barber before salon for each city", () => {
    for (let i = 0; i < LEAD_TARGETS.length; i += 2) {
      expect(LEAD_TARGETS[i].city).toBe(LEAD_TARGETS[i + 1].city);
      expect(LEAD_TARGETS[i].category).toBe("barber");
      expect(LEAD_TARGETS[i + 1].category).toBe("salon");
    }
  });

  it("covers the NYC + Long Island city set", () => {
    const cities = LEAD_TARGETS.filter((_, i) => i % 2 === 0).map((t) => t.city);
    for (const expected of [
      "Manhattan, NY",
      "Brooklyn, NY",
      "Hempstead, NY",
      "Huntington, NY",
    ]) {
      expect(cities).toContain(expected);
    }
  });
});

describe("rotateTargets", () => {
  const targets: LeadTarget[] = [
    { city: "A", category: "barber" },
    { city: "B", category: "salon" },
    { city: "C", category: "barber" },
    { city: "D", category: "salon" },
  ];

  it("returns count targets starting at cursor", () => {
    const { batch, nextCursor } = rotateTargets(1, 2, targets);
    expect(batch).toEqual([targets[1], targets[2]]);
    expect(nextCursor).toBe(3);
  });

  it("wraps around the end of the list", () => {
    const { batch, nextCursor } = rotateTargets(2, 3, targets);
    expect(batch).toEqual([targets[2], targets[3], targets[0]]);
    expect(nextCursor).toBe(1);
  });

  it("returns count items even when count exceeds the remaining length", () => {
    const { batch } = rotateTargets(3, 5, targets);
    expect(batch).toHaveLength(5);
    expect(batch[0]).toEqual(targets[3]);
    expect(batch[4]).toEqual(targets[3]);
  });

  it("handles a cursor equal to length by wrapping to 0", () => {
    const { batch, nextCursor } = rotateTargets(4, 1, targets);
    expect(batch).toEqual([targets[0]]);
    expect(nextCursor).toBe(1);
  });

  it("handles negative cursor by wrapping", () => {
    const { batch, nextCursor } = rotateTargets(-1, 2, targets);
    expect(batch[0]).toEqual(targets[3]);
    expect(nextCursor).toBe(1);
  });

  it("uses LEAD_TARGETS by default", () => {
    const out = rotateTargets(0, 1);
    expect(out.batch).toHaveLength(1);
    expect(out.batch[0]).toEqual(LEAD_TARGETS[0]);
  });

  it("returns empty when no targets", () => {
    expect(rotateTargets(0, 5, [])).toEqual({ batch: [], nextCursor: 0 });
  });
});
