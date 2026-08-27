/**
 * Pull a business's own photos from Google Places so a freshly drafted site
 * isn't empty. These are starting images — the operator replaces them with the
 * business's real photos before the site goes official (before the lead is WON).
 * Google requires their attributions be shown wherever the photos appear.
 */

type PlacesPhoto = {
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

/** Pull photo references + a display attribution from a Places Details result. */
export function parsePlacePhotos(result: unknown, max = 6): ParsedPlacePhotos {
  const photos: PlacesPhoto[] =
    result && typeof result === "object" && Array.isArray((result as { photos?: unknown }).photos)
      ? ((result as { photos: PlacesPhoto[] }).photos)
      : [];

  const refs: string[] = [];
  const names = new Set<string>();

  for (const p of photos) {
    if (refs.length >= max) break;
    if (typeof p.photo_reference !== "string" || !p.photo_reference) continue;
    refs.push(p.photo_reference);
    if (Array.isArray(p.html_attributions)) {
      for (const a of p.html_attributions) {
        if (typeof a === "string") {
          const name = stripTags(a);
          if (name) names.add(name);
        }
      }
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

/** Fetch a Places photo's bytes (the endpoint 302s to the real image host). */
export async function fetchPlacePhotoBytes(
  ref: string,
  apiKey: string,
  maxWidth = 1600
): Promise<Buffer | null> {
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

/** Places Details call for just the photos field. */
export async function fetchPlacePhotoRefs(placeId: string, apiKey: string): Promise<ParsedPlacePhotos> {
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
  return parsePlacePhotos(json.result);
}
