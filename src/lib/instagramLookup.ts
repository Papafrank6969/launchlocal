import { extractInstagramHandle } from "@/lib/places";

export type InstagramLookupResult =
  | { status: "found"; handle: string }
  | { status: "not_found" }
  | { status: "not_configured" }        // no BRAVE_SEARCH_API_KEY
  | { status: "key_rejected" }          // 401 / 403 / 422: bad or inactive key
  | { status: "rate_limited" }          // 429: per-second limit or out of credit
  | { status: "error"; detail: string }; // anything else: network, 5xx, malformed

export const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

/**
 * Looks up a business's Instagram handle with the Brave Search API, restricted
 * to instagram.com results (`site:instagram.com`). Brave runs its own index
 * through an official API; nothing here scrapes Instagram, which has no public
 * "search by business name" endpoint.
 *
 * (This used Google's Custom Search JSON API until it closed to new customers;
 * it shuts down for everyone on 2027-01-01.)
 *
 * Returns a typed status instead of throwing. The key goes in a header, never
 * the URL, so error strings can't leak it.
 */
export async function lookupInstagramHandle(businessName: string, city: string): Promise<InstagramLookupResult> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return { status: "not_configured" };

  // Name as an exact phrase, place as a plain word: the exact "Harlem, NY" with
  // its comma rarely appears on Instagram pages, so quoting it found nothing.
  const place = city.split(",")[0].trim();
  const query = `site:instagram.com "${businessName}" ${place}`;
  let res: Response;
  try {
    res = await fetch(`${BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&count=10`, {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    });
  } catch (err) {
    return { status: "error", detail: err instanceof Error ? err.message : "Network error" };
  }

  if (res.status === 401 || res.status === 403 || res.status === 422) return { status: "key_rejected" };
  if (res.status === 429) return { status: "rate_limited" };

  let body: { web?: { results?: BraveResult[] } };
  try {
    body = await res.json();
  } catch {
    return { status: "error", detail: `Brave Search returned a non-JSON response (status ${res.status})` };
  }
  if (!res.ok) return { status: "error", detail: `Brave Search error: status ${res.status}` };

  const handle = pickInstagramHandle(body.web?.results ?? [], businessName, city);
  return handle ? { status: "found", handle } : { status: "not_found" };
}

export type BraveResult = { url?: string; title?: string; description?: string };

const decode = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const norm = (s: string) =>
  // NFKD splits accents off ("é" → "e" + mark); the a-z0-9 filter then drops the marks.
  decode(s).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");

/** The handle of a profile page (`instagram.com/<handle>/`), or null for posts, reels and other pages. */
function profileHandle(url?: string): string | null {
  if (!url) return null;
  try {
    if (new URL(url).pathname.split("/").filter(Boolean).length !== 1) return null;
  } catch {
    return null;
  }
  return extractInstagramHandle(url);
}

/** Profile titles look like `Joe's Pizza (@joespizza9508) · New York, NY`. */
function displayName(title?: string): string | null {
  return title?.includes("(@") ? title.split("(@")[0] : null;
}

/** Lowercase words, apostrophes dropped first so "Joe's" is one word: "joes". */
const words = (s: string) =>
  decode(s).normalize("NFKD").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Every word of the business name appears as a word (or word prefix: "barber"
 * fits "barbers") in the profile's name, or the whole name is inside the
 * handle. Whole words, so "In barbershop" can't match "Dave's on Main barbershop".
 */
function nameMatches(businessName: string, display: string | null, handle: string): boolean {
  const n = norm(businessName);
  if (n.length < 3) return false;
  const nameWords = words(businessName);
  const shown = display ? words(display) : [];
  return nameWords.every((w) => shown.some((x) => x.startsWith(w))) || (n.length >= 5 && norm(handle).includes(n));
}

/**
 * The profile says where it is: the place ("Harlem"), or the lead's state ("NY",
 * plus "New York" / "NYC" for NY), appears in its name, handle or bio. Without
 * this, same-name businesses elsewhere got through ("CUTZ BY MOE" in Houston).
 */
function placeMatches(r: BraveResult, handle: string, city: string): boolean {
  const [placePart, statePart] = city.split(",").map((x) => x.trim());
  const text = `${r.title ?? ""} ${r.description ?? ""} ${handle}`;
  const flat = norm(text);
  const ws = new Set(words(text));
  const place = norm(placePart ?? "");
  if (place.length >= 4 && flat.includes(place)) return true;
  const state = (statePart ?? "").toLowerCase();
  if (state.length === 2 && ws.has(state)) return true;
  return (state === "ny" || place === "newyork") && (flat.includes("newyork") || ws.has("nyc"));
}

/**
 * Picks the business's own profile out of search results. A wrong handle means a
 * DM to a stranger, so this prefers "not found" over a guess. A profile counts
 * only if:
 * - it's a profile page: a post *about* the business (`/<someone>/p/…`,
 *   `/reel/…`) is someone else's account;
 * - its name or handle matches the business name (whole words);
 * - it shows it's in the lead's place or state.
 * The first such profile (Brave's ranking) wins.
 */
export function pickInstagramHandle(results: BraveResult[], businessName: string, city: string): string | null {
  for (const r of results) {
    const handle = profileHandle(r.url);
    if (handle && nameMatches(businessName, displayName(r.title), handle) && placeMatches(r, handle, city)) return handle;
  }
  return null;
}
