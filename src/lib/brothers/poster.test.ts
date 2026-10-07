import { describe, expect, it } from "vitest";
import { fullCaption, posterJob, POLL_TRIES, type PosterDeps } from "./poster";
import { fakeCtx } from "./testCtx";

const post = { id: "p1", caption: "A simple site for your lash studio.", hashtags: ["lashtech", "nyclashes"], videoUrl: "https://x.public.blob.vercel-storage.com/p1.mp4" };

function deps(statuses: string[], over: Partial<PosterDeps> = {}) {
  const calls: string[] = [];
  const posted: string[] = [];
  const failed: string[] = [];
  const reply = (body: object, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body }) as Response;
  const d: PosterDeps = {
    token: "tok",
    userId: "42",
    next: post,
    sleep: async () => {},
    markPosted: async (id) => void posted.push(id),
    markFailed: async (id, e) => void failed.push(`${id}: ${e}`),
    fetch: (async (url: string, init: RequestInit) => {
      const u = new URL(url);
      calls.push(`${init.method} ${u.pathname.split("/").slice(2).join("/")}`);
      if (u.pathname.endsWith("/media")) return reply({ id: "c1" });
      if (u.pathname.endsWith("/media_publish")) return reply({ id: "m1" });
      return reply({ status_code: statuses.shift() ?? "IN_PROGRESS" });
    }) as typeof fetch,
    ...over,
  };
  return { d, calls, posted, failed };
}

describe("fullCaption", () => {
  it("appends hashtags", () => {
    expect(fullCaption(post)).toBe("A simple site for your lash studio.\n\n#lashtech #nyclashes");
    expect(fullCaption({ caption: "Hi", hashtags: [] })).toBe("Hi");
  });
});

describe("posterJob", () => {
  it("does nothing until Instagram is connected", async () => {
    const { d, calls } = deps([], { token: undefined });
    expect(await posterJob(d, fakeCtx().ctx)).toMatch(/isn't connected/);
    expect(calls).toEqual([]);
  });

  it("creates a container, waits for FINISHED, publishes", async () => {
    const { d, calls, posted } = deps(["IN_PROGRESS", "FINISHED"]);
    expect(await posterJob(d, fakeCtx().ctx)).toBe("posted 1 Reel to Instagram");
    expect(calls).toEqual(["POST 42/media", "GET c1", "GET c1", "POST 42/media_publish"]);
    expect(posted).toEqual(["p1"]);
  });

  it("marks the post FAILED when Instagram can't process it", async () => {
    const { d, posted, failed } = deps(["ERROR"]);
    await posterJob(d, fakeCtx().ctx);
    expect(posted).toEqual([]);
    expect(failed).toHaveLength(1);
  });

  it("leaves the post for tomorrow if processing never finishes", async () => {
    const { d, calls, posted, failed } = deps([]);
    expect(await posterJob(d, fakeCtx().ctx)).toMatch(/retry tomorrow/);
    expect(calls.filter((c) => c === "GET c1")).toHaveLength(POLL_TRIES);
    expect([...posted, ...failed]).toEqual([]);
  });

  it("throws Instagram's error message so the run logs it", async () => {
    const { d } = deps([], {
      fetch: (async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid token" } }) })) as unknown as typeof fetch,
    });
    await expect(posterJob(d, fakeCtx().ctx)).rejects.toThrow("Instagram 400: Invalid token");
  });
});
