import { db } from "../db";
import { budgetFromEnv, startOfDayET } from "../agentBudget";
import type { ApprovalKind } from "../agentTypes";
import type { ScoutInput } from "./scout";
import type { RushChairInput } from "./rushChair";
import type { FollowUpInput } from "./followUp";
import type { BuilderLead } from "./builder";
import type { TreasurerInput } from "./treasurer";

// The only DB access brothers have, and it's reads only. Writes go through ctx.propose().

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
