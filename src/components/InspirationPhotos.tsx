"use client";

import { useEffect, useState } from "react";
import { FormStatus, type StatusMessage } from "@/components/FormStatus";

type InspirationImage = { id: string; url: string };

const MAX_IMAGES = 4;

export function InspirationPhotos({ siteId }: { siteId: string }) {
  const [images, setImages] = useState<InspirationImage[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);

  useEffect(() => {
    fetch(`/api/sites/${siteId}/inspiration`)
      .then((r) => r.json())
      .then((d) => setImages(d.images ?? []));
  }, [siteId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setStatus(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch(`/api/sites/${siteId}/inspiration`, { method: "POST", body });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Upload failed");
      setImages((prev) => [...(prev ?? []), result.image]);
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Upload failed — try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(imageId: string) {
    await fetch(`/api/sites/${siteId}/inspiration/${imageId}`, { method: "DELETE" });
    setImages((prev) => (prev ?? []).filter((img) => img.id !== imageId));
  }

  const atLimit = (images?.length ?? 0) >= MAX_IMAGES;

  return (
    <div>
      <p className="text-xs text-slate-500">
        Screenshots from the business&apos;s Instagram (or anywhere else that shows their real visual style) — the
        design generator looks at these alongside the business details below. Optional, up to {MAX_IMAGES}.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {images?.map((img) => (
          <div key={img.id} className="group relative h-16 w-16 overflow-hidden rounded-md border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element -- small local admin thumbnail preview */}
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(img.id)}
              aria-label="Remove inspiration photo"
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              Remove
            </button>
          </div>
        ))}
        {!atLimit && (
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:bg-slate-50">
            {uploading ? "…" : "+ Add"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        )}
      </div>
      <FormStatus status={status} className="mt-1" />
    </div>
  );
}
