"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, Star, AtSign } from "lucide-react";
import { DraftSiteButton } from "@/components/DraftSiteButton";
import { instagramDmUrl } from "@/lib/templates";
import { generateOutreachMessage, OUTREACH_VARIANT_COUNT } from "@/lib/outreachMessage";
import {
  QUEUE_KEYS,
  resolveQueueKey,
  actionAdvances,
  outreachPatchForAction,
  pacingLevel,
  PACING_CAUTION,
  PACING_LIMIT,
  type QueueAction,
} from "@/lib/outreachQueue";

type QueueLead = {
  id: string;
  name: string;
  category: string;
  city: string;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
  instagramHandle: string | null;
  rating: number | null;
  createdAt: string;
  sites?: { id: string; slug: string; status: string }[];
};

function previewUrlFor(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/s/${slug}`;
}

export default function OutreachConsolePage() {
  const [queue, setQueue] = useState<QueueLead[] | null>(null);
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState({ sent: 0, skipped: 0, rejected: 0 });

  useEffect(() => {
    fetch("/api/leads/outreach-queue")
      .then((r) => r.json())
      .then((d) => setQueue(d.leads ?? []))
      .catch(() => setQueue([]));
  }, []);

  const lead = queue?.[index];
  const done = queue != null && index >= queue.length;

  function patchLead(leadId: string, body: Record<string, unknown>) {
    fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  const runAction = useCallback(
    (action: QueueAction) => {
      const current = queue?.[index];
      if (!current) return;

      if (action === "send") setSession((s) => ({ ...s, sent: s.sent + 1 }));
      if (action === "skip") setSession((s) => ({ ...s, skipped: s.skipped + 1 }));
      if (action === "reject") setSession((s) => ({ ...s, rejected: s.rejected + 1 }));

      const patch = outreachPatchForAction(action);
      if (patch) patchLead(current.id, patch);

      if (actionAdvances(action)) setIndex((i) => i + 1);
    },
    [queue, index],
  );

  if (queue == null) {
    return <Shell><p className="text-sm text-slate-500">Loading queue…</p></Shell>;
  }

  if (queue.length === 0) {
    return (
      <Shell>
        <EmptyState />
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <Summary session={session} total={queue.length} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-500">
          Lead {index + 1} of {queue.length}
        </p>
        <SessionCounter session={session} />
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${(index / queue.length) * 100}%` }}
        />
      </div>

      <PacingBanner sent={session.sent} />

      <LeadCard
        key={lead!.id}
        lead={lead!}
        onAction={runAction}
        onDrafted={(site) =>
          setQueue((q) => (q ?? []).map((l) => (l.id === lead!.id ? { ...l, sites: [site] } : l)))
        }
      />

      <ShortcutLegend />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Outreach Console</h1>
      <p className="mt-1 text-slate-600">
        One lead at a time. Open the DM, paste, send, then log it with a keystroke. Only leads with
        an Instagram handle that haven&apos;t been contacted yet, best ones first.
      </p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function LeadCard({
  lead,
  onAction,
  onDrafted,
}: {
  lead: QueueLead;
  onAction: (action: QueueAction) => void;
  onDrafted: (site: { id: string; slug: string; status: string }) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewUrl = previewUrlFor(lead.sites?.[0]?.slug);
  const [variant, setVariant] = useState(0);
  const [message, setMessage] = useState(() =>
    generateOutreachMessage(lead, 0, { previewUrl }),
  );
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const dmUrl = instagramDmUrl(lead.instagramHandle);

  function handleDrafted(site: { id: string; slug: string; status: string }) {
    onDrafted(site);
    // The pitch changes from "free mockup" to a live link once a site exists.
    setMessage(generateOutreachMessage(lead, variant, { previewUrl: previewUrlFor(site.slug) }));
  }

  function regenerate() {
    const next = variant + 1;
    setVariant(next);
    setMessage(generateOutreachMessage(lead, next, { previewUrl }));
  }

  const openDm = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the DM still opens, operator can copy by hand */
    }
    if (dmUrl) window.open(dmUrl, "_blank", "noopener,noreferrer");
    setOpened(true);
  }, [message, dmUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const editing = document.activeElement === textareaRef.current;
      if (editing) {
        if (e.key === "Escape") textareaRef.current?.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const action = resolveQueueKey(e.key);
      if (!action) return;
      e.preventDefault();
      if (action === "open") openDm();
      else onAction(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDm, onAction]);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{lead.name}</h2>
          <p className="mt-0.5 text-sm capitalize text-slate-500">
            {lead.category} · {lead.city}
          </p>
        </div>
        {lead.rating != null && (
          <span className="flex shrink-0 items-center gap-1 text-sm text-slate-500">
            <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden="true" />
            {lead.rating}
          </span>
        )}
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
        <AtSign size={14} aria-hidden="true" />
        {lead.instagramHandle?.replace(/^@/, "")}
        {lead.websiteStatus === "POOR" && (
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            has a weak site
          </span>
        )}
      </p>

      <div className="mt-4">
        <DraftSiteButton leadId={lead.id} site={lead.sites?.[0]} onCreated={handleDrafted} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor="dm-message" className="block text-xs font-medium text-slate-500">
            DM message · v{(variant % OUTREACH_VARIANT_COUNT) + 1}
          </label>
          <button
            type="button"
            onClick={regenerate}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <RefreshCw size={12} aria-hidden="true" />
            Try another
          </button>
        </div>
        <textarea
          id="dm-message"
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="input mt-1 py-2"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={openDm}
          className={`col-span-2 rounded-md px-3 py-2 text-sm font-medium sm:col-span-1 ${
            opened
              ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
              : "bg-pink-600 text-white hover:bg-pink-700"
          }`}
        >
          {copied ? "Copied ✓" : opened ? "Open DM again" : "Open DM ⏎"}
        </button>
        <button
          type="button"
          onClick={() => onAction("send")}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Sent · 1
        </button>
        <button
          type="button"
          onClick={() => onAction("skip")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Skip · 2
        </button>
        <button
          type="button"
          onClick={() => onAction("reject")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Not a fit · 3
        </button>
      </div>
    </div>
  );
}

function ShortcutLegend() {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-4">
      {QUEUE_KEYS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1.5">
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
            {key}
          </kbd>
          <span>{label}</span>
        </div>
      ))}
    </dl>
  );
}

function SessionCounter({ session }: { session: { sent: number; skipped: number; rejected: number } }) {
  return (
    <p className="text-xs text-slate-400">
      <span className="font-medium text-emerald-600">{session.sent} sent</span> · {session.skipped}{" "}
      skipped · {session.rejected} not a fit
    </p>
  );
}

function PacingBanner({ sent }: { sent: number }) {
  const level = pacingLevel(sent);
  if (level === "ok") return null;
  return (
    <p
      className={`mt-4 rounded-md px-3 py-2 text-sm font-medium ${
        level === "limit" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {level === "limit"
        ? `${sent} DMs sent today. Instagram rate-limits accounts past ~${PACING_LIMIT} cold DMs a day — stop here and pick this up tomorrow.`
        : `${sent} DMs sent today. Ease off as you near ~${PACING_LIMIT}; past ${PACING_CAUTION} in a burst reads as automation.`}
    </p>
  );
}

function PacingReminder() {
  return (
    <p className="mt-3 text-xs text-slate-400">
      Every send opens the real Instagram DM thread — you paste and send it yourself. Keep it under
      ~{PACING_LIMIT} a day per account and vary the wording so it stays personal.
    </p>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-700">Queue&apos;s empty.</p>
      <p className="mt-1 text-sm text-slate-500">
        Every lead with an Instagram handle has been contacted. Find more on the{" "}
        <Link href="/leads" className="text-blue-600 hover:underline">
          Lead Finder
        </Link>
        , or add handles to existing leads with the &quot;Find it&quot; button there.
      </p>
    </div>
  );
}

function Summary({
  session,
  total,
}: {
  session: { sent: number; skipped: number; rejected: number };
  total: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-medium text-slate-700">Worked through all {total} leads.</p>
      <p className="mt-2 text-sm text-slate-500">
        <span className="font-medium text-emerald-600">{session.sent}</span> DMs sent ·{" "}
        {session.skipped} skipped · {session.rejected} marked not a fit.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Sent leads moved to the{" "}
        <Link href="/pipeline" className="text-blue-600 hover:underline">
          Pipeline
        </Link>{" "}
        with a follow-up in 3 days.
      </p>
      <PacingReminder />
    </div>
  );
}
