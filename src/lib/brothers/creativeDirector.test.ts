import { describe, expect, it } from "vitest";
import { audienceFor, creativeDirectorJob, parseSpec, pickPillar, PILLARS, type NewPost } from "./creativeDirector";
import { fakeCtx } from "./testCtx";

const good = {
  hook: "Your Instagram is not a booking page",
  beats: ["Clients ask the same 5 questions in DMs", "Prices, hours, where you are", "A site answers them while you work", "DM SITE and I'll build yours"],
  caption: "A simple site with your services, prices and a way to book. You keep your Instagram.",
  hashtags: ["#LashTech", "lashartist", "nyc lashes"],
};

function input(over: Partial<Parameters<typeof creativeDirectorJob>[0]> = {}) {
  const saved: NewPost[] = [];
  return { saved, input: { draftedToday: false, dayIndex: 0, recent: [], save: async (p: NewPost) => void saved.push(p), ...over } };
}

describe("audienceFor", () => {
  it("rotates daily and handles negatives", () => {
    expect([0, 1, 2, 3, 4].map(audienceFor)).toEqual(["lash", "nail", "brow", "barber", "lash"]);
    expect(audienceFor(-1)).toBe("barber");
  });
});

describe("pickPillar", () => {
  it("prefers a never-used pillar, else the least recent", () => {
    expect(pickPillar([])).toBe(PILLARS[0]);
    expect(pickPillar(["how-to", "myth", "demo"])).toBe("behind-the-scenes");
    expect(pickPillar(["how-to", "myth", "demo", "behind-the-scenes"])).toBe("behind-the-scenes");
    expect(pickPillar(["myth", "demo", "behind-the-scenes", "how-to"])).toBe("how-to");
  });
});

describe("parseSpec", () => {
  it("accepts a fenced spec and cleans hashtags and dashes", () => {
    const spec = parseSpec("Here:\n```json\n" + JSON.stringify({ ...good, hook: "Stop — read this" }) + "\n```");
    expect(spec?.hook).toBe("Stop, read this");
    expect(spec?.hashtags).toEqual(["lashtech", "lashartist", "nyclashes"]);
  });
  it("rejects missing fields, bad JSON, wrong beat counts, overlong lines", () => {
    expect(parseSpec("no json")).toBeNull();
    expect(parseSpec("{not json}")).toBeNull();
    expect(parseSpec("null {}")).toBeNull();
    expect(parseSpec(JSON.stringify({ ...good, hook: undefined }))).toBeNull();
    expect(parseSpec(JSON.stringify({ ...good, beats: "x" }))).toBeNull();
    expect(parseSpec(JSON.stringify({ ...good, beats: ["a", "b"] }))).toBeNull();
    expect(parseSpec(JSON.stringify({ ...good, beats: ["a", "b", 3] }))).toBeNull();
    expect(parseSpec(JSON.stringify({ ...good, hook: "x".repeat(71) }))).toBeNull();
  });
  it("caps hashtags and drops junk ones", () => {
    const spec = parseSpec(JSON.stringify({ ...good, hashtags: ["a", "b", 1, "#", "c", "d", "e", "f"] }));
    expect(spec?.hashtags).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("creativeDirectorJob", () => {
  it("skips when today's post exists", async () => {
    const { ctx, asks } = fakeCtx();
    const { input: i, saved } = input({ draftedToday: true });
    expect(await creativeDirectorJob(i, ctx)).toBe("already wrote today's post");
    expect(asks).toHaveLength(0);
    expect(saved).toHaveLength(0);
  });

  it("writes and saves one post, avoiding recent hooks", async () => {
    const { ctx, asks, nows } = fakeCtx(JSON.stringify(good));
    const { input: i, saved } = input({ dayIndex: 3, recent: [{ audience: "lash", pillar: "how-to", hook: "Old hook" }] });
    const summary = await creativeDirectorJob(i, ctx);
    expect(summary).toBe('wrote a myth post for barber: "Your Instagram is not a booking page"');
    expect(saved).toEqual([{ audience: "barber", pillar: "myth", spec: expect.objectContaining({ hook: good.hook }) }]);
    expect(asks[0].prompt).toContain("- Old hook");
    expect(asks[0].prompt).toContain("independent barbers");
    expect(nows).toEqual(["writing a myth post for barbers"]);
  });

  it("saves nothing when the reply breaks the rules", async () => {
    const { ctx } = fakeCtx("sorry");
    const { input: i, saved } = input();
    expect(await creativeDirectorJob(i, ctx)).toContain("skipped");
    expect(saved).toHaveLength(0);
  });

  it("lets Claude errors through so the run is marked ERROR", async () => {
    const { ctx } = fakeCtx(new Error("boom"));
    await expect(creativeDirectorJob(input().input, ctx)).rejects.toThrow("boom");
  });
});

describe("prompt", () => {
  it("grounds Claude in the real feature list", async () => {
    const { ctx, asks } = fakeCtx(JSON.stringify(good));
    await creativeDirectorJob(input().input, ctx);
    expect(asks[0].system).toContain("ONLY these features");
    expect(asks[0].system).toContain("no tipping");
  });
});

describe("banned claims", () => {
  it.each(["Tipping built in", "Add a tip at checkout", "No app fees", "Get more clients", "Built in minutes"])("rejects %s", (line) => {
    expect(parseSpec(JSON.stringify({ ...good, beats: [...good.beats.slice(0, 3), line] }))).toBeNull();
  });
});
