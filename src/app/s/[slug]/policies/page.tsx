import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell, LastUpdated } from "@/components/site/SitePageShell";
import { LegalSections } from "@/components/site/LegalSections";
import { generateRefundPolicy, LEGAL_LAST_UPDATED } from "@/lib/legalContent";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";
import { normalizeBookingUrl } from "@/lib/bookingUrl";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `Cancellation and Refunds · ${site.businessName}`,
    path: `/s/${slug}/policies`,
  });
}

export default async function PoliciesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") notFound();
  // Only meaningful when the site actually routes bookings somewhere.
  if (!normalizeBookingUrl(site.bookingUrl)) notFound();

  const sections = generateRefundPolicy(site);
  const system = resolveDesignSystem(site);

  return (
    <SitePageShell title="Cancellation and Refunds" subtitle={<LastUpdated date={LEGAL_LAST_UPDATED} />} system={system}>
      <LegalSections sections={sections} />
    </SitePageShell>
  );
}
