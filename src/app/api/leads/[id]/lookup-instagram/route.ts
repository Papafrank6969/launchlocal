import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lookupInstagramHandle } from "@/lib/instagramLookup";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let result;
  try {
    result = await lookupInstagramHandle(lead.name, lead.city);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 502 }
    );
  }

  if (result.status === "not_configured") {
    return NextResponse.json(
      {
        error:
          "Instagram lookup isn't configured yet — add GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID to .env.",
      },
      { status: 400 }
    );
  }

  if (result.status === "not_found") {
    return NextResponse.json({ lead, found: false });
  }

  const updated = await db.lead.update({
    where: { id },
    data: { instagramHandle: result.handle },
  });

  return NextResponse.json({ lead: updated, found: true });
}
