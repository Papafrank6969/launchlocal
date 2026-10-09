import { describe, expect, it } from "vitest";
import { candidates, gamblerJob, parsePicks, recordLine, type GamblerDeps, type Market } from "./gambler";
import { fakeCtx } from "./testCtx";

const now = new Date("2026-10-18T16:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);
const gb: Market = { ticker: "G-GB", event: "G", team: "Green Bay", bid: 0.45, ask: 0.46, gameAt: inHours(10) };
const dal: Market = { ticker: "G-DAL", event: "G", team: "Dallas", bid: 0.53, ask: 0.55, gameAt: inHours(10) };

function deps(over: Partial<GamblerDeps> = {}) {
  const graded: [string, string][] = [];
  const saved: unknown[] = [];
  const d: GamblerDeps = {
    now,
    etHour: 12,
    filedToday: false,
    due: [],
    graded: [],
    markets: async () => [gb, dal],
    settlement: async () => null,
    news: async () => ["Dallas QB questionable: limited in practice"],
    sleep: async () => {},
    grade: async (id, r) => void graded.push([id, r]),
    save: async (p) => void saved.push(...p),
    ...over,
  };
  return { d, graded, saved };
}

describe("candidates", () => {
  it("keeps liquid games settling in the next 36h", () => {
    const wide = { ...gb, ticker: "W", bid: 0.3, ask: 0.6 };
    const later = { ...gb, ticker: "L", gameAt: inHours(40) };
    const over = { ...gb, ticker: "O", gameAt: inHours(-1) };
    const live = { ...gb, ticker: "LV", gameAt: inHours(2) };
    const longshot = { ...gb, ticker: "S", bid: 0.04, ask: 0.05 };
    expect(candidates([gb, wide, later, over, live, longshot], now).map((m) => m.ticker)).toEqual(["G-GB"]);
  });
});

describe("parsePicks", () => {
  it("needs a 5-point edge over the ask, a known ticker, one side per game", () => {
    const reply = JSON.stringify([
      { ticker: "G-GB", prob: 0.53, why: "x" },
      { ticker: "G-DAL", prob: 0.7, why: "same game" },
      { ticker: "NOPE", prob: 0.9 },
    ]);
    expect(parsePicks(reply, [gb, dal]).map((p) => p.ticker)).toEqual(["G-GB"]);
    expect(parsePicks(JSON.stringify([{ ticker: "G-GB", prob: 0.5 }]), [gb])).toEqual([]); // 4 points: fee eats it
    expect(parsePicks("no idea", [gb])).toEqual([]);
  });
});

describe("recordLine", () => {
  it("is profit per $1 a pick, voids ignored", () => {
    expect(recordLine([])).toBe("Record: no graded picks yet");
    // won at 50¢ pays +$1, lost -$1, won at 25¢ pays +$3
    expect(recordLine([{ price: 0.5, result: "won" }, { price: 0.4, result: "lost" }, { price: 0.25, result: "won" }, { price: 0.5, result: "void" }])).toBe(
      "Record: 2-1, +$3.00 betting $1 a pick (before fees)",
    );
    expect(recordLine([{ price: 0.5, result: "lost" }])).toBe("Record: 0-1, -$1.00 betting $1 a pick (before fees)");
  });
});

describe("gamblerJob", () => {
  it("grades settled picks, and waits until late morning to pick", async () => {
    const { ctx, asks } = fakeCtx();
    const { d, graded } = deps({
      etHour: 8,
      due: [{ id: "a", ticker: "A" }, { id: "b", ticker: "B" }, { id: "c", ticker: "C" }],
      settlement: async (t) => (t === "A" ? "yes" : t === "B" ? "void" : null),
    });
    expect(await gamblerJob(d, ctx)).toBe("graded 2");
    expect(graded).toEqual([["a", "won"], ["b", "void"]]);
    expect(asks).toHaveLength(0);
  });

  it("files picks once a day with his record", async () => {
    const { ctx, proposals } = fakeCtx(JSON.stringify([{ ticker: "G-GB", prob: 0.56, why: "Dallas is on a short week." }]));
    const { d, saved } = deps({ graded: [{ price: 0.5, result: "won" }] });
    expect(await gamblerJob(d, ctx)).toBe("picked 1 from 1 games");
    expect(saved).toEqual([{ ticker: "G-GB", title: "Green Bay over Dallas", price: 0.46, prob: 0.56, reason: "Dallas is on a short week.", gameAt: gb.gameAt }]);
    expect(proposals[0].body).toContain('Green Bay to beat Dallas: buy "Green Bay" at 46¢ or less. He says 56%.');
    expect(proposals[0].body).toContain("Record: 1-0");
  });

  it("reads news for each game and passes it to Claude", async () => {
    const queries: string[] = [];
    const { ctx, asks } = fakeCtx("[]");
    const { d } = deps({ markets: async () => [{ ...gb, event: "KXNFLGAME-26OCT18DALGB" }, { ...dal, event: "KXNFLGAME-26OCT18DALGB" }], news: async (q) => (queries.push(q), ["Dallas QB out"]) });
    await gamblerJob(d, ctx);
    expect(queries).toEqual(["NFL Green Bay Dallas injury news"]);
    expect(asks[0].prompt).toContain("Dallas QB out");
  });

  it("files a no-picks note so he doesn't re-ask Claude every tick", async () => {
    const { ctx, proposals } = fakeCtx("[]");
    const { d } = deps();
    expect(await gamblerJob(d, ctx)).toBe("no picks from 1 games");
    expect(proposals[0].title).toBe("No picks today");
    const again = fakeCtx("[]");
    expect(await gamblerJob(deps({ filedToday: true }).d, again.ctx)).toBe("already picked today");
    expect(again.asks).toHaveLength(0);
  });
});
