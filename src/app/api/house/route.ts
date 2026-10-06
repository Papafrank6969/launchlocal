import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { budgetFromEnv } from "@/lib/agentBudget";
import { BROTHERS, inVilla } from "@/lib/brothers";
import { houseWindows, mergeAgents } from "@/lib/houseStats";

export const dynamic = "force-dynamic";

// Behind the operator password (src/proxy.ts). Polled by /house and /villa
// (?house=villa) every 15s. Spend is shared: one budget across both houses.
export async function GET(req: NextRequest) {
  const villa = req.nextUrl.searchParams.get("house") === "villa";
  const { since7d, dayStart } = houseWindows(new Date());

  const [backlog, dmsSent7d, replies7d, sitesPublished, draftsWaiting, spent, rows, lastRuns, queued, pending, posts] = await Promise.all([
    db.lead.count({ where: { outreachStatus: "NEW", sites: { none: {} } } }),
    db.event.count({ where: { type: "LEAD_CONTACTED", createdAt: { gte: since7d } } }),
    db.event.count({ where: { type: "LEAD_RESPONDED", createdAt: { gte: since7d } } }),
    db.site.count({ where: { status: "PUBLISHED" } }),
    db.approval.count({ where: { state: "PENDING" } }),
    db.agentRun.aggregate({ _sum: { costMicros: true }, where: { startedAt: { gte: dayStart } } }),
    db.agent.findMany({ select: { id: true, name: true, role: true, status: true, enabled: true, currentTask: true } }),
    db.agentRun.findMany({
      where: { trigger: { not: "CHAT" }, finishedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      distinct: ["agentId"],
      select: { agentId: true, outcome: true, summary: true, costMicros: true, finishedAt: true },
    }),
    db.agentTask.groupBy({ by: ["agentId"], where: { status: "QUEUED" }, _count: true }),
    db.approval.groupBy({ by: ["agentId"], where: { state: "PENDING" }, _count: true }),
    db.socialPost.groupBy({ by: ["status"], where: { createdAt: { gte: since7d } }, _count: true }),
  ]);

  const agents = mergeAgents(BROTHERS, rows).filter((a) => inVilla(a.id) === villa).map((a) => {
    const run = lastRuns.find((r) => r.agentId === a.id);
    return {
      ...a,
      lastRun: run
        ? { outcome: run.outcome ?? "RUNNING", summary: run.summary, costMicros: run.costMicros, finishedAt: run.finishedAt?.toISOString() ?? null }
        : null,
      queued: queued.find((q) => q.agentId === a.id)?._count ?? 0,
      pending: pending.find((p) => p.agentId === a.id)?._count ?? 0,
    };
  });

  return NextResponse.json({
    stats: {
      backlog,
      dmsSent7d,
      replies7d,
      sitesPublished,
      draftsWaiting,
      spentTodayMicros: spent._sum.costMicros ?? 0,
      budgetMicros: budgetFromEnv(process.env.AGENT_DAILY_BUDGET_MICROS),
    },
    posts7d: Object.fromEntries(posts.map((p) => [p.status, p._count])),
    recentPosts: villa
      ? await db.socialPost.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, status: true, audience: true, pillar: true, hook: true, caption: true, spec: true, videoUrl: true, createdAt: true },
        })
      : [],
    agents,
  });
}

export type HouseResponse = {
  stats: {
    backlog: number;
    dmsSent7d: number;
    replies7d: number;
    sitesPublished: number;
    draftsWaiting: number;
    spentTodayMicros: number;
    budgetMicros: number;
  };
  posts7d: Partial<Record<"DRAFTED" | "RENDERED" | "POSTED" | "FAILED", number>>;
  recentPosts: {
    id: string;
    status: "DRAFTED" | "RENDERED" | "POSTED" | "FAILED";
    audience: string;
    pillar: string;
    hook: string;
    caption: string;
    spec: { beats?: string[]; hashtags?: string[] };
    videoUrl: string | null;
    createdAt: string;
  }[];
  agents: {
    id: string;
    name: string;
    role: string;
    status: "IDLE" | "RUNNING" | "ERROR" | "OFF";
    currentTask: string | null;
    lastRun: { outcome: string; summary: string | null; costMicros: number; finishedAt: string | null } | null;
    queued: number;
    pending: number;
  }[];
};
