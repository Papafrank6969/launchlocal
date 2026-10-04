import { startOfDayET } from "./agentBudget";
import type { AgentStatus } from "./agentTypes";

// Pure pieces of GET /api/house (docs/FRAT-HOUSE-UI-PLAN.md §4). Counting
// happens in SQL; this owns the time windows and the agent list merge.

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** `since7d` is inclusive: an event exactly 7 days old counts. `dayStart` matches the runtime's budget day. */
export function houseWindows(now: Date): { since7d: Date; dayStart: Date } {
  return { since7d: new Date(now.getTime() - WEEK_MS), dayStart: startOfDayET(now) };
}

export type AgentRowLite = { id: string; name: string; role: string; status: AgentStatus; enabled: boolean; currentTask: string | null };

/**
 * Registered brothers ∪ Agent rows. A brother that has never run has no row
 * yet, so he shows as IDLE. Disabled agents show as OFF. Sorted by name.
 */
export function mergeAgents(
  brothers: { id: string; name: string; role: string }[],
  rows: AgentRowLite[],
): { id: string; name: string; role: string; status: AgentStatus; currentTask: string | null }[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ids = new Set([...brothers.map((b) => b.id), ...rows.map((r) => r.id)]);
  return [...ids]
    .map((id) => {
      const row = byId.get(id);
      const bro = brothers.find((b) => b.id === id);
      return {
        id,
        name: bro?.name ?? row!.name,
        role: bro?.role ?? row!.role,
        status: row ? (row.enabled ? row.status : "OFF") : "IDLE",
        currentTask: row?.currentTask ?? null,
      } as const;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Integer micros → "$0.002" style. Sub-cent amounts keep 3 decimals so a cheap call isn't "$0.00". */
export function formatMicros(micros: number): string {
  if (micros > 0 && micros < 1_000) return "<$0.001";
  const dollars = micros / 1_000_000;
  return `$${dollars >= 0.1 || micros === 0 ? dollars.toFixed(2) : dollars.toFixed(3)}`;
}
