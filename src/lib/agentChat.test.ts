import { describe, it, expect } from "vitest";
import { buildChatPrompt, chatMessageError, chatTranscript, chatTurn, CHAT_HISTORY, CHAT_MAX_CHARS, type ChatDeps, type ChatMessage } from "./agentChat";
import type { BrotherDefinition } from "./agentTypes";

const NOW = new Date("2026-10-04T18:00:00Z");
const def: BrotherDefinition = { id: "pledge", name: "Pledge", role: "says hi", run: async () => "" };

function fakeDeps(o: { spent?: number; budget?: number; fail?: Error } = {}) {
  const calls: Parameters<ChatDeps["callClaude"]>[0][] = [];
  const started: string[] = [];
  const finished: Parameters<ChatDeps["finishRun"]>[1][] = [];
  const saved: [string, string][] = [];
  const deps: ChatDeps = {
    now: () => NOW,
    budgetMicros: o.budget ?? 1_000_000,
    ensureAgent: async (d) => ({ id: d.id, model: "claude-haiku-4-5", status: "IDLE", lastRunAt: null }),
    spentSince: async () => o.spent ?? 0,
    loadContext: async () => ({
      runs: [{ outcome: "OK", summary: "said: hi house" }],
      drafts: ["Pledge says hi"],
      history: [{ role: "user", content: "yo" }, { role: "assistant", content: "sup" }],
    }),
    startRun: async (_id, trigger) => {
      started.push(trigger);
      return "run-1";
    },
    finishRun: async (_id, data) => {
      finished.push(data);
    },
    callClaude: async (input) => {
      calls.push(input);
      if (o.fail) throw o.fail;
      return { text: "I said hi today", usage: { input_tokens: 1000, output_tokens: 200 } };
    },
    saveMessages: async (_id, user, reply) => {
      saved.push([user, reply]);
    },
  };
  return { deps, calls, started, finished, saved };
}

describe("chatMessageError", () => {
  it("rejects empty, whitespace, non-string and over-length messages", () => {
    expect(chatMessageError("")).toBeTruthy();
    expect(chatMessageError("   ")).toBeTruthy();
    expect(chatMessageError(42)).toBeTruthy();
    expect(chatMessageError("x".repeat(CHAT_MAX_CHARS + 1))).toBeTruthy();
  });
  it("accepts a message at the limit", () => {
    expect(chatMessageError("x".repeat(CHAT_MAX_CHARS))).toBeNull();
  });
});

describe("buildChatPrompt", () => {
  it("includes name, role, run summaries, draft titles and the no-send rule", () => {
    const p = buildChatPrompt(def, { runs: [{ outcome: "OK", summary: "said: hi" }], drafts: ["Pledge says hi"] });
    for (const s of ["Pledge", "says hi", "said: hi", "Pledge says hi", "can't send"]) expect(p).toContain(s);
  });
  it("keeps only the last 5 runs and handles none", () => {
    const runs = Array.from({ length: 7 }, (_, i) => ({ outcome: "OK", summary: `run ${i}` }));
    const p = buildChatPrompt(def, { runs, drafts: [] });
    expect(p).toContain("run 4");
    expect(p).not.toContain("run 5");
    expect(buildChatPrompt(def, { runs: [], drafts: [] })).toContain("none yet");
  });
});

describe("chatTranscript", () => {
  it(`caps history at ${CHAT_HISTORY} and ends with the new message`, () => {
    const history: ChatMessage[] = Array.from({ length: 25 }, (_, i) => ({ role: "user", content: `m${i}` }));
    const t = chatTranscript(history, "latest");
    expect(t).not.toContain("m4\n");
    expect(t).toContain("m5");
    expect(t).toContain("Frank: latest");
  });
});

describe("chatTurn", () => {
  it("replies, meters cost under trigger CHAT, and saves both messages", async () => {
    const f = fakeDeps();
    const r = await chatTurn(def, " what did you do today? ", f.deps);
    expect(r).toEqual({ ok: true, reply: "I said hi today", costMicros: 2000 });
    expect(f.started).toEqual(["CHAT"]);
    expect(f.finished[0]).toMatchObject({ outcome: "OK", costMicros: 2000, inputTokens: 1000, outputTokens: 200 });
    expect(f.saved).toEqual([["what did you do today?", "I said hi today"]]);
    expect(f.calls[0].maxTokens).toBe(400);
    expect(f.calls[0].system).toContain("said: hi house");
    expect(f.calls[0].prompt).toContain("Frank: yo");
  });

  it("rejects a bad message with 400 and makes no call", async () => {
    const f = fakeDeps();
    expect(await chatTurn(def, "x".repeat(1001), f.deps)).toMatchObject({ ok: false, status: 400 });
    expect(f.calls).toHaveLength(0);
    expect(f.started).toHaveLength(0);
  });

  it("over budget → 429, no Claude call, no run", async () => {
    const f = fakeDeps({ spent: 1_000_000 });
    expect(await chatTurn(def, "hi", f.deps)).toEqual({ ok: false, status: 429, error: "Daily budget reached" });
    expect(f.calls).toHaveLength(0);
    expect(f.started).toHaveLength(0);
  });

  it("a Claude failure records an ERROR run and saves nothing", async () => {
    const f = fakeDeps({ fail: new Error("boom") });
    expect(await chatTurn(def, "hi", f.deps)).toEqual({ ok: false, status: 500, error: "boom" });
    expect(f.finished[0]).toMatchObject({ outcome: "ERROR", error: "boom" });
    expect(f.saved).toHaveLength(0);
  });
});
