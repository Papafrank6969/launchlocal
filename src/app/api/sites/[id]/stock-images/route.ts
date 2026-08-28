import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { db } from "@/lib/db";
import { compressImage, deleteUploadedFile, saveCompressedImage } from "@/lib/imageUpload";
import { fetchStockPhoto } from "@/lib/stockPhotos";
import { mergeAttribution, removeAttribution } from "@/lib/photoAttribution";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "sites");
const ATTR_PREFIX = "Photos via Pexels";

/**
 * Fill blank service cards with generic Pexels imagery — a placeholder for a
 * pitch site, meant to be replaced with the business's own photos. Only touches
 * services that have no image; never the hero or the About photo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({
    where: { id },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Set PEXELS_API_KEY in .env (free instant key at pexels.com/api) to use stock images." },
      { status: 400 }
    );
  }

  const blanks = site.serviceItems.filter((s) => !s.imageUrl);
  if (blanks.length === 0) {
    return NextResponse.json({ error: "Every service already has an image." }, { status: 400 });
  }

  const category = (site.category ?? "").trim();
  const photographers = new Set<string>();
  let filled = 0;

  await db.$transaction(async (tx) => {
    for (const service of blanks) {
      const stock =
        (await fetchStockPhoto(service.name, apiKey)) ||
        (category ? await fetchStockPhoto(category, apiKey) : null);
      if (!stock) continue;

      let bytes: Buffer | null = null;
      try {
        const res = await fetch(stock.url);
        if (res.ok) bytes = Buffer.from(await res.arrayBuffer());
      } catch {
        bytes = null;
      }
      const compressed = bytes ? await compressImage(bytes) : null;
      if (!compressed) continue;

      const filename = await saveCompressedImage(compressed, UPLOAD_DIR, `${site.id}-pexels`);
      await tx.service.update({ where: { id: service.id }, data: { imageUrl: `/uploads/sites/${filename}` } });
      photographers.add(stock.photographer);
      filled += 1;
    }

    if (filled > 0) {
      const line = `${ATTR_PREFIX} — ${[...photographers].join(", ")}`;
      await tx.site.update({ where: { id }, data: { photoAttribution: mergeAttribution(site.photoAttribution, line) } });
    }
  });

  if (filled === 0) {
    return NextResponse.json({ error: "Pexels had nothing usable for these services." }, { status: 502 });
  }

  const updated = await db.site.findUniqueOrThrow({
    where: { id },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ site: updated, count: filled });
}

/** Remove every Pexels-sourced service image + its attribution segment. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, include: { serviceItems: true } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction(async (tx) => {
    for (const s of site.serviceItems) {
      if (!s.imageUrl?.includes("-pexels-")) continue;
      await deleteUploadedFile(s.imageUrl);
      await tx.service.update({ where: { id: s.id }, data: { imageUrl: null } });
    }
    await tx.site.update({
      where: { id },
      data: { photoAttribution: removeAttribution(site.photoAttribution, ATTR_PREFIX) },
    });
  });

  const updated = await db.site.findUniqueOrThrow({
    where: { id },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ site: updated });
}
