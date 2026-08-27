"use client";

import { useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";

type ExistingSite = { id: string; slug: string; status: string };

/**
 * One click turns a lead into a draft site pre-filled from its Google data
 * (contact, rating, real reviews, category-typical services). Once a site
 * exists it becomes an edit link plus a one-tap copy of the public preview
 * URL — the thing you paste into the DM.
 */
export function DraftSiteButton({
  leadId,
  site,
  onCreated,
}: {
  leadId: string;
  site?: ExistingSite | null;
  onCreated?: (site: ExistingSite) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Couldn't draft a site");
      onCreated?.({ id: result.site.id, slug: result.site.slug, status: result.site.status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (site) {
    const previewUrl =
      typeof window !== "undefined" ? `${window.location.origin}/s/${site.slug}` : `/s/${site.slug}`;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/builder/${site.id}`} className="text-sm font-medium text-slate-700 hover:underline">
          Edit site →
        </Link>
        <CopyButton text={previewUrl} label="Copy preview link" copiedLabel="Link copied ✓" />
        {site.status !== "PUBLISHED" && <span className="text-xs text-slate-400">draft</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={draft}
        disabled={pending}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Drafting…" : "Draft site"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
