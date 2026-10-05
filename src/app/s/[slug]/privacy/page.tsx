import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell, LastUpdated } from "@/components/site/SitePageShell";
import { LegalSections } from "@/components/site/LegalSections";
import { generatePrivacyPolicy, LEGAL_LAST_UPDATED } from "@/lib/legalContent";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `Privacy Policy · ${site.businessName}`,
    path: `/s/${slug}/privacy`,
  });
}

export default async function PrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") notFound();

  const sections = generatePrivacyPolicy(site);
  const system = resolveDesignSystem(site);

  return (
    <SitePageShell title="Privacy Policy" subtitle={<LastUpdated date={LEGAL_LAST_UPDATED} />} system={system}>
      <LegalSections sections={sections} />
    </SitePageShell>
  );
}
