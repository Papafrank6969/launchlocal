import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; faqId: string }> }) {
  const { id, faqId } = await params;
  const existing = await db.faqItem.findUnique({ where: { id: faqId } });
  if (!existing || existing.siteId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string | number> = {};
  if (typeof body.question === "string") data.question = body.question.trim();
  if (typeof body.answer === "string") data.answer = body.answer.trim();
  if (typeof body.order === "number") data.order = body.order;

  const item = await db.faqItem.update({ where: { id: faqId }, data });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; faqId: string }> }) {
  const { id, faqId } = await params;
  const existing = await db.faqItem.findUnique({ where: { id: faqId } });
  if (!existing || existing.siteId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.faqItem.delete({ where: { id: faqId } });
  return NextResponse.json({ ok: true });
}
