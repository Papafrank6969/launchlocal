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

  const query = `site:instagram.com "${businessName}" "${city}"`;
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

function nameMatches(businessName: string, display: string | null, handle: string): boolean {
  const n = norm(businessName);
  if (n.length < 3) return false;
  const d = display ? norm(display) : "";
  const h = norm(handle);
  return (d.length >= 3 && (d.includes(n) || n.includes(d))) || h.includes(n) || (h.length >= n.length * 0.6 && n.includes(h));
}

/**
 * Picks the business's own profile out of search results. A wrong handle means a
 * DM to a stranger, so this prefers "not found" over a guess:
 * - only profile pages count: a post *about* the business (`/<someone>/p/…`,
 *   `/reel/…`) is someone else's account;
 * - the profile's name (from the title) or handle must match the business name;
 * - if several profiles match, the city must appear in the result to pick one,
 *   and if none mention it, it's ambiguous: not found.
 */
export function pickInstagramHandle(results: BraveResult[], businessName: string, city: string): string | null {
  const matches = results
    .map((r) => ({ r, handle: profileHandle(r.url) }))
    .filter((c): c is { r: BraveResult; handle: string } => !!c.handle && nameMatches(businessName, displayName(c.r.title), c.handle));
  if (matches.length === 1) return matches[0].handle;
  const place = norm(city.split(",")[0] ?? "");
  if (place.length < 3) return null;
  return matches.find((c) => norm(`${c.r.title ?? ""} ${c.r.description ?? ""}`).includes(place))?.handle ?? null;
}
