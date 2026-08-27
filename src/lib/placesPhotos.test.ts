import { describe, it, expect } from "vitest";
import { parsePlacePhotos } from "./placesPhotos";

describe("parsePlacePhotos", () => {
  it("returns empty refs and no attribution for a result with no photos", () => {
    expect(parsePlacePhotos({})).toEqual({ refs: [], attribution: "" });
    expect(parsePlacePhotos({ photos: [] })).toEqual({ refs: [], attribution: "" });
    expect(parsePlacePhotos(null)).toEqual({ refs: [], attribution: "" });
  });

  it("pulls photo references in order", () => {
    const result = { photos: [{ photo_reference: "ref-a" }, { photo_reference: "ref-b" }] };
    expect(parsePlacePhotos(result).refs).toEqual(["ref-a", "ref-b"]);
  });

  it("caps the number of references", () => {
    const result = { photos: Array.from({ length: 20 }, (_, i) => ({ photo_reference: `r${i}` })) };
    expect(parsePlacePhotos(result, 6).refs).toHaveLength(6);
  });

  it("skips entries without a usable photo_reference", () => {
    const result = { photos: [{ height: 100 }, { photo_reference: "" }, { photo_reference: "good" }] };
    expect(parsePlacePhotos(result).refs).toEqual(["good"]);
  });

  it("strips HTML from attributions and dedupes contributor names", () => {
    const result = {
      photos: [
        { photo_reference: "a", html_attributions: ['<a href="https://x">Jane Doe</a>'] },
        { photo_reference: "b", html_attributions: ['<a href="https://y">Jane Doe</a>'] },
        { photo_reference: "c", html_attributions: ['<a href="https://z">A Local Guide</a>'] },
      ],
    };
    expect(parsePlacePhotos(result).attribution).toBe("Photos via Google — Jane Doe, A Local Guide");
  });

  it("falls back to a bare 'Photos via Google' when refs exist but no names", () => {
    expect(parsePlacePhotos({ photos: [{ photo_reference: "a" }] }).attribution).toBe("Photos via Google");
  });

  it("decodes HTML entities in contributor names", () => {
    const result = {
      photos: [{ photo_reference: "a", html_attributions: ['<a href="x">Air, Heating &amp; Plumbing Co.</a>'] }],
    };
    expect(parsePlacePhotos(result).attribution).toBe("Photos via Google — Air, Heating & Plumbing Co.");
  });
});
