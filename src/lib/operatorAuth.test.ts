import { describe, it, expect } from "vitest";
import { checkBasicAuth, isPublicPath, safeEqual } from "./operatorAuth";

function basic(user: string, pass: string): string {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

describe("isPublicPath", () => {
  it.each([
    "/s/fade-lab",
    "/s/fade-lab/services/haircut",
    "/s/fade-lab/llms.txt",
    "/s/fade-lab/sitemap.xml",
    "/api/public/sites/fade-lab/contact",
    "/api/cron/daily-leads",
    "/api/cron/agents",
    "/privacy",
    "/terms",
    "/robots.txt",
    "/icon.svg",
    "/_next/static/chunks/main.js",
    "/favicon.ico",
    "/images/hero.jpg",
    "/api/telegram",
  ])("lets %s through without a password", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/leads",
    "/builder",
    "/builder/abc123",
    "/outreach/follow-up",
    "/pipeline",
    "/stats",
    "/house",
    "/house/house-final.glb",
    "/villa",
    "/villa/villa.glb",
    "/api/leads",
    "/api/leads/search",
    "/api/sites/abc123",
    "/api/agents/pledge/run",
    "/api/telegram/setup",
  ])("requires the password for %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  it("does not treat look-alike prefixes as public", () => {
    expect(isPublicPath("/search")).toBe(false); // starts with /s but isn't /s/
    expect(isPublicPath("/privacy-admin")).toBe(false);
    expect(isPublicPath("/api/publicity")).toBe(false);
    expect(isPublicPath("/api/cronjobs")).toBe(false);
  });

  it("treats a dotted file under an operator route as protected", () => {
    expect(isPublicPath("/builder/export.csv")).toBe(false);
    expect(isPublicPath("/api/leads/export.csv")).toBe(false);
  });
});

describe("safeEqual", () => {
  it("is true for identical strings", () => {
    expect(safeEqual("hunter2", "hunter2")).toBe(true);
  });

  it("is false for different strings of the same length", () => {
    expect(safeEqual("hunter2", "hunter3")).toBe(false);
  });

  it("is false for different lengths", () => {
    expect(safeEqual("hunter2", "hunter22")).toBe(false);
  });
});

describe("checkBasicAuth", () => {
  it("fails closed when no password is configured", () => {
    expect(checkBasicAuth(basic("frank", "x"), undefined)).toBe("unconfigured");
    expect(checkBasicAuth(basic("frank", "x"), "")).toBe("unconfigured");
  });

  it("accepts the right password with any username", () => {
    expect(checkBasicAuth(basic("frank", "s3cret"), "s3cret")).toBe("ok");
    expect(checkBasicAuth(basic("", "s3cret"), "s3cret")).toBe("ok");
  });

  it("accepts a password that contains a colon", () => {
    expect(checkBasicAuth(basic("frank", "a:b:c"), "a:b:c")).toBe("ok");
  });

  it("rejects the wrong password", () => {
    expect(checkBasicAuth(basic("frank", "nope"), "s3cret")).toBe("unauthorized");
  });

  it("rejects a missing header", () => {
    expect(checkBasicAuth(null, "s3cret")).toBe("unauthorized");
  });

  it("rejects a non-Basic scheme", () => {
    expect(checkBasicAuth("Bearer s3cret", "s3cret")).toBe("unauthorized");
  });

  it("rejects malformed base64", () => {
    expect(checkBasicAuth("Basic !!!not-base64!!!", "s3cret")).toBe("unauthorized");
  });

  it("rejects credentials with no colon", () => {
    expect(checkBasicAuth(`Basic ${btoa("s3cret")}`, "s3cret")).toBe("unauthorized");
  });
});
