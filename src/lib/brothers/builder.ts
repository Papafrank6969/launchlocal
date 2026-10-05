import type { BrotherContext } from "../agentTypes";
import { leadToDraftSite, type LeadForDraft } from "../leadToSite";

export const BUILDER_PROPOSALS = 3;

export type BuilderLead = LeadForDraft & { id: string };

/**
 * Proposes a draft site for warm leads (RESPONDED, no site, not already
 * proposed). No Claude call: site copy is never model-written (compliance
 * standards). Creates nothing; approvals-flow builds the site on approval.
 */
export async function builderJob(input: { leads: BuilderLead[] }, ctx: BrotherContext): Promise<string> {
  const leads = input.leads.slice(0, BUILDER_PROPOSALS);
  if (leads.length === 0) return "nothing to propose (no warm leads without a site or proposal)";
  for (const lead of leads) {
    await ctx.setNow(`sketching a site for ${lead.name}`);
    await ctx.propose({
      kind: "SITE_DRAFT",
      title: `Draft site for ${lead.name}`,
      body: JSON.stringify({ leadId: lead.id, preview: leadToDraftSite(lead) }),
      leadId: lead.id,
    });
  }
  return `proposed ${leads.length} draft site${leads.length === 1 ? "" : "s"}`;
}
