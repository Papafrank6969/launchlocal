import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateLead } from "@/lib/leadOutreach";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await updateLead(id, body);
  return result.ok
    ? NextResponse.json({ lead: result.lead })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
