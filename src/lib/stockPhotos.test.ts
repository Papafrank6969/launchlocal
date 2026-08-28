import { describe, it, expect } from "vitest";
import { parsePexelsResult } from "./stockPhotos";

const photo = (over: Record<string, unknown> = {}) => ({
  photographer: "Jane Doe",
  photographer_url: "https://www.pexels.com/@janedoe",
  src: { large: "https://images.pexels.com/photos/1/large.jpg", medium: "https://images.pexels.com/photos/1/medium.jpg" },
  ...over,
});

describe("parsePexelsResult", () => {
  it("returns null for an empty or malformed response", () => {
    expect(parsePexelsResult({})).toBeNull();
    expect(parsePexelsResult({ photos: [] })).toBeNull();
    expect(parsePexelsResult(null)).toBeNull();
  });

  it("maps the first photo to url + attribution", () => {
    expect(parsePexelsResult({ photos: [photo()] })).toEqual({
      url: "https://images.pexels.com/photos/1/large.jpg",
      photographer: "Jane Doe",
      photographerUrl: "https://www.pexels.com/@janedoe",
    });
  });

  it("selects the photo at the requested index", () => {
    const json = { photos: [photo({ src: { large: "a" } }), photo({ src: { large: "b" } })] };
    expect(parsePexelsResult(json, 1)?.url).toBe("b");
  });

  it("falls back to the first photo when the index is out of range", () => {
    expect(parsePexelsResult({ photos: [photo({ src: { large: "only" } })] }, 5)?.url).toBe("only");
  });

  it("falls back through src sizes when large is missing", () => {
    expect(parsePexelsResult({ photos: [photo({ src: { medium: "m" } })] })?.url).toBe("m");
  });

  it("skips a photo with no usable src", () => {
    expect(parsePexelsResult({ photos: [photo({ src: {} })] })).toBeNull();
  });

  it("defaults attribution when the photographer fields are missing", () => {
    const r = parsePexelsResult({ photos: [{ src: { large: "x" } }] });
    expect(r?.photographer).toBe("Pexels");
    expect(r?.photographerUrl).toBe("https://www.pexels.com");
  });
});
