import type { BrotherContext } from "../agentTypes";
import { opportunityScore, type BacklogLead } from "../leadBacklog";
import { BudgetExceededError } from "../agentRunner";
import { parseDraftJson, scrubDraft } from "./draftText";

export const SCOUT_PICKS = 10;

export type ScoutInput = { leads: BacklogLead[]; filedToday: boolean };

/** Ranks untouched leads by opportunityScore and files one NOTE with today's top picks. */
export async function scoutJob(input: ScoutInput, ctx: BrotherContext): Promise<string> {
  if (input.filedToday) return "already filed today";
  const picks = [...input.leads]
    .map((lead) => ({ lead, score: opportunityScore(lead) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SCOUT_PICKS);
  if (picks.length === 0) return "no untouched leads to rank";

  await ctx.setNow(`ranking ${picks.length} leads`);
  let whys = new Map<string, string>();
  try {
    const reply = await ctx.ask({
      system:
        "You help Frank pick which local businesses to pitch a website to. For each lead, write one short reason (under 15 words) it's worth pitching, using only the facts given. No em dashes. No emoji.",
      prompt: `Leads (JSON):\n${JSON.stringify(
        picks.map(({ lead, score }) => ({
          id: lead.id,
          name: lead.name,
          category: lead.category,
          city: lead.city,
          website: lead.websiteStatus === "NONE" ? "none" : "social page only",
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          hasInstagram: !!lead.instagramHandle?.trim(),
          hasDraftSite: (lead.sites?.length ?? 0) > 0,
          score,
        })),
      )}\n\nReply with only a JSON array: [{"id": "<lead id>", "why": "<reason>"}].`,
      maxTokens: 600,
    });
    whys = parseDraftJson(reply, picks.map((p) => p.lead.id), "why");
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err;
  }

  const lines = picks.map(({ lead, score }, i) => {
    const why = whys.get(lead.id);
    return `${i + 1}. ${lead.name} (${lead.category}, ${lead.city}) · score ${score}${why ? ` · ${scrubDraft(why)}` : ""}`;
  });
  await ctx.propose({ kind: "NOTE", title: "Today's top leads", body: lines.join("\n") });
  return `ranked ${picks.length} leads`;
}
