import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const pipeline = req.nextUrl.searchParams.get("pipeline");
  const leads = await db.lead.findMany({
    where: {
      ...(status ? { websiteStatus: status as "NONE" | "POOR" | "HAS_SITE" } : {}),
      ...(pipeline ? { outreachStatus: { not: "NEW" } } : {}),
    },
    orderBy: pipeline
      ? [{ followUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
      : { createdAt: "desc" },
    // v1: cap the backlog payload at 500 so an unbounded table can't blow up the
    // response. Filtering/sorting is client-side (see /leads); pagination over
    // the cap is a known follow-up, not done here.
    take: 500,
    include: { sites: { select: { id: true, slug: true, status: true } } },
  });
  return NextResponse.json({ leads });
}
