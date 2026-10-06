// The Villa's Editor (docs/VILLA-PLAN.md): posts are rendered by video/render-posts.ts
// in a GitHub Action, which reports back here. Pure so it's tested without a DB.

export const RENDER_BATCH = 3;
export const EDITOR_ID = "editor";

export type RenderResult = { id: string; videoUrl: string } | { id: string; error: string };

/** Fails closed: no CRON_SECRET configured means nobody gets in. */
export function cronAllowed(authorization: string | null, secret: string | undefined): boolean {
  return !!secret && authorization === `Bearer ${secret}`;
}

/** Only our own Blob store's public URLs are accepted as a video. */
export function isBlobVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.endsWith(".mp4");
  } catch {
    return false;
  }
}

/** Validates the Action's report body; drops malformed rows. */
export function parseRenderReport(body: unknown): RenderResult[] {
  const rows = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(rows)) return [];
  const out: RenderResult[] = [];
  for (const r of rows) {
    if (typeof r !== "object" || r === null || typeof (r as { id?: unknown }).id !== "string") continue;
    const { id, videoUrl, error } = r as { id: string; videoUrl?: unknown; error?: unknown };
    if (typeof videoUrl === "string" && isBlobVideoUrl(videoUrl)) out.push({ id, videoUrl });
    else if (typeof error === "string") out.push({ id, error: error.slice(0, 500) });
  }
  return out;
}

export function renderSummary(results: RenderResult[]): string {
  if (results.length === 0) return "nothing to render";
  const ok = results.filter((r) => "videoUrl" in r).length;
  const failed = results.length - ok;
  return `rendered ${ok} video${ok === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`;
}
