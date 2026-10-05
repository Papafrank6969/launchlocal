import type { BrotherContext } from "../agentTypes";
import { formatMicros } from "../houseStats";

export type TreasurerInput = {
  dayLabel: string; // e.g. "Oct 3", the ET day being reported
  filedToday: boolean;
  budgetMicros: number;
  runs: { agentId: string; outcome: string | null; costMicros: number }[]; // that day's runs
  pending: { kind: string; count: number }[]; // waiting on Frank right now
  events: { type: string }[]; // that day's events
};

const FUNNEL: [type: string, label: string][] = [
  ["LEAD_FOUND", "leads found"],
  ["LEAD_CONTACTED", "contacted"],
  ["LEAD_RESPONDED", "replied"],
  ["LEAD_WON", "won"],
  ["SITE_PUBLISHED", "sites published"],
];

/** Yesterday's numbers as one NOTE. Arithmetic only, no Claude. */
export async function treasurerJob(input: TreasurerInput, ctx: BrotherContext): Promise<string> {
  if (input.filedToday) return "already filed today";

  const spent = input.runs.reduce((sum, r) => sum + r.costMicros, 0);
  const byAgent = new Map<string, { runs: number; cost: number; errors: number }>();
  for (const r of input.runs) {
    const a = byAgent.get(r.agentId) ?? { runs: 0, cost: 0, errors: 0 };
    a.runs++;
    a.cost += r.costMicros;
    if (r.outcome === "ERROR") a.errors++;
    byAgent.set(r.agentId, a);
  }
  const count = (type: string) => input.events.filter((e) => e.type === type).length;
  const waiting = input.pending.reduce((sum, p) => sum + p.count, 0);

  const lines = [
    `Spend: ${formatMicros(spent)} of ${formatMicros(input.budgetMicros)}`,
    "",
    "Runs:",
    ...(byAgent.size
      ? [...byAgent].sort(([a], [b]) => a.localeCompare(b)).map(([id, a]) => `- ${id}: ${a.runs} run${a.runs === 1 ? "" : "s"}, ${formatMicros(a.cost)}${a.errors ? `, ${a.errors} error${a.errors === 1 ? "" : "s"}` : ""}`)
      : ["- none"]),
    "",
    `Funnel: ${FUNNEL.map(([type, label]) => `${count(type)} ${label}`).join(" · ")}`,
    "",
    `Waiting on you: ${waiting}${waiting ? ` (${input.pending.filter((p) => p.count).map((p) => `${p.count} ${p.kind}`).join(", ")})` : ""}`,
  ];
  await ctx.propose({ kind: "NOTE", title: `Daily digest, ${input.dayLabel}`, body: lines.join("\n") });
  return `digest for ${input.dayLabel}: ${formatMicros(spent)} spent`;
}
