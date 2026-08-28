/**
 * Generic stock imagery from Pexels, for the operator to drop onto blank
 * service cards on a pitch site — clearly a placeholder to replace with the
 * business's own photos. Never used for the hero or the About section (those
 * are statements about the specific business) and never automatic.
 */

type PexelsPhoto = {
  photographer?: string;
  photographer_url?: string;
  src?: Record<string, string>;
};

export type StockPhoto = {
  /** Direct image URL (Pexels `src.large`). */
  url: string;
  photographer: string;
  photographerUrl: string;
};

/** Pick the best candidate from a Pexels search response, or null. */
export function parsePexelsResult(json: unknown, index = 0): StockPhoto | null {
  const photos =
    json && typeof json === "object" && Array.isArray((json as { photos?: unknown }).photos)
      ? ((json as { photos: PexelsPhoto[] }).photos)
      : [];
  const p = photos[index] ?? photos[0];
  if (!p) return null;
  const url = p.src?.large || p.src?.large2x || p.src?.medium || p.src?.original;
  if (!url) return null;
  return {
    url,
    photographer: typeof p.photographer === "string" ? p.photographer : "Pexels",
    photographerUrl: typeof p.photographer_url === "string" ? p.photographer_url : "https://www.pexels.com",
  };
}

/** Search Pexels for one landscape photo matching `query`. Best-effort. */
export async function fetchStockPhoto(query: string, apiKey: string, index = 0): Promise<StockPhoto | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
        `&per_page=15&orientation=landscape&size=medium`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    return parsePexelsResult(await res.json(), index);
  } catch {
    return null;
  }
}
