import type { BrotherDefinition } from "../agentTypes";
import { scoutJob } from "./scout";
import { rushChairJob } from "./rushChair";
import { followUpJob } from "./followUp";
import { builderJob } from "./builder";
import { treasurerJob } from "./treasurer";
import { handleHunterJob } from "./handleHunter";
import { loadBuilderInput, loadFollowUpInput, loadHandleHunterDeps, loadRushChairInput, loadScoutInput, loadTreasurerInput } from "./brotherData";

// Every registered brother, in cron order (docs/FRAT-HOUSE-BROTHERS-PLAN.md).
// The cron upserts each into the Agent table, so a new brother shows up on the
// house just by being added here. Jobs are pure; the loaders do the DB reads.
export const BROTHERS: BrotherDefinition[] = [
  {
    // First, so Rush Chair can draft for the handles it finds the same day.
    id: "handle-hunter",
    name: "Handle Hunter",
    role: "Finds Instagram handles for new leads",
    run: async (ctx) => handleHunterJob(await loadHandleHunterDeps(), ctx),
  },
  {
    id: "scout",
    name: "Scout",
    role: "Picks the day's best untouched leads and says why",
    run: async (ctx) => scoutJob(await loadScoutInput(), ctx),
  },
  {
    id: "rush-chair",
    name: "Rush Chair",
    role: "Drafts first Instagram DMs for new leads",
    run: async (ctx) => rushChairJob(await loadRushChairInput(), ctx),
  },
  {
    id: "follow-up",
    name: "Follow-up",
    role: "Drafts follow-up DMs for leads that are due",
    run: async (ctx) => followUpJob(await loadFollowUpInput(), ctx),
  },
  {
    id: "builder",
    name: "Builder",
    role: "Proposes draft sites for leads who replied",
    run: async (ctx) => builderJob(await loadBuilderInput(), ctx),
  },
  {
    id: "treasurer",
    name: "Treasurer",
    role: "Writes yesterday's numbers: spend, runs, funnel, what's waiting",
    run: async (ctx) => treasurerJob(await loadTreasurerInput(), ctx),
  },
];

export function findBrother(id: string): BrotherDefinition | undefined {
  return BROTHERS.find((b) => b.id === id);
}
