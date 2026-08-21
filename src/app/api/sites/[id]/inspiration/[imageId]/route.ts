import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteUploadedFile } from "@/lib/imageUpload";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params;
  const existing = await db.inspirationImage.findUnique({ where: { id: imageId } });
  if (!existing || existing.siteId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteUploadedFile(existing.url);
  await db.inspirationImage.delete({ where: { id: imageId } });
  return NextResponse.json({ ok: true });
}
