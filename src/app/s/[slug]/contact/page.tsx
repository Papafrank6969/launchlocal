import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { ContactForm } from "@/components/site/ContactForm";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return { title: `Contact · ${site.businessName}` };
}

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") notFound();

  return (
    <SitePageShell title={`Contact ${site.businessName}`}>
      <ContactForm slug={slug} color={site.primaryColor || "#2563eb"} />
    </SitePageShell>
  );
}
