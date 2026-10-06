// The contract every Frat House brother implements (docs/FRAT-HOUSE-RUNTIME-PLAN.md §4).
// Mirrors the Prisma enums as string unions so pure modules stay Prisma-free.

export type ApprovalKind = "DM_DRAFT" | "FOLLOW_UP_DRAFT" | "SITE_DRAFT" | "NOTE";
export type AgentStatus = "IDLE" | "RUNNING" | "ERROR" | "OFF";
export type RunTrigger = "CRON" | "MANUAL" | "CHAT";
export type RunOutcome = "OK" | "ERROR" | "SKIPPED_BUDGET" | "SKIPPED_BUSY";

export type BrotherContext = {
  /** One Claude call. Cost is metered and the cap is re-checked before each call. */
  ask(input: { system: string; prompt: string; maxTokens: number }): Promise<string>;
  /** File a draft for Frank. Never sends anything anywhere. */
  propose(input: { kind: ApprovalKind; title: string; body: string; leadId?: string; siteId?: string }): Promise<void>;
  /** Update the "Now" line on the house. */
  setNow(text: string): Promise<void>;
};

export type BrotherDefinition = {
  id: string; // matches Agent.id
  name: string;
  role: string;
  /** Which house he lives in: the Frat House (/house, default) or the Villa (/villa). */
  house?: "villa";
  /** Claude model; defaults to the Agent row's (Haiku). Must be priced in agentCost.ts. */
  model?: string;
  /** Do the work. Return a one-line summary for the run log. */
  run(ctx: BrotherContext): Promise<string>;
};
