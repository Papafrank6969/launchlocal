import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";

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
  return { title: `${result.service.name} · ${result.site.businessName}` };
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
  const color = site.primaryColor || "#2563eb";

  return (
    <SitePageShell title={service.name}>
      {service.description ? (
        <p className="text-slate-700 dark:text-slate-300">{service.description}</p>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">
          Contact {site.businessName} to learn more about this service.
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        {site.phone && (
          <a
            href={`tel:${site.phone}`}
            className="inline-block rounded-md px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            Call {site.phone}
          </a>
        )}
        <a
          href={`/s/${slug}/contact`}
          className="inline-block rounded-md border px-5 py-2.5 font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
          style={{ borderColor: color, color }}
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
