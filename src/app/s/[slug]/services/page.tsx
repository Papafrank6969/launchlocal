import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `Services · ${site.businessName}`,
    description: `Services offered by ${site.businessName}.`,
    path: `/s/${slug}/services`,
  });
}

export default async function ServicesIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });
  if (!site || site.status !== "PUBLISHED") notFound();
  if (site.serviceItems.length === 0) notFound();

  const system = resolveDesignSystem(site);
  const color = system.colorPrimary;

  return (
    <SitePageShell title="Services" wide system={system}>
      <div className="grid gap-4 sm:grid-cols-2">
        {site.serviceItems.map((s) => (
          <a
            key={s.id}
            href={`/s/${slug}/services/${s.slug}`}
            className="site-border block rounded-xl border p-6 transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold" style={{ color }}>
              {s.name}
            </h2>
            {s.description && <p className="mt-2 line-clamp-3 text-sm opacity-80">{s.description}</p>}
          </a>
        ))}
      </div>
    </SitePageShell>
  );
}
