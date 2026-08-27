import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchGoogleReviews } from "@/lib/googleReviews";

/** Pull fresh Google reviews for this site from the Places Details API. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, include: { lead: true } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Set GOOGLE_PLACES_API_KEY in .env to pull real reviews." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const placeId =
    (typeof body.placeId === "string" && body.placeId.trim()) ||
    site.googlePlaceId ||
    site.lead?.placeId ||
    null;

  if (!placeId) {
    return NextResponse.json(
      { error: "No Google Place ID. Add one in the editor (or build this site from a Google lead)." },
      { status: 400 }
    );
  }

  let fetched;
  try {
    fetched = await fetchGoogleReviews(placeId, apiKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't reach Google Places." },
      { status: 502 }
    );
  }

  const updated = await db.site.update({
    where: { id },
    data: {
      googlePlaceId: placeId,
      googleReviewsJson: JSON.stringify(fetched.reviews),
      googleReviewsUpdatedAt: new Date(),
      googleMapsUrl: fetched.mapsUrl,
      // The aggregate rating badge should track the same real numbers.
      rating: fetched.rating ?? site.rating,
      reviewCount: fetched.reviewCount ?? site.reviewCount,
    },
  });

  return NextResponse.json({ site: updated, count: fetched.reviews.length });
}

/** Clear stored reviews without touching the aggregate rating. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await db.site.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.site.update({
    where: { id },
    data: { googleReviewsJson: null, googleReviewsUpdatedAt: null, googleMapsUrl: null },
  });
  return NextResponse.json({ site: updated });
}
