import { describe, it, expect } from "vitest";
import { extractInstagramHandle, scoreWebsite } from "./places";

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
