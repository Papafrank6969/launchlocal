import { writeFile, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB, before compression
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateUploadedImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Photo must be a JPEG, PNG, WebP, or GIF";
  if (file.size > MAX_UPLOAD_BYTES) return "Photo is too large (max 10MB)";
  return null;
}

export async function compressImage(bytes: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .rotate() // auto-orient based on EXIF, then strip it
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function saveCompressedImage(bytes: Buffer, dir: string, filenamePrefix: string): Promise<string> {
  const filename = `${filenamePrefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
  await writeFile(path.join(dir, filename), bytes);
  return filename;
}

export async function deleteUploadedFile(publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  const filePath = path.join(process.cwd(), "public", publicUrl);
  await unlink(filePath).catch(() => {});
}
