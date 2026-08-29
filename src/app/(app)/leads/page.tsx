"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { RefreshCw, Star } from "lucide-react";
import { instagramDmUrl } from "@/lib/templates";
import { generateOutreachMessage, OUTREACH_VARIANT_COUNT } from "@/lib/outreachMessage";
import { FormStatus } from "@/components/FormStatus";
import { OutreachControls } from "@/components/OutreachControls";
import { DraftSiteButton } from "@/components/DraftSiteButton";
import { LeadFilterBar } from "@/components/LeadFilterBar";
import {
  DEFAULT_LEAD_FILTERS,
  filterLeads,
  leadFacets,
  parseStoredFilters,
  sortLeads,
  type LeadFilters,
  type LeadSortKey,
} from "@/lib/leadBacklog";

function previewUrlFor(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/s/${slug}`;
}
import { OUTREACH_LABEL, OUTREACH_STYLE, type OutreachStatus } from "@/lib/outreachStatus";
import { TRADE_OPTIONS } from "@/lib/serviceSuggestions";

type Lead = {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  existingUrl: string | null;
  instagramHandle: string | null;
  rating: number | null;
  reviewCount: number | null;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
  source: "GOOGLE_PLACES" | "MOCK";
  outreachStatus: OutreachStatus;
  createdAt: string;
  lastContactedAt: string | null;
  followUpAt: string | null;
  sites?: { id: string; slug: string; status: string }[];
};

const STATUS_LABEL: Record<Lead["websiteStatus"], string> = {
  NONE: "No website",
  POOR: "Weak website",
  HAS_SITE: "Has a website",
};

const STATUS_STYLE: Record<Lead["websiteStatus"], string> = {
  NONE: "bg-red-100 text-red-700",
  POOR: "bg-amber-100 text-amber-700",
  HAS_SITE: "bg-emerald-100 text-emerald-700",
};

export default function LeadsPage() {
  const [city, setCity] = useState("Austin, TX");
  const [categories, setCategories] = useState<string[]>([
    "nail technician",
    "lash technician",
    "brow technician",
    "barber",
  ]);
  const [radiusMiles, setRadiusMiles] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingLiveData, setUsingLiveData] = useState<boolean | null>(null);
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_LEAD_FILTERS);
  const [sortKey, setSortKey] = useState<LeadSortKey>("newest");
  const [visibleCount, setVisibleCount] = useState(60);
  // Previous applied view, held in state (not a ref) so the render-time reset
  // below is lint-clean.
  const [prevView, setPrevView] = useState<{ filters: LeadFilters; sortKey: LeadSortKey }>({
    filters: DEFAULT_LEAD_FILTERS,
    sortKey: "newest",
  });

  // Restore the operator's saved view after mount. Reading localStorage during
  // render would mismatch between SSR (no window) and the client (stored value),
  // so we seed from defaults and load the stored view in an effect instead. The
  // saved prevView is set in the same effect so the cap-reset logic doesn't
  // misfire on the restored view. setState is deferred out of the synchronous
  // effect body (post-hydration), keeping React's set-state-in-effect rule quiet.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const storedView = parseStoredFilters(window.localStorage.getItem("launchlocal.leadFilters"));
        setFilters(storedView.filters);
        setSortKey(storedView.sortKey);
        setPrevView(storedView);
      } catch {
        // Storage may be unavailable (private mode / quota); keep defaults.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/leads");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load leads");
        if (!cancelled) setLeads(data.leads ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load leads");
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, categories, radiusMiles: radiusMiles || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setUsingLiveData(data.usingLiveData);
      const incoming = (data.leads ?? []) as Lead[];
      setLeads((prev) => {
        const incomingIds = incoming.map((inc) => inc.id);
        const merged = [
          ...incoming,
          ...prev.filter((p) => !incomingIds.includes(p.id)),
        ];
        setMergeStatus(
          `Added ${incomingIds.filter((id) => !prev.some((p) => p.id === id)).length} new, ` +
            `refreshed ${incomingIds.filter((id) => prev.some((p) => p.id === id)).length} already in your backlog.`,
        );
        setTimeout(() => setMergeStatus(null), 4000);
        return merged;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function updateInstagramHandle(leadId: string, handle: string): Promise<boolean> {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, instagramHandle: handle } : l)));
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramHandle: handle || null }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function updateEmail(leadId: string, email: string): Promise<boolean> {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, email } : l)));
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || null }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  function updateOutreach(leadId: string, patch: { outreachStatus?: OutreachStatus; followUpAt?: string | null }) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              ...(patch.outreachStatus ? { outreachStatus: patch.outreachStatus } : {}),
              ...("followUpAt" in patch ? { followUpAt: patch.followUpAt ?? null } : {}),
            }
          : l
      )
    );
    fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  function markLeadDrafted(leadId: string, site: { id: string; slug: string; status: string }) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, sites: [site] } : l)));
  }

  const facets = useMemo(() => leadFacets(leads), [leads]);
  const visible = useMemo(() => sortLeads(filterLeads(leads, filters), sortKey), [leads, filters, sortKey]);
  const shown = visible.slice(0, visibleCount);

  // Reset the "Load more" cap whenever the filter or sort changes, so a stale
  // slice can't be shown. Compared against the previous applied view held in
  // state and adjusted during render — React's recommended pattern, avoids a
  // cascading-render setState in an effect.
  if (prevView.filters !== filters || prevView.sortKey !== sortKey) {
    setPrevView({ filters, sortKey });
    setVisibleCount(60);
  }

  // Persist filter + sort so the operator's view survives a reload. Writing
  // localStorage is an external-system sync (allowed in an effect); the read
  // happens lazily in the initializer above.
  useEffect(() => {
    try {
      window.localStorage.setItem("launchlocal.leadFilters", JSON.stringify({ filters, sortKey }));
    } catch {
      // Storage may be unavailable (private mode / quota); ignoring keeps the
      // in-memory filters working.
    }
  }, [filters, sortKey]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Lead Finder</h1>
      <p className="mt-1 text-slate-600">
        Search businesses by city and category. We flag the ones with no website or a weak one.
      </p>

      <form onSubmit={handleSearch} className="mt-6 flex flex-wrap items-start gap-4">
        <div>
          <label htmlFor="lead-city" className="block text-sm font-medium text-slate-700">
            City
          </label>
          <input
            id="lead-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input mt-1 w-56"
            placeholder="Austin, TX"
          />
        </div>
        <div>
          <label htmlFor="lead-category" className="block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="lead-category"
            multiple
            size={5}
            value={categories}
            onChange={(e) => setCategories(Array.from(e.target.selectedOptions, (o) => o.value))}
            className="mt-1 w-56 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {TRADE_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Hold Ctrl (⌘ on Mac) to search more than one trade at once.</p>
        </div>
        <div>
          <label htmlFor="lead-radius" className="block text-sm font-medium text-slate-700">
            Radius (miles)
          </label>
          <input
            id="lead-radius"
            type="number"
            min={1}
            max={31}
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(e.target.value)}
            className="input mt-1 w-28"
            placeholder="any"
          />
        </div>
        <button
          type="submit"
          disabled={loading || categories.length === 0}
          className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-400">
        Radius search geocodes the city/address you enter and searches within that distance (max 31 miles). Leave
        blank to search the whole named area instead. Radius only applies to live Google results, not sample data.
      </p>

      <FormStatus status={error ? { type: "error", text: error } : null} className="mt-4" />
      {mergeStatus && <p className="mt-4 text-sm text-emerald-600">{mergeStatus}</p>}
      {usingLiveData !== null && (
        <p className="mt-4 text-xs text-slate-500">
          {usingLiveData
            ? "Live results from Google Places."
            : "No GOOGLE_PLACES_API_KEY configured — showing generated sample data. Add one to .env to search real businesses."}
        </p>
      )}

      {leads.length > 0 && (
        <LeadFilterBar
          filters={filters}
          onChange={setFilters}
          sortKey={sortKey}
          onSortChange={setSortKey}
          facets={facets}
          total={leads.length}
          shown={visible.length}
        />
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onSaveInstagram={updateInstagramHandle}
            onSaveEmail={updateEmail}
            onOutreachChange={updateOutreach}
            onSiteCreated={markLeadDrafted}
          />
        ))}
        {initialLoading && (
          <p className="text-sm text-slate-500">Loading leads…</p>
        )}
        {!loading && !initialLoading && leads.length === 0 && (
          <p className="text-sm text-slate-500">No leads yet — run a search above to start building your backlog.</p>
        )}
        {!loading && !initialLoading && leads.length > 0 && visible.length === 0 && (
          <p className="text-sm text-slate-500">
            No leads match these filters.{" "}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => {
                setFilters(DEFAULT_LEAD_FILTERS);
                setSortKey("newest");
              }}
            >
              Reset filters
            </button>
          </p>
        )}
      </div>
      {visible.length > visibleCount && (
        <div className="mt-6 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 60)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Load more
          </button>
          <p className="text-xs text-slate-400">
            Showing {Math.min(visibleCount, visible.length)} of {visible.length}
          </p>
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  onSaveInstagram,
  onSaveEmail,
  onOutreachChange,
  onSiteCreated,
}: {
  lead: Lead;
  onSaveInstagram: (leadId: string, handle: string) => Promise<boolean>;
  onSaveEmail: (leadId: string, email: string) => Promise<boolean>;
  onOutreachChange: (leadId: string, patch: { outreachStatus?: OutreachStatus; followUpAt?: string | null }) => void;
  onSiteCreated: (leadId: string, site: { id: string; slug: string; status: string }) => void;
}) {
  const uid = useId();
  const previewUrl = previewUrlFor(lead.sites?.[0]?.slug);
  const [handle, setHandle] = useState(lead.instagramHandle ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [looking, setLooking] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState(0);
  const [message, setMessage] = useState(() => generateOutreachMessage(lead, 0, { previewUrl }));
  const [copied, setCopied] = useState(false);
  const [instagramSaveState, setInstagramSaveState] = useState<"saved" | "error" | null>(null);
  const [emailSaveState, setEmailSaveState] = useState<"saved" | "error" | null>(null);
  const dmUrl = instagramDmUrl(handle);

  async function handleInstagramBlur() {
    if (handle === (lead.instagramHandle ?? "")) return;
    const ok = await onSaveInstagram(lead.id, handle);
    setInstagramSaveState(ok ? "saved" : "error");
    setTimeout(() => setInstagramSaveState(null), 2000);
  }

  async function handleEmailBlur() {
    if (email === (lead.email ?? "")) return;
    const ok = await onSaveEmail(lead.id, email);
    setEmailSaveState(ok ? "saved" : "error");
    setTimeout(() => setEmailSaveState(null), 2000);
  }

  function regenerateMessage() {
    const next = variant + 1;
    setVariant(next);
    setMessage(generateOutreachMessage(lead, next, { previewUrl }));
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleLookup() {
    setLooking(true);
    setLookupMessage(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/lookup-instagram`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setLookupMessage(data.error ?? "Lookup failed");
        return;
      }
      if (data.found) {
        setHandle(data.lead.instagramHandle);
        onSaveInstagram(lead.id, data.lead.instagramHandle);
      } else {
        setLookupMessage("Couldn't find an Instagram for this business — try entering it manually.");
      }
    } catch {
      setLookupMessage("Lookup failed — try again.");
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="break-words font-semibold text-slate-900">{lead.name}</h3>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[lead.websiteStatus]}`}>
            {STATUS_LABEL[lead.websiteStatus]}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OUTREACH_STYLE[lead.outreachStatus]}`}>
            {OUTREACH_LABEL[lead.outreachStatus]}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm capitalize text-slate-500">{lead.category}</p>
      <p className="mt-2 text-sm text-slate-600">{lead.address}</p>
      {lead.phone && (
        <a href={`tel:${lead.phone}`} className="block text-sm text-blue-600 hover:underline">
          {lead.phone}
        </a>
      )}
      {lead.rating != null && (
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
          <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden="true" />
          {lead.rating} ({lead.reviewCount ?? 0} reviews)
        </p>
      )}
      {lead.existingUrl && (
        <a
          href={lead.existingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block truncate text-sm text-blue-600 hover:underline"
        >
          {lead.existingUrl}
        </a>
      )}

      <div className="mt-3">
        <label htmlFor={`${uid}-email`} className="block text-xs font-medium text-slate-500">
          Email
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={`${uid}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleEmailBlur}
            placeholder="owner@business.com"
            className="input py-1.5"
          />
          {email && (
            <a
              href={`mailto:${email}`}
              className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Email ↗
            </a>
          )}
        </div>
        {emailSaveState && (
          <p className={`mt-1 text-xs ${emailSaveState === "saved" ? "text-emerald-600" : "text-red-600"}`}>
            {emailSaveState === "saved" ? "Saved ✓" : "Couldn't save — try again."}
          </p>
        )}
      </div>

      <div className="mt-3">
        <label htmlFor={`${uid}-ig`} className="block text-xs font-medium text-slate-500">
          Instagram handle
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={`${uid}-ig`}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onBlur={handleInstagramBlur}
            placeholder="@business_handle"
            className="input py-1.5"
          />
          {!handle && (
            <button
              type="button"
              onClick={handleLookup}
              disabled={looking}
              className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {looking ? "Looking…" : "Find it"}
            </button>
          )}
          {!handle && (
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${lead.name} ${lead.city} instagram`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Search Google ↗
            </a>
          )}
        </div>
        {lookupMessage && <p className="mt-1 text-xs text-amber-600">{lookupMessage}</p>}
        {instagramSaveState && (
          <p className={`mt-1 text-xs ${instagramSaveState === "saved" ? "text-emerald-600" : "text-red-600"}`}>
            {instagramSaveState === "saved" ? "Saved ✓" : "Couldn't save — try again."}
          </p>
        )}
      </div>

      {lead.websiteStatus !== "HAS_SITE" && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <label htmlFor={`${uid}-dm`} className="block text-xs font-medium text-slate-500">
              DM message · v{(variant % OUTREACH_VARIANT_COUNT) + 1}
            </label>
            <button
              type="button"
              onClick={regenerateMessage}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Try another
            </button>
          </div>
          <textarea
            id={`${uid}-dm`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="input mt-1 py-1.5"
          />
          <button
            type="button"
            onClick={copyMessage}
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied ? "Copied ✓" : "Copy message"}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DraftSiteButton
          leadId={lead.id}
          site={lead.sites?.[0]}
          onCreated={(site) => {
            onSiteCreated(lead.id, site);
            setMessage(generateOutreachMessage(lead, variant, { previewUrl: previewUrlFor(site.slug) }));
          }}
        />
        {dmUrl && (
          <a
            href={dmUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (lead.outreachStatus === "NEW") onOutreachChange(lead.id, { outreachStatus: "CONTACTED" });
            }}
            className="rounded-md border border-pink-300 px-3 py-1.5 text-sm font-medium text-pink-600 hover:bg-pink-50"
          >
            DM on Instagram
          </a>
        )}
      </div>

      <OutreachControls
        leadId={lead.id}
        outreachStatus={lead.outreachStatus}
        followUpAt={lead.followUpAt}
        onChange={onOutreachChange}
      />
    </div>
  );
}
