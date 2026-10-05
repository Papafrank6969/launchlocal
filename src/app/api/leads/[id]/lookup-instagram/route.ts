import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lookupInstagramHandle, type InstagramLookupResult } from "@/lib/instagramLookup";

type Failure = Exclude<InstagramLookupResult["status"], "found" | "not_found">;

const FAILURES: Record<Failure, { status: number; error: string }> = {
  not_configured: { status: 400, error: "Instagram lookup isn't configured: add BRAVE_SEARCH_API_KEY to the environment." },
  key_rejected: { status: 503, error: "Brave Search rejected the API key. Check BRAVE_SEARCH_API_KEY, or enter the handle manually." },
  rate_limited: { status: 429, error: "Instagram lookup is rate-limited right now. Try again in a moment, or enter the handle manually." },
  error: { status: 502, error: "Instagram lookup failed. Enter the handle manually." },
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await lookupInstagramHandle(lead.name, lead.city);

  if (result.status === "found") {
    const updated = await db.lead.update({ where: { id }, data: { instagramHandle: result.handle } });
    return NextResponse.json({ lead: updated, found: true });
  }
  if (result.status === "not_found") return NextResponse.json({ lead, found: false, reason: "not_found" });

  if (result.status === "error") console.error("[instagram-lookup]", result.detail);
  const f = FAILURES[result.status];
  return NextResponse.json({ error: f.error, reason: result.status }, { status: f.status });
}
