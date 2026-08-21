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
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(category)}&key=${apiKey}`
    );
    const searchJson = await searchRes.json();
    if (searchJson.status !== "OK" && searchJson.status !== "ZERO_RESULTS") {
      throw new Error(`Places nearbysearch error: ${searchJson.status} ${searchJson.error_message ?? ""}`);
    }
    candidates = (searchJson.results ?? []).slice(0, 12);
  } else {
    const query = `${category} in ${city}`;
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    );
    const searchJson = await searchRes.json();
    if (searchJson.status !== "OK" && searchJson.status !== "ZERO_RESULTS") {
      throw new Error(`Places textsearch error: ${searchJson.status} ${searchJson.error_message ?? ""}`);
    }
    candidates = (searchJson.results ?? []).slice(0, 12);
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
