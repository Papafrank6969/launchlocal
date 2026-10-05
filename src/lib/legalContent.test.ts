import { describe, it, expect } from "vitest";
import {
  generatePrivacyPolicy,
  generateTermsOfService,
  generateCookiePolicy,
  generateRefundPolicy,
  generateAppPrivacyPolicy,
  generateAppTerms,
  LEGAL_LAST_UPDATED,
  LAUNCHLOCAL_CONTACT_EMAIL,
  type LegalSection,
} from "./legalContent";

const site = { businessName: "Ferro's Barbershop", email: "hi@ferros.example", address: "12 Main St, Massapequa, NY" };

function allText(sections: LegalSection[]): string {
  return sections.map((s) => `${s.heading} ${s.body} ${(s.items ?? []).join(" ")}`).join("\n");
}

const generators = [
  ["privacy", () => generatePrivacyPolicy(site)],
  ["terms", () => generateTermsOfService(site)],
  ["cookie", () => generateCookiePolicy(site)],
  ["refund", () => generateRefundPolicy(site)],
  ["app privacy", () => generateAppPrivacyPolicy()],
  ["app terms", () => generateAppTerms()],
] as const;

describe("legal content", () => {
  it("last-updated is a fixed date, not derived from a row", () => {
    expect(LEGAL_LAST_UPDATED).toBeInstanceOf(Date);
    expect(Number.isNaN(LEGAL_LAST_UPDATED.getTime())).toBe(false);
  });

  for (const [name, gen] of generators) {
    describe(name, () => {
      const sections = gen();

      it("has multiple non-empty sections", () => {
        expect(sections.length).toBeGreaterThanOrEqual(3);
        for (const s of sections) {
          expect(s.heading.trim().length).toBeGreaterThan(0);
          expect(s.body.trim().length).toBeGreaterThan(0);
        }
      });

      it("carries no em or en dash (house style)", () => {
        expect(allText(sections)).not.toMatch(/[—–]/);
      });

      it("gives a way to get in touch", () => {
        // The refund policy routes to the business itself, not to LaunchLocal.
        const text = allText(sections);
        if (name === "refund") {
          expect(text.toLowerCase()).toContain("contact");
        } else {
          expect(text).toContain(LAUNCHLOCAL_CONTACT_EMAIL);
        }
      });
    });
  }

  it("privacy policy is honest about processors and no data sale", () => {
    const text = allText(generatePrivacyPolicy(site)).toLowerCase();
    expect(text).toContain("vercel");
    expect(text).toContain("do not sell");
    expect(text).toContain("ferro's barbershop");
  });

  it("privacy policy no longer claims data is never shared with third parties", () => {
    // The old text said "We don't sell or share this information with third
    // parties" while the site in fact uses a host + the business owner.
    expect(allText(generatePrivacyPolicy(site))).not.toMatch(/don't (sell or )?share this information with third parties/i);
  });

  it("terms bookings section adapts to whether a booking link exists", () => {
    const withBooking = allText(generateTermsOfService({ ...site, bookingUrl: "https://calendly.com/ferros" }));
    const without = allText(generateTermsOfService(site));
    expect(withBooking).toMatch(/scheduling tool/i);
    expect(without).toMatch(/does not take bookings or payments/i);
  });

  it("refund policy is a pass-through to the business, not a promise", () => {
    const text = allText(generateRefundPolicy(site)).toLowerCase();
    expect(text).toContain("handled directly by ferro's barbershop");
    expect(text).toContain("does not process payments");
  });

  it("cookie policy states there is no tracking and no consent banner", () => {
    const text = allText(generateCookiePolicy(site)).toLowerCase();
    expect(text).toContain("does not track you");
    expect(text).toMatch(/no cookie consent banner|there is no cookie consent banner/);
  });

  it("app privacy policy discloses the Google Places data + 30-day cycle", () => {
    const text = allText(generateAppPrivacyPolicy()).toLowerCase();
    expect(text).toContain("google places");
    expect(text).toContain("30-day");
  });

  it("falls back gracefully when the site has no email or address", () => {
    const bare = { businessName: "Test Co" };
    expect(() => generatePrivacyPolicy(bare)).not.toThrow();
    expect(() => generateTermsOfService(bare)).not.toThrow();
    expect(allText(generatePrivacyPolicy(bare))).toContain("Contact page");
  });
});
