import { canSpend, startOfDayET } from "./agentBudget";
import { BudgetExceededError, createMeter, errorText, type RunnerDeps } from "./agentRunner";
import type { BrotherDefinition } from "./agentTypes";

// One chat turn with a brother (docs/FRAT-HOUSE-UI-PLAN.md §4 "Chat"). Same
// budget gate and metering as runBrother; recorded as an AgentRun with trigger CHAT.

export const CHAT_MAX_CHARS = 1000;
export const CHAT_HISTORY = 20;
export const CHAT_MAX_TOKENS = 400;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatContext = {
  runs: { outcome: string | null; summary: string | null }[]; // newest first, up to 5
  drafts: string[]; // pending approval titles
  history: ChatMessage[]; // oldest first
};

export type ChatDeps = Pick<RunnerDeps, "now" | "budgetMicros" | "ensureAgent" | "spentSince" | "startRun" | "finishRun" | "callClaude"> & {
  loadContext(agentId: string): Promise<ChatContext>;
  saveMessages(agentId: string, user: string, reply: string): Promise<void>;
};

export type ChatResult =
  | { ok: true; reply: string; costMicros: number }
  | { ok: false; status: 400 | 429 | 500; error: string };

/** Why a message can't be sent, or null if it's fine. */
export function chatMessageError(message: unknown): string | null {
  if (typeof message !== "string" || message.trim() === "") return "Message is empty";
  if (message.length > CHAT_MAX_CHARS) return `Message is over ${CHAT_MAX_CHARS} characters`;
  return null;
}

export function buildChatPrompt(def: Pick<BrotherDefinition, "name" | "role">, ctx: Pick<ChatContext, "runs" | "drafts">): string {
  const runs = ctx.runs.slice(0, 5).map((r) => `- ${r.outcome ?? "RUNNING"}: ${r.summary ?? "(no summary)"}`);
  const drafts = ctx.drafts.map((t) => `- ${t}`);
  return [
    `You are ${def.name}, a brother in the LaunchLocal frat house. Your job: ${def.role}.`,
    `You're chatting with Frank, who runs the house. Keep replies short and friendly.`,
    `You can't send, publish or approve anything; your drafts need Frank's approval.`,
    `Your last runs (newest first):\n${runs.length ? runs.join("\n") : "- none yet"}`,
    `Your drafts waiting for Frank:\n${drafts.length ? drafts.join("\n") : "- none"}`,
  ].join("\n\n");
}

/** The last CHAT_HISTORY messages plus the new one, as one prompt. */
export function chatTranscript(history: ChatMessage[], message: string): string {
  const lines = history.slice(-CHAT_HISTORY).map((m) => `${m.role === "user" ? "Frank" : "You"}: ${m.content}`);
  lines.push(`Frank: ${message}`);
  return `${lines.join("\n")}\n\nReply to Frank's last message.`;
}

export async function chatTurn(def: BrotherDefinition, message: unknown, deps: ChatDeps): Promise<ChatResult> {
  const invalid = chatMessageError(message);
  if (invalid) return { ok: false, status: 400, error: invalid };
  const text = (message as string).trim();

  const agent = await deps.ensureAgent(def);
  const spentToday = await deps.spentSince(startOfDayET(deps.now()));
  if (!canSpend(spentToday, deps.budgetMicros)) return { ok: false, status: 429, error: "Daily budget reached" };

  const ctx = await deps.loadContext(def.id);
  const runId = await deps.startRun(def.id, "CHAT");
  const meter = createMeter(agent.model, spentToday, deps);

  try {
    const reply = await meter.ask({
      system: buildChatPrompt(def, ctx),
      prompt: chatTranscript(ctx.history, text),
      maxTokens: CHAT_MAX_TOKENS,
    });
    await deps.finishRun(runId, { outcome: "OK", ...meter.totals, summary: `chat: ${text.slice(0, 80)}`, error: null });
    await deps.saveMessages(def.id, text, reply);
    return { ok: true, reply, costMicros: meter.totals.costMicros };
  } catch (err) {
    const overBudget = err instanceof BudgetExceededError;
    await deps.finishRun(runId, {
      outcome: overBudget ? "SKIPPED_BUDGET" : "ERROR",
      ...meter.totals,
      summary: null,
      error: overBudget ? null : errorText(err),
    });
    return overBudget
      ? { ok: false, status: 429, error: "Daily budget reached" }
      : { ok: false, status: 500, error: errorText(err) };
  }
}
