import { db } from "@/lib/db";
import { uniqueSlug, slugify } from "@/lib/slug";
import { chooseDesign } from "@/lib/generateDesign";
import { normalizeBookingUrl } from "@/lib/bookingUrl";
import { fetchGoogleReviews } from "@/lib/googleReviews";
import { leadToDraftSite } from "@/lib/leadToSite";
import { fetchPlacePhotoRefs, fetchPlacePhotoBytes } from "@/lib/placesPhotos";
import { dominantHueOf } from "@/lib/imageColor";

// Site creation shared by POST /api/sites and approvals-flow (moved out of the
// route unchanged). Includes the one-click "draft from a lead" path.

/**
 * Best-effort: pull one of the business's own Google photos and read its
 * dominant hue, so the design's color variant can be matched to the real
 * storefront. Any failure just means we fall back to a name hash.
 */
async function dominantHueFromPlace(placeId: string | null | undefined): Promise<number | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !placeId) return null;
  try {
    const { refs } = await fetchPlacePhotoRefs(placeId, apiKey);
    if (refs.length === 0) return null;
    const bytes = await fetchPlacePhotoBytes(refs[0], apiKey, 640);
    if (!bytes) return null;
    return dominantHueOf(bytes);
  } catch {
    return null;
  }
}


type ServiceInput = { name?: string; description?: string | null; price?: string | null };

export type SiteInput = {
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

export const withServices = { serviceItems: { orderBy: { order: "asc" as const } } };

export async function createSite(input: SiteInput) {
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

  const dominantHue = await dominantHueFromPlace(site.googlePlaceId);
  const choice = await chooseDesign({
    businessName: site.businessName,
    category: site.category,
    tagline: site.tagline,
    about: site.about,
    serviceNames: site.serviceItems.map((s) => s.name),
    dominantHue,
  });
  await db.site.update({
    where: { id: site.id },
    data: {
      designSystemId: choice.system.id,
      designRationale: choice.rationale,
      colorVariant: choice.variant,
    },
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


/**
 * One draft per lead, built from its Google data and PUBLISHED (a working
 * pitch link, kept out of search until the lead is WON; see
 * isUnclaimedPitchSite). Returns the existing site if the lead already has one,
 * or null if the lead doesn't exist.
 */
export async function draftSiteFromLead(leadId: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { sites: { select: { id: true }, take: 1 } },
  });
  if (!lead) return null;

  // One draft per lead — clicking twice just returns the first one.
  if (lead.sites.length > 0) {
    const site = await db.site.findUnique({ where: { id: lead.sites[0].id }, include: withServices });
    return { site, existing: true };
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
  return { site, existing: false };
}
