import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell, LastUpdated } from "@/components/site/SitePageShell";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `About · ${site.businessName}`,
    description: site.story || site.about,
    path: `/s/${slug}/about`,
  });
}

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") notFound();

  const content = site.story || site.about;
  if (!content) notFound();

  const paragraphs = content.split("\n").map((p) => p.trim()).filter(Boolean);
  const system = resolveDesignSystem(site);

  return (
    <SitePageShell title={`About ${site.businessName}`} system={system}>
      <div className="space-y-4 opacity-90">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-8">
        <LastUpdated date={site.updatedAt} />
      </div>
    </SitePageShell>
  );
}
