import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const sites = await db.site.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/s/",
        disallow: ["/leads", "/builder", "/stats", "/api/"],
      },
    ],
    sitemap: sites.map((s) => `${base}/s/${s.slug}/sitemap.xml`),
  };
}
