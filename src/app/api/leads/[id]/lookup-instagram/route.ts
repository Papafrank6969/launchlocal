import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lookupInstagramHandle, redactKey } from "@/lib/instagramLookup";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let result;
  try {
    result = await lookupInstagramHandle(lead.name, lead.city);
  } catch (err) {
    console.error("[instagram-lookup]", redactKey(err instanceof Error ? err.message : "Lookup failed"));
    return NextResponse.json(
      {
        error: "Instagram lookup failed — enter the handle manually.",
        reason: "error",
      },
      { status: 502 }
    );
  }

  if (result.status === "found") {
    const updated = await db.lead.update({
      where: { id },
      data: { instagramHandle: result.handle },
    });
    return NextResponse.json({ lead: updated, found: true });
  }

  if (result.status === "not_found") {
    return NextResponse.json({ lead, found: false, reason: "not_found" }, { status: 200 });
  }

  if (result.status === "not_configured") {
    return NextResponse.json(
      {
        error:
          "Instagram lookup isn't configured — add GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID to .env.",
        reason: "not_configured",
      },
      { status: 400 }
    );
  }

  if (result.status === "api_disabled") {
    return NextResponse.json(
      {
        error:
          "The Custom Search API is disabled for this Google project — enable 'Custom Search API' in the Cloud console, or enter the handle manually.",
        reason: "api_disabled",
      },
      { status: 503 }
    );
  }

  if (result.status === "rate_limited") {
    return NextResponse.json(
      {
        error: "Instagram lookup is rate-limited right now — try again later or enter the handle manually.",
        reason: "rate_limited",
      },
      { status: 429 }
    );
  }

  console.error("[instagram-lookup]", redactKey(result.detail));
  return NextResponse.json(
    {
      error: "Instagram lookup failed — enter the handle manually.",
      reason: "error",
    },
    { status: 502 }
  );
}
