import { describe, it, expect } from "vitest";
import { formatMicros, houseWindows, mergeAgents, WEEK_MS } from "./houseStats";
import { startOfDayET } from "./agentBudget";

describe("houseWindows", () => {
  const now = new Date("2026-10-04T18:00:00Z");
  it("7-day window starts exactly 7 days back (day 7 in, day 8 out)", () => {
    const { since7d } = houseWindows(now);
    const day7 = new Date(now.getTime() - WEEK_MS);
    const day8 = new Date(now.getTime() - WEEK_MS - 1);
    expect(day7.getTime() >= since7d.getTime()).toBe(true);
    expect(day8.getTime() >= since7d.getTime()).toBe(false);
  });
  it("spend uses the runtime's ET day", () => {
    expect(houseWindows(now).dayStart).toEqual(startOfDayET(now));
  });
});

describe("mergeAgents", () => {
  const row = { id: "pledge", name: "Pledge", role: "r", status: "RUNNING" as const, enabled: true, currentTask: "saying hi" };
  it("uses the DB row's status and task", () => {
    expect(mergeAgents([{ id: "pledge", name: "Pledge", role: "r" }], [row])).toEqual([
      { id: "pledge", name: "Pledge", role: "r", status: "RUNNING", currentTask: "saying hi" },
    ]);
  });
  it("a brother with no row yet is IDLE; a disabled row is OFF; sorted by name", () => {
    const out = mergeAgents([{ id: "scout", name: "Scout", role: "s" }], [{ ...row, enabled: false }]);
    expect(out.map((a) => [a.id, a.status])).toEqual([
      ["pledge", "OFF"],
      ["scout", "IDLE"],
    ]);
  });
});

describe("formatMicros", () => {
  it("formats dollars, cents and sub-cent costs", () => {
    expect(formatMicros(0)).toBe("$0.00");
    expect(formatMicros(1_000_000)).toBe("$1.00");
    expect(formatMicros(250_000)).toBe("$0.25");
    expect(formatMicros(2_000)).toBe("$0.002");
    expect(formatMicros(150)).toBe("<$0.001");
    expect(formatMicros(4_500)).toBe("$0.005"); // half rounds up, not float-down
    expect(formatMicros(125_000)).toBe("$0.13");
  });
});
