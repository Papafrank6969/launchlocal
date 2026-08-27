"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OutreachControls } from "@/components/OutreachControls";
import { DraftSiteButton } from "@/components/DraftSiteButton";
import { OUTREACH_LABEL, OUTREACH_STYLE, isOverdue, type OutreachStatus } from "@/lib/outreachStatus";

type Lead = {
  id: string;
  name: string;
  category: string;
  city: string;
  phone: string | null;
  email: string | null;
  instagramHandle: string | null;
  outreachStatus: OutreachStatus;
  followUpAt: string | null;
  lastContactedAt: string | null;
  sites?: { id: string; slug: string; status: string }[];
};

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    fetch("/api/leads?pipeline=1")
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []));
  }, []);

  function updateOutreach(leadId: string, patch: { outreachStatus?: OutreachStatus; followUpAt?: string | null }) {
    setLeads((prev) =>
      (prev ?? []).map((l) =>
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

  function markDrafted(leadId: string, site: { id: string; slug: string; status: string }) {
    setLeads((prev) => (prev ?? []).map((l) => (l.id === leadId ? { ...l, sites: [site] } : l)));
  }

  const overdueCount = (leads ?? []).filter((l) => isOverdue(l.followUpAt)).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
      <p className="mt-1 text-slate-600">
        Leads you&apos;ve reached out to, sorted by follow-up date. Leads still at &quot;New&quot; live on the{" "}
        <Link href="/leads" className="text-blue-600 hover:underline">
          Lead Finder
        </Link>{" "}
        page.
      </p>
      {overdueCount > 0 && (
        <p className="mt-3 inline-block rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
          {overdueCount} follow-up{overdueCount === 1 ? "" : "s"} overdue
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {leads?.map((lead) => (
          <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="break-words font-semibold text-slate-900">{lead.name}</h3>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${OUTREACH_STYLE[lead.outreachStatus]}`}>
                {OUTREACH_LABEL[lead.outreachStatus]}
              </span>
            </div>
            <p className="mt-1 text-sm capitalize text-slate-500">
              {lead.category} · {lead.city}
            </p>
            {lead.lastContactedAt && (
              <p className="mt-1 text-xs text-slate-400">
                Last contacted {new Date(lead.lastContactedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-blue-600">
              {lead.phone && <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>}
              {lead.email && <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>}
            </div>

            <OutreachControls
              leadId={lead.id}
              outreachStatus={lead.outreachStatus}
              followUpAt={lead.followUpAt}
              onChange={updateOutreach}
            />

            <div className="mt-4">
              <DraftSiteButton
                leadId={lead.id}
                site={lead.sites?.[0]}
                onCreated={(site) => markDrafted(lead.id, site)}
              />
            </div>
          </div>
        ))}
        {leads?.length === 0 && (
          <p className="text-sm text-slate-500">
            Nothing here yet — leads show up once you move them past &quot;New&quot; on the Lead Finder page.
          </p>
        )}
      </div>
    </div>
  );
}
