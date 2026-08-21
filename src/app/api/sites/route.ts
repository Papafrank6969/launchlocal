import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uniqueSlug } from "@/lib/slug";

export async function GET() {
  const sites = await db.site.findMany({
    orderBy: { createdAt: "desc" },
    include: { lead: true },
  });
  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const businessName = (body.businessName ?? "").toString().trim();

  if (!businessName) {
    return NextResponse.json({ error: "businessName is required" }, { status: 400 });
  }

  const slug = await uniqueSlug(businessName, async (candidate) => {
    const existing = await db.site.findUnique({ where: { slug: candidate } });
    return !!existing;
  });

  const site = await db.site.create({
    data: {
      slug,
      businessName,
      tagline: body.tagline || null,
      about: body.about || null,
      services: body.services || null,
      hours: body.hours || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      instagramHandle: body.instagramHandle || null,
      template: body.template || "classic",
      primaryColor: body.primaryColor || "#2563eb",
      leadId: body.leadId || null,
    },
  });

  await db.event.create({ data: { type: "SITE_CREATED", siteId: site.id } });

  return NextResponse.json({ site });
}
