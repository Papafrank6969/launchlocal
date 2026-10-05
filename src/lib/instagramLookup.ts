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
    res = await fetch(`${BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&count=5`, {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    });
  } catch (err) {
    return { status: "error", detail: err instanceof Error ? err.message : "Network error" };
  }

  if (res.status === 401 || res.status === 403 || res.status === 422) return { status: "key_rejected" };
  if (res.status === 429) return { status: "rate_limited" };

  let body: { web?: { results?: { url?: string }[] } };
  try {
    body = await res.json();
  } catch {
    return { status: "error", detail: `Brave Search returned a non-JSON response (status ${res.status})` };
  }
  if (!res.ok) return { status: "error", detail: `Brave Search error: status ${res.status}` };

  for (const result of body.web?.results ?? []) {
    const handle = extractInstagramHandle(result.url);
    if (handle) return { status: "found", handle };
  }
  return { status: "not_found" };
}
