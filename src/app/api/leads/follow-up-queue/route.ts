import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildFollowUpQueue, type FollowUpQueueLead } from "@/lib/followUpQueue";

/** Leads for the follow-up console: contacted, overdue for a bump, still has a handle. */
export async function GET() {
  const leads = await db.lead.findMany({
    where: {
      outreachStatus: "CONTACTED",
      NOT: { instagramHandle: null },
      followUpAt: { not: null, lte: new Date() },
    },
    include: { sites: { select: { id: true, slug: true, status: true } } },
  });

  const queue = buildFollowUpQueue(
    leads.map(
      (l): FollowUpQueueLead => ({
        id: l.id,
        name: l.name,
        category: l.category,
        city: l.city,
        instagramHandle: l.instagramHandle,
        outreachStatus: l.outreachStatus,
        followUpAt: l.followUpAt?.toISOString() ?? null,
        followUpCount: l.followUpCount,
        sites: l.sites,
      }),
    ),
  );

  return NextResponse.json({ leads: queue });
}
