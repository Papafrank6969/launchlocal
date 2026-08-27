import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { db } from "@/lib/db";
import { compressImage, saveCompressedImage, validateUploadedImage } from "@/lib/imageUpload";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "sites");

/**
 * Compress + store one service-card image and return its URL. The URL is held
 * in the editor form's `serviceItems[i].imageUrl` and persisted on the next
 * save (see reconcileServices) — this route does not write to the DB, because
 * the service row may not exist yet.
 */
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

  const compressed = await compressImage(Buffer.from(await file.arrayBuffer()));
  if (!compressed) {
    return NextResponse.json({ error: "Couldn't process that image — try a different file" }, { status: 400 });
  }

  const filename = await saveCompressedImage(compressed, UPLOAD_DIR, `${site.id}-service`);
  return NextResponse.json({ url: `/uploads/sites/${filename}` });
}
