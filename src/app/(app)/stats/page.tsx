import type { Metadata } from "next";
import { db } from "@/lib/db";
import { StatsCharts } from "@/components/StatsCharts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stats",
  description: "Leads found, sites built, conversion rate, and site views over time.",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function StatsPage() {
  const [leads, sites, events] = await Promise.all([
    db.lead.findMany({ select: { websiteStatus: true, outreachStatus: true } }),
    db.site.findMany({
      select: { id: true, businessName: true, slug: true, status: true, _count: { select: { events: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.event.findMany({
      where: { type: "SITE_VIEW" },
      select: { createdAt: true },
    }),
  ]);

  const totalLeads = leads.length;
  const opportunities = leads.filter((l) => l.websiteStatus !== "HAS_SITE").length;
  const sitesBuilt = sites.length;
  const sitesPublished = sites.filter((s) => s.status === "PUBLISHED").length;
  const conversionRate = opportunities > 0 ? Math.round((sitesBuilt / opportunities) * 100) : 0;
  const totalViews = events.length;

  const leadsByStatus = [
    { key: "NONE", label: "No website", count: leads.filter((l) => l.websiteStatus === "NONE").length },
    { key: "POOR", label: "Weak website", count: leads.filter((l) => l.websiteStatus === "POOR").length },
    { key: "HAS_SITE", label: "Has a website", count: leads.filter((l) => l.websiteStatus === "HAS_SITE").length },
  ];

  const contacted = leads.filter((l) => l.outreachStatus !== "NEW").length;
  const responded = leads.filter((l) => l.outreachStatus === "RESPONDED" || l.outreachStatus === "WON").length;
  const won = leads.filter((l) => l.outreachStatus === "WON").length;
  const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;

  const days: { date: string; views: number }[] = [];
  const today = startOfDay(new Date());
  for (let i = 29; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const label = day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const count = events.filter((e) => startOfDay(new Date(e.createdAt)).getTime() === day.getTime()).length;
    days.push({ date: label, views: count });
  }

  const siteViewCounts = sites
    .map((s) => ({ id: s.id, name: s.businessName, slug: s.slug, status: s.status, views: s._count.events }))
    .sort((a, b) => b.views - a.views);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Stats</h1>
      <p className="mt-1 text-slate-600">How prospecting and site-building are going.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Leads found" value={totalLeads} />
        <StatTile label="Opportunities" value={opportunities} hint="no site / weak site" />
        <StatTile label="Sites built" value={sitesBuilt} />
        <StatTile label="Published" value={sitesPublished} />
        <StatTile label="Conversion" value={`${conversionRate}%`} hint="built ÷ opportunities" />
        <StatTile label="Total views" value={totalViews} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="Contacted" value={contacted} hint="leads past 'New'" />
        <StatTile label="Response rate" value={`${responseRate}%`} hint="responded or won ÷ contacted" />
        <StatTile label="Won" value={won} />
      </div>

      <StatsCharts days={days} leadsByStatus={leadsByStatus} />

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Sites</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {siteViewCounts.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{s.views}</td>
                </tr>
              ))}
              {siteViewCounts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    No sites yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
