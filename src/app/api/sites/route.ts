import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uniqueSlug, slugify } from "@/lib/slug";
import { chooseDesign } from "@/lib/generateDesign";
import { normalizeBookingUrl } from "@/lib/bookingUrl";
import { fetchGoogleReviews } from "@/lib/googleReviews";
import { leadToDraftSite } from "@/lib/leadToSite";

export async function GET() {
  const sites = await db.site.findMany({
    orderBy: { createdAt: "desc" },
    include: { lead: true },
  });
  return NextResponse.json({ sites });
}

type ServiceInput = { name?: string; description?: string | null; price?: string | null };

type SiteInput = {
  businessName: string;
  tagline?: string | null;
  about?: string | null;
  story?: string | null;
  hours?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  instagramHandle?: string | null;
  facebookUrl?: string | null;
  bookingUrl?: string | null;
  guaranteeText?: string | null;
  paymentMethods?: string | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  category?: string | null;
  googlePlaceId?: string | null;
  leadId?: string | null;
  status?: "DRAFT" | "PUBLISHED";
  serviceItems?: ServiceInput[];
};

function num(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function buildServiceRows(items: ServiceInput[] | undefined) {
  const seen = new Set<string>();
  return (items ?? [])
    .map((s) => ({
      name: (s.name ?? "").trim(),
      description: (s.description ?? "").trim() || null,
      price: (s.price ?? "").trim() || null,
    }))
    .filter((s) => s.name.length > 0)
    .map((s, i) => {
      let itemSlug = slugify(s.name) || `service-${i + 1}`;
      let n = 1;
      while (seen.has(itemSlug)) {
        n += 1;
        itemSlug = `${slugify(s.name)}-${n}`;
      }
      seen.add(itemSlug);
      return { slug: itemSlug, name: s.name, description: s.description, price: s.price, order: i };
    });
}

const withServices = { serviceItems: { orderBy: { order: "asc" as const } } };

async function createSite(input: SiteInput) {
  const slug = await uniqueSlug(input.businessName, async (candidate) => {
    return !!(await db.site.findUnique({ where: { slug: candidate } }));
  });
  const serviceRows = buildServiceRows(input.serviceItems);

  const site = await db.site.create({
    data: {
      slug,
      businessName: input.businessName,
      tagline: input.tagline || null,
      about: input.about || null,
      story: input.story || null,
      hours: input.hours || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      instagramHandle: input.instagramHandle || null,
      facebookUrl: input.facebookUrl || null,
      bookingUrl: normalizeBookingUrl(input.bookingUrl),
      guaranteeText: input.guaranteeText || null,
      paymentMethods: input.paymentMethods || null,
      rating: num(input.rating),
      reviewCount: num(input.reviewCount),
      category: (input.category ?? "").toString().trim() || null,
      googlePlaceId: input.googlePlaceId || null,
      leadId: input.leadId || null,
      status: input.status ?? "DRAFT",
      serviceItems: serviceRows.length > 0 ? { create: serviceRows } : undefined,
    },
    include: withServices,
  });

  await db.event.create({ data: { type: "SITE_CREATED", siteId: site.id } });
  if (site.status === "PUBLISHED") {
    await db.event.create({ data: { type: "SITE_PUBLISHED", siteId: site.id } });
  }

  const choice = await chooseDesign({
    businessName: site.businessName,
    category: site.category,
    tagline: site.tagline,
    about: site.about,
    serviceNames: site.serviceItems.map((s) => s.name),
  });
  await db.site.update({
    where: { id: site.id },
    data: { designSystemId: choice.system.id, designRationale: choice.rationale },
  });

  // A draft that leads outreach converts better with real social proof already
  // on it. Best-effort — the site is fine without it.
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (apiKey && site.googlePlaceId) {
    try {
      const fetched = await fetchGoogleReviews(site.googlePlaceId, apiKey);
      if (fetched.reviews.length > 0) {
        await db.site.update({
          where: { id: site.id },
          data: {
            googleReviewsJson: JSON.stringify(fetched.reviews),
            googleReviewsUpdatedAt: new Date(),
            googleMapsUrl: fetched.mapsUrl,
            rating: fetched.rating ?? num(input.rating),
            reviewCount: fetched.reviewCount ?? num(input.reviewCount),
          },
        });
      }
    } catch {
      // leave the draft without reviews
    }
  }

  return db.site.findUniqueOrThrow({ where: { id: site.id }, include: withServices });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // One-click draft straight from a lead's Google data.
  if (body.leadId && !body.businessName) {
    const lead = await db.lead.findUnique({
      where: { id: String(body.leadId) },
      include: { sites: { select: { id: true }, take: 1 } },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // One draft per lead — clicking twice just returns the first one.
    if (lead.sites.length > 0) {
      const site = await db.site.findUnique({ where: { id: lead.sites[0].id }, include: withServices });
      return NextResponse.json({ site, existing: true });
    }

    const draft = leadToDraftSite(lead);
    const site = await createSite({
      ...draft,
      serviceItems: draft.serviceNames.map((name) => ({ name })),
      leadId: lead.id,
      // Published so the operator can send a working link — but kept out of
      // search until the lead is WON (see isUnclaimedPitchSite).
      status: "PUBLISHED",
    });
    return NextResponse.json({ site });
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
