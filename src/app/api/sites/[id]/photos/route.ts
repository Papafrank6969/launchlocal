import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compressImage, deleteUploadedFile, saveCompressedImage } from "@/lib/imageUpload";
import { fetchPlacePhotoRefs, fetchPlacePhotoBytes } from "@/lib/placesPhotos";
import { mergeAttribution, removeAttribution } from "@/lib/photoAttribution";

const ATTR_PREFIX = "Photos via Google";

/**
 * Pull the business's own photos from Google Places as starting imagery:
 * photo 1 → hero, photo 2 → story, the rest → service cards without an image.
 * Never overwrites a photo the operator already set.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({
    where: { id },
    include: { lead: true, serviceItems: { orderBy: { order: "asc" } } },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Set GOOGLE_PLACES_API_KEY in .env to pull photos." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const placeId =
    (typeof body.placeId === "string" && body.placeId.trim()) || site.googlePlaceId || site.lead?.placeId || null;
  if (!placeId) {
    return NextResponse.json(
      { error: "No Google Place ID. Add one in the editor (or build this site from a Google lead)." },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = await fetchPlacePhotoRefs(placeId, apiKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't reach Google Places." },
      { status: 502 }
    );
  }
  if (parsed.refs.length === 0) {
    return NextResponse.json({ error: "Google has no photos for this business." }, { status: 404 });
  }

  // Only fetch as many as we'll actually place: hero + story + one per
  // image-less service. Otherwise the extras just leak onto disk.
  const slotsNeeded =
    (site.photoUrl ? 0 : 1) +
    (site.storyPhotoUrl ? 0 : 1) +
    site.serviceItems.filter((s) => !s.imageUrl).length;

  const saved: string[] = [];
  for (const ref of parsed.refs) {
    if (saved.length >= slotsNeeded) break;
    const bytes = await fetchPlacePhotoBytes(ref, apiKey);
    if (!bytes) continue;
    const compressed = await compressImage(bytes);
    if (!compressed) continue;
    const url = await saveCompressedImage(compressed, `${site.id}-places`);
    saved.push(url);
  }
  if (saved.length === 0) {
    return NextResponse.json({ error: "Couldn't download any of the photos — try again." }, { status: 502 });
  }

  const pool = [...saved];
  const heroUrl = site.photoUrl ?? pool.shift() ?? site.photoUrl;
  const storyUrl = site.storyPhotoUrl ?? pool.shift() ?? site.storyPhotoUrl;

  await db.$transaction(async (tx) => {
    await tx.site.update({
      where: { id },
      data: {
        photoUrl: heroUrl,
        storyPhotoUrl: storyUrl,
        photoAttribution: mergeAttribution(site.photoAttribution, parsed.attribution),
      },
    });
    for (const service of site.serviceItems) {
      if (service.imageUrl || pool.length === 0) continue;
      await tx.service.update({ where: { id: service.id }, data: { imageUrl: pool.shift()! } });
    }
  });

  const updated = await db.site.findUniqueOrThrow({
    where: { id },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ site: updated, count: saved.length });
}

/** Remove every Places-pulled photo and the attribution. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({
    where: { id },
    include: { serviceItems: true },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPlaces = (u: string | null | undefined) => !!u && u.includes("-places-");

  await db.$transaction(async (tx) => {
    const data: { photoUrl?: null; storyPhotoUrl?: null; photoAttribution: string | null } = {
      photoAttribution: removeAttribution(site.photoAttribution, ATTR_PREFIX),
    };
    if (isPlaces(site.photoUrl)) {
      await deleteUploadedFile(site.photoUrl);
      data.photoUrl = null;
    }
    if (isPlaces(site.storyPhotoUrl)) {
      await deleteUploadedFile(site.storyPhotoUrl);
      data.storyPhotoUrl = null;
    }
    await tx.site.update({ where: { id }, data });
    for (const s of site.serviceItems) {
      if (!isPlaces(s.imageUrl)) continue;
      await deleteUploadedFile(s.imageUrl);
      await tx.service.update({ where: { id: s.id }, data: { imageUrl: null } });
    }
  });

  const updated = await db.site.findUniqueOrThrow({
    where: { id },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ site: updated });
}
