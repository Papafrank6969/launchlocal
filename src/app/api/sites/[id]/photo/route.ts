import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compressImage, deleteUploadedFile, saveCompressedImage, validateUploadedImage } from "@/lib/imageUpload";

// "hero" sets photoUrl (default), "story" sets storyPhotoUrl (the About image).
function photoTarget(req: NextRequest, formData: FormData | null): "hero" | "story" {
  const raw = req.nextUrl.searchParams.get("target") ?? (formData?.get("target") as string | null);
  return raw === "story" ? "story" : "hero";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("photo");
  const target = photoTarget(req, formData);

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
  const currentUrl = target === "story" ? site.storyPhotoUrl : site.photoUrl;
  await deleteUploadedFile(currentUrl);

  const updated = await db.site.update({
    where: { id },
    data: target === "story" ? { storyPhotoUrl: url } : { photoUrl: url },
  });

  return NextResponse.json({ site: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = photoTarget(req, null);
  await deleteUploadedFile(target === "story" ? site.storyPhotoUrl : site.photoUrl);

  const updated = await db.site.update({
    where: { id },
    data: target === "story" ? { storyPhotoUrl: null } : { photoUrl: null },
  });
  return NextResponse.json({ site: updated });
}
