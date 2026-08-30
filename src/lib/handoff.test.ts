import { describe, it, expect } from "vitest";
import {
  HANDOFF_STEPS,
  HANDOFF_STEP_KEYS,
  reconcileHandoffTasks,
  buildHandoffProgress,
  handoffSummaryText,
} from "./handoff";

describe("HANDOFF_STEPS", () => {
  it("defines exactly the seven canonical steps in order", () => {
    expect(HANDOFF_STEPS.map((s) => s.key)).toEqual([
      "domain",
      "dns",
      "live-on-domain",
      "search-visible",
      "google-business",
      "client-package-sent",
      "payment-arranged",
    ]);
  });
});

describe("reconcileHandoffTasks", () => {
  it("returns all 7 rows with canonical order when nothing exists", () => {
    const r = reconcileHandoffTasks([]);
    expect(r).toEqual(HANDOFF_STEPS.map((s, i) => ({ key: s.key, order: i })));
  });

  it("returns only the missing 5 with correct order when domain+dns exist", () => {
    const r = reconcileHandoffTasks(["domain", "dns"]);
    expect(r.map((x) => x.key)).toEqual([
      "live-on-domain",
      "search-visible",
      "google-business",
      "client-package-sent",
      "payment-arranged",
    ]);
    expect(r.map((x) => x.order)).toEqual([2, 3, 4, 5, 6]);
  });

  it("returns [] when all 7 exist", () => {
    expect(reconcileHandoffTasks(HANDOFF_STEP_KEYS)).toEqual([]);
  });

  it("ignores unknown keys and still returns all 7", () => {
    const r = reconcileHandoffTasks(["bogus"]);
    expect(r).toEqual(HANDOFF_STEPS.map((s, i) => ({ key: s.key, order: i })));
  });
});

describe("buildHandoffProgress", () => {
  it("empty tasks → total 7, done 0, pct 0, next is first step", () => {
    expect(buildHandoffProgress([])).toEqual({
      total: 7,
      done: 0,
      pct: 0,
      complete: false,
      nextStep: HANDOFF_STEPS[0],
    });
  });

  it("3 non-contiguous done → done 3, pct 43, next is dns", () => {
    const p = buildHandoffProgress([
      { key: "domain", done: true },
      { key: "live-on-domain", done: true },
      { key: "google-business", done: true },
    ]);
    expect(p.done).toBe(3);
    expect(p.pct).toBe(43);
    expect(p.nextStep?.key).toBe("dns");
    expect(p.complete).toBe(false);
    expect(p.total).toBe(7);
  });

  it("all 7 done → complete, pct 100, next null", () => {
    const p = buildHandoffProgress(HANDOFF_STEP_KEYS.map((key) => ({ key, done: true })));
    expect(p.complete).toBe(true);
    expect(p.pct).toBe(100);
    expect(p.done).toBe(7);
    expect(p.nextStep).toBeNull();
  });

  it("ignores a bogus key and does not inflate done", () => {
    const p = buildHandoffProgress([{ key: "bogus", done: true }]);
    expect(p.done).toBe(0);
    expect(p.total).toBe(7);
  });

  it("a canonical key absent from the array counts as not done", () => {
    const p = buildHandoffProgress([
      { key: "domain", done: true },
      { key: "dns", done: true },
      { key: "live-on-domain", done: true },
      { key: "search-visible", done: true },
      { key: "google-business", done: true },
      { key: "client-package-sent", done: true },
    ]);
    expect(p.total).toBe(7);
    expect(p.done).toBe(6);
    expect(p.complete).toBe(false);
    expect(p.nextStep?.key).toBe("payment-arranged");
  });
});

describe("handoffSummaryText", () => {
  const base = {
    businessName: "Joe's Barbershop",
    liveUrl: "https://site.example/s/joes",
    pages: ["Home", "Services", "Contact"],
  };

  it("renders the full literal with a customDomain", () => {
    const out = handoffSummaryText({ ...base, customDomain: "joesbarbershop.com" });
    expect(out).toBe(
      [
        "Your new website is live",
        "========================",
        "",
        "Business: Joe's Barbershop",
        "Web address: https://joesbarbershop.com",
        "Preview link (always works): https://site.example/s/joes",
        "",
        "What's included",
        "  - Home",
        "  - Services",
        "  - Contact",
        "",
        "Requesting changes",
        "Reply with what you'd like changed - copy, photos, hours, services.",
        "There's no login and nothing for you to manage; send the change to us",
        "and we'll make it.",
        "",
      ].join("\n")
    );
  });

  it("omits the preview link and shows liveUrl when no customDomain", () => {
    const out = handoffSummaryText({ ...base, customDomain: null });
    expect(out).toBe(
      [
        "Your new website is live",
        "========================",
        "",
        "Business: Joe's Barbershop",
        "Web address: https://site.example/s/joes",
        "What's included",
        "  - Home",
        "  - Services",
        "  - Contact",
        "",
        "Requesting changes",
        "Reply with what you'd like changed - copy, photos, hours, services.",
        "There's no login and nothing for you to manage; send the change to us",
        "and we'll make it.",
        "",
      ].join("\n")
    );
  });

  it("appends a Questions line when contactEmail is present", () => {
    const out = handoffSummaryText({ ...base, customDomain: "joesbarbershop.com", contactEmail: "joe@joesbarbershop.com" });
    expect(out).toBe(
      [
        "Your new website is live",
        "========================",
        "",
        "Business: Joe's Barbershop",
        "Web address: https://joesbarbershop.com",
        "Preview link (always works): https://site.example/s/joes",
        "",
        "What's included",
        "  - Home",
        "  - Services",
        "  - Contact",
        "",
        "Requesting changes",
        "Reply with what you'd like changed - copy, photos, hours, services.",
        "There's no login and nothing for you to manage; send the change to us",
        "and we'll make it.",
        "Questions: joe@joesbarbershop.com",
        "",
      ].join("\n")
    );
  });

  it("ends in exactly one newline and no Questions line when email is absent", () => {
    const out = handoffSummaryText({ ...base, customDomain: null, contactEmail: null });
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
    expect(out).not.toContain("Questions:");
  });

  it("treats a blank customDomain as null", () => {
    const out = handoffSummaryText({ ...base, customDomain: "   " });
    expect(out).toContain("Web address: https://site.example/s/joes");
    expect(out).not.toContain("Preview link (always works):");
  });
});
