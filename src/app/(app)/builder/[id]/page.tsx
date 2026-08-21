"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SiteEditorForm, type EditableSite } from "@/components/SiteEditorForm";
import { FormStatus, autoClearStatus, type StatusMessage } from "@/components/FormStatus";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { BuilderTabs } from "@/components/BuilderTabs";
import { ContactSubmissions } from "@/components/ContactSubmissions";
import { withUtm } from "@/lib/utm";

export default function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [site, setSite] = useState<EditableSite | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<StatusMessage>(null);
  const [publishMessage, setPublishMessage] = useState<StatusMessage>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/sites/${id}`)
      .then((r) => r.json())
      .then((d) => setSite(d.site));
  }, [id]);

  async function handleSave(data: EditableSite) {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to save");
      setSite(result.site);
      autoClearStatus(setSaveMessage, { type: "success", text: "Saved." });
    } catch (err) {
      autoClearStatus(setSaveMessage, {
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong — try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function performTogglePublish() {
    if (!site) return;
    setConfirmOpen(false);
    setPublishing(true);
    setPublishMessage(null);
    try {
      const nextStatus = site.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      const res = await fetch(`/api/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to update");
      setSite(result.site);
      autoClearStatus(setPublishMessage, {
        type: "success",
        text: nextStatus === "PUBLISHED" ? "Published." : "Unpublished.",
      });
    } catch (err) {
      autoClearStatus(setPublishMessage, {
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong — try again.",
      });
    } finally {
      setPublishing(false);
    }
  }

  if (!site) return <p className="mx-auto max-w-6xl px-6 py-12 text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-slate-900">
            {site.businessName || "Untitled site"}
          </h1>
          {site.status === "PUBLISHED" ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>
                Live at{" "}
                <Link href={`/s/${site.slug}`} className="text-blue-600 hover:underline" target="_blank">
                  /s/{site.slug}
                </Link>
              </span>
              <CopyButton
                text={withUtm(`${typeof window !== "undefined" ? window.location.origin : ""}/s/${site.slug}`, {
                  enabled: site.utmTrackingEnabled ?? false,
                  slug: site.slug ?? "",
                })}
                label="Copy link"
                copiedLabel="Link copied ✓"
              />
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Draft — not visible to the public yet</p>
          )}
        </div>
        <div className="text-right">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={publishing}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              site.status === "PUBLISHED"
                ? "border border-slate-300 text-slate-700 hover:bg-slate-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {publishing ? "Working…" : site.status === "PUBLISHED" ? "Unpublish" : "Publish site"}
          </button>
          <FormStatus status={publishMessage} className="mt-1.5" />
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={site.status === "PUBLISHED" ? "Unpublish this site?" : "Publish this site?"}
        description={
          site.status === "PUBLISHED"
            ? "The public page will stop being reachable until you publish it again."
            : "This makes the site publicly reachable at its /s/ URL."
        }
        confirmLabel={site.status === "PUBLISHED" ? "Unpublish" : "Publish"}
        danger={site.status === "PUBLISHED"}
        onConfirm={performTogglePublish}
        onCancel={() => setConfirmOpen(false)}
      />

      <BuilderTabs id={id} />

      <FormStatus status={saveMessage} className="mt-4" />

      <div className="mt-8">
        <SiteEditorForm initial={site} onSave={handleSave} saving={saving} />
      </div>

      <div className="mt-12">
        <ContactSubmissions siteId={id} />
      </div>
    </div>
  );
}
