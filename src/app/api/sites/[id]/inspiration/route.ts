import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compressImage, saveCompressedImage, validateUploadedImage } from "@/lib/imageUpload";

const MAX_IMAGES = 4;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const images = await db.inspirationImage.findMany({ where: { siteId: id }, orderBy: { order: "asc" } });
  return NextResponse.json({ images });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existingCount = await db.inspirationImage.count({ where: { siteId: id } });
  if (existingCount >= MAX_IMAGES) {
    return NextResponse.json({ error: `You can upload at most ${MAX_IMAGES} inspiration photos` }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("photo");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }
  const validationError = validateUploadedImage(file);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const compressed = await compressImage(bytes);
  if (!compressed) {
    return NextResponse.json({ error: "Couldn't process that image — try a different file" }, { status: 400 });
  }

  const url = await saveCompressedImage(compressed, site.id);
  const image = await db.inspirationImage.create({
    data: { siteId: id, url, order: existingCount },
  });

  return NextResponse.json({ image });
}
