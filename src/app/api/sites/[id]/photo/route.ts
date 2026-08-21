import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { db } from "@/lib/db";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB, before compression
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
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
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Photo must be a JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Photo is too large (max 10MB)" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let compressed: Buffer;
  try {
    compressed = await sharp(bytes)
      .rotate() // auto-orient based on EXIF, then strip it
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Couldn't process that image — try a different file" }, { status: 400 });
  }

  const filename = `${site.id}-${Date.now()}.webp`;
  await writeFile(path.join(UPLOAD_DIR, filename), compressed);

  if (site.photoUrl) {
    const oldPath = path.join(process.cwd(), "public", site.photoUrl);
    unlink(oldPath).catch(() => {});
  }

  const photoUrl = `/uploads/sites/${filename}`;
  const updated = await db.site.update({ where: { id }, data: { photoUrl } });

  return NextResponse.json({ site: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (site.photoUrl) {
    const oldPath = path.join(process.cwd(), "public", site.photoUrl);
    unlink(oldPath).catch(() => {});
  }

  const updated = await db.site.update({ where: { id }, data: { photoUrl: null } });
  return NextResponse.json({ site: updated });
}
