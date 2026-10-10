import { describe, expect, it } from "vitest";
import { bossJob, goalLine, parseBossReply, type BossInput } from "./boss";
import { fakeCtx } from "./testCtx";

describe("goalLine", () => {
  it("shows sales against the straight-line pace to $10k", () => {
    // Day one: nothing expected yet.
    expect(goalLine(0, 0, 0, new Date("2026-10-09T04:00:00Z"))).toBe(
      "Goal: $0 of $10,000 by Mar 31 (0 sites sold at $1,000; on pace means 0 by now; 174 days left). DMs sent yesterday: 0, last 7 days: 0 (pace: 10 a day).",
    );
    // Halfway (Jan 3-ish): 5 sales expected.
    expect(goalLine(2, 12, 60, new Date("2027-01-04T05:00:00Z"))).toContain("$2,000 of $10,000 by Mar 31 (2 sites sold at $1,000; on pace means 5 by now; 87 days left)");
    // Past the deadline: clamps, never negative.
    expect(goalLine(11, 0, 0, new Date("2027-05-01T04:00:00Z"))).toContain("$11,000 of $10,000 by Mar 31 (11 sites sold at $1,000; on pace means 10 by now; 0 days left)");
  });
});

function input(snapshot: string, lastSnapshot: string | null) {
  const saved: string[] = [];
  const disabled: string[] = [];
  const i: BossInput = {
    snapshot,
    lastSnapshot,
    lastNote: "Drafts are piling up.",
    brotherIds: ["scout", "poster"],
    saveSnapshot: async (s) => void saved.push(s),
    disable: async (id) => void disabled.push(id),
  };
  return { i, saved, disabled };
}

describe("bossJob", () => {
  it("costs nothing when nothing changed", async () => {
    const { ctx, asks, proposals } = fakeCtx();
    const { i, saved } = input("same", "same");
    expect(await bossJob(i, ctx)).toBe("all quiet");
    expect(asks).toHaveLength(0);
    expect(proposals).toHaveLength(0);
    expect(saved).toHaveLength(0);
  });

  it("looks when something changed, notes Frank, benches only known brothers", async () => {
    const { ctx, asks, proposals } = fakeCtx(
      '{"note": "Poster failed 3 times — check Zernio.", "disable": [{"id": "poster", "reason": "keeps failing"}, {"id": "boss", "reason": "x"}, {"id": "nobody"}]}',
    );
    const { i, saved, disabled } = input("new", "old");
    expect(await bossJob(i, ctx)).toBe("wrote Frank a note, switched off poster");
    expect(asks).toHaveLength(1);
    expect(asks[0].prompt).toContain("Your last note to Frank:\nDrafts are piling up.");
    expect(saved).toEqual(["new"]);
    expect(disabled).toEqual(["poster"]);
    expect(proposals[0].kind).toBe("NOTE");
    expect(proposals[0].body).toBe("Poster failed 3 times, check Zernio.\n\nSwitched off poster: keeps failing");
  });

  it("stays silent when he has nothing to say", async () => {
    const { ctx, proposals } = fakeCtx('{"note": null, "disable": []}');
    const { i, saved } = input("new", null);
    expect(await bossJob(i, ctx)).toBe("nothing for Frank");
    expect(proposals).toHaveLength(0);
    expect(saved).toEqual(["new"]);
  });

  it("doesn't save the snapshot when the call fails, so the next tick retries", async () => {
    const { ctx } = fakeCtx(new Error("overloaded"));
    const { i, saved } = input("new", "old");
    await expect(bossJob(i, ctx)).rejects.toThrow("overloaded");
    expect(saved).toHaveLength(0);
  });
});

describe("parseBossReply", () => {
  it("acts on nothing when the reply isn't JSON", () => {
    expect(parseBossReply("Sure! Everything looks fine.", ["scout"])).toEqual({ note: null, disabled: [] });
    expect(parseBossReply("null", ["scout"])).toEqual({ note: null, disabled: [] });
  });
});
