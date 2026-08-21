"use client";

import { useState } from "react";
import { SitePreview, TEMPLATES, type SiteData } from "@/lib/templates";
import { FormStatus } from "@/components/FormStatus";

export type EditableSite = SiteData & {
  id?: string;
  status?: "DRAFT" | "PUBLISHED";
  slug?: string;
  utmTrackingEnabled?: boolean;
  googleSiteVerification?: string | null;
};

export function SiteEditorForm({
  initial,
  onSave,
  saving,
}: {
  initial: EditableSite;
  onSave: (data: EditableSite) => void | Promise<void>;
  saving?: boolean;
}) {
  const [data, setData] = useState<EditableSite>(initial);
  const [uploading, setUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function set<K extends keyof EditableSite>(key: K, value: EditableSite[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !data.id) return;

    setUploading(true);
    setPhotoMessage(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch(`/api/sites/${data.id}/photo`, { method: "POST", body });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Upload failed");
      set("photoUrl", result.site.photoUrl);
      setPhotoMessage({ type: "success", text: "Photo uploaded." });
    } catch (err) {
      setPhotoMessage({ type: "error", text: err instanceof Error ? err.message : "Upload failed — try again." });
    } finally {
      setUploading(false);
      setTimeout(() => setPhotoMessage(null), 3000);
    }
  }

  async function handlePhotoRemove() {
    if (!data.id) return;
    setUploading(true);
    setPhotoMessage(null);
    try {
      const res = await fetch(`/api/sites/${data.id}/photo`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Couldn't remove photo");
      set("photoUrl", null);
    } catch (err) {
      setPhotoMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong" });
      setTimeout(() => setPhotoMessage(null), 3000);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-5">
        <Field label="Business name">
          <input
            className="input"
            value={data.businessName}
            onChange={(e) => set("businessName", e.target.value)}
          />
        </Field>
        <Field label="Photo">
          {!data.id ? (
            <p className="text-sm text-slate-500">Save the site first, then come back here to add a photo.</p>
          ) : (
            <div className="flex items-center gap-3">
              {data.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- small local thumbnail preview, next/image is overkill here
                <img
                  src={data.photoUrl}
                  alt=""
                  className="h-14 w-14 rounded-md border border-slate-200 object-cover"
                />
              )}
              <div>
                <label className="inline-block cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {uploading ? "Uploading…" : data.photoUrl ? "Replace photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading}
                    onChange={handlePhotoSelect}
                  />
                </label>
                {data.photoUrl && (
                  <button
                    type="button"
                    onClick={handlePhotoRemove}
                    disabled={uploading}
                    className="ml-2 text-sm font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
                <FormStatus status={photoMessage} className="mt-1" />
              </div>
            </div>
          )}
        </Field>
        <Field label="Tagline">
          <input
            className="input"
            value={data.tagline ?? ""}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="Fast, friendly, family-owned since 1998"
          />
        </Field>
        <Field label="About">
          <textarea
            className="input min-h-24"
            value={data.about ?? ""}
            onChange={(e) => set("about", e.target.value)}
          />
        </Field>
        <Field label="Story (optional, for a dedicated About page)">
          <textarea
            className="input min-h-24"
            value={data.story ?? ""}
            onChange={(e) => set("story", e.target.value)}
            placeholder="A longer version of your story — separate paragraphs with a blank line."
          />
        </Field>
        <Field label="Services">
          <ServicesEditor
            services={data.serviceItems ?? []}
            onChange={(items) => set("serviceItems", items)}
          />
        </Field>
        <Field label="Hours">
          <textarea
            className="input min-h-20"
            value={data.hours ?? ""}
            onChange={(e) => set("hours", e.target.value)}
            placeholder={"Mon-Fri: 8am-6pm\nSat: 9am-2pm"}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input className="input" value={data.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={data.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              placeholder="hello@business.com"
            />
          </Field>
        </div>
        <Field label="Address">
          <input className="input" value={data.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Instagram handle">
          <input
            className="input"
            value={data.instagramHandle ?? ""}
            onChange={(e) => set("instagramHandle", e.target.value)}
            placeholder="@business_handle"
          />
          <p className="mt-1 text-xs text-slate-500">
            Adds a &ldquo;DM us on Instagram&rdquo; button that opens a DM to this account.
          </p>
        </Field>
        <Field label="Facebook URL">
          <input
            className="input"
            value={data.facebookUrl ?? ""}
            onChange={(e) => set("facebookUrl", e.target.value)}
            placeholder="https://facebook.com/yourbusiness"
          />
        </Field>
        <Field label="Payment methods (comma-separated)">
          <input
            className="input"
            value={data.paymentMethods ?? ""}
            onChange={(e) => set("paymentMethods", e.target.value)}
            placeholder="Cash, Card, Venmo"
          />
        </Field>
        <Field label="Guarantee statement">
          <input
            className="input"
            value={data.guaranteeText ?? ""}
            onChange={(e) => set("guaranteeText", e.target.value)}
            placeholder="100% satisfaction guaranteed"
          />
        </Field>
        <Field label="Template">
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => set("template", t.id)}
                className={`rounded-md border p-2 text-left text-xs ${
                  data.template === t.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"
                }`}
              >
                <div className="font-semibold">{t.name}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Accent color">
          <input
            type="color"
            value={data.primaryColor}
            onChange={(e) => set("primaryColor", e.target.value)}
            className="h-10 w-16 rounded border border-slate-300"
          />
        </Field>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={data.utmTrackingEnabled ?? false}
            onChange={(e) => set("utmTrackingEnabled", e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Tag shared links with UTM parameters
            <span className="block text-xs text-slate-500">
              Adds utm_source/utm_medium/utm_campaign to the site link when it&apos;s copied from the admin app.
            </span>
          </span>
        </label>
        <Field label="Google Search Console verification code (optional)">
          <input
            className="input"
            value={data.googleSiteVerification ?? ""}
            onChange={(e) => set("googleSiteVerification", e.target.value)}
            placeholder="Paste the content value from a google-site-verification meta tag"
          />
          <p className="mt-1 text-xs text-slate-500">
            Get this from Google Search Console after adding this site&apos;s URL as a property.
          </p>
        </Field>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(data)}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
          Live preview
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          <SitePreview site={data} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

type EditableService = { id?: string; slug?: string; name: string; description?: string | null };

function ServicesEditor({
  services,
  onChange,
}: {
  services: EditableService[];
  onChange: (services: EditableService[]) => void;
}) {
  function update(index: number, patch: Partial<EditableService>) {
    onChange(services.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function remove(index: number) {
    onChange(services.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= services.length) return;
    const next = [...services];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {services.map((s, i) => (
        <div key={s.id ?? i} className="rounded-md border border-slate-300 p-3">
          <div className="flex items-start gap-2">
            <input
              className="input"
              value={s.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Service name"
            />
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
                className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-xs text-slate-500 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === services.length - 1}
                aria-label="Move down"
                className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-xs text-slate-500 disabled:opacity-30"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove service"
              className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600"
            >
              Remove
            </button>
          </div>
          <textarea
            className="input mt-2 min-h-16 text-xs"
            value={s.description ?? ""}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Optional longer description — gives this service its own page"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...services, { name: "" }])}
        className="w-full rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        + Add service
      </button>
    </div>
  );
}
