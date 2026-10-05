import type { BrotherDefinition } from "../agentTypes";
import { pledge } from "./pledge";

// Every registered brother. The cron upserts each into the Agent table, so a
// new brother shows up on the house just by being added here.
export const BROTHERS: BrotherDefinition[] = [pledge];

export function findBrother(id: string): BrotherDefinition | undefined {
  return BROTHERS.find((b) => b.id === id);
}
