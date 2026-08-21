import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uniqueSlug, slugify } from "@/lib/slug";

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

  const rawServices: { name?: string; description?: string | null }[] = Array.isArray(body.serviceItems)
    ? body.serviceItems
    : [];
  const seen = new Set<string>();
  const serviceRows = rawServices
    .map((s) => ({ name: (s.name ?? "").trim(), description: (s.description ?? "").trim() || null }))
    .filter((s) => s.name.length > 0)
    .map((s, i) => {
      let itemSlug = slugify(s.name) || `service-${i + 1}`;
      let n = 1;
      while (seen.has(itemSlug)) {
        n += 1;
        itemSlug = `${slugify(s.name)}-${n}`;
      }
      seen.add(itemSlug);
      return { slug: itemSlug, name: s.name, description: s.description, order: i };
    });

  const site = await db.site.create({
    data: {
      slug,
      businessName,
      tagline: body.tagline || null,
      about: body.about || null,
      story: body.story || null,
      hours: body.hours || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      instagramHandle: body.instagramHandle || null,
      facebookUrl: body.facebookUrl || null,
      guaranteeText: body.guaranteeText || null,
      paymentMethods: body.paymentMethods || null,
      template: body.template || "classic",
      primaryColor: body.primaryColor || "#2563eb",
      leadId: body.leadId || null,
      serviceItems: serviceRows.length > 0 ? { create: serviceRows } : undefined,
    },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });

  await db.event.create({ data: { type: "SITE_CREATED", siteId: site.id } });

  return NextResponse.json({ site });
}
