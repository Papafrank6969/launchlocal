import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return { title: `Services · ${site.businessName}` };
}

export default async function ServicesIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });
  if (!site || site.status !== "PUBLISHED") notFound();
  if (site.serviceItems.length === 0) notFound();

  const color = site.primaryColor || "#2563eb";

  return (
    <SitePageShell title="Services" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        {site.serviceItems.map((s) => (
          <a
            key={s.id}
            href={`/s/${slug}/services/${s.slug}`}
            className="block rounded-xl border border-slate-200 p-6 transition-shadow hover:shadow-md dark:border-slate-800"
          >
            <h2 className="font-semibold text-slate-900 dark:text-white" style={{ color }}>
              {s.name}
            </h2>
            {s.description && (
              <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{s.description}</p>
            )}
          </a>
        ))}
      </div>
    </SitePageShell>
  );
}
