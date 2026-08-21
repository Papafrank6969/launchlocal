import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submissions = await db.contactSubmission.findMany({ where: { siteId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ submissions });
}
