import type { BrotherContext } from "../agentTypes";
import type { InstagramLookupResult } from "../instagramLookup";

// Finds Instagram handles for new leads so Rush Chair has someone to DM
// (docs/FRAT-HOUSE-BROTHERS-PLAN.md §9). No Claude: Brave Search lookups only.

/** Per ET day, not per run: ticks come every 15 min and Brave bills per search. */
export const HUNTER_LOOKUPS = 20;
export const HUNTER_RETRY_DAYS = 30;
export const HUNTER_PACE_MS = 1100; // Brave's per-second limit

export type HunterDeps = {
  leads: { id: string; name: string; city: string }[]; // NEW, no handle, not tried in 30 days; oldest first
  doneToday: number; // lookups recorded since midnight ET
  lookup(name: string, city: string): Promise<InstagramLookupResult>;
  saveHandle(leadId: string, handle: string): Promise<void>;
  recordAttempt(leadId: string, found: boolean): Promise<void>;
  sleep(ms: number): Promise<void>;
};

const STOP: Partial<Record<InstagramLookupResult["status"], string>> = {
  not_configured: "BRAVE_SEARCH_API_KEY isn't set",
  key_rejected: "Brave rejected the API key",
  rate_limited: "Brave rate-limited the lookups",
};

export async function handleHunterJob(deps: HunterDeps, ctx: BrotherContext): Promise<string> {
  const left = Math.max(0, HUNTER_LOOKUPS - deps.doneToday);
  if (left === 0) return `done for today (${HUNTER_LOOKUPS} lookups)`;
  const leads = deps.leads.slice(0, left);
  if (leads.length === 0) return "no new leads need a handle";

  const counts = { found: 0, missed: 0, errors: 0 };
  for (const [i, lead] of leads.entries()) {
    if (i > 0) await deps.sleep(HUNTER_PACE_MS);
    await ctx.setNow(`looking up ${lead.name}`);
    const result = await deps.lookup(lead.name, lead.city);

    const stop = STOP[result.status];
    if (stop) return `stopped after ${i} of ${leads.length}: ${stop} (${counts.found} found)`;

    if (result.status === "found") {
      await deps.saveHandle(lead.id, result.handle);
      await deps.recordAttempt(lead.id, true);
      counts.found++;
    } else if (result.status === "not_found") {
      await deps.recordAttempt(lead.id, false);
      counts.missed++;
    } else {
      counts.errors++; // transient; not recorded, so it's retried tomorrow
    }
  }
  return `looked up ${leads.length}: ${counts.found} found, ${counts.missed} not found${counts.errors ? `, ${counts.errors} error${counts.errors === 1 ? "" : "s"}` : ""}`;
}
