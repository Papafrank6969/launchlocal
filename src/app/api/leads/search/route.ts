import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractInstagramHandle, findBusinesses, scoreWebsite } from "@/lib/places";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const city = (body.city ?? "").toString().trim();
  const category = (body.category ?? "").toString().trim();
  const radiusMiles = body.radiusMiles ? Number(body.radiusMiles) : undefined;

  if (!city || !category) {
    return NextResponse.json({ error: "city and category are required" }, { status: 400 });
  }

  const businesses = await findBusinesses(city, category, radiusMiles);

  const leads = await Promise.all(
    businesses.map(async (b) => {
      const websiteStatus = scoreWebsite(b.existingUrl);
      const detectedHandle = extractInstagramHandle(b.existingUrl);
      const placeId = b.placeId ?? `${b.name}-${b.address}`;

      const existing = await db.lead.findUnique({ where: { placeId } });

      const lead = await db.lead.upsert({
        where: { placeId },
        create: {
          name: b.name,
          category: b.category,
          address: b.address,
          city: b.city,
          phone: b.phone,
          existingUrl: b.existingUrl,
          instagramHandle: detectedHandle,
          rating: b.rating,
          reviewCount: b.reviewCount,
          websiteStatus,
          source: b.source,
          placeId,
        },
        update: {
          existingUrl: b.existingUrl,
          // Only auto-fill if nothing's there yet — never clobber a manually entered handle.
          instagramHandle: existing?.instagramHandle ?? detectedHandle,
          rating: b.rating,
          reviewCount: b.reviewCount,
          websiteStatus,
        },
        include: { sites: { select: { id: true, slug: true, status: true } } },
      });
      return lead;
    })
  );

  await db.event.createMany({
    data: leads.map(() => ({ type: "LEAD_FOUND" as const })),
  });

  return NextResponse.json({ leads, usingLiveData: !!process.env.GOOGLE_PLACES_API_KEY });
}
