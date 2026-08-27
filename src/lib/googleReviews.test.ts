import { describe, it, expect } from "vitest";
import { parseGoogleReviews, type GoogleReview } from "./googleReviews";

const stored = (over: Partial<GoogleReview> = {}): GoogleReview => ({
  author: "Jamie R.",
  rating: 5,
  text: "Best lash tech in town.",
  relativeTime: "2 weeks ago",
  time: 1_700_000_000,
  ...over,
});

describe("parseGoogleReviews", () => {
  it("returns [] for null, empty, or non-JSON input", () => {
    expect(parseGoogleReviews(null)).toEqual([]);
    expect(parseGoogleReviews(undefined)).toEqual([]);
    expect(parseGoogleReviews("")).toEqual([]);
    expect(parseGoogleReviews("not json")).toEqual([]);
  });

  it("returns [] when the JSON isn't an array", () => {
    expect(parseGoogleReviews('{"author":"x"}')).toEqual([]);
  });

  it("round-trips a stored review", () => {
    const [r] = parseGoogleReviews(JSON.stringify([stored()]));
    expect(r).toEqual({
      author: "Jamie R.",
      authorUrl: undefined,
      profilePhotoUrl: undefined,
      rating: 5,
      text: "Best lash tech in town.",
      relativeTime: "2 weeks ago",
      time: 1_700_000_000,
    });
  });

  it("drops entries missing an author, text, or a valid 1-5 rating", () => {
    const rows = [
      stored({ author: "" }),
      stored({ text: "   " }),
      stored({ rating: 0 }),
      stored({ rating: 9 }),
      stored({ author: "Real Person", text: "Real text", rating: 4 }),
    ];
    const parsed = parseGoogleReviews(JSON.stringify(rows));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].author).toBe("Real Person");
  });

  it("orders newest first and caps at 5", () => {
    const rows = Array.from({ length: 8 }, (_, i) => stored({ author: `P${i}`, time: i }));
    const parsed = parseGoogleReviews(JSON.stringify(rows));
    expect(parsed).toHaveLength(5);
    expect(parsed.map((r) => r.author)).toEqual(["P7", "P6", "P5", "P4", "P3"]);
  });

  it("rounds a fractional rating to the nearest star", () => {
    const [r] = parseGoogleReviews(JSON.stringify([stored({ rating: 4.6 })]));
    expect(r.rating).toBe(5);
  });

  it("keeps author profile links when present", () => {
    const [r] = parseGoogleReviews(
      JSON.stringify([stored({ authorUrl: "https://maps.google.com/contrib/1" })])
    );
    expect(r.authorUrl).toBe("https://maps.google.com/contrib/1");
  });
});
