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
    include: { sites: { select: { id: true, slug: true, status: true } } },
  });
  return NextResponse.json({ leads });
}
