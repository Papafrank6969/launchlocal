import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uniqueSlug, slugify } from "@/lib/slug";
import { chooseDesign } from "@/lib/generateDesign";
import { normalizeBookingUrl } from "@/lib/bookingUrl";

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

  const rawServices: { name?: string; description?: string | null; price?: string | null }[] = Array.isArray(
    body.serviceItems
  )
    ? body.serviceItems
    : [];
  const seen = new Set<string>();
  const serviceRows = rawServices
    .map((s) => ({
      name: (s.name ?? "").trim(),
      description: (s.description ?? "").trim() || null,
      price: (s.price ?? "").trim() || null,
    }))
    .filter((s) => s.name.length > 0)
    .map((s, i) => {
      let itemSlug = slugify(s.name) || `service-${i + 1}`;
      let n = 1;
      while (seen.has(itemSlug)) {
        n += 1;
        itemSlug = `${slugify(s.name)}-${n}`;
      }
      seen.add(itemSlug);
      return { slug: itemSlug, name: s.name, description: s.description, price: s.price, order: i };
    });

  const category = (body.category ?? "").toString().trim() || null;
  const rating = body.rating !== undefined && body.rating !== null && body.rating !== "" ? Number(body.rating) : null;
  const reviewCount =
    body.reviewCount !== undefined && body.reviewCount !== null && body.reviewCount !== ""
      ? Number(body.reviewCount)
      : null;

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
      bookingUrl: normalizeBookingUrl(body.bookingUrl),
      guaranteeText: body.guaranteeText || null,
      paymentMethods: body.paymentMethods || null,
      rating: rating !== null && !Number.isNaN(rating) ? rating : null,
      reviewCount: reviewCount !== null && !Number.isNaN(reviewCount) ? reviewCount : null,
      category,
      leadId: body.leadId || null,
      serviceItems: serviceRows.length > 0 ? { create: serviceRows } : undefined,
    },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });

  await db.event.create({ data: { type: "SITE_CREATED", siteId: site.id } });

  const choice = await chooseDesign({
    businessName: site.businessName,
    category: site.category,
    tagline: site.tagline,
    about: site.about,
    serviceNames: site.serviceItems.map((s) => s.name),
  });
  const designed = await db.site.update({
    where: { id: site.id },
    data: { designSystemId: choice.system.id, designRationale: choice.rationale },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ site: designed });
}
