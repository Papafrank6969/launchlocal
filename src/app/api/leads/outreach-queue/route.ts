import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildOutreachQueue, type QueueLead } from "@/lib/outreachQueue";

/** Leads for the Instagram outreach console: untouched, has a handle, still needs a site. */
export async function GET() {
  const leads = await db.lead.findMany({
    where: {
      outreachStatus: "NEW",
      websiteStatus: { not: "HAS_SITE" },
      NOT: { instagramHandle: null },
    },
    include: { sites: { select: { id: true, slug: true, status: true } } },
  });

  const queue = buildOutreachQueue(
    leads.map(
      (l): QueueLead => ({
        id: l.id,
        name: l.name,
        category: l.category,
        city: l.city,
        websiteStatus: l.websiteStatus,
        instagramHandle: l.instagramHandle,
        rating: l.rating,
        createdAt: l.createdAt.toISOString(),
        sites: l.sites,
      }),
    ),
  );

  return NextResponse.json({ leads: queue });
}
