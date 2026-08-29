import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupInstagramHandle, redactKey } from "./instagramLookup";

const apiKey = "test-api-key";
const cx = "test-cx";

function stubEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    vi.stubEnv(key, "");
    delete process.env[key];
  } else {
    vi.stubEnv(key, value);
  }
}

function jsonResponse(body: unknown, status = 200, ok = true): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function errorBody(value: unknown) {
  return { error: value } as const;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("lookupInstagramHandle", () => {
  it("returns not_configured when only the API key is missing, without calling fetch", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", undefined);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "not_configured" });
    expect(fetched).not.toHaveBeenCalled();
  });

  it("returns not_configured when only the CSE id is missing, without calling fetch", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", undefined);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "not_configured" });
    expect(fetched).not.toHaveBeenCalled();
  });

  it("returns found, pulling the handle out of the first item's link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ items: [{ link: "https://www.instagram.com/bella.lashes/" }] })
      )
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "found", handle: "bella.lashes" });
  });

  it("skips a reserved path item and uses the next real handle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            { link: "https://www.instagram.com/explore/tags/lashes/" },
            { link: "https://www.instagram.com/bella.lashes/" },
          ],
        })
      )
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "found", handle: "bella.lashes" });
  });

  it("returns not_found when the response is OK but has no items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("No One Here", "Nowhere");

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns api_disabled on a 403 status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Forbidden" } }, 403, false))
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "api_disabled" });
  });

  it("returns api_disabled when the body reports PERMISSION_DENIED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          errorBody({ status: "PERMISSION_DENIED", message: "This project does not have access to Custom Search JSON API." }),
          403,
          false
        )
      )
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "api_disabled" });
  });

  it("returns api_disabled when an error reason is SERVICE_DISABLED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          errorBody({ message: "Service disabled", errors: [{ reason: "SERVICE_DISABLED", domain: "usageLimits" }] }),
          403,
          false
        )
      )
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "api_disabled" });
  });

  it("returns rate_limited on a 429 status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Quota exceeded" } }, 429, false))
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "rate_limited" });
  });

  it("returns rate_limited when the body reports RESOURCE_EXHAUSTED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          errorBody({ status: "RESOURCE_EXHAUSTED", message: "Quota violated" }),
          503,
          false
        )
      )
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result).toEqual({ status: "rate_limited" });
  });

  it("returns error with a non-empty detail on a 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Internal error" } }, 500, false))
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });

  it("returns error with a non-empty detail on a malformed JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      } as unknown as Response)
    );
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });

  it("returns error with a non-empty detail when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unreachable")));
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    const result = await lookupInstagramHandle("Bella's Lashes", "Austin");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });

  it("composes the query with site:instagram.com, the quoted name and city, and num=3", async () => {
    const fetched = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetched);
    stubEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", apiKey);
    stubEnv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", cx);

    await lookupInstagramHandle("Bella's Lashes", "Austin");

    const calledUrl = fetched.mock.calls[0][0] as string;
    const decoded = decodeURIComponent(calledUrl);
    expect(decoded).toContain("site:instagram.com");
    expect(decoded).toContain('"Bella\'s Lashes"');
    expect(decoded).toContain('"Austin"');
    expect(decoded).toContain("num=3");
  });
});

describe("redactKey", () => {
  it("redacts a key query parameter", () => {
    expect(redactKey("...q=foo&key=secret123&cx=abc...")).toBe(
      "...q=foo&key=REDACTED&cx=abc..."
    );
  });

  it("redacts a leading key parameter", () => {
    expect(redactKey("key=secret123&cx=abc")).toBe("key=REDACTED&cx=abc");
  });

  it("returns the string unchanged when there is no key parameter", () => {
    expect(redactKey("just some text")).toBe("just some text");
    expect(redactKey("q=hello")).toBe("q=hello");
  });
});
