import { afterEach, describe, expect, it, vi } from "vitest";
import { BRAVE_SEARCH_URL, lookupInstagramHandle } from "./instagramLookup";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}
const results = (...urls: string[]) => ({ web: { results: urls.map((url) => ({ url, title: "t" })) } });

function withKey() {
  vi.stubEnv("BRAVE_SEARCH_API_KEY", "test-brave-key");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("lookupInstagramHandle (Brave Search)", () => {
  it("returns not_configured without a key, without calling fetch", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await lookupInstagramHandle("Fade Lab", "Massapequa, NY")).toEqual({ status: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries site:instagram.com with the quoted name and city, key in the header only", async () => {
    withKey();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(results()));
    await lookupInstagramHandle("Fade Lab", "Massapequa, NY");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith(BRAVE_SEARCH_URL)).toBe(true);
    expect(new URL(url).searchParams.get("q")).toBe('site:instagram.com "Fade Lab" "Massapequa, NY"');
    expect(url).not.toContain("test-brave-key");
    expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("test-brave-key");
  });

  it("returns the first real handle, skipping reserved paths", async () => {
    withKey();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(results("https://www.instagram.com/explore/tags/barber/", "https://www.instagram.com/fadelab_ny/")),
    );
    expect(await lookupInstagramHandle("Fade Lab", "Massapequa, NY")).toEqual({ status: "found", handle: "fadelab_ny" });
  });

  it("returns not_found when nothing on instagram.com matches", async () => {
    withKey();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(results("https://example.com/fade-lab")));
    expect(await lookupInstagramHandle("Fade Lab", "Massapequa, NY")).toEqual({ status: "not_found" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));
    expect(await lookupInstagramHandle("Fade Lab", "Massapequa, NY")).toEqual({ status: "not_found" });
  });

  it.each([401, 403, 422])("returns key_rejected on %i", async (status) => {
    withKey();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ type: "ErrorResponse" }, status));
    expect(await lookupInstagramHandle("a", "b")).toEqual({ status: "key_rejected" });
  });

  it("returns rate_limited on 429", async () => {
    withKey();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 429));
    expect(await lookupInstagramHandle("a", "b")).toEqual({ status: "rate_limited" });
  });

  it("returns error on a 500, malformed JSON, or a network failure", async () => {
    withKey();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 500));
    expect(await lookupInstagramHandle("a", "b")).toMatchObject({ status: "error", detail: expect.stringContaining("500") });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } } as unknown as Response);
    expect(await lookupInstagramHandle("a", "b")).toMatchObject({ status: "error" });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    expect(await lookupInstagramHandle("a", "b")).toEqual({ status: "error", detail: "ECONNRESET" });
  });
});
