import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractInstagramHandle, findBusinesses, scoreWebsite, type RawBusiness } from "@/lib/places";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const city = (body.city ?? "").toString().trim();
  // Accept either the current multi-select `categories` array or the older
  // single `category` string, so nothing calling this route with the old
  // shape breaks.
  const categories: string[] = Array.isArray(body.categories)
    ? body.categories.map((c: unknown) => String(c).trim()).filter(Boolean)
    : [String(body.category ?? "").trim()].filter(Boolean);
  const radiusMiles = body.radiusMiles ? Number(body.radiusMiles) : undefined;

  if (!city || categories.length === 0) {
    return NextResponse.json({ error: "city and at least one category are required" }, { status: 400 });
  }

  const resultsByCategory = await Promise.all(categories.map((cat) => findBusinesses(city, cat, radiusMiles)));
  const seenKeys = new Set<string>();
  const businesses: RawBusiness[] = [];
  for (const batch of resultsByCategory) {
    for (const b of batch) {
      const key = b.placeId ?? `${b.name}-${b.address}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      businesses.push(b);
    }
  }

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
