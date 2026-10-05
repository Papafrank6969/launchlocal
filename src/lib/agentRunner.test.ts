import { describe, it, expect } from "vitest";
import {
  BUSY_TIMEOUT_MS,
  ERROR_MAX_CHARS,
  MAX_TOKENS_PER_CALL,
  runBrother,
  type AgentRow,
  type RunnerDeps,
} from "./agentRunner";
import type { BrotherContext, BrotherDefinition } from "./agentTypes";

const NOW = new Date("2026-10-04T18:00:00Z"); // 2pm ET

type FinishedRun = Parameters<RunnerDeps["finishRun"]>[1] & { runId: string };

function fakeDeps(overrides: { agent?: Partial<AgentRow>; spent?: number; budget?: number; reply?: string } = {}) {
  const calls: Parameters<RunnerDeps["callClaude"]>[0][] = [];
  const finished: FinishedRun[] = [];
  const agentUpdates: Parameters<RunnerDeps["updateAgent"]>[1][] = [];
  const approvals: Parameters<RunnerDeps["createApproval"]>[0][] = [];
  const started: { agentId: string; trigger: string }[] = [];
  let spentSinceArg: Date | null = null;

  const deps: RunnerDeps = {
    now: () => NOW,
    budgetMicros: overrides.budget ?? 1_000_000,
    ensureAgent: async (def) => ({
      id: def.id,
      model: "claude-haiku-4-5",
      status: "IDLE",
      lastRunAt: null,
      ...overrides.agent,
    }),
    spentSince: async (since) => {
      spentSinceArg = since;
      return overrides.spent ?? 0;
    },
    startRun: async (agentId, trigger) => {
      started.push({ agentId, trigger });
      return `run-${started.length}`;
    },
    finishRun: async (runId, data) => {
      finished.push({ runId, ...data });
    },
    updateAgent: async (_id, data) => {
      agentUpdates.push(data);
    },
    createApproval: async (data) => {
      approvals.push(data);
    },
    callClaude: async (input) => {
      calls.push(input);
      // 1000 in + 200 out on Haiku = 1000 + 1000 = 2000 micros
      return { text: overrides.reply ?? "hey", usage: { input_tokens: 1000, output_tokens: 200 } };
    },
  };

  return { deps, calls, finished, agentUpdates, approvals, started, spentSince: () => spentSinceArg };
}

function brother(run: (ctx: BrotherContext) => Promise<string>): BrotherDefinition {
  return { id: "pledge", name: "Pledge", role: "Test brother", run };
}

const oneCall = brother(async (ctx) => {
  await ctx.ask({ system: "s", prompt: "p", maxTokens: 100 });
  return "said hi";
});

describe("runBrother: happy path", () => {
  it("records an OK run with metered tokens and cost", async () => {
    const f = fakeDeps();
    const result = await runBrother(oneCall, "MANUAL", f.deps);

    expect(result).toEqual({ id: "pledge", outcome: "OK", costMicros: 2000, summary: "said hi", error: null });
    expect(f.finished).toEqual([
      {
        runId: "run-1",
        outcome: "OK",
        inputTokens: 1000,
        outputTokens: 200,
        costMicros: 2000,
        summary: "said hi",
        error: null,
      },
    ]);
    expect(f.started).toEqual([{ agentId: "pledge", trigger: "MANUAL" }]);
  });

  it("marks the agent RUNNING at start and IDLE at the end", async () => {
    const f = fakeDeps();
    await runBrother(oneCall, "CRON", f.deps);

    expect(f.agentUpdates[0]).toEqual({ status: "RUNNING", currentTask: null, lastRunAt: NOW });
    expect(f.agentUpdates.at(-1)).toEqual({ status: "IDLE", currentTask: null, lastRunAt: NOW });
  });

  it("passes the agent's model and the brother's prompt to Claude", async () => {
    const f = fakeDeps({ agent: { model: "claude-sonnet-5-5" } });
    await runBrother(oneCall, "MANUAL", f.deps);

    expect(f.calls).toEqual([{ model: "claude-sonnet-5-5", system: "s", prompt: "p", maxTokens: 100 }]);
  });

  it("measures today's spend from midnight New York time", async () => {
    const f = fakeDeps();
    await runBrother(oneCall, "MANUAL", f.deps);

    expect(f.spentSince()?.toISOString()).toBe("2026-10-04T04:00:00.000Z");
  });

  it("returns Claude's text to the brother", async () => {
    const f = fakeDeps({ reply: "what's good" });
    const result = await runBrother(
      brother(async (ctx) => ctx.ask({ system: "s", prompt: "p", maxTokens: 50 })),
      "MANUAL",
      f.deps
    );

    expect(result.summary).toBe("what's good");
  });

  it("files approvals as drafts tied to the run", async () => {
    const f = fakeDeps();
    await runBrother(
      brother(async (ctx) => {
        await ctx.propose({ kind: "DM_DRAFT", title: "DM for Fade Lab", body: "yo", leadId: "lead-1" });
        return "drafted";
      }),
      "MANUAL",
      f.deps
    );

    expect(f.approvals).toEqual([
      { agentId: "pledge", runId: "run-1", kind: "DM_DRAFT", title: "DM for Fade Lab", body: "yo", leadId: "lead-1", siteId: undefined },
    ]);
  });

  it("updates the Now line through setNow", async () => {
    const f = fakeDeps();
    await runBrother(
      brother(async (ctx) => {
        await ctx.setNow("grading Fade Lab");
        return "ok";
      }),
      "MANUAL",
      f.deps
    );

    expect(f.agentUpdates).toContainEqual({ currentTask: "grading Fade Lab" });
  });
});

describe("runBrother: budget", () => {
  it("skips without calling Claude when today's spend is already at the cap", async () => {
    const f = fakeDeps({ spent: 1_000_000 });
    const result = await runBrother(oneCall, "CRON", f.deps);

    expect(result.outcome).toBe("SKIPPED_BUDGET");
    expect(f.calls).toHaveLength(0);
    expect(f.finished[0]).toMatchObject({ outcome: "SKIPPED_BUDGET", costMicros: 0 });
  });

  it("does not mark the agent RUNNING when it skips for budget", async () => {
    const f = fakeDeps({ spent: 1_000_000 });
    await runBrother(oneCall, "CRON", f.deps);

    expect(f.agentUpdates).toEqual([]);
  });

  it("stops mid-run when a call would cross the cap, keeping the cost already spent", async () => {
    // Cap 2000: the first call (0 spent) is allowed and costs 2000; the second
    // sees 2000 spent, which is at the cap, and is refused.
    const f = fakeDeps({ budget: 2000 });
    const twoCalls = brother(async (ctx) => {
      await ctx.ask({ system: "s", prompt: "1", maxTokens: 100 });
      await ctx.ask({ system: "s", prompt: "2", maxTokens: 100 });
      return "never";
    });
    const result = await runBrother(twoCalls, "CRON", f.deps);

    expect(result).toMatchObject({ outcome: "SKIPPED_BUDGET", costMicros: 2000 });
    expect(f.calls).toHaveLength(1);
    expect(f.finished[0]).toMatchObject({ outcome: "SKIPPED_BUDGET", inputTokens: 1000, costMicros: 2000 });
    expect(f.agentUpdates.at(-1)).toEqual({ status: "IDLE", currentTask: null, lastRunAt: NOW });
  });

  it("counts earlier spend today toward the mid-run check", async () => {
    const f = fakeDeps({ spent: 999_000, budget: 1_000_000 });
    const twoCalls = brother(async (ctx) => {
      await ctx.ask({ system: "s", prompt: "1", maxTokens: 100 }); // 999_000 < cap → allowed, now 1_001_000
      await ctx.ask({ system: "s", prompt: "2", maxTokens: 100 }); // refused
      return "never";
    });
    const result = await runBrother(twoCalls, "CRON", f.deps);

    expect(result.outcome).toBe("SKIPPED_BUDGET");
    expect(f.calls).toHaveLength(1);
  });
});

describe("runBrother: busy", () => {
  it("skips when the agent is already running and started recently", async () => {
    const f = fakeDeps({ agent: { status: "RUNNING", lastRunAt: new Date(NOW.getTime() - 60_000) } });
    const result = await runBrother(oneCall, "CRON", f.deps);

    expect(result.outcome).toBe("SKIPPED_BUSY");
    expect(f.calls).toHaveLength(0);
    expect(f.finished[0]).toMatchObject({ outcome: "SKIPPED_BUSY" });
  });

  it("reclaims a RUNNING agent whose run is older than the busy timeout", async () => {
    const f = fakeDeps({ agent: { status: "RUNNING", lastRunAt: new Date(NOW.getTime() - BUSY_TIMEOUT_MS - 1) } });
    const result = await runBrother(oneCall, "CRON", f.deps);

    expect(result.outcome).toBe("OK");
  });

  it("reclaims a RUNNING agent with no lastRunAt", async () => {
    const f = fakeDeps({ agent: { status: "RUNNING", lastRunAt: null } });
    const result = await runBrother(oneCall, "CRON", f.deps);

    expect(result.outcome).toBe("OK");
  });
});

describe("runBrother: errors", () => {
  it("records ERROR and marks the agent ERROR when the brother throws", async () => {
    const f = fakeDeps();
    const result = await runBrother(
      brother(async () => {
        throw new Error("lead not found");
      }),
      "CRON",
      f.deps
    );

    expect(result).toMatchObject({ outcome: "ERROR", error: "lead not found" });
    expect(f.agentUpdates.at(-1)).toEqual({ status: "ERROR", currentTask: null, lastRunAt: NOW });
  });

  it("keeps the cost of calls made before the brother threw", async () => {
    const f = fakeDeps();
    const result = await runBrother(
      brother(async (ctx) => {
        await ctx.ask({ system: "s", prompt: "p", maxTokens: 100 });
        throw new Error("parse failed");
      }),
      "CRON",
      f.deps
    );

    expect(result).toMatchObject({ outcome: "ERROR", costMicros: 2000 });
    expect(f.finished[0]).toMatchObject({ outputTokens: 200, costMicros: 2000 });
  });

  it("truncates long error messages", async () => {
    const f = fakeDeps();
    const result = await runBrother(
      brother(async () => {
        throw new Error("x".repeat(2000));
      }),
      "CRON",
      f.deps
    );

    expect(result.error).toHaveLength(ERROR_MAX_CHARS);
  });

  it("stringifies a non-Error throw", async () => {
    const f = fakeDeps();
    const result = await runBrother(
      brother(async () => {
        throw "plain string";
      }),
      "CRON",
      f.deps
    );

    expect(result.error).toBe("plain string");
  });

  it("rejects an ask above the per-call token limit without calling Claude", async () => {
    const f = fakeDeps();
    const result = await runBrother(
      brother(async (ctx) => ctx.ask({ system: "s", prompt: "p", maxTokens: MAX_TOKENS_PER_CALL + 1 })),
      "CRON",
      f.deps
    );

    expect(result).toMatchObject({ outcome: "ERROR", error: `maxTokens ${MAX_TOKENS_PER_CALL + 1} exceeds ${MAX_TOKENS_PER_CALL}` });
    expect(f.calls).toHaveLength(0);
  });

  it("refuses to call Claude for a model with no known price", async () => {
    const f = fakeDeps({ agent: { model: "claude-mystery-1" } });
    const result = await runBrother(oneCall, "CRON", f.deps);

    expect(result).toMatchObject({ outcome: "ERROR", error: "No price for model claude-mystery-1" });
    expect(f.calls).toHaveLength(0);
  });

  it("never throws, even when bookkeeping itself fails", async () => {
    const f = fakeDeps();
    f.deps.ensureAgent = async () => {
      throw new Error("db down");
    };
    const result = await runBrother(oneCall, "CRON", f.deps);

    expect(result).toEqual({ id: "pledge", outcome: "ERROR", costMicros: 0, summary: null, error: "db down" });
  });
});
