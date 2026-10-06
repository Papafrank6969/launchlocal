import { describe, expect, it } from "vitest";
import { cronAllowed, isBlobVideoUrl, parseRenderReport, renderSummary } from "./villaRender";

const url = "https://abc123.public.blob.vercel-storage.com/villa/p1.mp4";

describe("cronAllowed", () => {
  it("fails closed without a secret and checks the bearer", () => {
    expect(cronAllowed("Bearer x", undefined)).toBe(false);
    expect(cronAllowed("Bearer ", "")).toBe(false);
    expect(cronAllowed("Bearer s3", "s3")).toBe(true);
    expect(cronAllowed("Bearer nope", "s3")).toBe(false);
    expect(cronAllowed(null, "s3")).toBe(false);
  });
});

describe("isBlobVideoUrl", () => {
  it.each([
    [url, true],
    ["http://abc.public.blob.vercel-storage.com/a.mp4", false],
    ["https://evil.com/a.mp4", false],
    ["https://abc.public.blob.vercel-storage.com.evil.com/a.mp4", false],
    ["https://abc.public.blob.vercel-storage.com/a.png", false],
    ["not a url", false],
  ])("%s -> %s", (u, ok) => expect(isBlobVideoUrl(u)).toBe(ok));
});

describe("parseRenderReport", () => {
  it("keeps valid rows, drops junk, truncates errors", () => {
    const rows = parseRenderReport({
      results: [
        { id: "p1", videoUrl: url },
        { id: "p2", error: "x".repeat(600) },
        { id: "p3", videoUrl: "https://evil.com/a.mp4" },
        { videoUrl: url },
        null,
        "x",
      ],
    });
    expect(rows).toEqual([
      { id: "p1", videoUrl: url },
      { id: "p2", error: "x".repeat(500) },
    ]);
  });
  it("handles a missing or bad body", () => {
    expect(parseRenderReport(null)).toEqual([]);
    expect(parseRenderReport({ results: "no" })).toEqual([]);
  });
});

describe("renderSummary", () => {
  it("counts", () => {
    expect(renderSummary([])).toBe("nothing to render");
    expect(renderSummary([{ id: "a", videoUrl: url }])).toBe("rendered 1 video");
    expect(renderSummary([{ id: "a", videoUrl: url }, { id: "b", videoUrl: url }, { id: "c", error: "e" }])).toBe("rendered 2 videos, 1 failed");
  });
});
