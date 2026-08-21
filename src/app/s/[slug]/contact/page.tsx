import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { ContactForm } from "@/components/site/ContactForm";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `Contact · ${site.businessName}`,
    description: `Get in touch with ${site.businessName}.`,
    path: `/s/${slug}/contact`,
  });
}

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") notFound();

  const system = resolveDesignSystem(site);

  return (
    <SitePageShell title={`Contact ${site.businessName}`} system={system}>
      <ContactForm slug={slug} color={system.colorPrimary} />
    </SitePageShell>
  );
}
