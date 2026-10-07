import type { BrotherContext } from "../agentTypes";

// The Villa's Poster (docs/VILLA-PLAN.md): publishes one RENDERED post a day as
// an Instagram Reel through the Instagram API with Instagram Login. No Claude.
// Reels publish in three steps: create a container from the video URL, wait for
// Instagram to process it, then publish the container.

export const IG_API = "https://graph.instagram.com/v23.0";
export const POLL_MS = 5_000;
export const POLL_TRIES = 36; // ~3 min, inside the agents cron's maxDuration

export type PosterPost = { id: string; caption: string; hashtags: string[]; videoUrl: string };

export type PosterDeps = {
  token?: string;
  userId?: string;
  next: PosterPost | null; // oldest RENDERED post
  fetch: typeof fetch;
  sleep(ms: number): Promise<void>;
  markPosted(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
};

export function fullCaption(p: Pick<PosterPost, "caption" | "hashtags">): string {
  const tags = p.hashtags.map((h) => `#${h}`).join(" ");
  return tags ? `${p.caption}\n\n${tags}` : p.caption;
}

async function ig(deps: PosterDeps, path: string, params: Record<string, string>, method: "GET" | "POST") {
  const qs = new URLSearchParams({ ...params, access_token: deps.token! });
  const res = await deps.fetch(`${IG_API}/${path}?${qs}`, { method });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Instagram ${res.status}: ${body.error?.message ?? "request failed"}`);
  return body;
}

export async function posterJob(deps: PosterDeps, ctx: BrotherContext): Promise<string> {
  if (!deps.token || !deps.userId) return "Instagram isn't connected (INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID)";
  const post = deps.next;
  if (!post) return "nothing rendered to post";

  await ctx.setNow("uploading a Reel to Instagram");
  const { id: containerId } = await ig(
    deps,
    `${deps.userId}/media`,
    { media_type: "REELS", video_url: post.videoUrl, caption: fullCaption(post) },
    "POST"
  );

  for (let i = 0; i < POLL_TRIES; i++) {
    await deps.sleep(POLL_MS);
    const { status_code, status } = await ig(deps, String(containerId), { fields: "status_code,status" }, "GET");
    if (status_code === "FINISHED") {
      await ig(deps, `${deps.userId}/media_publish`, { creation_id: String(containerId) }, "POST");
      await deps.markPosted(post.id);
      return "posted 1 Reel to Instagram";
    }
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      const error = `Instagram couldn't process the video: ${status ?? status_code}`;
      await deps.markFailed(post.id, error);
      return error;
    }
  }
  // Left RENDERED, so tomorrow's run makes a fresh container and tries again.
  return "Instagram was still processing the video; will retry tomorrow";
}
