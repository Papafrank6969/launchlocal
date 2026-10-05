import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSite, draftSiteFromLead } from "@/lib/siteCreate";

export async function GET() {
  const sites = await db.site.findMany({
    orderBy: { createdAt: "desc" },
    include: { lead: true },
  });
  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // One-click draft straight from a lead's Google data.
  if (body.leadId && !body.businessName) {
    const result = await draftSiteFromLead(String(body.leadId));
    if (!result) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json(result.existing ? result : { site: result.site });
  }

  // Manual create from the builder form.
  const businessName = (body.businessName ?? "").toString().trim();
  if (!businessName) {
    return NextResponse.json({ error: "businessName is required" }, { status: 400 });
  }

  const site = await createSite({
    businessName,
    tagline: body.tagline,
    about: body.about,
    story: body.story,
    hours: body.hours,
    phone: body.phone,
    email: body.email,
    address: body.address,
    instagramHandle: body.instagramHandle,
    facebookUrl: body.facebookUrl,
    bookingUrl: body.bookingUrl,
    guaranteeText: body.guaranteeText,
    paymentMethods: body.paymentMethods,
    rating: body.rating,
    reviewCount: body.reviewCount,
    category: body.category,
    googlePlaceId: body.googlePlaceId,
    leadId: body.leadId,
    serviceItems: Array.isArray(body.serviceItems) ? body.serviceItems : undefined,
  });

  return NextResponse.json({ site });
}
