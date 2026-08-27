import { describe, it, expect } from "vitest";
import { localBusinessJsonLd } from "./jsonLd";

const BASE = "https://launchlocal.example";

describe("localBusinessJsonLd", () => {
  it("builds a minimal LocalBusiness node from just a name", () => {
    const json = localBusinessJsonLd({ businessName: "Lash Loft" }, BASE, "/s/lash-loft");
    expect(json).toMatchObject({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "Lash Loft",
      url: "https://launchlocal.example/s/lash-loft",
    });
    expect(json).not.toHaveProperty("potentialAction");
  });

  it("adds a ReserveAction pointing at a normalised booking URL", () => {
    const json = localBusinessJsonLd(
      { businessName: "Lash Loft", bookingUrl: "vagaro.com/lashloft" },
      BASE,
      "/s/lash-loft"
    );
    expect(json.potentialAction).toEqual({
      "@type": "ReserveAction",
      name: "Book an appointment",
      target: "https://vagaro.com/lashloft",
    });
  });

  it("omits potentialAction when the booking URL is invalid", () => {
    const json = localBusinessJsonLd(
      { businessName: "Lash Loft", bookingUrl: "javascript:alert(1)" },
      BASE,
      "/s/lash-loft"
    );
    expect(json).not.toHaveProperty("potentialAction");
  });
});
