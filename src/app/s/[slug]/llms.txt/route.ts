import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: {
      serviceItems: { orderBy: { order: "asc" } },
      blogPosts: { where: { published: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!site || site.status !== "PUBLISHED") {
    return new NextResponse("Not found", { status: 404 });
  }

  const base = new URL(req.url).origin;
  const path = (p: string) => `${base}/s/${slug}${p}`;

  const lines: string[] = [`# ${site.businessName}`, ""];
  if (site.tagline) lines.push(site.tagline, "");
  if (site.about || site.story) lines.push((site.story || site.about)!, "");

  lines.push("## Contact");
  if (site.phone) lines.push(`Phone: ${site.phone}`);
  if (site.email) lines.push(`Email: ${site.email}`);
  if (site.address) lines.push(`Address: ${site.address}`);
  if (site.hours) lines.push(`Hours: ${site.hours.replace(/\n/g, "; ")}`);
  lines.push("");

  if (site.serviceItems.length > 0) {
    lines.push("## Services");
    for (const s of site.serviceItems) {
      lines.push(`- [${s.name}](${path(`/services/${s.slug}`)})${s.description ? `: ${s.description}` : ""}`);
    }
    lines.push("");
  }

  if (site.blogPosts.length > 0) {
    lines.push("## Blog");
    for (const p of site.blogPosts) {
      lines.push(`- [${p.title}](${path(`/blog/${p.slug}`)})`);
    }
    lines.push("");
  }

  lines.push("## Pages");
  lines.push(`- Home: ${path("")}`);
  lines.push(`- Contact: ${path("/contact")}`);
  lines.push(`- Privacy Policy: ${path("/privacy")}`);
  lines.push(`- Terms of Service: ${path("/terms")}`);

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
