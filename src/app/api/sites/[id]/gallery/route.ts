import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { db } from "@/lib/db";
import { compressImage, saveCompressedImage, validateUploadedImage } from "@/lib/imageUpload";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "gallery");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await db.galleryItem.findMany({ where: { siteId: id }, orderBy: { order: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const before = formData?.get("before");
  const after = formData?.get("after");
  const caption = formData?.get("caption");
  const category = formData?.get("category");

  if (!before || !(before instanceof File) || !after || !(after instanceof File)) {
    return NextResponse.json({ error: "Both a before and an after photo are required" }, { status: 400 });
  }

  for (const file of [before, after]) {
    const err = validateUploadedImage(file);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const beforeCompressed = await compressImage(Buffer.from(await before.arrayBuffer()));
  const afterCompressed = await compressImage(Buffer.from(await after.arrayBuffer()));
  if (!beforeCompressed || !afterCompressed) {
    return NextResponse.json({ error: "Couldn't process one of those images — try different files" }, { status: 400 });
  }

  const beforeFilename = await saveCompressedImage(beforeCompressed, UPLOAD_DIR, `${site.id}-before`);
  const afterFilename = await saveCompressedImage(afterCompressed, UPLOAD_DIR, `${site.id}-after`);

  const count = await db.galleryItem.count({ where: { siteId: id } });
  const item = await db.galleryItem.create({
    data: {
      siteId: id,
      beforeUrl: `/uploads/gallery/${beforeFilename}`,
      afterUrl: `/uploads/gallery/${afterFilename}`,
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : null,
      category: typeof category === "string" && category.trim() ? category.trim() : null,
      order: count,
    },
  });

  return NextResponse.json({ item });
}
