import { BudgetExceededError } from "../agentRunner";
import type { ApprovalKind, BrotherContext } from "../agentTypes";

// Shared by Rush Chair and Follow-up (docs/FRAT-HOUSE-BROTHERS-PLAN.md §1
// "Drafted-DM rules"): one batched Claude call, code-enforced cleanup, and a
// template fallback so every eligible lead still gets a draft.

export const DRAFT_MIN_CHARS = 40;
export const DRAFT_MAX_CHARS = 400;
/** Stop drafting a kind once this many are waiting on Frank. */
export const PENDING_PAUSE = 16;

/** No em/en dashes, no emoji, single spaces. Compliance rule, enforced in code. */
export function scrubDraft(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]/gu, "")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/,\s*([,.!?])/g, "$1")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** A Claude draft that passes the rules, or null. */
export function acceptDraft(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const clean = scrubDraft(text);
  return clean.length >= DRAFT_MIN_CHARS && clean.length <= DRAFT_MAX_CHARS ? clean : null;
}

/** Reads `[{"id": "...", "text": "..."}]` out of a reply, tolerating fences and prose around it. Unknown ids are dropped. */
export function parseDraftJson(reply: string, ids: string[], field = "text"): Map<string, string> {
  const out = new Map<string, string>();
  const start = reply.indexOf("[");
  const end = reply.lastIndexOf("]");
  if (start === -1 || end <= start) return out;
  let rows: unknown;
  try {
    rows = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return out;
  }
  if (!Array.isArray(rows)) return out;
  const wanted = new Set(ids);
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const { id, [field]: value } = row as Record<string, unknown>;
    if (typeof id === "string" && wanted.has(id) && typeof value === "string") out.set(id, value);
  }
  return out;
}

/** Stable template variant per lead, so a lead's fallback doesn't change run to run. */
export function templateIndex(leadId: string, variants: number): number {
  let h = 0;
  for (const ch of leadId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % variants;
}

export type DraftLead = { id: string; name: string; facts: Record<string, unknown>; template: string };

/**
 * One Claude call for all leads, then one approval per lead. A lead whose draft
 * is missing or fails the rules gets its template, titled "(template)". Any
 * Claude failure except the budget cap falls back to templates for everyone.
 */
export async function writeDrafts(
  ctx: BrotherContext,
  opts: { kind: ApprovalKind; titlePrefix: string; system: string; leads: DraftLead[] },
): Promise<{ claude: number; template: number }> {
  let drafts = new Map<string, string>();
  try {
    const reply = await ctx.ask({
      system: opts.system,
      prompt: `Leads (JSON):\n${JSON.stringify(opts.leads.map((l) => ({ id: l.id, ...l.facts })))}\n\nReply with only a JSON array: [{"id": "<lead id>", "text": "<message>"}], one per lead.`,
      maxTokens: Math.min(2000, 150 * opts.leads.length + 100),
    });
    drafts = parseDraftJson(reply, opts.leads.map((l) => l.id));
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err;
  }

  const counts = { claude: 0, template: 0 };
  for (const lead of opts.leads) {
    const good = acceptDraft(drafts.get(lead.id));
    await ctx.propose({
      kind: opts.kind,
      title: `${opts.titlePrefix} ${lead.name}${good ? "" : " (template)"}`,
      body: good ?? scrubDraft(lead.template),
      leadId: lead.id,
    });
    counts[good ? "claude" : "template"]++;
  }
  return counts;
}

export const DM_RULES = `Rules:
1. Use only the facts given for each lead. Never invent reviews, awards, years in business, prices or anything else.
2. No em dashes. No emoji. No profanity. Under ${DRAFT_MAX_CHARS} characters.
3. Casual, first person, from Frank. End with one question.
4. Never promise a price or a timeline.`;
