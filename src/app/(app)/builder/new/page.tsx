"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteEditorForm, type EditableSite } from "@/components/SiteEditorForm";
import { FormStatus } from "@/components/FormStatus";

const BLANK: EditableSite = {
  businessName: "",
  tagline: "",
  about: "",
  story: "",
  hours: "",
  phone: "",
  email: "",
  address: "",
  instagramHandle: "",
  facebookUrl: "",
  guaranteeText: "",
  paymentMethods: "",
  template: "classic",
  primaryColor: "#2563eb",
  serviceItems: [],
};

function NewSiteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");

  const [initial, setInitial] = useState<EditableSite>(BLANK);
  const [ready, setReady] = useState(!leadId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.lead) {
          setInitial((prev) => ({
            ...prev,
            businessName: d.lead.name,
            phone: d.lead.phone ?? "",
            email: d.lead.email ?? "",
            address: d.lead.address ?? "",
            instagramHandle: d.lead.instagramHandle ?? "",
            tagline: `Your trusted ${d.lead.category} in ${d.lead.city}`,
          }));
        }
      })
      .finally(() => setReady(true));
  }, [leadId]);

  async function handleSave(data: EditableSite) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, leadId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to create site");
      router.push(`/builder/${result.site.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
      setSaving(false);
    }
  }

  if (!ready) return <p className="mx-auto max-w-6xl px-6 py-12 text-slate-500">Loading lead details…</p>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">New site</h1>
      <p className="mt-1 text-slate-600">Fill in the details and pick a template. You can publish later.</p>
      <FormStatus status={error ? { type: "error", text: error } : null} className="mt-4" />
      <div className="mt-8">
        <SiteEditorForm initial={initial} onSave={handleSave} saving={saving} />
      </div>
    </div>
  );
}

export default function NewSitePage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-6 py-12 text-slate-500">Loading…</p>}>
      <NewSiteInner />
    </Suspense>
  );
}
