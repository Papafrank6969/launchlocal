import { describe, expect, it } from "vitest";
import { bossJob, parseBossReply, type BossInput } from "./boss";
import { fakeCtx } from "./testCtx";

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
