import { canSpend, startOfDayET } from "./agentBudget";
import { costMicros, type Usage } from "./agentCost";
import type { AgentStatus, ApprovalKind, BrotherContext, BrotherDefinition, RunOutcome, RunTrigger } from "./agentTypes";

export const MAX_TOKENS_PER_CALL = 2000;
export const BUSY_TIMEOUT_MS = 10 * 60 * 1000;
export const ERROR_MAX_CHARS = 500;

export class BudgetExceededError extends Error {}

export type AgentRow = { id: string; model: string; status: AgentStatus; lastRunAt: Date | null };

export type RunResult = {
  id: string;
  outcome: RunOutcome;
  costMicros: number;
  summary: string | null;
  error: string | null;
};

// All I/O is injected so the orchestration is testable without a DB or network.
export type RunnerDeps = {
  now(): Date;
  budgetMicros: number;
  ensureAgent(def: BrotherDefinition): Promise<AgentRow>;
  spentSince(since: Date): Promise<number>;
  startRun(agentId: string, trigger: RunTrigger): Promise<string>;
  finishRun(
    runId: string,
    data: {
      outcome: RunOutcome;
      inputTokens: number;
      outputTokens: number;
      costMicros: number;
      summary: string | null;
      error: string | null;
    }
  ): Promise<void>;
  updateAgent(agentId: string, data: { status?: AgentStatus; currentTask?: string | null; lastRunAt?: Date }): Promise<void>;
  createApproval(data: {
    agentId: string;
    runId: string;
    kind: ApprovalKind;
    title: string;
    body: string;
    leadId?: string;
    siteId?: string;
  }): Promise<void>;
  callClaude(input: { model: string; system: string; prompt: string; maxTokens: number }): Promise<{ text: string; usage: Usage }>;
};

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, ERROR_MAX_CHARS);
}

/** Runs one brother: busy check → budget check → work → record. Never throws. */
export async function runBrother(def: BrotherDefinition, trigger: RunTrigger, deps: RunnerDeps): Promise<RunResult> {
  try {
    return await run(def, trigger, deps);
  } catch (err) {
    return { id: def.id, outcome: "ERROR", costMicros: 0, summary: null, error: errorText(err) };
  }
}

async function run(def: BrotherDefinition, trigger: RunTrigger, deps: RunnerDeps): Promise<RunResult> {
  const agent = await deps.ensureAgent(def);
  const now = deps.now();

  const skip = async (outcome: "SKIPPED_BUSY" | "SKIPPED_BUDGET"): Promise<RunResult> => {
    const runId = await deps.startRun(def.id, trigger);
    await deps.finishRun(runId, { outcome, inputTokens: 0, outputTokens: 0, costMicros: 0, summary: null, error: null });
    return { id: def.id, outcome, costMicros: 0, summary: null, error: null };
  };

  const recentlyStarted = agent.lastRunAt !== null && now.getTime() - agent.lastRunAt.getTime() <= BUSY_TIMEOUT_MS;
  if (agent.status === "RUNNING" && recentlyStarted) return skip("SKIPPED_BUSY");

  const spentToday = await deps.spentSince(startOfDayET(now));
  if (!canSpend(spentToday, deps.budgetMicros)) return skip("SKIPPED_BUDGET");

  const runId = await deps.startRun(def.id, trigger);
  await deps.updateAgent(def.id, { status: "RUNNING", currentTask: null, lastRunAt: now });

  const totals = { inputTokens: 0, outputTokens: 0, costMicros: 0 };

  const ctx: BrotherContext = {
    async ask({ system, prompt, maxTokens }) {
      if (maxTokens > MAX_TOKENS_PER_CALL) {
        throw new Error(`maxTokens ${maxTokens} exceeds ${MAX_TOKENS_PER_CALL}`);
      }
      costMicros(agent.model, { input_tokens: 0, output_tokens: 0 }); // unknown model → throws before spending
      if (!canSpend(spentToday + totals.costMicros, deps.budgetMicros)) {
        throw new BudgetExceededError("daily budget reached");
      }
      const res = await deps.callClaude({ model: agent.model, system, prompt, maxTokens });
      totals.inputTokens += res.usage.input_tokens;
      totals.outputTokens += res.usage.output_tokens;
      totals.costMicros += costMicros(agent.model, res.usage);
      return res.text;
    },
    async propose(input) {
      await deps.createApproval({ agentId: def.id, runId, ...input });
    },
    async setNow(text) {
      await deps.updateAgent(def.id, { currentTask: text });
    },
  };

  let outcome: RunOutcome;
  let summary: string | null = null;
  let error: string | null = null;
  try {
    summary = await def.run(ctx);
    outcome = "OK";
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      outcome = "SKIPPED_BUDGET";
    } else {
      outcome = "ERROR";
      error = errorText(err);
    }
  }

  await deps.finishRun(runId, { outcome, ...totals, summary, error });
  await deps.updateAgent(def.id, {
    status: outcome === "ERROR" ? "ERROR" : "IDLE",
    currentTask: null,
    lastRunAt: deps.now(),
  });

  return { id: def.id, outcome, costMicros: totals.costMicros, summary, error };
}
