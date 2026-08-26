import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";
import { readableTextColor } from "@/lib/contrast";

async function getService(slug: string, serviceSlug: string) {
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") return null;
  const service = await db.service.findUnique({ where: { siteId_slug: { siteId: site.id, slug: serviceSlug } } });
  if (!service) return null;
  return { site, service };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; service: string }>;
}): Promise<Metadata> {
  const { slug, service: serviceSlug } = await params;
  const result = await getService(slug, serviceSlug);
  if (!result) return { title: "Not found" };
  return pageMetadata({
    title: `${result.service.name} · ${result.site.businessName}`,
    description: result.service.description || `${result.service.name} offered by ${result.site.businessName}.`,
    path: `/s/${slug}/services/${serviceSlug}`,
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string; service: string }>;
}) {
  const { slug, service: serviceSlug } = await params;
  const result = await getService(slug, serviceSlug);
  if (!result) notFound();
  const { site, service } = result;
  const system = resolveDesignSystem(site);
  const color = system.colorPrimary;
  const buttonText = readableTextColor(color);

  return (
    <SitePageShell title={service.name} system={system}>
      {service.price && (
        <p className="text-xl font-semibold" style={{ color }}>
          {service.price}
        </p>
      )}
      {service.description ? (
        <p className="opacity-90">{service.description}</p>
      ) : (
        <p className="opacity-70">Contact {site.businessName} to learn more about this service.</p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        {site.phone && (
          <a
            href={`tel:${site.phone}`}
            className="inline-block rounded-md px-5 py-2.5 font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: color, color: buttonText }}
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
      <p className="mt-8 text-sm">
        <a href={`/s/${slug}/services`} className="hover:underline" style={{ color }}>
          ← All services
        </a>
      </p>
    </SitePageShell>
  );
}
