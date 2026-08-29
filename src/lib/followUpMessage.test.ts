import { describe, it, expect } from "vitest";
import { generateFollowUpMessage, FOLLOW_UP_VARIANT_COUNT } from "./followUpMessage";

const lead = { name: "Bella Lash Studio" };

describe("generateFollowUpMessage", () => {
  it("reads as a bump, not a re-pitch", () => {
    const msg = generateFollowUpMessage(lead, 0);
    expect(msg.toLowerCase()).toMatch(/follow|bump|bumping/);
  });

  it("cycles through variants without going out of range", () => {
    for (let v = 0; v < FOLLOW_UP_VARIANT_COUNT * 2 + 1; v++) {
      expect(generateFollowUpMessage(lead, v)).toBeTruthy();
    }
  });

  it("offers to send a mockup when no preview URL is given", () => {
    const msg = generateFollowUpMessage(lead, 0);
    expect(msg.toLowerCase()).toContain("mockup");
  });

  it("points at the live sample when a preview URL is given", () => {
    const url = "https://launchlocal.app/s/bella-lash-studio";
    const msg = generateFollowUpMessage(lead, 0, { previewUrl: url });
    expect(msg).toContain(url);
  });

  it("treats an empty preview URL as no preview", () => {
    const msg = generateFollowUpMessage(lead, 0, { previewUrl: "" });
    expect(msg.toLowerCase()).toContain("mockup");
  });
});
