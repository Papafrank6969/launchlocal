import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decide } from "@/lib/approvalDecision";
import { updateLead } from "@/lib/leadOutreach";
import { draftSiteFromLead } from "@/lib/siteCreate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Behind the operator password (src/proxy.ts). Frank acts on one draft.
// Never sends anything: DMs are sent by Frank in Instagram, this only records it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = (await req.json().catch(() => null)) as { action?: unknown; body?: unknown } | null;

  const approval = await db.approval.findUnique({ where: { id } });
  if (!approval) return NextResponse.json({ error: "No such draft" }, { status: 404 });
  const lead = approval.leadId
    ? await db.lead.findUnique({ where: { id: approval.leadId }, select: { id: true, name: true, outreachStatus: true, followUpCount: true } })
    : null;

  const d = decide(approval, lead, input?.action, input?.body, new Date());
  if (!d.ok) return NextResponse.json({ error: d.error }, { status: d.status });

  // Claim first: only one click wins, even across tabs.
  const claimed = await db.approval.updateMany({
    where: { id, state: "PENDING" },
    data: { state: d.state, decidedAt: new Date(), ...(d.body !== undefined && { body: d.body }) },
  });
  if (claimed.count === 0) return NextResponse.json({ error: "Already decided" }, { status: 409 });

  try {
    let updatedLead = null;
    let site = null;
    if (d.leadPatch && lead) {
      const res = await updateLead(lead.id, d.leadPatch);
      if (!res.ok) throw new Error(res.error);
      updatedLead = res.lead;
    }
    if (d.createSite && lead) {
      site = (await draftSiteFromLead(lead.id))?.site ?? null;
      if (!site) throw new Error("Lead no longer exists");
    }
    const saved = await db.approval.findUnique({ where: { id } });
    return NextResponse.json({ approval: saved, lead: updatedLead, site });
  } catch (err) {
    // Put it back so Frank can retry.
    await db.approval.update({ where: { id }, data: { state: "PENDING", decidedAt: null, body: approval.body } });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
