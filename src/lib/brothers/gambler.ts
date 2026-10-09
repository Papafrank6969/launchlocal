import type { BrotherContext } from "../agentTypes";
import { scrubDraft } from "./draftText";

// The Gambler (Frank's call, 2026-10-08): sports picks Frank places by hand on
// Robinhood, which has no official API for its prediction markets. Prices come
// from Kalshi's public market data (CFTC event contracts, no account needed).
// Every pick is graded from Kalshi's settlement, so the paper record shows
// whether he's worth listening to. He never places a bet.

export const LEAGUES = ["KXNFLGAME", "KXNBAGAME", "KXMLBGAME", "KXNHLGAME", "KXNCAAFGAME"];
export const MAX_PICKS = 3;
/** Robinhood's fee is 5-10% of the payout odds; a thinner edge loses money. */
export const MIN_EDGE = 0.05;
export const MAX_SPREAD = 0.04;
export const LOOKAHEAD_MS = 36 * 60 * 60 * 1000;
// ponytail: Kalshi gives the expected settle time, not kickoff (~3h earlier), so
// anything settling within 3.5h has likely started. Use occurrence times if a
// live game ever slips through.
export const MIN_LEAD_MS = 3.5 * 60 * 60 * 1000;
/** Lines are sharper by late morning; picking at midnight uses stale prices. */
export const PICK_HOUR_ET = 11;

export type Market = { ticker: string; event: string; team: string; bid: number; ask: number; gameAt: Date };
export type NewPick = { ticker: string; title: string; price: number; prob: number; reason: string; gameAt: Date };
export type Result = "won" | "lost" | "void";

export type GamblerDeps = {
  now: Date;
  etHour: number;
  /** Already filed today's note (picks or "no picks"). */
  filedToday: boolean;
  /** Ungraded picks whose game should be over. */
  due: { id: string; ticker: string }[];
  /** Every graded pick, for the record. */
  graded: { price: number; result: string }[];
  markets(): Promise<Market[]>;
  /** Kalshi's settlement: "yes"/"no", "void" if the market settled without a side, null if not yet. */
  settlement(ticker: string): Promise<"yes" | "no" | "void" | null>;
  grade(id: string, result: Result): Promise<void>;
  save(picks: NewPick[]): Promise<void>;
};

const SYSTEM = `You pick sports bets for Frank, who places them by hand on Robinhood's prediction markets. Each market pays $1 if the team wins; the price is what one contract costs, so a 46 cent price means the market gives that team about a 46% chance.
Only pick a team when you have a concrete reason the market is wrong by at least ${Math.round(MIN_EDGE * 100)} percentage points: Robinhood takes a fee, so a smaller edge loses money. You don't have today's injury news or lineups, so be humble: the market usually knows more than you. Zero picks is the right answer on most days. At most ${MAX_PICKS} picks, at most one per game.
Reply with only a JSON array: [{"ticker": "<market ticker>", "prob": <your win probability, 0-1>, "why": "<one short sentence, no em dashes>"}], or [] for no picks.`;

/** Profit per $1 staked, before Robinhood's fee. Voids don't count. */
export function recordLine(graded: { price: number; result: string }[]): string {
  const settled = graded.filter((g) => g.result === "won" || g.result === "lost");
  if (settled.length === 0) return "Record: no graded picks yet";
  const wins = settled.filter((g) => g.result === "won");
  const profit = settled.reduce((sum, g) => sum + (g.result === "won" ? 1 / g.price - 1 : -1), 0);
  return `Record: ${wins.length}-${settled.length - wins.length}, ${profit >= 0 ? "+" : "-"}$${Math.abs(profit).toFixed(2)} betting $1 a pick (before fees)`;
}

/** Liquid team-wins markets for games not yet started, settling in the next 36 hours. */
export function candidates(markets: Market[], now: Date): Market[] {
  const until = now.getTime() + LOOKAHEAD_MS;
  const from = now.getTime() + MIN_LEAD_MS;
  return markets.filter(
    (m) => m.gameAt.getTime() > from && m.gameAt.getTime() <= until && m.ask - m.bid <= MAX_SPREAD && m.ask >= 0.1 && m.ask <= 0.9,
  );
}

/** Code-enforced: known ticker, sane probability, edge over the ask, one per game. */
export function parsePicks(reply: string, pool: Market[]): (Market & { prob: number; why: string })[] {
  let rows: unknown;
  try {
    rows = JSON.parse(reply.slice(reply.indexOf("["), reply.lastIndexOf("]") + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const out: (Market & { prob: number; why: string })[] = [];
  for (const row of rows) {
    const { ticker, prob, why } = (row ?? {}) as Record<string, unknown>;
    const m = pool.find((p) => p.ticker === ticker);
    if (!m || typeof prob !== "number" || prob <= 0 || prob >= 1 || prob - m.ask < MIN_EDGE) continue;
    if (out.some((o) => o.event === m.event)) continue;
    out.push({ ...m, prob, why: typeof why === "string" ? scrubDraft(why).slice(0, 200) : "" });
    if (out.length === MAX_PICKS) break;
  }
  return out;
}

const cents = (p: number) => `${Math.round(p * 100)}¢`;

export async function gamblerJob(deps: GamblerDeps, ctx: BrotherContext): Promise<string> {
  let gradedNow = 0;
  for (const pick of deps.due) {
    const s = await deps.settlement(pick.ticker);
    if (!s) continue;
    await deps.grade(pick.id, s === "yes" ? "won" : s === "no" ? "lost" : "void");
    gradedNow++;
  }
  const graded = gradedNow ? `graded ${gradedNow}` : null;
  if (deps.filedToday) return graded ?? "already picked today";
  if (deps.etHour < PICK_HOUR_ET) return graded ?? `picks after ${PICK_HOUR_ET}am ET`;

  await ctx.setNow("reading the lines");
  const all = await deps.markets();
  const pool = candidates(all, deps.now);
  if (pool.length === 0) return [graded, "no liquid games in the next 36 hours"].filter(Boolean).join(", ");

  const opponent = (m: Market) => all.find((o) => o.event === m.event && o.ticker !== m.ticker)?.team ?? "?";
  const games = [...new Set(pool.map((m) => m.event))].map((event) => ({
    game: event,
    sides: pool.filter((m) => m.event === event).map((m) => ({ ticker: m.ticker, team: m.team, price: m.ask })),
  }));
  const reply = await ctx.ask({
    system: SYSTEM,
    prompt: `Today is ${deps.now.toDateString()}. Games settling in the next 36 hours (price = cost of one $1 contract):\n${JSON.stringify(games)}`,
    maxTokens: 800,
  });
  const picks = parsePicks(reply, pool);
  await deps.save(
    picks.map((p) => ({ ticker: p.ticker, title: `${p.team} over ${opponent(p)}`, price: p.ask, prob: p.prob, reason: p.why, gameAt: p.gameAt })),
  );

  const lines = picks.length
    ? picks.map((p, i) => `${i + 1}. ${p.team} to beat ${opponent(p)}: buy "${p.team}" at ${cents(p.ask)} or less. He says ${Math.round(p.prob * 100)}%. ${p.why}`)
    : ["No picks today: nothing priced far enough off to beat the fee."];
  await ctx.propose({
    kind: "NOTE",
    title: picks.length ? `Today's picks (${picks.length})` : "No picks today",
    body: [...lines, "", "Kalshi prices; check Robinhood's price before you bet. Paper picks, not advice.", recordLine(deps.graded)].join("\n"),
  });
  return [graded, picks.length ? `picked ${picks.length} of ${pool.length} sides` : `no picks from ${pool.length} sides`].filter(Boolean).join(", ");
}
