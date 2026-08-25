import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a normal business name", () => {
    expect(slugify("Maple Bread Co.")).toBe("maple-bread-co");
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("A & B  --  Plumbing!!!")).toBe("a-b-plumbing");
  });

  it("strips leading and trailing hyphens left over from punctuation", () => {
    expect(slugify("  -- Sunrise Plumbing Co. -- ")).toBe("sunrise-plumbing-co");
  });

  it("returns an empty string for input with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when it doesn't already exist", async () => {
    const slug = await uniqueSlug("Maple Bread Co.", async () => false);
    expect(slug).toBe("maple-bread-co");
  });

  it("appends an incrementing suffix until it finds a free slug", async () => {
    const taken = new Set(["sunrise-plumbing-co", "sunrise-plumbing-co-2", "sunrise-plumbing-co-3"]);
    const slug = await uniqueSlug("Sunrise Plumbing Co.", async (candidate) => taken.has(candidate));
    expect(slug).toBe("sunrise-plumbing-co-4");
  });

  it("falls back to 'site' as the base when the name has no usable characters", async () => {
    const slug = await uniqueSlug("!!!", async () => false);
    expect(slug).toBe("site");
  });
});
