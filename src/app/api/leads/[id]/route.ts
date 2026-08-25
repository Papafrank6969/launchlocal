import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { OutreachStatus } from "@prisma/client";

const OUTREACH_STATUSES: OutreachStatus[] = ["NEW", "CONTACTED", "RESPONDED", "WON", "LOST"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ("outreachStatus" in body && !OUTREACH_STATUSES.includes(body.outreachStatus)) {
    return NextResponse.json({ error: "Invalid outreachStatus" }, { status: 400 });
  }

  const nextStatus: OutreachStatus | undefined = "outreachStatus" in body ? body.outreachStatus : undefined;
  const advancingFromNew = nextStatus === "CONTACTED" && existing.outreachStatus === "NEW";

  const lead = await db.lead.update({
    where: { id },
    data: {
      instagramHandle: "instagramHandle" in body ? body.instagramHandle : undefined,
      email: "email" in body ? body.email : undefined,
      outreachStatus: nextStatus,
      lastContactedAt:
        "lastContactedAt" in body
          ? body.lastContactedAt
            ? new Date(body.lastContactedAt)
            : null
          : advancingFromNew || nextStatus === "CONTACTED"
            ? new Date()
            : undefined,
      followUpAt: "followUpAt" in body ? (body.followUpAt ? new Date(body.followUpAt) : null) : undefined,
      outreachNotes: "outreachNotes" in body ? body.outreachNotes : undefined,
    },
  });

  return NextResponse.json({ lead });
}
