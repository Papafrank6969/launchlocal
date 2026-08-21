import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `FAQ · ${site.businessName}`,
    description: `Frequently asked questions about ${site.businessName}.`,
    path: `/s/${slug}/faq`,
  });
}

export default async function FaqPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: { faqItems: { orderBy: { order: "asc" } } },
  });
  if (!site || site.status !== "PUBLISHED") notFound();
  if (site.faqItems.length === 0) notFound();

  const system = resolveDesignSystem(site);

  return (
    <SitePageShell title="Frequently asked questions" system={system}>
      <FaqAccordion items={site.faqItems} color={system.colorPrimary} />
    </SitePageShell>
  );
}
