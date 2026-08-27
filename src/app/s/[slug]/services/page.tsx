import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { PrintButton } from "@/components/site/PrintButton";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";
import { normalizeBookingUrl } from "@/lib/bookingUrl";
import { readableTextColor } from "@/lib/contrast";
import { fontCssValue } from "@/lib/designSystems";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `Services · ${site.businessName}`,
    description: `Services and pricing for ${site.businessName}.`,
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
  const headingFont = fontCssValue(system.fontHeading);
  const bookingUrl = normalizeBookingUrl(site.bookingUrl);
  const hasAnyPrice = site.serviceItems.some((s) => s.price);

  return (
    <SitePageShell
      title="Services"
      system={system}
      subtitle={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{site.businessName}</span>
          <PrintButton color={color} />
        </div>
      }
    >
      <ul className="space-y-4">
        {site.serviceItems.map((s) => (
          <li key={s.id}>
            <div className="flex items-baseline justify-between gap-2 sm:justify-normal">
              <a
                href={`/s/${slug}/services/${s.slug}`}
                className="font-medium underline-offset-4 hover:underline"
                style={{ fontFamily: headingFont, color }}
              >
                {s.name}
              </a>
              {hasAnyPrice && (
                <span
                  aria-hidden="true"
                  className="site-border mx-1 hidden flex-1 -translate-y-1 border-b border-dotted opacity-60 sm:block"
                />
              )}
              {s.price && (
                <span className="shrink-0 text-sm font-semibold tabular-nums opacity-80">{s.price}</span>
              )}
            </div>
            {s.description && (
              <p className="mt-1 max-w-prose text-sm leading-relaxed opacity-70">{s.description}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3 print:hidden">
        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md px-5 py-2.5 font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: color, color: readableTextColor(color) }}
          >
            Book Now
          </a>
        )}
        {site.phone && (
          <a
            href={`tel:${site.phone}`}
            className={
              bookingUrl
                ? "site-border inline-block rounded-md border px-5 py-2.5 font-medium transition-opacity hover:opacity-80"
                : "inline-block rounded-md px-5 py-2.5 font-medium transition-opacity hover:opacity-90"
            }
            style={bookingUrl ? { color } : { backgroundColor: color, color: readableTextColor(color) }}
          >
            Call {site.phone}
          </a>
        )}
        <a
          href={`/s/${slug}/contact`}
          className="site-border inline-block rounded-md border px-5 py-2.5 font-medium transition-opacity hover:opacity-80"
          style={{ color }}
        >
          Get in touch
        </a>
      </div>
    </SitePageShell>
  );
}
