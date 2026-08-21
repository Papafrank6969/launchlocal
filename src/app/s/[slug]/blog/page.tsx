import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";
import { pageMetadata } from "@/lib/seo";
import { resolveDesignSystem } from "@/lib/templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return pageMetadata({
    title: `Blog · ${site.businessName}`,
    description: `News and updates from ${site.businessName}.`,
    path: `/s/${slug}/blog`,
  });
}

function excerpt(content: string, max = 160): string {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

export default async function BlogIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: { blogPosts: { where: { published: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!site || site.status !== "PUBLISHED") notFound();
  if (site.blogPosts.length === 0) notFound();

  const system = resolveDesignSystem(site);
  const color = system.colorPrimary;

  return (
    <SitePageShell title="Blog" wide system={system}>
      <div className="space-y-6">
        {site.blogPosts.map((post) => (
          <a
            key={post.id}
            href={`/s/${slug}/blog/${post.slug}`}
            className="site-border block rounded-xl border p-6 transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold" style={{ color }}>
              {post.title}
            </h2>
            <p className="mt-1 text-xs opacity-60">
              {post.updatedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="mt-2 text-sm opacity-80">{excerpt(post.content)}</p>
          </a>
        ))}
      </div>
    </SitePageShell>
  );
}
