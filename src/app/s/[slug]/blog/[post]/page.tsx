import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SitePageShell, LastUpdated } from "@/components/site/SitePageShell";
import { pageMetadata } from "@/lib/seo";

async function getPost(slug: string, postSlug: string) {
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") return null;
  const post = await db.blogPost.findUnique({ where: { siteId_slug: { siteId: site.id, slug: postSlug } } });
  if (!post || !post.published) return null;
  return { site, post };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; post: string }>;
}): Promise<Metadata> {
  const { slug, post: postSlug } = await params;
  const result = await getPost(slug, postSlug);
  if (!result) return { title: "Not found" };
  return pageMetadata({
    title: `${result.post.title} · ${result.site.businessName}`,
    description: result.post.content.replace(/\s+/g, " ").trim().slice(0, 160),
    path: `/s/${slug}/blog/${postSlug}`,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string; post: string }> }) {
  const { slug, post: postSlug } = await params;
  const result = await getPost(slug, postSlug);
  if (!result) notFound();
  const { site, post } = result;
  const color = site.primaryColor || "#2563eb";

  const paragraphs = post.content.split("\n").map((p) => p.trim()).filter(Boolean);

  return (
    <SitePageShell title={post.title} subtitle={<LastUpdated date={post.updatedAt} />}>
      <div className="space-y-4 text-slate-700 dark:text-slate-300">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <p className="mt-8 text-sm">
        <a href={`/s/${slug}/blog`} className="hover:underline" style={{ color }}>
          ← All posts
        </a>
      </p>
    </SitePageShell>
  );
}
