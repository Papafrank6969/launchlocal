/**
 * Pure logic for the persistent Lead Backlog.
 *
 * `/leads` used to render only the results of the most recent search and held
 * them in component state, so a found-but-unfollowed lead vanished on unmount.
 * This module backs a redesigned page that loads every lead already in the
 * database, treats search as an additive merge, and filters/sorts on the client.
 *
 * Deliberately has no React or Prisma imports — it's plain TypeScript over a
 * structural lead type so it stays trivially testable.
 */

/** The subset of a Lead the backlog needs. `sites` is the draft/preview state. */
export type BacklogLead = {
  id: string;
  name: string;
  category: string; // freeform, e.g. "barber", "nail technician", or a raw Places category
  city: string; // e.g. "Massapequa, NY"
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
  outreachStatus: "NEW" | "CONTACTED" | "RESPONDED" | "WON" | "LOST";
  instagramHandle: string | null;
  rating: number | null;
  reviewCount: number | null;
  createdAt: string; // ISO string from the API
  sites?: { id: string; slug: string; status: string }[];
};

/** How far along the outreach funnel a lead is (grouped for the work-state filter). */
export type WorkState = "unworked" | "in-progress" | "won" | "lost" | "all";

/** Website-quality filter, centered on the "opportunity" (no/weak site) default. */
export type WebsiteFilter = "opportunities" | "none" | "poor" | "has-site" | "all";

/** Which if any drafts exist / instagram handle exists. */
export type TriState = "all" | "yes" | "no";

export type LeadFilters = {
  workState: WorkState;
  website: WebsiteFilter;
  city: string | null; // null = all; matched case-insensitively, exact
  trade: string | null; // null = all; matched case-insensitively, exact
  hasHandle: TriState;
  hasDraft: TriState;
  nameQuery: string; // case-insensitive substring on name; "" = no constraint
};

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  workState: "unworked",
  website: "opportunities",
  city: null,
  trade: null,
  hasHandle: "all",
  hasDraft: "all",
  nameQuery: "",
};

export type LeadSortKey = "newest" | "opportunity" | "rating" | "name";

export const LEAD_SORT_OPTIONS: { key: LeadSortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "opportunity", label: "Best opportunity" },
  { key: "rating", label: "Highest rated" },
  { key: "name", label: "Name (A–Z)" },
];

/**
 * Returns the subset of `leads` matching every active filter, preserving input
 * order. Each dimension's predicate:
 *  - `workState` maps `outreachStatus` to a group (unworked = NEW, in-progress =
 *    CONTACTED|RESPONDED, won = WON, lost = LOST, all = no constraint).
 *  - `website` "opportunities" keeps NONE|POOR; none/poor/has-site are exact;
 *    all = no constraint.
 *  - `city`/`trade` are case-insensitive exact matches (not substring) when set.
 *  - `hasHandle`/`hasDraft` tri-state, treating a whitespace-only handle as none.
 *  - `nameQuery` is a case-insensitive substring on name; whitespace means none.
 */
export function filterLeads<T extends BacklogLead>(leads: T[], filters: LeadFilters): T[] {
  const q = filters.nameQuery.trim().toLowerCase();
  return leads.filter((lead) => {
    if (filters.workState !== "all") {
      const inGroup =
        filters.workState === "unworked"
          ? lead.outreachStatus === "NEW"
          : filters.workState === "in-progress"
            ? lead.outreachStatus === "CONTACTED" || lead.outreachStatus === "RESPONDED"
            : filters.workState === "won"
              ? lead.outreachStatus === "WON"
              : lead.outreachStatus === "LOST";
      if (!inGroup) return false;
    }

    if (filters.website !== "all") {
      if (filters.website === "opportunities") {
        if (lead.websiteStatus === "HAS_SITE") return false;
      } else {
        // "none" | "poor" | "has-site" → NONE | POOR | HAS_SITE
        const target = filters.website === "has-site" ? "HAS_SITE" : filters.website.toUpperCase();
        if (lead.websiteStatus !== target) return false;
      }
    }

    if (filters.city && lead.city.trim().toLowerCase() !== filters.city.trim().toLowerCase()) return false;

    if (filters.trade && lead.category.trim().toLowerCase() !== filters.trade.trim().toLowerCase()) return false;

    if (filters.hasHandle !== "all") {
      const has = !!lead.instagramHandle?.trim();
      if (filters.hasHandle === "yes" ? !has : has) return false;
    }

    if (filters.hasDraft !== "all") {
      const has = (lead.sites?.length ?? 0) > 0;
      if (filters.hasDraft === "yes" ? !has : has) return false;
    }

    if (q && !lead.name.toLowerCase().includes(q)) return false;

    return true;
  });
}

/**
 * Returns an integer 0–100 scoring how worth pursuing a lead is. Higher is
 * better; deterministic. Weights, documented:
 *
 *   - `HAS_SITE` → 0 (not a prospect).
 *   - base: NONE → 55, POOR → 40.
 *   - reviewsPoints = round(min(25, 8 * log10(reviewCount + 1))): more reviews
 *     means more established → more to gain, likelier to pay. 0 → 0, ~9 → ~8,
 *     ~99 → ~16, ~999 → ~24, capped at 25.
 *   - ratingPoints (null → 0): >=4.9 → 3 (fine, less urgent); >=4.0 → 10 (the
 *     sweet spot); >=3.0 → 6 (operating but has problems); <3.0 → 2 (struggling).
 *   - reachBonus = 6 if a real instagram handle exists (can DM right now).
 *   - readyBonus = 8 if a draft site exists (pitch is a link).
 *
 * Result is clamped to [0, 100].
 */
export function opportunityScore(lead: BacklogLead): number {
  if (lead.websiteStatus === "HAS_SITE") return 0;

  const base = lead.websiteStatus === "NONE" ? 55 : 40;

  const reviewsPoints = Math.round(Math.min(25, 8 * Math.log10((lead.reviewCount ?? 0) + 1)));

  let ratingPoints = 0;
  if (lead.rating !== null) {
    if (lead.rating >= 4.9) ratingPoints = 3;
    else if (lead.rating >= 4.0) ratingPoints = 10;
    else if (lead.rating >= 3.0) ratingPoints = 6;
    else ratingPoints = 2;
  }

  const reachBonus = lead.instagramHandle?.trim() ? 6 : 0;
  const readyBonus = (lead.sites?.length ?? 0) > 0 ? 8 : 0;

  return Math.max(0, Math.min(100, base + reviewsPoints + ratingPoints + reachBonus + readyBonus));
}

/**
 * Returns a NEW array of `leads` ordered by `key` (input is not mutated).
 * JS sort is stable, so ties keep input order.
 *  - newest → createdAt descending (parsed to epoch)
 *  - opportunity → opportunityScore descending
 *  - rating → rating descending, nulls last
 *  - name → name ascending, case-insensitive localeCompare
 */
export function sortLeads<T extends BacklogLead>(leads: T[], key: LeadSortKey): T[] {
  const copy = [...leads];
  copy.sort((a, b) => {
    switch (key) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "opportunity":
        return opportunityScore(b) - opportunityScore(a);
      case "rating": {
        const ar = a.rating;
        const br = b.rating;
        if (ar === null && br === null) return 0;
        if (ar === null) return 1;
        if (br === null) return -1;
        return br - ar;
      }
      case "name":
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
  });
  return copy;
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/**
 * Distinct `city` and `category` values present in the list, for populating the
 * filter dropdowns. Cities are de-duplicated case-insensitively keeping the
 * first-seen casing; trades are returned title-cased. Both sorted ascending
 * with localeCompare. The stored filter value is compared case-insensitively by
 * `filterLeads`, so casing here is display-only.
 */
export function leadFacets(leads: BacklogLead[]): { cities: string[]; trades: string[] } {
  const citySet = new Map<string, string>();
  const tradeSet = new Map<string, string>();
  for (const lead of leads) {
    const cKey = lead.city.trim().toLowerCase();
    if (cKey && !citySet.has(cKey)) citySet.set(cKey, lead.city.trim());
    const tKey = lead.category.trim().toLowerCase();
    if (tKey && !tradeSet.has(tKey)) tradeSet.set(tKey, titleCase(lead.category));
  }
  return {
    cities: [...citySet.values()].sort((a, b) => a.localeCompare(b)),
    trades: [...tradeSet.values()].sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * How many filter dimensions differ from `DEFAULT_LEAD_FILTERS`. Drives the
 * "Reset filters" button and count badge. `nameQuery` counts as active when its
 * trimmed value is non-empty.
 */
export function activeFilterCount(filters: LeadFilters): number {
  let count = 0;
  if (filters.workState !== DEFAULT_LEAD_FILTERS.workState) count++;
  if (filters.website !== DEFAULT_LEAD_FILTERS.website) count++;
  if (filters.city !== null) count++;
  if (filters.trade !== null) count++;
  if (filters.hasHandle !== "all") count++;
  if (filters.hasDraft !== "all") count++;
  if (filters.nameQuery.trim() !== "") count++;
  return count;
}

const WORK_STATES: WorkState[] = ["unworked", "in-progress", "won", "lost", "all"];
const WEBSITE_FILTERS: WebsiteFilter[] = ["opportunities", "none", "poor", "has-site", "all"];
const SORT_KEYS: LeadSortKey[] = ["newest", "opportunity", "rating", "name"];

/**
 * Validates the shape persisted under `launchlocal.leadFilters` (a blob of
 * `{ filters, sortKey }`, exactly as the page serializes it) and returns the
 * stored view, or the defaults on any mismatch or parse error — per the spec:
 * validate the parsed shape against `DEFAULT_LEAD_FILTERS` keys and fall back
 * to defaults on any mismatch. Strict by design: every `filters` key must be
 * present with a valid value, and `sortKey` must be a valid key, or the whole
 * blob is rejected in favor of defaults (an old/corrupt value shouldn't take
 * down the UI).
 */
export function parseStoredFilters(
  raw: string | null,
): { filters: LeadFilters; sortKey: LeadSortKey } {
  const defaults = { filters: DEFAULT_LEAD_FILTERS, sortKey: "newest" as LeadSortKey };
  if (!raw) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return defaults;

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.sortKey !== "string" || !(SORT_KEYS as string[]).includes(obj.sortKey)) return defaults;
  const rawFilters = obj.filters;
  if (typeof rawFilters !== "object" || rawFilters === null || Array.isArray(rawFilters)) return defaults;

  const f = rawFilters as Record<string, unknown>;

  if (
    typeof f.workState !== "string" ||
    !(WORK_STATES as string[]).includes(f.workState) ||
    typeof f.website !== "string" ||
    !(WEBSITE_FILTERS as string[]).includes(f.website) ||
    f.hasHandle !== "all" && f.hasHandle !== "yes" && f.hasHandle !== "no" ||
    f.hasDraft !== "all" && f.hasDraft !== "yes" && f.hasDraft !== "no" ||
    (f.city !== null && typeof f.city !== "string") ||
    (f.trade !== null && typeof f.trade !== "string") ||
    typeof f.nameQuery !== "string"
  ) {
    return defaults;
  }

  const filters: LeadFilters = {
    workState: f.workState as WorkState,
    website: f.website as WebsiteFilter,
    city: typeof f.city === "string" && f.city.trim() !== "" ? (f.city as string) : null,
    trade: typeof f.trade === "string" && f.trade.trim() !== "" ? (f.trade as string) : null,
    hasHandle: f.hasHandle as TriState,
    hasDraft: f.hasDraft as TriState,
    nameQuery: f.nameQuery as string,
  };

  return { filters, sortKey: obj.sortKey as LeadSortKey };
}
