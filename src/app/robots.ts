import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { isUnclaimedPitchSite } from "@/lib/siteVisibility";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const sites = await db.site.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, leadId: true, lead: { select: { outreachStatus: true } } },
  });

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/s/",
        disallow: ["/leads", "/builder", "/pipeline", "/stats", "/api/"],
      },
    ],
    // Sites still being pitched to a lead are excluded — they're published so
    // the operator can share a link, not so Google can index them.
    sitemap: sites
      .filter((s) => !isUnclaimedPitchSite(s.leadId, s.lead?.outreachStatus))
      .map((s) => `${base}/s/${s.slug}/sitemap.xml`),
  };
}
