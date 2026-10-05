import type { BrotherContext } from "../agentTypes";
import { buildOutreachQueue, type QueueLead } from "../outreachQueue";
import { generateOutreachMessage, OUTREACH_VARIANT_COUNT } from "../outreachMessage";
import { DM_RULES, PENDING_PAUSE, templateIndex, writeDrafts } from "./draftText";

export const RUSH_CHAIR_DRAFTS = 8;

export type RushChairInput = {
  leads: QueueLead[]; // NEW leads, not yet drafted
  pendingDrafts: number; // PENDING DM_DRAFTs waiting on Frank
  previewBase: string;
};

const previewUrl = (base: string, lead: QueueLead) => (lead.sites?.[0] ? `${base}/s/${lead.sites[0].slug}` : null);

/** Drafts a first Instagram DM for the top of the outreach queue. Never sends. */
export async function rushChairJob(input: RushChairInput, ctx: BrotherContext): Promise<string> {
  if (input.pendingDrafts >= PENDING_PAUSE) {
    await ctx.setNow(`waiting on Frank: ${input.pendingDrafts} drafts`);
    return `paused: ${input.pendingDrafts} DM drafts waiting`;
  }
  const leads = buildOutreachQueue(input.leads).slice(0, RUSH_CHAIR_DRAFTS);
  if (leads.length === 0) return "nothing new to draft (no undrafted NEW leads with a handle)";

  await ctx.setNow(`drafting ${leads.length} DMs`);
  const { claude, template } = await writeDrafts(ctx, {
    kind: "DM_DRAFT",
    titlePrefix: "DM for",
    system: `You draft first-contact Instagram DMs from Frank, who builds websites for local businesses, to businesses with no real website. Frank sends them by hand after reviewing.\n${DM_RULES}\nIf a lead has previewUrl, Frank already built them a free sample site: mention it and include the link exactly.`,
    leads: leads.map((lead) => {
      const url = previewUrl(input.previewBase, lead);
      return {
        id: lead.id,
        name: lead.name,
        facts: {
          name: lead.name,
          category: lead.category,
          city: lead.city,
          website: lead.websiteStatus === "NONE" ? "none" : "social page only",
          rating: lead.rating,
          previewUrl: url,
        },
        template: generateOutreachMessage(lead, templateIndex(lead.id, OUTREACH_VARIANT_COUNT), { previewUrl: url }),
      };
    }),
  });
  return `drafted ${leads.length} DMs (${claude} written, ${template} template)`;
}
