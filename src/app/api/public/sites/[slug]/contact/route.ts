import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  if (!site || site.status !== "PUBLISHED") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required.";
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!message) errors.message = "Message is required.";
  if (Object.keys(errors).length > 0) return NextResponse.json({ errors }, { status: 400 });

  await db.contactSubmission.create({ data: { siteId: site.id, name, email, message } });

  // Best-effort telemetry: a contact-form submission is the clearest "this site is
  // working" signal. Never fail the submission because the event write failed.
  try {
    await db.event.create({ data: { type: "CONTACT_SUBMITTED", siteId: site.id } });
  } catch (err) {
    console.error("Failed to record contact-submitted event", err);
  }

  return NextResponse.json({ ok: true });
}
