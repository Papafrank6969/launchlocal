import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function url(base: string, path: string): string {
  return `${base}${path}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: {
      serviceItems: { orderBy: { order: "asc" } },
      blogPosts: { where: { published: true }, orderBy: { createdAt: "desc" } },
      galleryItems: { select: { id: true } },
      faqItems: { select: { id: true } },
    },
  });

  if (!site || site.status !== "PUBLISHED") {
    return new NextResponse("Not found", { status: 404 });
  }

  const base = new URL(req.url).origin;
  const path = (p: string) => `/s/${slug}${p}`;

  const entries: { loc: string; lastmod: string }[] = [
    { loc: path(""), lastmod: site.updatedAt.toISOString() },
    { loc: path("/contact"), lastmod: site.updatedAt.toISOString() },
    { loc: path("/privacy"), lastmod: site.updatedAt.toISOString() },
    { loc: path("/terms"), lastmod: site.updatedAt.toISOString() },
  ];

  if (site.story || site.about) entries.push({ loc: path("/about"), lastmod: site.updatedAt.toISOString() });
  if (site.serviceItems.length > 0) {
    entries.push({ loc: path("/services"), lastmod: site.updatedAt.toISOString() });
    for (const s of site.serviceItems) {
      entries.push({ loc: path(`/services/${s.slug}`), lastmod: s.updatedAt.toISOString() });
    }
  }
  if (site.blogPosts.length > 0) {
    entries.push({ loc: path("/blog"), lastmod: site.updatedAt.toISOString() });
    for (const p of site.blogPosts) {
      entries.push({ loc: path(`/blog/${p.slug}`), lastmod: p.updatedAt.toISOString() });
    }
  }
  if (site.galleryItems.length > 0) entries.push({ loc: path("/gallery"), lastmod: site.updatedAt.toISOString() });
  if (site.faqItems.length > 0) entries.push({ loc: path("/faq"), lastmod: site.updatedAt.toISOString() });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>\n    <loc>${url(base, e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`).join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
