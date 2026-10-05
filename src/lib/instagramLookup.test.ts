import { afterEach, describe, expect, it, vi } from "vitest";
import { BRAVE_SEARCH_URL, lookupInstagramHandle, pickInstagramHandle } from "./instagramLookup";

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

// Real Brave results from 2026-10-04 (trimmed): the cases that broke "take the first link".
const LUCALI = [
  { url: "https://www.instagram.com/reel/DRQXAYRjCdO/", title: "Lucali In Brooklyn Is An All Time Great Pizza | David Portnoy ..." },
  { url: "https://www.instagram.com/stoolpresidente/p/BpIXMQiBbhc/?hl=en", title: "Barstool Pizza Review - Lucali (Brooklyn)" },
  { url: "https://www.instagram.com/popular/lucali-brooklyn-instagram/", title: "Lucali Brooklyn Instagram" },
];
const JOES = [
  { url: "https://www.instagram.com/joespizza9508/", title: "Joe's Pizza (@joespizza9508) · New York, NY", description: "Joe&#x27;s Pizza (@joespizza9508) on Instagram: &quot;Located in Queens" },
  { url: "https://www.instagram.com/joespizzala/?hl=en", title: "Joe's Pizza - LA (@joespizzala) - Instagram", description: "A Slice of New York in LA" },
  { url: "https://www.instagram.com/newyorkcitykopp/reel/DHedv7bONIO/", title: "Kelly Kopp | Have you been to Joe's Pizza in New York City ..." },
  { url: "https://www.instagram.com/joes.pza/", title: "#joespizza (@joes.pza) • Instagram photos and videos", description: "JOE'S PIZZA SANTA MONICA" },
];

describe("pickInstagramHandle", () => {
  it("never takes a handle from someone else's post or reel about the business", () => {
    expect(pickInstagramHandle(LUCALI, "Lucali", "Brooklyn")).toBeNull(); // was "stoolpresidente"
  });

  it("several matching profiles: the city picks one", () => {
    expect(pickInstagramHandle(JOES, "Joe's Pizza", "New York")).toBe("joespizza9508");
  });

  it("several matching profiles and none mention the city: ambiguous, not found", () => {
    expect(pickInstagramHandle(JOES, "Joe's Pizza", "Massapequa, NY")).toBeNull();
  });

  it("a single matching profile is accepted even without the city", () => {
    expect(pickInstagramHandle([{ url: "https://www.instagram.com/fadelab_ny/", title: "Fade Lab Barbershop (@fadelab_ny) • Instagram" }], "Fade Lab", "Massapequa, NY")).toBe("fadelab_ny");
  });

  it("a profile whose name doesn't match the business is rejected", () => {
    expect(pickInstagramHandle([{ url: "https://www.instagram.com/nyc_eats/", title: "NYC Eats (@nyc_eats) • Instagram" }], "Fade Lab", "Massapequa, NY")).toBeNull();
  });

  it("matches through accents and punctuation", () => {
    expect(pickInstagramHandle([{ url: "https://www.instagram.com/cafebonjour.li/", title: "Café Bonjour (@cafebonjour.li)" }], "Cafe Bonjour", "Bay Shore, NY")).toBe("cafebonjour.li");
  });
});
