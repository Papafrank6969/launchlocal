import { describe, it, expect } from "vitest";
import { suggestedFaqs } from "./faqSuggestions";

describe("suggestedFaqs", () => {
  it("returns an empty list for no category", () => {
    expect(suggestedFaqs(null)).toEqual([]);
    expect(suggestedFaqs(undefined)).toEqual([]);
    expect(suggestedFaqs("")).toEqual([]);
    expect(suggestedFaqs("   ")).toEqual([]);
  });

  it("returns no filler for a category outside the covered niches", () => {
    expect(suggestedFaqs("plumber")).toEqual([]);
    expect(suggestedFaqs("restaurant")).toEqual([]);
  });

  it("gives each niche trade its own real, distinct FAQ set", () => {
    const nail = suggestedFaqs("nail technician");
    const lash = suggestedFaqs("lash technician");
    const brow = suggestedFaqs("brow technician");

    expect(nail.length).toBeGreaterThan(0);
    expect(lash.length).toBeGreaterThan(0);
    expect(brow.length).toBeGreaterThan(0);

    expect(nail.some((f) => /gel|acrylic/i.test(f.question))).toBe(true);
    expect(lash.some((f) => /patch test/i.test(f.question))).toBe(true);
    expect(brow.some((f) => /heal/i.test(f.question))).toBe(true);
  });

  it("every suggestion has a non-empty question and answer", () => {
    for (const category of ["nail technician", "lash technician", "brow technician"]) {
      for (const faq of suggestedFaqs(category)) {
        expect(faq.question.trim().length).toBeGreaterThan(0);
        expect(faq.answer.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("is case-insensitive and groups synonym categories together", () => {
    expect(suggestedFaqs("Nail Salon")).toEqual(suggestedFaqs("nail technician"));
    expect(suggestedFaqs("lash artist")).toEqual(suggestedFaqs("lash technician"));
    expect(suggestedFaqs("microblading")).toEqual(suggestedFaqs("brow technician"));
  });

  it("matches an exact category before falling back to a substring match", () => {
    expect(suggestedFaqs("mobile lash technician")).toEqual(suggestedFaqs("lash technician"));
  });
});
