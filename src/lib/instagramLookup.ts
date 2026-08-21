import { extractInstagramHandle } from "@/lib/places";

export type InstagramLookupResult =
  | { status: "found"; handle: string }
  | { status: "not_found" }
  | { status: "not_configured" };

/**
 * Looks up a business's Instagram handle via Google Custom Search, restricted
 * to instagram.com results (`site:instagram.com`). This queries Google's own
 * search index through an official API — it does not scrape Instagram, which
 * has no public "search by business name" endpoint of its own.
 *
 * Requires a Custom Search Engine configured at
 * https://programmablesearchengine.google.com/ (with "Search the entire web"
 * enabled) plus an API key with the Custom Search API enabled.
 */
export async function lookupInstagramHandle(
  businessName: string,
  city: string
): Promise<InstagramLookupResult> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    return { status: "not_configured" };
  }

  const query = `site:instagram.com "${businessName}" "${city}"`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=3`;

  const res = await fetch(url);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(`Custom Search error: ${json?.error?.message ?? res.status}`);
  }

  const items: { link?: string }[] = json.items ?? [];
  for (const item of items) {
    const handle = extractInstagramHandle(item.link);
    if (handle) return { status: "found", handle };
  }

  return { status: "not_found" };
}
