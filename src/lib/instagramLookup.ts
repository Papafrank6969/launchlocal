import { extractInstagramHandle } from "@/lib/places";

export type InstagramLookupResult =
  | { status: "found"; handle: string }
  | { status: "not_found" }
  | { status: "not_configured" }        // no API key / no CSE id
  | { status: "api_disabled" }          // 403 / SERVICE_DISABLED / PERMISSION_DENIED
  | { status: "rate_limited" }          // 429 / quota
  | { status: "error"; detail: string }; // anything else — network, 5xx, malformed

interface CustomSearchErrorShape {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: { reason?: string; domain?: string }[];
  };
}

/**
 * Looks up a business's Instagram handle via Google Custom Search, restricted
 * to instagram.com results (`site:instagram.com`). This queries Google's own
 * search index through an official API — it does not scrape Instagram, which
 * has no public "search by business name" endpoint of its own.
 *
 * Requires a Custom Search Engine configured at
 * https://programmablesearchengine.google.com/ (with "Search the entire web"
 * enabled) plus an API key with the Custom Search API enabled.
 *
 * Returns a typed status instead of throwing: `not_configured` when credentials
 * are missing, `found` / `not_found` on a successful query, `api_disabled`
 * when the Custom Search API is disabled / permission-denied for the project
 * (the state this project has actually been stuck in), `rate_limited` on a
 * quota/429 hit, and `error` with a short detail string for everything else
 * (network failure, 5xx, malformed response).
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

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return { status: "error", detail: err instanceof Error ? err.message : "Network error" };
  }

  let body: CustomSearchErrorShape & { items?: { link?: string }[] };
  try {
    body = await res.json();
  } catch {
    if (!res.ok) {
      return { status: "error", detail: `Custom Search error: non-JSON response (status ${res.status})` };
    }
    return { status: "error", detail: "Custom Search returned a non-JSON response" };
  }

  if (res.status === 403 || (body.error && isPermissionDenied(body.error))) {
    return { status: "api_disabled" };
  }

  if (res.status === 429 || (body.error && isRateLimited(body.error))) {
    return { status: "rate_limited" };
  }

  if (!res.ok) {
    return { status: "error", detail: `Custom Search error: ${body.error?.message ?? `status ${res.status}`}` };
  }

  const items: { link?: string }[] = body.items ?? [];
  for (const item of items) {
    const handle = extractInstagramHandle(item.link);
    if (handle) return { status: "found", handle };
  }

  return { status: "not_found" };
}

function isPermissionDenied(error: NonNullable<CustomSearchErrorShape["error"]>): boolean {
  if (error.status === "PERMISSION_DENIED") return true;
  if (error.errors?.some((e) => e.reason === "SERVICE_DISABLED" || e.reason === "accessNotConfigured")) {
    return true;
  }
  return false;
}

function isRateLimited(error: NonNullable<CustomSearchErrorShape["error"]>): boolean {
  if (error.status === "RESOURCE_EXHAUSTED") return true;
  if (error.errors?.some((e) => e.reason === "rateLimitExceeded" || e.reason === "quotaExceeded")) {
    return true;
  }
  return false;
}
