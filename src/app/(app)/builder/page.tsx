import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site Builder",
  description: "Every site you've started, drafted, or published.",
};

export default async function BuilderIndexPage() {
  const sites = await db.site.findMany({
    orderBy: { createdAt: "desc" },
    include: { lead: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Site Builder</h1>
          <p className="mt-1 text-slate-600">Every site you&apos;ve started, drafted, or published.</p>
        </div>
        <Link
          href="/builder/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New site
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => (
          <Link
            key={site.id}
            href={`/builder/${site.id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="break-words font-semibold text-slate-900">{site.businessName}</h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  site.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {site.status === "PUBLISHED" ? "Published" : "Draft"}
              </span>
            </div>
            {site.lead && <p className="mt-1 text-sm text-slate-500">from lead: {site.lead.name}</p>}
            <p className="mt-2 text-xs text-slate-400">/s/{site.slug}</p>
          </Link>
        ))}
        {sites.length === 0 && (
          <p className="text-sm text-slate-500">
            No sites yet. Start from a{" "}
            <Link href="/leads" className="text-blue-600 hover:underline">
              lead
            </Link>{" "}
            or create a{" "}
            <Link href="/builder/new" className="text-blue-600 hover:underline">
              blank site
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
