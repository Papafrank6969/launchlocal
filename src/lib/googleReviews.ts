/**
 * Real Google reviews, pulled on demand from the Places Details API and shown
 * verbatim with attribution and a link back to the Google listing.
 *
 * Hard rules (Google Places ToS + `docs/SITE-QUALITY-CHECKLIST.md`):
 * - Reviews are NEVER generated, edited, reordered by sentiment, or filtered by
 *   star rating. What Google returns is what renders.
 * - Cached copies must be refreshed regularly — `googleReviewsUpdatedAt` records
 *   the last pull so the operator can see when it's stale.
 * - The Places API returns at most 5 reviews per place; that's the ceiling here.
 *
 * Two shapes flow through here: the raw Places `reviews[]` entry (snake_case)
 * from the API, and our own `GoogleReview` (the shape we persist in
 * `Site.googleReviewsJson` and render). `fetchGoogleReviews` converts the first
 * to the second; `parseGoogleReviews` validates the second when reading it back.
 */

export type GoogleReview = {
  author: string;
  authorUrl?: string;
  profilePhotoUrl?: string;
  rating: number;
  text: string;
  relativeTime: string;
  /** Unix seconds — used only for ordering, never shown (we show relativeTime). */
  time: number;
};

const MAX_REVIEWS = 5;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function optionalStr(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function rating(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
}

function build(fields: {
  author: string;
  authorUrl?: string;
  profilePhotoUrl?: string;
  rating: number;
  text: string;
  relativeTime: string;
  time: number;
}): GoogleReview | null {
  if (!fields.author || !fields.text || fields.rating < 1 || fields.rating > 5) return null;
  return fields;
}

/** One raw Places `reviews[]` entry → our shape. */
function fromPlacesReview(raw: unknown): GoogleReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return build({
    author: str(r.author_name),
    authorUrl: optionalStr(r.author_url),
    profilePhotoUrl: optionalStr(r.profile_photo_url),
    rating: rating(r.rating),
    text: str(r.text),
    relativeTime: str(r.relative_time_description),
    time: typeof r.time === "number" ? r.time : 0,
  });
}

/** One persisted `GoogleReview` (re-validated on read). */
function fromStoredReview(raw: unknown): GoogleReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return build({
    author: str(r.author),
    authorUrl: optionalStr(r.authorUrl),
    profilePhotoUrl: optionalStr(r.profilePhotoUrl),
    rating: rating(r.rating),
    text: str(r.text),
    relativeTime: str(r.relativeTime),
    time: typeof r.time === "number" ? r.time : 0,
  });
}

function newestFirst(a: GoogleReview, b: GoogleReview): number {
  return b.time - a.time;
}

/** Parse the stored `googleReviewsJson` blob into a safe, newest-first list. */
export function parseGoogleReviews(json?: string | null): GoogleReview[] {
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(fromStoredReview)
    .filter((r): r is GoogleReview => r !== null)
    .sort(newestFirst)
    .slice(0, MAX_REVIEWS);
}

export type FetchedGoogleReviews = {
  reviews: GoogleReview[];
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
};

/**
 * Pull fresh reviews + aggregate rating for a place. Throws with a readable
 * message on any API-level failure so the caller can surface it.
 */
export async function fetchGoogleReviews(
  placeId: string,
  apiKey: string
): Promise<FetchedGoogleReviews> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
    `&fields=reviews,url,rating,user_ratings_total&reviews_sort=newest&key=${apiKey}`;

  const res = await fetch(url);
  const json = (await res.json()) as {
    status?: string;
    error_message?: string;
    result?: {
      reviews?: unknown[];
      url?: string;
      rating?: number;
      user_ratings_total?: number;
    };
  };

  if (json.status !== "OK") {
    throw new Error(
      json.status === "INVALID_REQUEST"
        ? "Google didn't recognize that Place ID."
        : `Google Places error: ${json.status ?? "unknown"}${json.error_message ? ` — ${json.error_message}` : ""}`
    );
  }

  const reviews = (json.result?.reviews ?? [])
    .map(fromPlacesReview)
    .filter((r): r is GoogleReview => r !== null)
    .sort(newestFirst)
    .slice(0, MAX_REVIEWS);

  return {
    reviews,
    mapsUrl: typeof json.result?.url === "string" ? json.result.url : null,
    rating: typeof json.result?.rating === "number" ? json.result.rating : null,
    reviewCount:
      typeof json.result?.user_ratings_total === "number" ? json.result.user_ratings_total : null,
  };
}
