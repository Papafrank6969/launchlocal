import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { ContactForm } from "@/components/site/ContactForm";
import { MapEmbed } from "@/components/site/MapEmbed";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";
import { normalizeBookingUrl } from "@/lib/bookingUrl";
import { readableTextColor } from "@/lib/contrast";

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
  const bookingUrl = normalizeBookingUrl(site.bookingUrl);

  return (
    <SitePageShell title={`Contact ${site.businessName}`} system={system}>
      {bookingUrl && (
        <div className="site-border site-card-bg mb-8 rounded-xl border p-5">
          <p className="font-medium">Ready to book?</p>
          <p className="mt-1 text-sm opacity-80">Schedule your appointment online. No waiting for a reply.</p>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-md px-5 py-2.5 font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: system.colorPrimary, color: readableTextColor(system.colorPrimary) }}
          >
            Book an appointment
          </a>
        </div>
      )}
      <ContactForm slug={slug} color={system.colorPrimary} />
      {site.address && <MapEmbed address={site.address} businessName={site.businessName} />}
    </SitePageShell>
  );
}
