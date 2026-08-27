import { suggestedServices } from "@/lib/serviceSuggestions";

/**
 * Turn a lead's Google Places data into everything we can safely pre-fill on a
 * draft site — so the operator can send "I already built you one, here's the
 * link" instead of pitching a maybe.
 *
 * Only maps facts that came from Google (name, contact, rating, Place ID) plus
 * category-typical service names. It never invents an "about" or a claim — that
 * copy is the operator's to write before the site goes out.
 */

export type LeadForDraft = {
  name: string;
  category: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  instagramHandle?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  placeId?: string | null;
};

export type DraftSiteInput = {
  businessName: string;
  tagline: string;
  category: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  instagramHandle: string | null;
  rating: number | null;
  reviewCount: number | null;
  googlePlaceId: string | null;
  serviceNames: string[];
};

const clean = (v?: string | null): string | null => v?.trim() || null;

export function leadToDraftSite(lead: LeadForDraft): DraftSiteInput {
  const category = lead.category.trim();
  const city = lead.city.trim();

  return {
    businessName: lead.name.trim(),
    // A starting-point tagline the operator personalises before sending — matches
    // the default the manual /builder/new flow has always used.
    tagline: category && city ? `Your trusted ${category} in ${city}` : "",
    category,
    address: clean(lead.address),
    phone: clean(lead.phone),
    email: clean(lead.email),
    instagramHandle: clean(lead.instagramHandle),
    rating: lead.rating ?? null,
    reviewCount: lead.reviewCount ?? null,
    googlePlaceId: clean(lead.placeId),
    serviceNames: suggestedServices(category).slice(0, 5),
  };
}
