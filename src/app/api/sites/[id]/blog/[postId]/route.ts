import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  const existing = await db.blogPost.findUnique({ where: { id: postId } });
  if (!existing || existing.siteId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string | boolean> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.content === "string") data.content = body.content.trim();
  if (typeof body.published === "boolean") data.published = body.published;

  const post = await db.blogPost.update({ where: { id: postId }, data });
  return NextResponse.json({ post });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  const existing = await db.blogPost.findUnique({ where: { id: postId } });
  if (!existing || existing.siteId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.blogPost.delete({ where: { id: postId } });
  return NextResponse.json({ ok: true });
}
