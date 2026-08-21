import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell } from "@/components/site/SitePageShell";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site) return { title: "Site not found" };
  return { title: `Blog · ${site.businessName}` };
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

  const color = site.primaryColor || "#2563eb";

  return (
    <SitePageShell title="Blog" wide>
      <div className="space-y-6">
        {site.blogPosts.map((post) => (
          <a
            key={post.id}
            href={`/s/${slug}/blog/${post.slug}`}
            className="block rounded-xl border border-slate-200 p-6 transition-shadow hover:shadow-md dark:border-slate-800"
          >
            <h2 className="font-semibold text-slate-900 dark:text-white" style={{ color }}>
              {post.title}
            </h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {post.updatedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{excerpt(post.content)}</p>
          </a>
        ))}
      </div>
    </SitePageShell>
  );
}
