import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  const { id, subId } = await params;
  const existing = await db.contactSubmission.findUnique({ where: { id: subId } });
  if (!existing || existing.siteId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const read = typeof body.read === "boolean" ? body.read : true;

  const submission = await db.contactSubmission.update({ where: { id: subId }, data: { read } });
  return NextResponse.json({ submission });
}
