import { afterEach, describe, expect, it, vi } from "vitest";
import { extractInstagramHandle, findBusinesses, scoreWebsite } from "./places";

const NEW_API_URL = "https://places.googleapis.com/v1/places:searchText";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("extractInstagramHandle", () => {
  it("pulls the handle out of a plain profile URL", () => {
    expect(extractInstagramHandle("https://www.instagram.com/bellalash/")).toBe("bellalash");
  });

  it("returns null for a non-Instagram host", () => {
    expect(extractInstagramHandle("https://example.com/bellalash")).toBeNull();
  });

  it("returns null for a missing or empty URL", () => {
    expect(extractInstagramHandle(undefined)).toBeNull();
    expect(extractInstagramHandle(null)).toBeNull();
  });

  it("returns null for an unparseable URL", () => {
    expect(extractInstagramHandle("not a url")).toBeNull();
  });

  it("returns null for the bare instagram.com root", () => {
    expect(extractInstagramHandle("https://www.instagram.com/")).toBeNull();
  });

  // Regression: a Lindenhurst, NY search returned "Marilyn Nails" with
  // instagram.com/invites/contact/?i=… as its "website" — Instagram's own
  // QR/contact-invite link feature, not a business profile. It parsed as
  // handle "invites", which would open ig.me/m/invites — nowhere real.
  it("rejects Instagram's own reserved top-level paths, not business handles", () => {
    for (const path of ["explore", "accounts", "p", "reel", "reels", "stories", "direct", "about", "developer", "invites", "legal", "privacy", "web", "lite"]) {
      expect(extractInstagramHandle(`https://www.instagram.com/${path}/contact/?i=abc`)).toBeNull();
    }
  });
});

describe("scoreWebsite", () => {
  it("treats a missing or blank URL as NONE", () => {
    expect(scoreWebsite(undefined)).toBe("NONE");
    expect(scoreWebsite(null)).toBe("NONE");
    expect(scoreWebsite("")).toBe("NONE");
    expect(scoreWebsite("   ")).toBe("NONE");
  });

  it("treats a social/link-in-bio host as POOR", () => {
    expect(scoreWebsite("https://www.facebook.com/somebusiness")).toBe("POOR");
    expect(scoreWebsite("https://www.instagram.com/somebusiness")).toBe("POOR");
    expect(scoreWebsite("https://linktr.ee/somebusiness")).toBe("POOR");
  });

  it("treats a very short domain as POOR", () => {
    expect(scoreWebsite("https://a.co")).toBe("POOR");
  });

  it("treats a real standalone domain as HAS_SITE", () => {
    expect(scoreWebsite("https://bellalashstudio.com")).toBe("HAS_SITE");
  });

  it("treats an unparseable URL as POOR rather than throwing", () => {
    expect(scoreWebsite("not a url")).toBe("POOR");
  });
});

describe("findBusinesses", () => {
  it("returns RawBusinesses from a single Places API (New) searchText call, with no Details fan-out", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const searchTextBody = {
      places: [
        {
          id: "Cmp0Xz1",
          displayName: { text: "Bellas Barber Shop", languageCode: "en" },
          formattedAddress: "123 Main St, Austin, TX",
          nationalPhoneNumber: "(512) 555-0100",
          websiteUri: "https://bellasbarber.com",
          rating: 4.6,
          userRatingCount: 117,
        },
        {
          id: "Cmp0Xz2",
          displayName: { text: "Downtown Cuts", languageCode: "en" },
          formattedAddress: "456 Oak Ave, Austin, TX",
        },
      ],
    };
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(searchTextBody);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await findBusinesses("Austin, TX", "barber");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toBe(NEW_API_URL);
    expect(capturedInit?.method).toBe("POST");
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ textQuery: "barber in Austin, TX", pageSize: 20 });
    expect(capturedInit?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Goog-Api-Key": "test-key",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      name: "Bellas Barber Shop",
      category: "barber",
      address: "123 Main St, Austin, TX",
      city: "Austin, TX",
      phone: "(512) 555-0100",
      existingUrl: "https://bellasbarber.com",
      rating: 4.6,
      reviewCount: 117,
      placeId: "Cmp0Xz1",
      source: "GOOGLE_PLACES",
    });
    expect(results[1]).toEqual({
      name: "Downtown Cuts",
      category: "barber",
      address: "456 Oak Ave, Austin, TX",
      city: "Austin, TX",
      phone: undefined,
      existingUrl: undefined,
      rating: undefined,
      reviewCount: undefined,
      placeId: "Cmp0Xz2",
      source: "GOOGLE_PLACES",
    });
  });

  it("follows nextPageToken to a second searchText call and stops once it is gone", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const searchTextBodies: unknown[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      searchTextBodies.push(JSON.parse(init!.body as string));
      if (searchTextBodies.length === 1) {
        return jsonResponse({
          places: [{ id: "p1", displayName: { text: "First Page Co" }, formattedAddress: "1 A St" }],
          nextPageToken: "token-2",
        });
      }
      return jsonResponse({
        places: [{ id: "p2", displayName: { text: "Second Page Co" }, formattedAddress: "2 B St" }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await findBusinesses("Austin, TX", "barber");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(searchTextBodies[0]).toEqual({ textQuery: "barber in Austin, TX", pageSize: 20 });
    expect(searchTextBodies[1]).toEqual({ textQuery: "barber in Austin, TX", pageSize: 20, pageToken: "token-2" });
    expect(results.map((r) => r.placeId)).toEqual(["p1", "p2"]);
  });

  it("stops after MAX_PLACES_PAGES (3) searchText calls when every page keeps returning a nextPageToken", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        places: [{ id: "loop", displayName: { text: "Looping Co" }, formattedAddress: "Loop St" }],
        nextPageToken: "keep-going",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await findBusinesses("Austin, TX", "barber");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
  });

  it("geocodes the city first and sends a locationRestriction.circle with the radius in metres, capped at 50 000", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    type RadiusBody = {
      locationRestriction?: { circle: { center: { latitude: number; longitude: number }; radius: number } };
    };
    let searchTextBody: RadiusBody | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("https://maps.googleapis.com/maps/api/geocode/json")) {
        return jsonResponse({
          status: "OK",
          results: [{ geometry: { location: { lat: 30.2672, lng: -97.7431 } } }],
        });
      }
      searchTextBody = JSON.parse(init!.body as string);
      return jsonResponse({ places: [{ id: "r1", displayName: { text: "Radius Shop" } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await findBusinesses("Austin, TX", "barber", 5);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const geocodeUrl = String(fetchMock.mock.calls[0][0]);
    expect(geocodeUrl).toContain("maps/api/geocode/json");
    expect(decodeURIComponent(geocodeUrl)).toContain("address=Austin, TX");
    expect(geocodeUrl).toContain("key=test-key");
    expect(searchTextBody).toEqual({
      textQuery: "barber in Austin, TX",
      pageSize: 20,
      locationRestriction: {
        circle: {
          center: { latitude: 30.2672, longitude: -97.7431 },
          radius: 8047,
        },
      },
    });
    expect(results[0].placeId).toBe("r1");

    await findBusinesses("Austin, TX", "barber", 100);
    expect(searchTextBody?.locationRestriction?.circle.radius).toBe(50000);
  });

  it("falls back to the legacy Places API when the new API returns 403, and warns about enabling it", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://places.googleapis.com")) {
        return jsonResponse({ error: { code: 403, message: "Places API (New) has not been used... or is disabled" } }, 403);
      }
      if (url.includes("/place/textsearch/json")) {
        return jsonResponse({ status: "OK", results: [{ place_id: "legacy-1" }] });
      }
      if (url.includes("/place/details/json")) {
        return jsonResponse({
          result: {
            place_id: "legacy-1",
            name: "Legacy Barbers",
            formatted_address: "789 Legacy St",
            formatted_phone_number: "(555) 000-1234",
            website: "https://legacybarbers.com",
            rating: 4.2,
            user_ratings_total: 89,
          },
        });
      }
      throw new Error(`Unexpected URL in fallback test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await findBusinesses("Austin, TX", "barber");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: "Legacy Barbers",
      category: "barber",
      address: "789 Legacy St",
      city: "Austin, TX",
      phone: "(555) 000-1234",
      existingUrl: "https://legacybarbers.com",
      rating: 4.2,
      reviewCount: 89,
      placeId: "legacy-1",
      source: "GOOGLE_PLACES",
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(String(warnSpy.mock.calls[0][0])).toContain("Places API (New) may not be enabled");
  });

  it("falls back to mock data when both the new API and the legacy API error", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://places.googleapis.com")) {
        return jsonResponse({ error: { code: 500, message: "boom" } }, 500);
      }
      if (url.includes("/place/textsearch/json")) {
        return jsonResponse({ status: "ERROR", error_message: "key invalid" });
      }
      throw new Error(`Unexpected URL in double-fallback test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await findBusinesses("Austin, TX", "barber");

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.source).toBe("MOCK");
    }
  });

  it("returns mock data with zero fetch calls when GOOGLE_PLACES_API_KEY is unset", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const results = await findBusinesses("Austin, TX", "barber");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.source).toBe("MOCK");
    }
  });
});
