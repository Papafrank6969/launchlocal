import { describe, expect, it } from "vitest";
import { fullCaption, posterJob, zernioBody, type PosterDeps } from "./poster";
import { fakeCtx } from "./testCtx";

const post = { id: "p1", caption: "A simple site for your lash studio.", hashtags: ["lashtech", "nyclashes"], videoUrl: "https://x.public.blob.vercel-storage.com/p1.mp4" };

function deps(status: number, over: Partial<PosterDeps> = {}) {
  const sent: { url: string; init: RequestInit }[] = [];
  const posted: string[] = [];
  const failed: string[] = [];
  const d: PosterDeps = {
    apiKey: "sk_test",
    instagramAccountId: "ig1",
    tiktokAccountId: "tt1",
    next: post,
    markPosted: async (id) => void posted.push(id),
    markFailed: async (id, e) => void failed.push(`${id}: ${e}`),
    fetch: (async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return { ok: status < 300, status, json: async () => (status < 300 ? { post: { _id: "z1" } } : { error: "bad video" }) };
    }) as unknown as typeof fetch,
    ...over,
  };
  return { d, sent, posted, failed };
}

describe("fullCaption", () => {
  it("appends hashtags", () => {
    expect(fullCaption(post)).toBe("A simple site for your lash studio.\n\n#lashtech #nyclashes");
    expect(fullCaption({ caption: "Hi", hashtags: [] })).toBe("Hi");
  });
});

describe("zernioBody", () => {
  it("only includes connected platforms, TikTok settings only with TikTok", () => {
    const ig = zernioBody(post, { instagram: "ig1" });
    expect(ig.platforms).toEqual([{ platform: "instagram", accountId: "ig1" }]);
    expect(ig).not.toHaveProperty("tiktokSettings");
    const both = zernioBody(post, { instagram: "ig1", tiktok: "tt1" });
    expect(both.platforms.map((p) => p.platform)).toEqual(["instagram", "tiktok"]);
    expect(both.tiktokSettings?.privacy_level).toBe("PUBLIC_TO_EVERYONE");
  });
});

describe("posterJob", () => {
  it("does nothing until Zernio is connected", async () => {
    const { d, sent } = deps(200, { apiKey: undefined });
    expect(await posterJob(d, fakeCtx().ctx)).toMatch(/no accounts connected/);
    expect(sent).toEqual([]);
  });

  it("posts the video and marks it POSTED", async () => {
    const { d, sent, posted } = deps(200);
    expect(await posterJob(d, fakeCtx().ctx)).toBe("posted 1 video to Instagram + TikTok");
    expect(sent[0].url).toBe("https://zernio.com/api/v1/posts");
    expect((sent[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test");
    expect(posted).toEqual(["p1"]);
  });

  it("marks the post FAILED when Zernio rejects it", async () => {
    const { d, posted, failed } = deps(400);
    expect(await posterJob(d, fakeCtx().ctx)).toBe("Zernio 400: bad video");
    expect(posted).toEqual([]);
    expect(failed).toEqual(["p1: Zernio 400: bad video"]);
  });

  it("throws on outages and bad keys, leaving the post for tomorrow", async () => {
    for (const status of [500, 429, 401]) {
      const { d, failed } = deps(status);
      await expect(posterJob(d, fakeCtx().ctx)).rejects.toThrow(`Zernio ${status}`);
      expect(failed).toEqual([]);
    }
  });
});
