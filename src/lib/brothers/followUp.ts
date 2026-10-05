import type { BrotherContext } from "../agentTypes";
import { buildFollowUpQueue, type FollowUpQueueLead } from "../followUpQueue";
import { generateFollowUpMessage, FOLLOW_UP_VARIANT_COUNT } from "../followUpMessage";
import { DM_RULES, PENDING_PAUSE, templateIndex, writeDrafts } from "./draftText";

export const FOLLOW_UP_DRAFTS = 8;

export type FollowUpInput = {
  leads: FollowUpQueueLead[]; // CONTACTED leads, not yet drafted
  pendingDrafts: number; // PENDING FOLLOW_UP_DRAFTs waiting on Frank
  previewBase: string;
  now: Date;
};

/** Drafts a short bump for leads whose follow-up is due. Never sends. */
export async function followUpJob(input: FollowUpInput, ctx: BrotherContext): Promise<string> {
  if (input.pendingDrafts >= PENDING_PAUSE) {
    await ctx.setNow(`waiting on Frank: ${input.pendingDrafts} drafts`);
    return `paused: ${input.pendingDrafts} follow-up drafts waiting`;
  }
  const leads = buildFollowUpQueue(input.leads, input.now).slice(0, FOLLOW_UP_DRAFTS);
  if (leads.length === 0) return "nothing new to draft (no undrafted follow-ups due)";

  await ctx.setNow(`drafting ${leads.length} follow-ups`);
  const { claude, template } = await writeDrafts(ctx, {
    kind: "FOLLOW_UP_DRAFT",
    titlePrefix: "Follow-up for",
    system: `You draft short, low-pressure Instagram follow-ups from Frank, who builds websites for local businesses, to businesses he DMed before and hasn't heard back from. It's a bump, not a re-pitch: two sentences max. Frank sends them by hand after reviewing.\n${DM_RULES}\nYou may say you're following up on a previous message. If a lead has previewUrl, point to the free sample site and include the link exactly.`,
    leads: leads.map((lead) => {
      const url = lead.sites?.[0] ? `${input.previewBase}/s/${lead.sites[0].slug}` : null;
      return {
        id: lead.id,
        name: lead.name,
        facts: { name: lead.name, category: lead.category, city: lead.city, followUpsSoFar: lead.followUpCount, previewUrl: url },
        template: generateFollowUpMessage(lead, templateIndex(lead.id, FOLLOW_UP_VARIANT_COUNT), { previewUrl: url }),
      };
    }),
  });
  return `drafted ${leads.length} follow-ups (${claude} written, ${template} template)`;
}
