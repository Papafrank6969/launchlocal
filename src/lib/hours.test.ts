import { describe, it, expect } from "vitest";
import { parseHours, isOpenNow } from "./hours";

describe("parseHours", () => {
  it("returns null for empty/missing input", () => {
    expect(parseHours(null)).toBeNull();
    expect(parseHours(undefined)).toBeNull();
    expect(parseHours("")).toBeNull();
    expect(parseHours("   ")).toBeNull();
  });

  it("parses a multi-line day-range spec with am/pm times", () => {
    const ranges = parseHours("Mon-Fri: 8am-6pm\nSat: 9am-2pm");
    expect(ranges).toEqual([
      { start: 1, end: 5, openMinutes: 8 * 60, closeMinutes: 18 * 60 },
      { start: 6, end: 6, openMinutes: 9 * 60, closeMinutes: 14 * 60 },
    ]);
  });

  it("handles noon/midnight correctly (12pm/12am)", () => {
    const ranges = parseHours("Sun: 12am-12pm");
    expect(ranges).toEqual([{ start: 0, end: 0, openMinutes: 0, closeMinutes: 12 * 60 }]);
  });

  it("returns null (best-effort, no partial/garbled result) for an unparseable line", () => {
    expect(parseHours("Whenever we feel like it")).toBeNull();
    expect(parseHours("Mon-Fri: 8am-6pm\nsomething weird")).toBeNull();
  });

  it("returns null for an out-of-range time", () => {
    expect(parseHours("Mon: 25:00-26:00")).toBeNull();
  });
});

describe("isOpenNow", () => {
  it("is open during the middle of a same-day range", () => {
    const ranges = parseHours("Mon-Fri: 8am-6pm")!;
    // Wednesday 2026-08-26 is a Wednesday (day 3), at noon.
    const wednesdayNoon = new Date(2026, 7, 26, 12, 0);
    expect(isOpenNow(ranges, wednesdayNoon)).toBe(true);
  });

  it("is closed outside the range on an included day", () => {
    const ranges = parseHours("Mon-Fri: 8am-6pm")!;
    const wednesdayEarly = new Date(2026, 7, 26, 6, 0);
    expect(isOpenNow(ranges, wednesdayEarly)).toBe(false);
  });

  it("is closed on a day outside the configured range", () => {
    const ranges = parseHours("Mon-Fri: 8am-6pm")!;
    // Sunday 2026-08-23.
    const sundayNoon = new Date(2026, 7, 23, 12, 0);
    expect(isOpenNow(ranges, sundayNoon)).toBe(false);
  });

  it("handles an overnight close time that wraps past midnight", () => {
    const ranges = parseHours("Fri-Sat: 6pm-2am")!;
    // Saturday 2026-08-22 at 1am — after midnight, still "open" from Friday night.
    const saturdayEarlyMorning = new Date(2026, 7, 22, 1, 0);
    expect(isOpenNow(ranges, saturdayEarlyMorning)).toBe(true);
  });

  it("handles a day range that wraps past the end of the week", () => {
    const ranges = parseHours("Sat-Sun: 10am-4pm")!;
    // Sunday 2026-08-23 at noon.
    const sundayNoon = new Date(2026, 7, 23, 12, 0);
    expect(isOpenNow(ranges, sundayNoon)).toBe(true);
  });
});
