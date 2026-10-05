import { describe, it, expect } from "vitest";
import { handleHunterJob, HUNTER_LOOKUPS, HUNTER_PACE_MS, type HunterDeps } from "./handleHunter";
import type { InstagramLookupResult } from "../instagramLookup";
import { fakeCtx } from "./testCtx";

function fakeDeps(n: number, results: (i: number) => InstagramLookupResult) {
  const saved: [string, string][] = [];
  const attempts: [string, boolean][] = [];
  const sleeps: number[] = [];
  const looked: string[] = [];
  const deps: HunterDeps = {
    leads: Array.from({ length: n }, (_, i) => ({ id: `l${i}`, name: `Shop ${i}`, city: "Bayside, NY" })),
    lookup: async (name) => {
      looked.push(name);
      return results(looked.length - 1);
    },
    saveHandle: async (id, h) => {
      saved.push([id, h]);
    },
    recordAttempt: async (id, found) => {
      attempts.push([id, found]);
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return { deps, saved, attempts, sleeps, looked };
}

describe("handleHunterJob", () => {
  it(`looks up at most ${HUNTER_LOOKUPS}, saves found handles, records every hit and miss, paces calls`, async () => {
    const f = fakeDeps(25, (i) => (i % 2 === 0 ? { status: "found", handle: `shop${i}` } : { status: "not_found" }));
    const c = fakeCtx();
    expect(await handleHunterJob(f.deps, c.ctx)).toBe(`looked up ${HUNTER_LOOKUPS}: 10 found, 10 not found`);
    expect(f.looked).toHaveLength(HUNTER_LOOKUPS);
    expect(f.saved).toHaveLength(10);
    expect(f.saved[0]).toEqual(["l0", "shop0"]);
    expect(f.attempts).toHaveLength(HUNTER_LOOKUPS);
    expect(f.attempts[1]).toEqual(["l1", false]);
    expect(f.sleeps).toEqual(Array(HUNTER_LOOKUPS - 1).fill(HUNTER_PACE_MS)); // no sleep before the first
    expect(c.asks).toHaveLength(0); // no Claude
  });

  it.each([
    ["rate_limited", "Brave rate-limited the lookups"],
    ["key_rejected", "Brave rejected the API key"],
    ["not_configured", "BRAVE_SEARCH_API_KEY isn't set"],
  ] as const)("stops early on %s and says why", async (status, why) => {
    const f = fakeDeps(5, (i) => (i < 2 ? { status: "found", handle: `h${i}` } : { status }));
    expect(await handleHunterJob(f.deps, fakeCtx().ctx)).toBe(`stopped after 2 of 5: ${why} (2 found)`);
    expect(f.looked).toHaveLength(3);
    expect(f.attempts).toHaveLength(2); // the stopping lead isn't recorded, so it's retried
  });

  it("doesn't record transient errors, so those leads are retried tomorrow", async () => {
    const f = fakeDeps(3, (i) => (i === 1 ? { status: "error", detail: "500" } : { status: "not_found" }));
    expect(await handleHunterJob(f.deps, fakeCtx().ctx)).toBe("looked up 3: 0 found, 2 not found, 1 error");
    expect(f.attempts.map(([id]) => id)).toEqual(["l0", "l2"]);
  });

  it("nothing to do → no lookups", async () => {
    const f = fakeDeps(0, () => ({ status: "not_found" }));
    expect(await handleHunterJob(f.deps, fakeCtx().ctx)).toBe("no new leads need a handle");
    expect(f.looked).toHaveLength(0);
  });
});
