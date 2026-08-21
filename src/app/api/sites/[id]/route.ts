import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, include: { lead: true } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ site });
}

const EDITABLE_FIELDS = [
  "businessName",
  "tagline",
  "about",
  "services",
  "hours",
  "phone",
  "email",
  "address",
  "instagramHandle",
  "template",
  "primaryColor",
] as const;

const EDITABLE_BOOLEAN_FIELDS = ["utmTrackingEnabled"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await db.site.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, string | boolean> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) data[field] = body[field];
  }
  for (const field of EDITABLE_BOOLEAN_FIELDS) {
    if (field in body) data[field] = Boolean(body[field]);
  }

  let status = existing.status;
  if (body.status === "PUBLISHED" || body.status === "DRAFT") {
    status = body.status;
  }

  const site = await db.site.update({
    where: { id },
    data: { ...data, status },
  });

  if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
    await db.event.create({ data: { type: "SITE_PUBLISHED", siteId: site.id } });
  }

  return NextResponse.json({ site });
}
