import { describe, it, expect, vi, afterEach } from "vitest";
import { isOverdue, OUTREACH_STATUSES, OUTREACH_LABEL, OUTREACH_STYLE } from "./outreachStatus";

describe("isOverdue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when there is no follow-up date", () => {
    expect(isOverdue(null)).toBe(false);
  });

  it("returns true for a follow-up date in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T00:00:00Z"));
    expect(isOverdue("2026-08-24T00:00:00Z")).toBe(true);
  });

  it("returns false for a follow-up date in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T00:00:00Z"));
    expect(isOverdue("2026-08-26T00:00:00Z")).toBe(false);
  });
});

describe("OUTREACH_STATUSES catalog", () => {
  it("gives every status a label and a style", () => {
    for (const status of OUTREACH_STATUSES) {
      expect(OUTREACH_LABEL[status]).toBeTruthy();
      expect(OUTREACH_STYLE[status]).toBeTruthy();
    }
  });
});
