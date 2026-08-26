import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";

type GridItem = { id: string; beforeUrl: string; afterUrl: string; caption: string | null };

function GalleryGrid({ items, firstPriority }: { items: GridItem[]; firstPriority: boolean }) {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {items.map((item, i) => (
        <div key={item.id}>
          <div className="site-border grid grid-cols-2 gap-1 overflow-hidden rounded-xl border">
            <div className="relative aspect-square">
              <Image
                src={item.beforeUrl}
                alt="Before"
                fill
                className="object-cover"
                sizes="50vw"
                priority={firstPriority && i === 0}
              />
              <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                Before
              </span>
            </div>
            <div className="relative aspect-square">
              <Image
                src={item.afterUrl}
                alt="After"
                fill
                className="object-cover"
                sizes="50vw"
                priority={firstPriority && i === 0}
              />
              <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                After
              </span>
            </div>
          </div>
          {item.caption && <p className="mt-2 text-sm opacity-80">{item.caption}</p>}
        </div>
      ))}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `Gallery · ${site.businessName}`,
    description: `Before and after photos from ${site.businessName}.`,
    path: `/s/${slug}/gallery`,
  });
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: { galleryItems: { orderBy: { order: "asc" } } },
  });
  if (!site || site.status !== "PUBLISHED") notFound();
  if (site.galleryItems.length === 0) notFound();

  const system = resolveDesignSystem(site);
  const color = system.colorPrimary;

  // Group by category (service name) so a visitor can see examples of the
  // exact style/service they want, rather than one flat feed. Sites that
  // never categorize their gallery (the common case) keep the plain flat
  // grid — grouping only kicks in once the operator actually uses it.
  const groups = new Map<string, GridItem[]>();
  for (const item of site.galleryItems) {
    const key = item.category ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const isFlat = groups.size === 1 && groups.has("");

  if (isFlat) {
    return (
      <SitePageShell title="Before & after" wide system={system}>
        <GalleryGrid items={site.galleryItems} firstPriority />
      </SitePageShell>
    );
  }

  const categorized = [...groups.entries()].filter(([key]) => key !== "");
  const uncategorized = groups.get("") ?? [];

  return (
    <SitePageShell title="Before & after" wide system={system}>
      <div className="space-y-14">
        {categorized.map(([name, items], i) => (
          <section key={name}>
            <h2 className="text-xl font-semibold" style={{ color }}>
              {name}
            </h2>
            <div className="mt-4">
              <GalleryGrid items={items} firstPriority={i === 0} />
            </div>
          </section>
        ))}
        {uncategorized.length > 0 && (
          <section>
            {categorized.length > 0 && (
              <h2 className="text-xl font-semibold" style={{ color }}>
                More work
              </h2>
            )}
            <div className="mt-4">
              <GalleryGrid items={uncategorized} firstPriority={categorized.length === 0} />
            </div>
          </section>
        )}
      </div>
    </SitePageShell>
  );
}
