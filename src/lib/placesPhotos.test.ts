import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPlacePhotoBytes, fetchPlacePhotoRefs, parsePlacePhotos } from "./placesPhotos";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function imageResponse(contentType: string | null, status = 200) {
  const body = new Uint8Array([1, 2, 3]).buffer;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? contentType : null) },
    arrayBuffer: async () => body,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("parsePlacePhotos", () => {
  it("returns empty refs and no attribution for a result with no photos", () => {
    expect(parsePlacePhotos({})).toEqual({ refs: [], attribution: "" });
    expect(parsePlacePhotos({ photos: [] })).toEqual({ refs: [], attribution: "" });
    expect(parsePlacePhotos(null)).toEqual({ refs: [], attribution: "" });
  });

  it("uses each photo's resource name as the ref, in order", () => {
    const result = {
      photos: [
        { name: "places/ChIJx/photos/AeJbb1" },
        { name: "places/ChIJx/photos/AeJbb2" },
      ],
    };
    expect(parsePlacePhotos(result).refs).toEqual(["places/ChIJx/photos/AeJbb1", "places/ChIJx/photos/AeJbb2"]);
  });

  it("caps the number of references", () => {
    const result = { photos: Array.from({ length: 20 }, (_, i) => ({ name: `places/p/photos/n${i}` })) };
    expect(parsePlacePhotos(result, 6).refs).toHaveLength(6);
  });

  it("skips entries without a usable resource name", () => {
    const result = { photos: [{ heightPx: 100 }, { name: "" }, { name: "places/p/photos/good" }] };
    expect(parsePlacePhotos(result).refs).toEqual(["places/p/photos/good"]);
  });

  it("joins authorAttributions displayNames into the attribution line", () => {
    const result = {
      photos: [
        { name: "places/p/photos/a", authorAttributions: [{ displayName: "Jane Doe" }] },
        { name: "places/p/photos/b", authorAttributions: [{ displayName: "Jane Doe" }] },
        { name: "places/p/photos/c", authorAttributions: [{ displayName: "A Local Guide" }] },
      ],
    };
    expect(parsePlacePhotos(result).attribution).toBe("Photos via Google — Jane Doe, A Local Guide");
  });

  it("falls back to a bare 'Photos via Google' when refs exist but no names", () => {
    expect(parsePlacePhotos({ photos: [{ name: "places/p/photos/a" }] }).attribution).toBe("Photos via Google");
  });
});

describe("fetchPlacePhotoRefs", () => {
  it("returns refs and attribution from a single Places API (New) place lookup", async () => {
    const placeBody = {
      photos: [
        { name: "places/ChIJx/photos/AeJbb1", authorAttributions: [{ displayName: "Jane & Sons" }] },
        { name: "places/ChIJx/photos/AeJbb2" },
      ],
    };
    let captured: { url?: string; headers?: Record<string, unknown> } = {};
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), headers: init?.headers as Record<string, unknown> };
      return jsonResponse(placeBody);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPlacePhotoRefs("ChIJx", "test-key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(captured.url).toBe("https://places.googleapis.com/v1/places/ChIJx");
    expect(captured.headers).toMatchObject({ "X-Goog-Api-Key": "test-key", "X-Goog-FieldMask": "photos" });
    expect(result).toEqual({
      refs: ["places/ChIJx/photos/AeJbb1", "places/ChIJx/photos/AeJbb2"],
      attribution: "Photos via Google — Jane & Sons",
    });
  });

  it("falls back to the legacy Details call when the New API returns 403, stripping its HTML attribution", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://places.googleapis.com")) {
        return jsonResponse({ error: { code: 403, message: "Places API (New) has not been enabled" } }, 403);
      }
      if (url.includes("/place/details/json")) {
        return jsonResponse({
          status: "OK",
          result: {
            photos: [
              { photo_reference: "legacy-ref", html_attributions: ['<a href="https://x">Jane &amp; Sons</a>'] },
            ],
          },
        });
      }
      throw new Error(`Unexpected URL in fallback test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPlacePhotoRefs("ChIJx", "test-key");

    expect(result).toEqual({ refs: ["legacy-ref"], attribution: "Photos via Google — Jane & Sons" });
    expect(warnSpy).toHaveBeenCalled();
    expect(String(warnSpy.mock.calls[0][0])).toContain("Places API (New) may not be enabled");
  });
});

describe("fetchPlacePhotoBytes", () => {
  it("routes a New resource name to the /media endpoint and returns the image bytes", async () => {
    let capturedUrl: string | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return imageResponse("image/jpeg");
    });
    vi.stubGlobal("fetch", fetchMock);

    const bytes = await fetchPlacePhotoBytes("places/ChIJx/photos/AeJbb1", "test-key", 640);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toBe(
      "https://places.googleapis.com/v1/places/ChIJx/photos/AeJbb1/media?maxWidthPx=640&key=test-key"
    );
    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes?.length).toBe(3);
  });

  it("returns null when the media response is not an image", async () => {
    const fetchMock = vi.fn(async () => imageResponse("application/json"));
    vi.stubGlobal("fetch", fetchMock);

    const bytes = await fetchPlacePhotoBytes("places/ChIJx/photos/AeJbb1", "test-key");

    expect(bytes).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the legacy photo endpoint when the New media path returns null", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.startsWith("https://places.googleapis.com")) {
        return imageResponse("text/html", 500);
      }
      return imageResponse("image/png");
    });
    vi.stubGlobal("fetch", fetchMock);

    const bytes = await fetchPlacePhotoBytes("places/ChIJx/photos/AeJbb1", "test-key");

    expect(urls[0]).toContain("/media?maxWidthPx=1600");
    expect(urls[1]).toContain("maps/api/place/photo");
    expect(Buffer.isBuffer(bytes)).toBe(true);
  });

  it("routes a legacy photo_reference straight to the legacy photo endpoint", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return imageResponse("image/jpeg");
    });
    vi.stubGlobal("fetch", fetchMock);

    const bytes = await fetchPlacePhotoBytes("legacy-ref-abc", "test-key", 640);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls[0]).toBe(
      "https://maps.googleapis.com/maps/api/place/photo?maxwidth=640&photo_reference=legacy-ref-abc&key=test-key"
    );
    expect(Buffer.isBuffer(bytes)).toBe(true);
  });
});