import { describe, expect, it } from "vitest";
import { emailFinderJob, FINDER_PER_DAY, isSocial, pickEmail, type FinderDeps, type FinderLead } from "./emailFinder";
import { fakeCtx } from "./testCtx";

describe("isSocial", () => {
  it("never fetches social or map pages", () => {
    for (const u of ["https://www.instagram.com/shineco", "https://m.facebook.com/shine", "https://maps.app.goo.gl/x", "https://www.google.com/maps/place/x", "not a url"]) expect(isSocial(u)).toBe(true);
    for (const u of ["https://shineco.wixsite.com/home", "https://linktr.ee/shineco", "https://sites.google.com/view/shine"]) expect(isSocial(u)).toBe(false);
  });
});

describe("pickEmail", () => {
  const site = "https://shineco.com";
  it("prefers a mailto link, then the site's own domain, then any", () => {
    expect(pickEmail(`<a href="mailto:Book@ShineCo.com?subject=hi">Email</a> other@gmail.com`, site)).toBe("book@shineco.com");
    expect(pickEmail(`Reach us: someone@gmail.com or hello@shineco.com`, site)).toBe("hello@shineco.com");
    expect(pickEmail(`Reach us: shinecodetail@gmail.com`, site)).toBe("shinecodetail@gmail.com");
  });
  it("decodes obfuscated @ and skips junk", () => {
    expect(pickEmail(`hello&#64;shineco.com`, site)).toBe("hello@shineco.com");
    expect(pickEmail(`hello [at] shineco.com`, site)).toBeNull(); // spaces around [at]: not a clean address, leave it
    expect(pickEmail(`logo@2x.png you@example.com 1a2b@sentry.wixpress.com noreply@shineco.com`, site)).toBeNull();
    expect(pickEmail(`<a href="mailto:%E0%A4%A">x</a>`, site)).toBeNull(); // bad escape doesn't throw
  });
});

function deps(over: Partial<FinderDeps> = {}) {
  const saved: [string, string][] = [];
  const attempts: [string, boolean][] = [];
  const fetched: string[] = [];
  const lead = (id: string): FinderLead => ({ id, name: `Shop ${id}`, url: `https://${id}.wixsite.com/home` });
  const d: FinderDeps = {
    leads: ["a", "b"].map(lead),
    doneToday: 0,
    fetchPage: async (url) => (fetched.push(url), url.includes("a.wixsite") && !url.endsWith("/contact") ? `<a href="mailto:a@shop.com">` : null),
    save: async (l, e) => void saved.push([l.id, e]),
    recordAttempt: async (id, found) => void attempts.push([id, found]),
    ...over,
  };
  return { d, saved, attempts, fetched };
}

describe("emailFinderJob", () => {
  it("saves what a site publishes, tries /contact when the home page has nothing, records every attempt", async () => {
    const { d, saved, attempts, fetched } = deps();
    expect(await emailFinderJob(d, fakeCtx().ctx)).toBe("checked 2 sites: 1 email found and enrolled");
    expect(saved).toEqual([["a", "a@shop.com"]]);
    expect(attempts).toEqual([["a", true], ["b", false]]);
    expect(fetched).toEqual(["https://a.wixsite.com/home", "https://b.wixsite.com/home", "https://b.wixsite.com/contact"]);
  });

  it("stops at the daily cap", async () => {
    const { d, fetched } = deps({ doneToday: FINDER_PER_DAY });
    expect(await emailFinderJob(d, fakeCtx().ctx)).toBe(`done for today (${FINDER_PER_DAY} sites)`);
    expect(fetched).toHaveLength(0);
  });
});
