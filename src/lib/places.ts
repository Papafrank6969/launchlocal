export type RawBusiness = {
  name: string;
  category: string;
  address: string;
  city: string;
  phone?: string;
  existingUrl?: string;
  rating?: number;
  reviewCount?: number;
  placeId?: string;
  source: "GOOGLE_PLACES" | "MOCK";
};

export type WebsiteStatus = "NONE" | "POOR" | "HAS_SITE";

const WEAK_SITE_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linktr.ee",
  "linktree.com",
  "yelp.com",
  "wix.com/website-builder",
  "sites.google.com",
];

export function scoreWebsite(url?: string | null): WebsiteStatus {
  if (!url || url.trim() === "") return "NONE";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (WEAK_SITE_HOSTS.some((weak) => host.includes(weak))) return "POOR";
    // Extremely short / placeholder-looking domains also read as "poor"
    if (host.length < 6) return "POOR";
    return "HAS_SITE";
  } catch {
    return "POOR";
  }
}

const NON_HANDLE_PATHS = new Set([
  "explore",
  "accounts",
  "p",
  "reel",
  "reels",
  "stories",
  "direct",
  "about",
  "developer",
]);

/**
 * Google Places sometimes returns a business's "website" as a direct link to
 * their Instagram profile (common for small businesses with no real site).
 * Pull the @handle out of that URL when that's the case — this is the only
 * legitimate zero-effort way to get a handle, since Instagram has no public
 * "search by business name" API to look one up otherwise.
 */
export function extractInstagramHandle(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "instagram.com") return null;
    const handle = parsed.pathname.split("/").filter(Boolean)[0];
    if (!handle || NON_HANDLE_PATHS.has(handle.toLowerCase())) return null;
    return handle;
  } catch {
    return null;
  }
}

const MOCK_CATEGORIES = [
  "plumber",
  "hair salon",
  "bakery",
  "auto repair",
  "landscaping",
  "dentist",
  "coffee shop",
  "hvac contractor",
];

const MOCK_NAME_PARTS = {
  prefixes: ["Sunrise", "Golden", "Blue Ridge", "Maple", "Downtown", "Riverside", "Summit", "Coastal", "Heritage", "Lucky"],
  suffixes: {
    plumber: ["Plumbing", "Pipe & Drain", "Plumbing Co."],
    "hair salon": ["Hair Studio", "Salon & Spa", "Cuts"],
    bakery: ["Bakery", "Bread Co.", "Baking Co."],
    "auto repair": ["Auto Repair", "Auto Care", "Garage"],
    landscaping: ["Landscaping", "Lawn & Garden", "Outdoor Services"],
    dentist: ["Dental Care", "Family Dentistry", "Dental Group"],
    "coffee shop": ["Coffee House", "Roasters", "Cafe"],
    "hvac contractor": ["Heating & Cooling", "HVAC Services", "Climate Control"],
  } as Record<string, string[]>,
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function mockBusinessesFor(city: string, category: string): RawBusiness[] {
  const cat = category.toLowerCase().trim();
  const matched = MOCK_CATEGORIES.includes(cat) ? cat : MOCK_CATEGORIES[Math.abs(hashCode(cat)) % MOCK_CATEGORIES.length];
  const rand = seededRandom(hashCode(city + matched));
  const count = 8 + Math.floor(rand() * 5);
  const results: RawBusiness[] = [];

  for (let i = 0; i < count; i++) {
    const prefix = MOCK_NAME_PARTS.prefixes[Math.floor(rand() * MOCK_NAME_PARTS.prefixes.length)];
    const suffixOptions = MOCK_NAME_PARTS.suffixes[matched] ?? ["Services"];
    const suffix = suffixOptions[Math.floor(rand() * suffixOptions.length)];
    const name = `${prefix} ${suffix}`;

    const roll = rand();
    let existingUrl: string | undefined;
    if (roll < 0.4) {
      existingUrl = undefined; // no website
    } else if (roll < 0.52) {
      existingUrl = `https://facebook.com/${name.toLowerCase().replace(/\s+/g, "")}`; // poor — Facebook page
    } else if (roll < 0.65) {
      existingUrl = `https://instagram.com/${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`; // poor — Instagram is their "website"
    } else {
      existingUrl = `https://www.${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`; // has site
    }

    results.push({
      name,
      category: matched,
      address: `${100 + Math.floor(rand() * 900)} ${["Main St", "Oak Ave", "1st St", "Elm St", "Broadway"][Math.floor(rand() * 5)]}, ${city}`,
      city,
      phone: `(${200 + Math.floor(rand() * 700)}) 555-${1000 + Math.floor(rand() * 8999)}`,
      existingUrl,
      rating: Math.round((3 + rand() * 2) * 10) / 10,
      reviewCount: Math.floor(rand() * 250),
      placeId: `mock_${hashCode(city + name + i)}`,
      source: "MOCK",
    });
  }

  return results;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

const MAX_RADIUS_METERS = 50_000; // Nearby Search's hard cap, ~31 miles

export async function findBusinesses(
  city: string,
  category: string,
  radiusMiles?: number
): Promise<RawBusiness[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return mockBusinessesFor(city, category);
  }

  try {
    return await findBusinessesViaGooglePlaces(city, category, apiKey, radiusMiles);
  } catch (err) {
    console.error("Google Places lookup failed, falling back to mock data:", err);
    return mockBusinessesFor(city, category);
  }
}

async function geocode(address: string, apiKey: string): Promise<{ lat: number; lng: number }> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
  );
  const json = await res.json();
  if (json.status !== "OK" || !json.results?.[0]) {
    throw new Error(`Geocoding error: ${json.status} ${json.error_message ?? ""}`);
  }
  return json.results[0].geometry.location;
}

const PLACES_PAGE_DELAY_MS = 2000; // Google's documented minimum before a next_page_token *might* be valid.
// Token readiness is non-deterministic in practice, but on at least one real
// project next_page_token never became valid even after 12s of polling — so
// this stays low (not the 3+ retries you'd want for a flaky-but-eventually-
// works case) to avoid burning several extra seconds of latency on a search
// that can't paginate at all, while still trying once in case it's fixed.
const PLACES_PAGE_MAX_RETRIES = 1;
const MAX_PLACES_PAGES = 3; // Google never returns more than 3 pages (60 results) for search endpoints.

async function fetchPlacesPage(
  endpoint: "nearbysearch" | "textsearch",
  params: string
): Promise<{ status: string; error_message?: string; results?: { place_id: string }[]; next_page_token?: string }> {
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/${endpoint}/json?${params}`);
  return res.json();
}

/**
 * Follows next_page_token up to Google's 3-page/60-result ceiling. A page
 * beyond the first failing (token not ready, or — as observed on at least one
 * real project — never becoming valid at all) keeps whatever pages already
 * succeeded instead of losing the whole search or hanging indefinitely.
 */
async function fetchAllPlacesPages(
  endpoint: "nearbysearch" | "textsearch",
  baseParams: string,
  apiKey: string
): Promise<{ place_id: string }[]> {
  const results: { place_id: string }[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PLACES_PAGES; page++) {
    let json: Awaited<ReturnType<typeof fetchPlacesPage>> | undefined;

    if (!pageToken) {
      json = await fetchPlacesPage(endpoint, `${baseParams}&key=${apiKey}`);
    } else {
      for (let attempt = 0; attempt < PLACES_PAGE_MAX_RETRIES; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, PLACES_PAGE_DELAY_MS));
        json = await fetchPlacesPage(endpoint, `pagetoken=${pageToken}&key=${apiKey}`);
        if (json.status === "OK" || json.status === "ZERO_RESULTS") break;
      }
    }

    if (!json || (json.status !== "OK" && json.status !== "ZERO_RESULTS")) {
      if (page === 0) throw new Error(`Places ${endpoint} error: ${json?.status} ${json?.error_message ?? ""}`);
      break; // couldn't get this page after retries — stop here, keep what we have.
    }
    results.push(...(json.results ?? []));
    if (!json.next_page_token) break;
    pageToken = json.next_page_token;
  }

  return results;
}

async function findBusinessesViaGooglePlaces(
  city: string,
  category: string,
  apiKey: string,
  radiusMiles?: number
): Promise<RawBusiness[]> {
  let candidates: { place_id: string }[];

  if (radiusMiles && radiusMiles > 0) {
    const { lat, lng } = await geocode(city, apiKey);
    const radiusMeters = Math.min(Math.round(radiusMiles * 1609.34), MAX_RADIUS_METERS);
    candidates = await fetchAllPlacesPages(
      "nearbysearch",
      `location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(category)}`,
      apiKey
    );
  } else {
    const query = `${category} in ${city}`;
    candidates = await fetchAllPlacesPages("textsearch", `query=${encodeURIComponent(query)}`, apiKey);
  }

  const detailed = await Promise.all(
    candidates.map(async (place: { place_id: string }) => {
      try {
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total&key=${apiKey}`
        );
        const detailJson = await detailRes.json();
        return detailJson.result;
      } catch {
        return null;
      }
    })
  );

  return detailed
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map((d) => ({
      name: d.name,
      category,
      address: d.formatted_address ?? "",
      city,
      phone: d.formatted_phone_number,
      existingUrl: d.website,
      rating: d.rating,
      reviewCount: d.user_ratings_total,
      placeId: d.place_id ?? `${d.name}-${d.formatted_address}`,
      source: "GOOGLE_PLACES" as const,
    }));
}
