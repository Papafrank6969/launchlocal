import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { db } from "@/lib/db";
import { compressImage, deleteUploadedFile, saveCompressedImage, validateUploadedImage } from "@/lib/imageUpload";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "sites");

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const filename = await saveCompressedImage(compressed, UPLOAD_DIR, site.id);
  await deleteUploadedFile(site.photoUrl);

  const photoUrl = `/uploads/sites/${filename}`;
  const updated = await db.site.update({ where: { id }, data: { photoUrl } });

  return NextResponse.json({ site: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteUploadedFile(site.photoUrl);

  const updated = await db.site.update({ where: { id }, data: { photoUrl: null } });
  return NextResponse.json({ site: updated });
}
