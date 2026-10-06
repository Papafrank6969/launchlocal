import { db } from "./db";
import { ask } from "./claude";
import { budgetFromEnv } from "./agentBudget";
import type { RunnerDeps } from "./agentRunner";

// Prisma + Anthropic-backed implementation of the runner's I/O. Shared by the
// cron and manual-run routes.
export function prismaRunnerDeps(): RunnerDeps {
  return {
    now: () => new Date(),
    budgetMicros: budgetFromEnv(process.env.AGENT_DAILY_BUDGET_MICROS),
    ensureAgent: (def) =>
      db.agent.upsert({
        where: { id: def.id },
        create: { id: def.id, name: def.name, role: def.role, ...(def.model && { model: def.model }) },
        update: { name: def.name, role: def.role, ...(def.model && { model: def.model }) },
        select: { id: true, model: true, status: true, lastRunAt: true },
      }),
    spentSince: async (since) => {
      const agg = await db.agentRun.aggregate({
        _sum: { costMicros: true },
        where: { startedAt: { gte: since } },
      });
      return agg._sum.costMicros ?? 0;
    },
    startRun: async (agentId, trigger) => (await db.agentRun.create({ data: { agentId, trigger } })).id,
    finishRun: async (runId, data) => {
      await db.agentRun.update({ where: { id: runId }, data: { ...data, finishedAt: new Date() } });
    },
    updateAgent: async (agentId, data) => {
      await db.agent.update({ where: { id: agentId }, data });
    },
    createApproval: async (data) => {
      await db.approval.create({ data });
    },
    callClaude: ask,
  };
}
