"use client";

import { use, useEffect, useState } from "react";
import { BuilderTabs } from "@/components/BuilderTabs";
import { FormStatus, type StatusMessage } from "@/components/FormStatus";

type GalleryItem = { id: string; beforeUrl: string; afterUrl: string; caption: string | null };

export default function GalleryAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);

  useEffect(() => {
    fetch(`/api/sites/${id}/gallery`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!before || !after) {
      setStatus({ type: "error", text: "Choose both a before and an after photo." });
      return;
    }
    setUploading(true);
    setStatus(null);
    try {
      const body = new FormData();
      body.append("before", before);
      body.append("after", after);
      if (caption.trim()) body.append("caption", caption.trim());
      const res = await fetch(`/api/sites/${id}/gallery`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setItems((prev) => [...(prev ?? []), data.item]);
      setBefore(null);
      setAfter(null);
      setCaption("");
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function removeItem(itemId: string) {
    await fetch(`/api/sites/${id}/gallery/${itemId}`, { method: "DELETE" });
    setItems((prev) => (prev ?? []).filter((it) => it.id !== itemId));
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Gallery</h1>
      <p className="mt-1 text-slate-600">Before/after photo pairs shown on this site&apos;s gallery page.</p>
      <BuilderTabs id={id} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {items === null && <p className="text-sm text-slate-500">Loading…</p>}
        {items?.length === 0 && <p className="text-sm text-slate-500">No photos yet.</p>}
        {items?.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-3">
            <div className="grid grid-cols-2 gap-1 overflow-hidden rounded">
              {/* eslint-disable-next-line @next/next/no-img-element -- small local thumbnail, next/image is overkill here */}
              <img src={item.beforeUrl} alt="Before" className="h-32 w-full object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element -- small local thumbnail, next/image is overkill here */}
              <img src={item.afterUrl} alt="After" className="h-32 w-full object-cover" />
            </div>
            {item.caption && <p className="mt-2 text-sm text-slate-600">{item.caption}</p>}
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="mt-2 text-xs font-medium text-slate-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-8 space-y-3 rounded-md border border-dashed border-slate-300 p-4">
        <p className="text-sm font-medium text-slate-700">Add a before/after pair</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-500">Before photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setBefore(e.target.files?.[0] ?? null)}
              className="mt-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-500">After photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setAfter(e.target.files?.[0] ?? null)}
              className="mt-1 text-sm"
            />
          </label>
        </div>
        <input
          className="input"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (optional)"
        />
        <button
          type="submit"
          disabled={uploading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Add photos"}
        </button>
        <FormStatus status={status} />
      </form>
    </div>
  );
}
