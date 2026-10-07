import type { BrotherContext } from "../agentTypes";

// The Villa's Poster (docs/VILLA-PLAN.md): publishes one RENDERED post a day to
// Instagram Reels and TikTok through Zernio (formerly Late), an audited posting
// service, so TikTok posts go out public. No Claude. Zernio publishes async;
// per-platform results show in its dashboard.

export const ZERNIO_API = "https://zernio.com/api/v1";

export type PosterPost = { id: string; caption: string; hashtags: string[]; videoUrl: string };

export type PosterDeps = {
  apiKey?: string;
  instagramAccountId?: string;
  tiktokAccountId?: string;
  next: PosterPost | null; // oldest RENDERED post
  fetch: typeof fetch;
  markPosted(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
};

export function fullCaption(p: Pick<PosterPost, "caption" | "hashtags">): string {
  const tags = p.hashtags.map((h) => `#${h}`).join(" ");
  return tags ? `${p.caption}\n\n${tags}` : p.caption;
}

export function zernioBody(post: PosterPost, accounts: { instagram?: string; tiktok?: string }) {
  return {
    content: fullCaption(post),
    mediaItems: [{ type: "video", url: post.videoUrl }],
    platforms: [
      ...(accounts.instagram ? [{ platform: "instagram", accountId: accounts.instagram }] : []),
      ...(accounts.tiktok ? [{ platform: "tiktok", accountId: accounts.tiktok }] : []),
    ],
    ...(accounts.tiktok && {
      tiktokSettings: {
        privacy_level: "PUBLIC_TO_EVERYONE",
        allow_comment: true,
        allow_duet: true,
        allow_stitch: true,
        content_preview_confirmed: true,
        express_consent_given: true,
      },
    }),
    publishNow: true,
  };
}

export async function posterJob(deps: PosterDeps, ctx: BrotherContext): Promise<string> {
  const accounts = { instagram: deps.instagramAccountId, tiktok: deps.tiktokAccountId };
  if (!deps.apiKey || (!accounts.instagram && !accounts.tiktok)) {
    return "no accounts connected (ZERNIO_API_KEY + ZERNIO_INSTAGRAM_ACCOUNT_ID / ZERNIO_TIKTOK_ACCOUNT_ID)";
  }
  const post = deps.next;
  if (!post) return "nothing rendered to post";

  const where = [accounts.instagram && "Instagram", accounts.tiktok && "TikTok"].filter(Boolean).join(" + ");
  await ctx.setNow(`posting to ${where}`);
  const res = await deps.fetch(`${ZERNIO_API}/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${deps.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(zernioBody(post, accounts)),
  });
  if (res.ok) {
    await deps.markPosted(post.id);
    return `posted 1 video to ${where}`;
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  const error = `Zernio ${res.status}: ${body.error ?? body.message ?? "request failed"}`.slice(0, 500);
  // Other 4xx = this post is the problem; 5xx, 429 and a bad key are Zernio's or
  // ours, so throw (the run logs ERROR) and retry the same post tomorrow.
  if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 401) {
    await deps.markFailed(post.id, error);
    return error;
  }
  throw new Error(error);
}
