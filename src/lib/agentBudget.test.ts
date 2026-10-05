import { describe, it, expect } from "vitest";
import { budgetFromEnv, canSpend, DAILY_BUDGET_MICROS, startOfDayET } from "./agentBudget";

describe("DAILY_BUDGET_MICROS", () => {
  it("is $1.00", () => {
    expect(DAILY_BUDGET_MICROS).toBe(1_000_000);
  });
});

describe("startOfDayET", () => {
  it("returns midnight EDT for an afternoon in October", () => {
    expect(startOfDayET(new Date("2026-10-04T16:00:00Z")).toISOString()).toBe("2026-10-04T04:00:00.000Z");
  });

  it("returns the previous ET day when it is still before midnight in New York", () => {
    // 03:00 UTC on Oct 4 is 11pm Oct 3 in New York
    expect(startOfDayET(new Date("2026-10-04T03:00:00Z")).toISOString()).toBe("2026-10-03T04:00:00.000Z");
  });

  it("returns midnight EST in winter", () => {
    expect(startOfDayET(new Date("2026-12-15T12:00:00Z")).toISOString()).toBe("2026-12-15T05:00:00.000Z");
  });

  it("uses the EST midnight on the spring-forward day (2026-03-08)", () => {
    expect(startOfDayET(new Date("2026-03-08T12:00:00Z")).toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("uses the EDT midnight the day after spring-forward", () => {
    expect(startOfDayET(new Date("2026-03-09T12:00:00Z")).toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("uses the EDT midnight on the fall-back day (2026-11-01)", () => {
    expect(startOfDayET(new Date("2026-11-01T12:00:00Z")).toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });

  it("uses the EST midnight the day after fall-back", () => {
    expect(startOfDayET(new Date("2026-11-02T12:00:00Z")).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("returns the same instant when given exactly midnight ET", () => {
    expect(startOfDayET(new Date("2026-10-04T04:00:00Z")).toISOString()).toBe("2026-10-04T04:00:00.000Z");
  });
});

describe("canSpend", () => {
  it("allows spending while under the cap", () => {
    expect(canSpend(999_999)).toBe(true);
  });

  it("blocks spending once the cap is reached exactly", () => {
    expect(canSpend(1_000_000)).toBe(false);
  });

  it("blocks spending over the cap", () => {
    expect(canSpend(1_200_000)).toBe(false);
  });

  it("respects a custom cap", () => {
    expect(canSpend(5, 10)).toBe(true);
    expect(canSpend(10, 10)).toBe(false);
  });
});

describe("budgetFromEnv", () => {
  it("defaults to the daily budget when unset", () => {
    expect(budgetFromEnv(undefined)).toBe(DAILY_BUDGET_MICROS);
  });

  it("uses a positive integer override", () => {
    expect(budgetFromEnv("1")).toBe(1);
  });

  it("ignores a non-numeric value", () => {
    expect(budgetFromEnv("lots")).toBe(DAILY_BUDGET_MICROS);
  });

  it("ignores zero and negatives", () => {
    expect(budgetFromEnv("0")).toBe(DAILY_BUDGET_MICROS);
    expect(budgetFromEnv("-5")).toBe(DAILY_BUDGET_MICROS);
  });

  it("ignores a fractional value", () => {
    expect(budgetFromEnv("2.5")).toBe(DAILY_BUDGET_MICROS);
  });
});
