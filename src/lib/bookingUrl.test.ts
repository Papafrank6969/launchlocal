import { describe, it, expect } from "vitest";
import { normalizeBookingUrl, bookingProviderLabel } from "./bookingUrl";

describe("normalizeBookingUrl", () => {
  it("returns null for empty, null, or whitespace input", () => {
    expect(normalizeBookingUrl(null)).toBeNull();
    expect(normalizeBookingUrl(undefined)).toBeNull();
    expect(normalizeBookingUrl("")).toBeNull();
    expect(normalizeBookingUrl("   ")).toBeNull();
  });

  it("keeps a well-formed https URL", () => {
    expect(normalizeBookingUrl("https://calendly.com/glam/lash-fill")).toBe(
      "https://calendly.com/glam/lash-fill"
    );
  });

  it("assumes https for a bare domain", () => {
    expect(normalizeBookingUrl("booksy.com/en-us/123-studio")).toBe(
      "https://booksy.com/en-us/123-studio"
    );
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(normalizeBookingUrl("  vagaro.com/studio  ")).toBe("https://vagaro.com/studio");
  });

  it("upgrades http to https", () => {
    expect(normalizeBookingUrl("http://www.glossgenius.com/book/studio")).toBe(
      "https://www.glossgenius.com/book/studio"
    );
  });

  it("handles a protocol-relative URL", () => {
    expect(normalizeBookingUrl("//fresha.com/a/studio")).toBe("https://fresha.com/a/studio");
  });

  it("rejects a javascript: URL", () => {
    expect(normalizeBookingUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects mailto: and tel: schemes", () => {
    expect(normalizeBookingUrl("mailto:studio@example.com")).toBeNull();
    expect(normalizeBookingUrl("tel:+15555551234")).toBeNull();
  });

  it("rejects a host with no dot (localhost, bare word)", () => {
    expect(normalizeBookingUrl("localhost:3000/book")).toBeNull();
    expect(normalizeBookingUrl("booknow")).toBeNull();
  });

  it("preserves query strings and fragments", () => {
    expect(normalizeBookingUrl("https://acuityscheduling.com/schedule.php?owner=123#step-1")).toBe(
      "https://acuityscheduling.com/schedule.php?owner=123#step-1"
    );
  });
});

describe("bookingProviderLabel", () => {
  it("recognises common booking hosts", () => {
    expect(bookingProviderLabel("https://www.vagaro.com/studio")).toBe("Vagaro");
    expect(bookingProviderLabel("https://booksy.com/en-us/123")).toBe("Booksy");
    expect(bookingProviderLabel("https://calendly.com/glam")).toBe("Calendly");
    expect(bookingProviderLabel("https://glossgenius.com/book/x")).toBe("GlossGenius");
    expect(bookingProviderLabel("https://squareup.com/appointments/x")).toBe("Square");
  });

  it("returns null for an unrecognised host", () => {
    expect(bookingProviderLabel("https://example.com/book")).toBeNull();
  });

  it("returns null for a non-URL or empty value", () => {
    expect(bookingProviderLabel(null)).toBeNull();
    expect(bookingProviderLabel("not a url")).toBeNull();
  });

  it("does not match a look-alike host that only contains the brand as a substring", () => {
    expect(bookingProviderLabel("https://vagaro.com.evil.example/x")).toBeNull();
    expect(bookingProviderLabel("https://notcalendly.com/x")).toBeNull();
  });
});
