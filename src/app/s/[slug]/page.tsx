import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePreview } from "@/lib/templates";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });

  if (!site) return { title: "Site not found" };

  return {
    title: { absolute: site.businessName },
    description: site.tagline || site.about || `${site.businessName} — contact info, services, and hours.`,
  };
}

export default async function PublicSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: { serviceItems: { orderBy: { order: "asc" } } },
  });

  if (!site) notFound();

  if (site.status !== "PUBLISHED") {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900">This site isn&apos;t published yet</h1>
        <p className="mt-2 text-slate-600">Check back soon.</p>
      </div>
    );
  }

  await db.event.create({ data: { type: "SITE_VIEW", siteId: site.id, path: "/" } });

  return <SitePreview site={site} />;
}
