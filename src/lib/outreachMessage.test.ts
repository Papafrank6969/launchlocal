import { describe, it, expect } from "vitest";
import { generateOutreachMessage, OUTREACH_VARIANT_COUNT } from "./outreachMessage";

const lead = { name: "Bella Lash Studio", category: "lash technician", city: "Austin, TX" };

describe("generateOutreachMessage", () => {
  it("opens by acknowledging there's no website for a NONE lead", () => {
    const msg = generateOutreachMessage({ ...lead, websiteStatus: "NONE" }, 0);
    expect(msg).toContain("Bella Lash Studio");
    expect(msg.toLowerCase()).toContain("website");
  });

  it("opens by calling out a social-only presence for a POOR lead", () => {
    const msg = generateOutreachMessage({ ...lead, websiteStatus: "POOR" }, 0);
    expect(msg.toLowerCase()).toMatch(/social|facebook|instagram/);
  });

  it("cycles through variants without going out of range", () => {
    for (let v = 0; v < OUTREACH_VARIANT_COUNT * 2 + 1; v++) {
      expect(generateOutreachMessage({ ...lead, websiteStatus: "NONE" }, v)).toBeTruthy();
    }
  });

  it("pitches a free mockup when no preview URL is given", () => {
    const msg = generateOutreachMessage({ ...lead, websiteStatus: "NONE" }, 0);
    expect(msg.toLowerCase()).toContain("mockup");
  });

  it("leads with the live link when a preview URL is given", () => {
    const url = "https://launchlocal.app/s/bella-lash-studio";
    const msg = generateOutreachMessage({ ...lead, websiteStatus: "NONE" }, 0, { previewUrl: url });
    expect(msg).toContain(url);
    expect(msg.toLowerCase()).not.toContain("mockup");
  });

  it("treats an empty preview URL as no preview", () => {
    const msg = generateOutreachMessage({ ...lead, websiteStatus: "NONE" }, 0, { previewUrl: "" });
    expect(msg.toLowerCase()).toContain("mockup");
  });
});
