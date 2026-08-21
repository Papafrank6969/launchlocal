import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell, LastUpdated } from "@/components/site/SitePageShell";
import { generateTermsOfService } from "@/lib/legalContent";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `Terms of Service · ${site.businessName}`,
    path: `/s/${slug}/terms`,
  });
}

export default async function TermsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") notFound();

  const sections = generateTermsOfService(site);

  return (
    <SitePageShell title="Terms of Service" subtitle={<LastUpdated date={site.updatedAt} />}>
      <div className="space-y-6">
        {sections.map((s) => (
          <div key={s.heading}>
            <h2 className="font-semibold text-slate-900 dark:text-white">{s.heading}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{s.body}</p>
          </div>
        ))}
      </div>
    </SitePageShell>
  );
}
