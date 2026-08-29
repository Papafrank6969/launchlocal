"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, AtSign, Clock } from "lucide-react";
import { OutreachNav } from "@/components/OutreachNav";
import { instagramDmUrl } from "@/lib/templates";
import { generateFollowUpMessage, FOLLOW_UP_VARIANT_COUNT } from "@/lib/followUpMessage";
import {
  FOLLOW_UP_KEYS,
  resolveFollowUpKey,
  followUpActionAdvances,
  followUpPatchForAction,
  MAX_FOLLOW_UPS,
  type FollowUpAction,
} from "@/lib/followUpQueue";

type FollowUpLead = {
  id: string;
  name: string;
  category: string;
  city: string;
  instagramHandle: string | null;
  followUpAt: string | null;
  followUpCount: number;
  sites?: { id: string; slug: string; status: string }[];
};

function previewUrlFor(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/s/${slug}`;
}

function daysOverdue(followUpAt: string | null): number {
  if (!followUpAt) return 0;
  const ms = Date.now() - new Date(followUpAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export default function FollowUpConsolePage() {
  const [queue, setQueue] = useState<FollowUpLead[] | null>(null);
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState({ bumped: 0, skipped: 0, replied: 0, gaveUp: 0 });

  useEffect(() => {
    fetch("/api/leads/follow-up-queue")
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
    (action: FollowUpAction) => {
      const current = queue?.[index];
      if (!current) return;

      if (action === "bump") setSession((s) => ({ ...s, bumped: s.bumped + 1 }));
      if (action === "skip") setSession((s) => ({ ...s, skipped: s.skipped + 1 }));
      if (action === "replied") setSession((s) => ({ ...s, replied: s.replied + 1 }));
      if (action === "giveUp") setSession((s) => ({ ...s, gaveUp: s.gaveUp + 1 }));

      const patch = followUpPatchForAction(action, current);
      if (patch) patchLead(current.id, patch);

      if (followUpActionAdvances(action)) setIndex((i) => i + 1);
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

      <LeadCard key={lead!.id} lead={lead!} onAction={runAction} />

      <ShortcutLegend />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Outreach Console</h1>
      <p className="mt-1 text-slate-600">
        Second touch, one lead at a time. Leads you DM&apos;d that haven&apos;t replied by their
        follow-up date, most overdue first. Bumped past {MAX_FOLLOW_UPS} touches drop out — that&apos;s
        a call for the{" "}
        <Link href="/pipeline" className="text-blue-600 hover:underline">
          Pipeline
        </Link>
        , not another DM.
      </p>
      <OutreachNav active="follow-up" />
      <div className="mt-8">{children}</div>
    </div>
  );
}

function LeadCard({ lead, onAction }: { lead: FollowUpLead; onAction: (action: FollowUpAction) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewUrl = previewUrlFor(lead.sites?.[0]?.slug);
  const [variant, setVariant] = useState(0);
  const [message, setMessage] = useState(() => generateFollowUpMessage(lead, 0, { previewUrl }));
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const dmUrl = instagramDmUrl(lead.instagramHandle);

  function regenerate() {
    const next = variant + 1;
    setVariant(next);
    setMessage(generateFollowUpMessage(lead, next, { previewUrl }));
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
      const action = resolveFollowUpKey(e.key);
      if (!action) return;
      e.preventDefault();
      if (action === "open") openDm();
      else onAction(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDm, onAction]);

  const overdueDays = daysOverdue(lead.followUpAt);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{lead.name}</h2>
          <p className="mt-0.5 text-sm capitalize text-slate-500">
            {lead.category} · {lead.city}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <Clock size={12} aria-hidden="true" />
          {overdueDays === 0 ? "due today" : `${overdueDays}d overdue`}
        </span>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
        <AtSign size={14} aria-hidden="true" />
        {lead.instagramHandle?.replace(/^@/, "")}
        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          touch {lead.followUpCount + 2} of {MAX_FOLLOW_UPS + 1}
        </span>
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor="followup-message" className="block text-xs font-medium text-slate-500">
            Follow-up message · v{(variant % FOLLOW_UP_VARIANT_COUNT) + 1}
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
          id="followup-message"
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
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
          onClick={() => onAction("bump")}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Followed up · 1
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
          onClick={() => onAction("replied")}
          className="rounded-md border border-purple-300 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
        >
          They replied · 3
        </button>
      </div>
      <button
        type="button"
        onClick={() => onAction("giveUp")}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
      >
        Give up — no response · 4
      </button>
    </div>
  );
}

function ShortcutLegend() {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
      {FOLLOW_UP_KEYS.map(({ key, label }) => (
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

function SessionCounter({
  session,
}: {
  session: { bumped: number; skipped: number; replied: number; gaveUp: number };
}) {
  return (
    <p className="text-xs text-slate-400">
      <span className="font-medium text-emerald-600">{session.bumped} followed up</span> ·{" "}
      <span className="font-medium text-purple-600">{session.replied} replied</span> · {session.skipped}{" "}
      skipped · {session.gaveUp} gave up
    </p>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-700">Nothing overdue.</p>
      <p className="mt-1 text-sm text-slate-500">
        Every contacted lead is either not due for a follow-up yet, already past the {MAX_FOLLOW_UPS}-touch
        cap, or has moved on. Check the{" "}
        <Link href="/pipeline" className="text-blue-600 hover:underline">
          Pipeline
        </Link>{" "}
        for anything that needs a manual look, or head to{" "}
        <Link href="/outreach" className="text-blue-600 hover:underline">
          New leads
        </Link>{" "}
        to keep the top of the funnel moving.
      </p>
    </div>
  );
}

function Summary({
  session,
  total,
}: {
  session: { bumped: number; skipped: number; replied: number; gaveUp: number };
  total: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-medium text-slate-700">Worked through all {total} overdue leads.</p>
      <p className="mt-2 text-sm text-slate-500">
        <span className="font-medium text-emerald-600">{session.bumped}</span> followed up ·{" "}
        <span className="font-medium text-purple-600">{session.replied}</span> replied ·{" "}
        {session.skipped} skipped · {session.gaveUp} given up on.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Replies moved to{" "}
        <Link href="/pipeline" className="text-blue-600 hover:underline">
          Pipeline
        </Link>{" "}
        as &quot;Responded&quot; — worth checking those threads for real.
      </p>
    </div>
  );
}
