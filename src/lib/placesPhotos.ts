/**
 * Pull a business's own photos from Google Places so a freshly drafted site
 * isn't empty. These are starting images — the operator replaces them with the
 * business's real photos before the site goes official (before the lead is WON).
 * Google requires their attributions be shown wherever the photos appear.
 *
 * Photo flow uses Places API (New): a place lookup with a `photos` field mask
 * yields photo *resource names* (`places/…/photos/…`), then each name goes to
 * the New `/media` endpoint for bytes. The legacy Places Photo endpoints are
 * kept as the tier-2 fallback (same posture as `places.ts`).
 */

type NewPlacesPhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[];
};

type LegacyPlacePhoto = {
  photo_reference?: string;
  html_attributions?: unknown;
};

export type ParsedPlacePhotos = {
  refs: string[];
  /** Plain-text attribution line to show near the photos, or "" if none. */
  attribution: string;
};

const ENTITIES: Record<string, string> = { "&amp;": "&", "&#39;": "'", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#?\w+;/g, (m) => ENTITIES[m] ?? m)
    .trim();
}

function photoListOf<T>(
  photos: T[],
  refOf: (p: T) => string | undefined,
  namesOf: (p: T) => string[],
  max: number
): ParsedPlacePhotos {
  const refs: string[] = [];
  const names = new Set<string>();

  for (const p of photos) {
    if (refs.length >= max) break;
    const ref = refOf(p);
    if (typeof ref !== "string" || !ref) continue;
    refs.push(ref);
    for (const name of namesOf(p)) {
      if (name) names.add(name);
    }
  }

  const attribution =
    refs.length === 0
      ? ""
      : names.size > 0
        ? `Photos via Google — ${[...names].join(", ")}`
        : "Photos via Google";

  return { refs, attribution };
}

/** Parse a Places API (New) place response: refs are photo resource names, authorAttributions are already plain text. */
export function parsePlacePhotos(result: unknown, max = 6): ParsedPlacePhotos {
  const photos: NewPlacesPhoto[] =
    result && typeof result === "object" && Array.isArray((result as { photos?: unknown }).photos)
      ? (result as { photos: NewPlacesPhoto[] }).photos
      : [];

  return photoListOf(
    photos,
    (p) => p.name,
    (p) => (p.authorAttributions ?? []).map((a) => (typeof a.displayName === "string" ? a.displayName : "")),
    max
  );
}

/** Parse a legacy Places Details result: refs are photo_reference strings, attributions arrive as HTML blobs. */
function parseLegacyPlacePhotos(result: unknown, max = 6): ParsedPlacePhotos {
  const photos: LegacyPlacePhoto[] =
    result && typeof result === "object" && Array.isArray((result as { photos?: unknown }).photos)
      ? (result as { photos: LegacyPlacePhoto[] }).photos
      : [];

  return photoListOf(
    photos,
    (p) => p.photo_reference,
    (p) =>
      Array.isArray(p.html_attributions)
        ? p.html_attributions.filter((a): a is string => typeof a === "string").map(stripTags)
        : [],
    max
  );
}

/** Places API (New) place lookup — metadata only (the `photos` field is all we need). */
async function fetchPlacePhotoRefsViaNew(placeId: string, apiKey: string): Promise<ParsedPlacePhotos> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "photos",
    },
  });
  const json = (await res.json()) as { error?: { code: number; message: string } };
  if (!res.ok) {
    // Include HTTP status and the API's error.message, like the search migration.
    throw new Error(`Places API (New) error: ${res.status} ${json.error?.message ?? ""}`);
  }
  return parsePlacePhotos(json);
}

/** Legacy Places Details call for just the photos field — tier-2 fallback. */
async function fetchPlacePhotoRefsViaLegacy(placeId: string, apiKey: string): Promise<ParsedPlacePhotos> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
      `&fields=photos&key=${apiKey}`
  );
  const json = (await res.json()) as { status?: string; error_message?: string; result?: unknown };
  if (json.status !== "OK") {
    throw new Error(
      json.status === "INVALID_REQUEST"
        ? "Google didn't recognize that Place ID."
        : `Google Places error: ${json.status ?? "unknown"}${json.error_message ? ` — ${json.error_message}` : ""}`
    );
  }
  return parseLegacyPlacePhotos(json.result);
}

/**
 * Places API (New) photo bytes — the `/media` endpoint 302s to the real image
 * host and returns image bytes (like the legacy `place/photo` endpoint).
 * `key` goes in the query string here (the media endpoint accepts it there).
 */
async function fetchPlacePhotoBytesViaNew(resourceName: string, apiKey: string, maxWidth = 1600): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${resourceName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`
    );
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Legacy Places photo bytes — tier-2 fallback. */
async function fetchPlacePhotoBytesViaLegacy(ref: string, apiKey: string, maxWidth: number): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}` +
        `&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`
    );
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Places Details call that returns photo refs, using the New API with the legacy tier as fallback. */
export async function fetchPlacePhotoRefs(placeId: string, apiKey: string): Promise<ParsedPlacePhotos> {
  try {
    return await fetchPlacePhotoRefsViaNew(placeId, apiKey);
  } catch (err) {
    const isForbidden = err instanceof Error && /403/.test(err.message);
    console.warn(
      isForbidden
        ? "Places API (New) may not be enabled — see docs/GOOGLE-APIS.md. Falling back to legacy Places API."
        : "Places API (New) photo lookup failed, falling back to legacy Places API.",
      err
    );
    return fetchPlacePhotoRefsViaLegacy(placeId, apiKey);
  }
}

/** Fetch a Places photo's bytes (the endpoint 302s to the real image host). */
export async function fetchPlacePhotoBytes(ref: string, apiKey: string, maxWidth = 1600): Promise<Buffer | null> {
  // Tier routing: New photo resource names always start with `places/`; legacy
  // photo_reference strings never do. Route by that so refs and bytes stay on
  // the tier that produced the refs (a New resource name is not a valid
  // legacy photo_reference and vice versa). If the New path returns null for a
  // New ref, try legacy as a last resort — it will usually fail the same way.
  if (ref.startsWith("places/")) {
    const viaNew = await fetchPlacePhotoBytesViaNew(ref, apiKey, maxWidth);
    if (viaNew !== null) return viaNew;
  }
  return fetchPlacePhotoBytesViaLegacy(ref, apiKey, maxWidth);
}