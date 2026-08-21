import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";

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

  return (
    <SitePageShell title="Before & after" wide system={system}>
      <div className="grid gap-8 sm:grid-cols-2">
        {site.galleryItems.map((item, i) => (
          <div key={item.id}>
            <div className="site-border grid grid-cols-2 gap-1 overflow-hidden rounded-xl border">
              <div className="relative aspect-square">
                <Image src={item.beforeUrl} alt="Before" fill className="object-cover" sizes="50vw" priority={i === 0} />
                <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  Before
                </span>
              </div>
              <div className="relative aspect-square">
                <Image src={item.afterUrl} alt="After" fill className="object-cover" sizes="50vw" priority={i === 0} />
                <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  After
                </span>
              </div>
            </div>
            {item.caption && <p className="mt-2 text-sm opacity-80">{item.caption}</p>}
          </div>
        ))}
      </div>
    </SitePageShell>
  );
}
