import { describe, it, expect } from "vitest";
import { layoutRooms, OVERFLOW, ROOMS, roomLook } from "./houseLayout";

describe("layoutRooms", () => {
  it("gives every mapped brother his own room", () => {
    const ids = Object.keys(ROOMS);
    const out = layoutRooms(ids);
    expect(out.map((r) => r.id)).toEqual(ids);
    out.forEach(({ id, room }) => expect(room).toBe(ROOMS[id]));
  });

  it("fills overflow with unknown ids in a stable (sorted) order, never sharing a slot", () => {
    const a = layoutRooms(["zeta", "pledge", "alpha"]);
    const b = layoutRooms(["alpha", "zeta", "pledge"]);
    expect(a.find((r) => r.id === "alpha")!.room).toBe(OVERFLOW[0]);
    expect(a.find((r) => r.id === "zeta")!.room).toBe(OVERFLOW[1]);
    expect(b.find((r) => r.id === "alpha")!.room).toBe(OVERFLOW[0]);
    expect(new Set(a.map((r) => r.room)).size).toBe(a.length);
  });

  it("drops brothers beyond the overflow slots instead of stacking them", () => {
    const ids = Array.from({ length: OVERFLOW.length + 2 }, (_, i) => `x${i}`);
    expect(layoutRooms(ids)).toHaveLength(OVERFLOW.length);
  });
});

describe("roomLook", () => {
  it("covers all four statuses", () => {
    expect(roomLook("IDLE", false)).toMatchObject({ pulse: false });
    expect(roomLook("RUNNING", false).pulse).toBe(true);
    expect(roomLook("RUNNING", false).glow).toBeGreaterThan(roomLook("IDLE", false).glow);
    expect(roomLook("ERROR", false).window).not.toBe(roomLook("IDLE", false).window);
    expect(roomLook("OFF", false).glow).toBe(0);
  });

  it("reduced motion never pulses", () => {
    for (const s of ["IDLE", "RUNNING", "ERROR", "OFF"] as const) expect(roomLook(s, true).pulse).toBe(false);
  });
});
