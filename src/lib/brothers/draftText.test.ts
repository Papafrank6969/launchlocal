import { describe, it, expect } from "vitest";
import { acceptDraft, parseDraftJson, scrubDraft, templateIndex, writeDrafts, DRAFT_MAX_CHARS } from "./draftText";
import { BudgetExceededError } from "../agentRunner";
import { fakeCtx } from "./testCtx";

describe("scrubDraft", () => {
  it("replaces em and en dashes and strips emoji", () => {
    expect(scrubDraft("Hey — love the shop 🔥🔥 – seriously")).toBe("Hey, love the shop, seriously");
    expect(scrubDraft("Nice work 👍🏽.")).toBe("Nice work.");
  });
  it("doesn't leave a comma before punctuation", () => {
    expect(scrubDraft("Hey —. there")).toBe("Hey. there");
  });
});

describe("acceptDraft", () => {
  it("enforces the length bounds after scrubbing", () => {
    expect(acceptDraft("too short")).toBeNull();
    expect(acceptDraft("x".repeat(DRAFT_MAX_CHARS + 1))).toBeNull();
    expect(acceptDraft("Hey, saw your shop on Google and wanted to say hi. Got a sec?")).toMatch(/^Hey/);
    expect(acceptDraft(42)).toBeNull();
  });
});

describe("parseDraftJson", () => {
  it("reads fenced JSON with prose around it and drops unknown ids", () => {
    const reply = 'Here you go:\n```json\n[{"id":"a","text":"one"},{"id":"zzz","text":"x"},{"id":"b","text":2}]\n```\nThanks!';
    const m = parseDraftJson(reply, ["a", "b"]);
    expect([...m]).toEqual([["a", "one"]]);
  });
  it("returns empty on garbage", () => {
    expect(parseDraftJson("no json here", ["a"]).size).toBe(0);
    expect(parseDraftJson("[not json]", ["a"]).size).toBe(0);
  });
  it("reads a different field name", () => {
    expect(parseDraftJson('[{"id":"a","why":"top rated"}]', ["a"], "why").get("a")).toBe("top rated");
  });
});

describe("templateIndex", () => {
  it("is stable and in range", () => {
    expect(templateIndex("lead-1", 3)).toBe(templateIndex("lead-1", 3));
    for (const id of ["a", "bb", "lead-9"]) expect(templateIndex(id, 3)).toBeLessThan(3);
  });
});

describe("writeDrafts", () => {
  const leads = [
    { id: "a", name: "Fade Lab", facts: { city: "Massapequa" }, template: "Hey — template A, long enough to pass the bar easily." },
    { id: "b", name: "Shear Joy", facts: { city: "Bayside" }, template: "Hi — template B, long enough to pass the bar easily." },
  ];
  const opts = { kind: "DM_DRAFT" as const, titlePrefix: "DM for", system: "s", leads };

  it("makes one call and files one draft per lead; a bad draft falls back alone", async () => {
    const f = fakeCtx(JSON.stringify([{ id: "a", text: "Hey Fade Lab — saw you on Google in Massapequa. Want a free mockup?" }, { id: "b", text: "short" }]));
    expect(await writeDrafts(f.ctx, opts)).toEqual({ claude: 1, template: 1 });
    expect(f.asks).toHaveLength(1);
    expect(f.asks[0].prompt).toContain('"id":"a"');
    expect(f.proposals.map((p) => [p.leadId, p.title])).toEqual([
      ["a", "DM for Fade Lab"],
      ["b", "DM for Shear Joy (template)"],
    ]);
    expect(f.proposals[0].body).not.toMatch(/[—–]/);
    expect(f.proposals[1].body).toBe("Hi, template B, long enough to pass the bar easily.");
  });

  it("an unparseable reply or a Claude error → all templates", async () => {
    for (const reply of ["sorry, I can't", new Error("overloaded")]) {
      const f = fakeCtx(reply);
      expect(await writeDrafts(f.ctx, opts)).toEqual({ claude: 0, template: 2 });
    }
  });

  it("the budget cap propagates (the runner records SKIPPED_BUDGET) and files nothing", async () => {
    const f = fakeCtx(new BudgetExceededError("cap"));
    await expect(writeDrafts(f.ctx, opts)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(f.proposals).toHaveLength(0);
  });
});
