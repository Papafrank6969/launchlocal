import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteUploadedFile } from "@/lib/imageUpload";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const existing = await db.galleryItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.siteId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteUploadedFile(existing.beforeUrl);
  await deleteUploadedFile(existing.afterUrl);
  await db.galleryItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
