import { describe, it, expect } from "vitest";
import { isUnclaimedPitchSite } from "./siteVisibility";

describe("isUnclaimedPitchSite", () => {
  it("is false for a site with no lead (built blank / manually)", () => {
    expect(isUnclaimedPitchSite(null, null)).toBe(false);
    expect(isUnclaimedPitchSite(undefined, "NEW")).toBe(false);
  });

  it("is true for a lead-linked site while the lead is still open", () => {
    expect(isUnclaimedPitchSite("lead_1", "NEW")).toBe(true);
    expect(isUnclaimedPitchSite("lead_1", "CONTACTED")).toBe(true);
    expect(isUnclaimedPitchSite("lead_1", "RESPONDED")).toBe(true);
    expect(isUnclaimedPitchSite("lead_1", "LOST")).toBe(true);
    expect(isUnclaimedPitchSite("lead_1", null)).toBe(true);
  });

  it("is false once the lead is WON — it's a real client site now", () => {
    expect(isUnclaimedPitchSite("lead_1", "WON")).toBe(false);
  });
});
