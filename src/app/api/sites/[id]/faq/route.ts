import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await db.faqItem.findMany({ where: { siteId: id }, orderBy: { order: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const question = (body.question ?? "").toString().trim();
  const answer = (body.answer ?? "").toString().trim();
  if (!question || !answer) {
    return NextResponse.json({ error: "Question and answer are required" }, { status: 400 });
  }

  const count = await db.faqItem.count({ where: { siteId: id } });
  const item = await db.faqItem.create({ data: { siteId: id, question, answer, order: count } });
  return NextResponse.json({ item });
}
