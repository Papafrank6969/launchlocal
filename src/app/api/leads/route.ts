import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const leads = await db.lead.findMany({
    where: status ? { websiteStatus: status as "NONE" | "POOR" | "HAS_SITE" } : undefined,
    orderBy: { createdAt: "desc" },
    include: { sites: { select: { id: true, slug: true, status: true } } },
  });
  return NextResponse.json({ leads });
}
