import { db } from "../db";
import { budgetFromEnv, startOfDayET } from "../agentBudget";
import type { ApprovalKind } from "../agentTypes";
import type { ScoutInput } from "./scout";
import type { RushChairInput } from "./rushChair";
import type { FollowUpInput } from "./followUp";
import type { BuilderLead } from "./builder";
import type { TreasurerInput } from "./treasurer";
import { HUNTER_RETRY_DAYS, type HunterDeps } from "./handleHunter";
import { lookupInstagramHandle } from "../instagramLookup";
import type { CreativeDirectorInput } from "./creativeDirector";
import type { PosterDeps } from "./poster";
import type { BossInput } from "./boss";
import { LEAGUES, type GamblerDeps, type Market } from "./gambler";

// The only DB access brothers have. Reads only, except Handle Hunter's handle
// write and attempt log (plan §9) and Creative Director's SocialPost insert. Everything else writes through ctx.propose().

const SITES = { select: { id: true, slug: true, status: true } } as const;
const previewBase = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

async function pendingLeadIds(kind: ApprovalKind): Promise<Set<string>> {
  const rows = await db.approval.findMany({ where: { kind, state: "PENDING", leadId: { not: null } }, select: { leadId: true } });
  return new Set(rows.map((r) => r.leadId!));
}

async function filedNoteToday(agentId: string, now: Date): Promise<boolean> {
  return (await db.approval.count({ where: { agentId, kind: "NOTE", createdAt: { gte: startOfDayET(now) } } })) > 0;
}

export async function loadScoutInput(now = new Date()): Promise<ScoutInput> {
  const leads = await db.lead.findMany({
    where: { outreachStatus: "NEW", websiteStatus: { not: "HAS_SITE" } },
    include: { sites: SITES },
  });
  return {
    filedToday: await filedNoteToday("scout", now),
    leads: leads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}

export async function loadRushChairInput(): Promise<RushChairInput> {
  // Same query as /api/leads/outreach-queue.
  const [leads, drafted] = await Promise.all([
    db.lead.findMany({
      where: { outreachStatus: "NEW", websiteStatus: { not: "HAS_SITE" }, NOT: { instagramHandle: null } },
      include: { sites: SITES },
    }),
    pendingLeadIds("DM_DRAFT"),
  ]);
  return {
    pendingDrafts: drafted.size,
    previewBase: previewBase(),
    leads: leads.filter((l) => !drafted.has(l.id)).map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}

export async function loadFollowUpInput(now = new Date()): Promise<FollowUpInput> {
  // Same query as /api/leads/follow-up-queue.
  const [leads, drafted] = await Promise.all([
    db.lead.findMany({
      where: { outreachStatus: "CONTACTED", NOT: { instagramHandle: null }, followUpAt: { not: null, lte: now } },
      include: { sites: SITES },
    }),
    pendingLeadIds("FOLLOW_UP_DRAFT"),
  ]);
  return {
    now,
    pendingDrafts: drafted.size,
    previewBase: previewBase(),
    leads: leads.filter((l) => !drafted.has(l.id)).map((l) => ({ ...l, followUpAt: l.followUpAt?.toISOString() ?? null })),
  };
}

export async function loadBuilderInput(): Promise<{ leads: BuilderLead[] }> {
  const [leads, proposed] = await Promise.all([
    db.lead.findMany({ where: { outreachStatus: "RESPONDED", sites: { none: {} } }, orderBy: { createdAt: "asc" } }),
    pendingLeadIds("SITE_DRAFT"),
  ]);
  return { leads: leads.filter((l) => !proposed.has(l.id)) };
}

export async function loadTreasurerInput(now = new Date()): Promise<TreasurerInput> {
  const today = startOfDayET(now);
  const yesterday = startOfDayET(new Date(today.getTime() - 1));
  const range = { gte: yesterday, lt: today };
  const [runs, events, pending, filedToday] = await Promise.all([
    db.agentRun.findMany({ where: { startedAt: range }, select: { agentId: true, outcome: true, costMicros: true } }),
    db.event.findMany({ where: { createdAt: range }, select: { type: true } }),
    db.approval.groupBy({ by: ["kind"], where: { state: "PENDING" }, _count: true }),
    filedNoteToday("treasurer", now),
  ]);
  return {
    dayLabel: yesterday.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }),
    filedToday,
    budgetMicros: budgetFromEnv(process.env.AGENT_DAILY_BUDGET_MICROS),
    runs,
    events,
    pending: pending.map((p) => ({ kind: p.kind, count: p._count })),
  };
}

const LOOKUP_KIND = "instagram_lookup";

export async function loadHandleHunterDeps(now = new Date()): Promise<HunterDeps> {
  const since = new Date(now.getTime() - HUNTER_RETRY_DAYS * 24 * 60 * 60 * 1000);
  const [leads, tried, doneToday] = await Promise.all([
    db.lead.findMany({
      where: { outreachStatus: "NEW", websiteStatus: { not: "HAS_SITE" }, instagramHandle: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, city: true },
    }),
    db.agentTask.findMany({ where: { kind: LOOKUP_KIND, createdAt: { gte: since } }, select: { leadId: true } }),
    db.agentTask.count({ where: { kind: LOOKUP_KIND, createdAt: { gte: startOfDayET(now) } } }),
  ]);
  const triedIds = new Set(tried.map((t) => t.leadId));
  return {
    leads: leads.filter((l) => !triedIds.has(l.id)),
    doneToday,
    lookup: lookupInstagramHandle,
    // Only fills an empty handle: never overwrites one Frank typed in.
    saveHandle: async (leadId, handle) => {
      await db.lead.updateMany({ where: { id: leadId, instagramHandle: null }, data: { instagramHandle: handle } });
    },
    recordAttempt: async (leadId, found) => {
      await db.agentTask.create({
        data: { agentId: "handle-hunter", kind: LOOKUP_KIND, leadId, status: found ? "DONE" : "FAILED", doneAt: new Date() },
      });
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

export async function loadCreativeDirectorInput(now = new Date()): Promise<CreativeDirectorInput> {
  const dayStart = startOfDayET(now);
  const recent = await db.socialPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 14,
    select: { audience: true, pillar: true, hook: true, createdAt: true },
  });
  return {
    draftedToday: recent.some((p) => p.createdAt >= dayStart),
    dayIndex: Math.round(dayStart.getTime() / 86_400_000),
    recent,
    save: async ({ audience, pillar, spec }) => {
      await db.socialPost.create({ data: { audience, pillar, hook: spec.hook, caption: spec.caption, spec } });
    },
  };
}

export async function loadPosterDeps(): Promise<PosterDeps> {
  const next = await db.socialPost.findFirst({
    where: { status: "RENDERED", videoUrl: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, caption: true, spec: true, videoUrl: true },
  });
  return {
    apiKey: process.env.ZERNIO_API_KEY,
    instagramAccountId: process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID,
    tiktokAccountId: process.env.ZERNIO_TIKTOK_ACCOUNT_ID,
    next: next && {
      id: next.id,
      caption: next.caption,
      hashtags: (next.spec as { hashtags?: string[] }).hashtags ?? [],
      videoUrl: next.videoUrl!,
    },
    fetch,
    markPosted: async (id) => {
      await db.socialPost.updateMany({ where: { id, status: "RENDERED" }, data: { status: "POSTED", postedAt: new Date(), error: null } });
    },
    markFailed: async (id, error) => {
      await db.socialPost.updateMany({ where: { id, status: "RENDERED" }, data: { status: "FAILED", error } });
    },
  };
}

const BOSS_STATE = "boss";

export async function loadBossInput(now = new Date()): Promise<BossInput> {
  const dayStart = startOfDayET(now);
  const [agents, lastRuns, pending, posts, spent, state, lastNote, firstPost] = await Promise.all([
    db.agent.findMany({ where: { id: { not: "boss" } }, select: { id: true, enabled: true }, orderBy: { id: "asc" } }),
    db.agentRun.findMany({
      where: { agentId: { not: "boss" }, trigger: { not: "CHAT" }, finishedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      distinct: ["agentId"],
      select: { agentId: true, outcome: true, summary: true, error: true },
    }),
    // Notes aren't blockers, and counting them made his own notes change what he sees.
    db.approval.groupBy({ by: ["kind"], where: { state: "PENDING", kind: { not: "NOTE" } }, _count: true, orderBy: { kind: "asc" } }),
    db.socialPost.groupBy({ by: ["status"], where: { createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }, _count: true, orderBy: { status: "asc" } }),
    db.agentRun.aggregate({ _sum: { costMicros: true }, where: { startedAt: { gte: dayStart } } }),
    db.cronState.findUnique({ where: { id: BOSS_STATE } }),
    db.approval.findFirst({ where: { agentId: "boss" }, orderBy: { createdAt: "desc" }, select: { body: true } }),
    db.socialPost.findFirst({ where: { status: "POSTED" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const budget = budgetFromEnv(process.env.AGENT_DAILY_BUDGET_MICROS);
  const runOf = (id: string) => lastRuns.find((r) => r.agentId === id);
  // No timestamps or spend amounts: the snapshot only changes when something happens.
  const snapshot = [
    `Day (ET): ${dayStart.toLocaleDateString("en-US", { timeZone: "America/New_York" })}`,
    `Budget: ${(spent._sum.costMicros ?? 0) >= budget * 0.8 ? "80%+ used today" : "fine"}`,
    "Brothers:",
    ...agents.map((a) => {
      const r = runOf(a.id);
      return `- ${a.id} (${a.enabled ? "on" : "off"}): ${r ? `${r.outcome} ${r.summary ?? ""}${r.error ? ` error: ${r.error}` : ""}` : "never ran"}`;
    }),
    `Waiting on Frank: ${pending.map((p) => `${p._count} ${p.kind}`).join(", ") || "nothing"}`,
    `Villa posts, last 7 days: ${posts.map((p) => `${p._count} ${p.status}`).join(", ") || "none"}${firstPost ? ` (first ever post ${firstPost.createdAt.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })})` : ""}`,
  ].join("\n");
  return {
    snapshot,
    lastSnapshot: state?.lastRunNote ?? null,
    lastNote: lastNote?.body ?? null,
    brotherIds: agents.map((a) => a.id),
    saveSnapshot: async (text) => {
      await db.cronState.upsert({
        where: { id: BOSS_STATE },
        create: { id: BOSS_STATE, lastRunAt: now, lastRunNote: text },
        update: { lastRunAt: now, lastRunNote: text },
      });
    },
    disable: async (id) => {
      await db.agent.update({ where: { id }, data: { enabled: false } });
    },
  };
}

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

async function kalshi(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${KALSHI}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Kalshi ${path.split("?")[0]}: HTTP ${res.status}`);
  return res.json();
}

type KalshiMarket = { ticker: string; event_ticker: string; yes_sub_title: string; yes_bid_dollars: string; yes_ask_dollars: string; expected_expiration_time: string; status: string; result: string };

export async function loadGamblerDeps(now = new Date()): Promise<GamblerDeps> {
  const [due, graded, filedToday] = await Promise.all([
    db.betPick.findMany({ where: { result: null, gameAt: { lte: now } }, select: { id: true, ticker: true } }),
    db.betPick.findMany({ where: { result: { not: null } }, select: { price: true, result: true } }),
    filedNoteToday("gambler", now),
  ]);
  const etHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(now));
  return {
    now,
    etHour,
    filedToday,
    due,
    graded: graded.map((g) => ({ price: g.price, result: g.result! })),
    markets: async () => {
      const pages = await Promise.all(Object.keys(LEAGUES).map((s) => kalshi(`/markets?series_ticker=${s}&status=open&limit=1000`)));
      return pages.flatMap((p) =>
        (p.markets as KalshiMarket[]).map(
          (m): Market => ({
            ticker: m.ticker,
            event: m.event_ticker,
            team: m.yes_sub_title,
            bid: Number(m.yes_bid_dollars),
            ask: Number(m.yes_ask_dollars),
            gameAt: new Date(m.expected_expiration_time),
          }),
        ),
      );
    },
    settlement: async (ticker) => {
      const m = (await kalshi(`/markets/${encodeURIComponent(ticker)}`)).market as KalshiMarket;
      if (m.status !== "finalized" && m.status !== "settled") return null;
      return m.result === "yes" || m.result === "no" ? m.result : "void";
    },
    news: braveNews,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    grade: async (id, result) => {
      await db.betPick.update({ where: { id }, data: { result, gradedAt: new Date() } });
    },
    save: async (picks) => {
      await db.betPick.createMany({ data: picks });
    },
  };
}

const stripTags = (t: string) => t.replace(/<[^>]+>/g, "").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** Top 3 news results from the past day. The key stays in a header. */
async function braveNews(query: string): Promise<string[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query)}&count=3&freshness=pd`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: { title?: string; description?: string; age?: string }[] };
    return (body.results ?? []).slice(0, 3).map((r) => stripTags(`${r.title ?? ""}: ${r.description ?? ""}${r.age ? ` (${r.age})` : ""}`).slice(0, 300));
  } catch {
    return [];
  }
}
