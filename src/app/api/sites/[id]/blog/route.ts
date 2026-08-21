import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const posts = await db.blogPost.findMany({ where: { siteId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const title = (body.title ?? "").toString().trim();
  const content = (body.content ?? "").toString().trim();
  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const baseSlug = slugify(title) || "post";
  let slug = baseSlug;
  let n = 1;
  while (await db.blogPost.findUnique({ where: { siteId_slug: { siteId: id, slug } } })) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const post = await db.blogPost.create({
    data: { siteId: id, slug, title, content, published: Boolean(body.published) },
  });
  return NextResponse.json({ post });
}
