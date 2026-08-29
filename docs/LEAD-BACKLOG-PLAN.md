# Feature plan: Persistent Lead Backlog

**Status:** specced, not started
**Owner of spec:** project boss
**Assignee:** assistant (opencode / "big-pickle")
**Scope class:** operator app only — `src/app/(app)/leads`, `src/app/api/leads`,
`src/lib/`, `src/components/`. **Does not touch** `src/lib/templates.tsx`,
`src/app/s/[slug]/**`, `src/components/site/**`, `src/lib/designSystems.ts`,
`prisma/schema.prisma`. No migration.

---

## 1. Goal

Make the Lead Finder page (`/leads`) show **every lead already in the database**,
not just the results of the most recent search. A search becomes "add more leads
to the backlog", not "replace what's on screen". Add a filter + sort bar so the
operator can work the pool down (by city, trade, website status, outreach state,
whether it has an Instagram handle, whether a draft site exists) and see the
best opportunities first.

### Why

`/leads/page.tsx` renders only the `leads` returned from `POST /api/leads/search`
and holds them in component state. On unmount that state is gone. A lead found
but left at `outreachStatus: NEW` with no Instagram handle then appears on **no
screen in the app**:

- `/pipeline` filters to `outreachStatus != NEW` (`GET /api/leads?pipeline=1`).
- `/outreach` filters to `NEW` **and** `instagramHandle != null` — and the
  Instagram lookup is currently broken, so freshly-found no-website leads almost
  never have a handle yet.

The only way back to those leads today is re-running the exact same Places search
(API quota cost, and Places pagination is unreliable — see `places.ts` comments).
Every downstream feature (draft, outreach, follow-up) assumes the operator can
return to a lead. This closes that gap.

### Non-goals (do not build these here)

- Server-side pagination or server-side filtering. v1 fetches all leads (capped
  at 500) and filters on the client. If the 500 cap is ever hit in practice,
  that's a separate follow-up task.
- Any new DB column, enum value, or migration.
- Bulk actions (multi-select draft/delete/status change). Separate future task.
- Changes to the Outreach or Follow-up consoles.
- Changes to conversion/funnel tracking or the Stats page.
- New nav entry — `/leads` stays the single entry point.

---

## 2. Design constraints

This is **operator-app UI**, governed by `docs/DESIGN-PROCESS.md` §3, not the
site-quality checklist (no generated-site or public-page code is touched).

- Keep the operator palette: `blue-600` primary, `slate-*` neutrals,
  `emerald-600` for positive/publish. No new accent colors.
- Use the existing `.input` and `.select-compact` component classes
  (`src/app/globals.css`) for form controls. Every `<select>`/`<input>` gets a
  visible `<label>` (not placeholder-only) and keeps its focus ring.
- Icons: Lucide only (already a dependency). No emoji.
- Before building the filter bar, run these `ui-ux-pro-max` skill queries (see
  `docs/DESIGN-PROCESS.md` "Running a query" for the invocation) and apply what
  fits within the conventions above — the operator conventions and this spec
  outrank any skill output:
  ```
  "filter bar faceted filters result count" --domain ux --density 7
  "list view sort control default ordering" --domain ux
  ```
  If the skill returns nothing useful, say so in the commit message and fall
  back to the conventions above. Do **not** adopt skill suggestions for motion,
  color, or scroll behavior.

---

## 3. Tasks

### Task 1 — `src/lib/leadBacklog.ts` (new, pure logic)

Create the module with the types and functions below. Full doc comments on every
export. No imports from React or Prisma — plain TS over a structural lead type.

```ts
export type BacklogLead = {
  id: string;
  name: string;
  category: string;         // freeform, e.g. "barber", "nail technician", or a raw Places category
  city: string;             // e.g. "Massapequa, NY"
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
  outreachStatus: "NEW" | "CONTACTED" | "RESPONDED" | "WON" | "LOST";
  instagramHandle: string | null;
  rating: number | null;
  reviewCount: number | null;
  createdAt: string;        // ISO string from the API
  sites?: { id: string; slug: string; status: string }[];
};

export type WorkState = "unworked" | "in-progress" | "won" | "lost" | "all";
export type WebsiteFilter = "opportunities" | "none" | "poor" | "has-site" | "all";
export type TriState = "all" | "yes" | "no";

export type LeadFilters = {
  workState: WorkState;
  website: WebsiteFilter;
  city: string | null;      // null = all; matched case-insensitively, exact
  trade: string | null;     // null = all; matched case-insensitively, exact
  hasHandle: TriState;
  hasDraft: TriState;
  nameQuery: string;        // case-insensitive substring on name; "" = no constraint
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
```

**`filterLeads(leads: BacklogLead[], filters: LeadFilters): BacklogLead[]`**
Returns the subset matching every active filter, **input order preserved**.
Predicate per dimension:

- `workState`:
  - `unworked` → `outreachStatus === "NEW"`
  - `in-progress` → `outreachStatus === "CONTACTED" || outreachStatus === "RESPONDED"`
  - `won` → `outreachStatus === "WON"`
  - `lost` → `outreachStatus === "LOST"`
  - `all` → no constraint
- `website`:
  - `opportunities` → `websiteStatus !== "HAS_SITE"`
  - `none` / `poor` / `has-site` → exact match on `websiteStatus`
  - `all` → no constraint
- `city`: `null` → no constraint; else `lead.city.trim().toLowerCase() === filters.city.trim().toLowerCase()`
- `trade`: `null` → no constraint; else `lead.category.trim().toLowerCase() === filters.trade.trim().toLowerCase()`
- `hasHandle`: `all` → no constraint; `yes` → `!!lead.instagramHandle?.trim()`; `no` → `!lead.instagramHandle?.trim()`
- `hasDraft`: `all` → no constraint; `yes` → `(lead.sites?.length ?? 0) > 0`; `no` → `(lead.sites?.length ?? 0) === 0`
- `nameQuery`: `""`/whitespace → no constraint; else `lead.name.toLowerCase().includes(q.trim().toLowerCase())`

**`opportunityScore(lead: BacklogLead): number`**
Integer 0–100. Higher = more worth pursuing. Deterministic. Document the weights
in the doc comment exactly as below.

```
If websiteStatus === "HAS_SITE": return 0  (not a prospect)

base:
  NONE -> 55
  POOR -> 40

reviewsPoints = round( min(25, 8 * log10((reviewCount ?? 0) + 1)) )
  // rationale: more reviews => more established => more to gain, likelier to pay.
  // reviewCount 0 -> 0, ~9 -> ~8, ~99 -> ~16, ~999 -> ~24, capped at 25.

ratingPoints (rating === null -> 0):
  rating >= 4.9 -> 3     // near-perfect reputation: fine, but less urgent
  rating >= 4.0 -> 10    // strong, credible — the sweet spot
  rating >= 3.0 -> 6     // operating but has problems
  rating <  3.0 -> 2     // struggling — lower priority

reachBonus  = instagramHandle?.trim() ? 6 : 0    // can DM right now
readyBonus  = (sites?.length ?? 0) > 0 ? 8 : 0   // draft exists — pitch is a link

score = clamp(base + reviewsPoints + ratingPoints + reachBonus + readyBonus, 0, 100)
```

**`sortLeads(leads: BacklogLead[], key: LeadSortKey): BacklogLead[]`**
Returns a **new** array (don't mutate input). JS sort is stable — rely on that
for ties.

- `newest` → `createdAt` descending (parse ISO to epoch).
- `opportunity` → `opportunityScore` descending.
- `rating` → `rating` descending, **nulls last** (a null rating sorts after any
  number regardless of direction).
- `name` → `name` ascending, `localeCompare`, case-insensitive
  (`{ sensitivity: "base" }`).

**`leadFacets(leads: BacklogLead[]): { cities: string[]; trades: string[] }`**
Distinct `city` and `category` values present in the list, each:
- de-duplicated case-insensitively (keep the first-seen original casing for
  `cities`; for `trades` return the value title-cased — reuse a small local
  `titleCase` helper, first letter of each word upper, rest lower; special-case
  nothing),
- sorted ascending with `localeCompare`.
These populate the city/trade dropdowns. The dropdown's stored filter value is
compared case-insensitively by `filterLeads`, so casing here is display-only.

**`activeFilterCount(filters: LeadFilters): number`**
How many dimensions differ from `DEFAULT_LEAD_FILTERS`. Used to show/hide a
"Reset filters" button and a count badge. `nameQuery` counts as active when its
trimmed value is non-empty.

### Task 2 — `src/lib/leadBacklog.test.ts` (new)

One `describe` per exported function; `it` names read as sentences. Assert real
outputs, never `toBeDefined()` alone. Cover:

- **`filterLeads`**
  - each `workState` value selects the right `outreachStatus` set
  - `website: "opportunities"` excludes `HAS_SITE`, keeps `NONE` and `POOR`
  - `website: "none"|"poor"|"has-site"` exact
  - `city` / `trade` match case-insensitively and are exact (not substring — e.g.
    `trade: "barber"` does **not** match a `"barbershop"` lead)
  - `hasHandle` / `hasDraft` tri-state, including `"  "` (whitespace handle) counting as no handle
  - `nameQuery` substring, case-insensitive, whitespace-only = no constraint
  - `DEFAULT_LEAD_FILTERS` passes NEW non-HAS_SITE leads and drops the rest
  - combined filters AND together
  - input order is preserved
- **`opportunityScore`**
  - `HAS_SITE` ⇒ exactly `0` regardless of other fields
  - at otherwise-equal inputs: `NONE` score > `POOR` score
  - more `reviewCount` ⇒ score is `>=` (monotonic non-decreasing) — test a few points
  - `null` rating and `null` reviewCount don't throw and score stays in range
  - adding a draft site raises the score by 8 (below the clamp); adding a handle raises it by 6
  - result is always an integer within `[0, 100]` — test a deliberately maxed-out lead clamps at 100
  - 3 concrete fixture leads with hand-computed expected scores, to pin the formula
- **`sortLeads`**
  - `newest` orders by `createdAt` desc
  - `opportunity` orders by score desc
  - `rating` desc with nulls last
  - `name` A–Z case-insensitive
  - does not mutate the input array
  - stable on ties (e.g. two leads same score keep input order)
- **`leadFacets`** — dedupes case-insensitively, sorts, trades title-cased
- **`activeFilterCount`** — `0` for defaults, increments per changed dimension,
  `nameQuery: "  "` counts as `0`

### Task 3 — `src/app/api/leads/route.ts` (small change)

The `GET` handler currently supports `?status=` and `?pipeline=`. Keep both
working exactly as they are. Only change: add `take: 500` to the `findMany` so
an unbounded backlog can't blow up the payload, and make the default ordering
explicit as `orderBy: { createdAt: "desc" }` (it already is for the non-pipeline
branch — just confirm and leave a one-line comment noting the 500 cap is a known
v1 limit, pagination is a follow-up). No new query params.

If there is an existing route test, update it; if not, don't add an integration
test (the repo has none yet — see `TESTING.md`).

### Task 4 — `src/components/LeadFilterBar.tsx` (new, presentational)

A controlled component. Props:

```ts
{
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
  sortKey: LeadSortKey;
  onSortChange: (key: LeadSortKey) => void;
  facets: { cities: string[]; trades: string[] };
  total: number;     // leads in the backlog before filtering
  shown: number;     // leads after filtering
}
```

- Render as a `<fieldset>` with a visually-styled `<legend>` ("Filter & sort")
  or a `<div role="group" aria-label="Filter and sort leads">` — your call,
  but it must be a labelled group.
- Controls, each with its own `<label htmlFor>`:
  - Work state — `<select>`: Unworked / In progress / Won / Lost / All
  - Website — `<select>`: Opportunities (no/weak site) / No site / Weak site / Has a site / All
  - City — `<select>`: "All cities" + `facets.cities`
  - Trade — `<select>`: "All trades" + `facets.trades`
  - Instagram — `<select>`: Any / Has handle / Needs handle  (maps to `hasHandle`)
  - Draft site — `<select>`: Any / Drafted / Not drafted  (maps to `hasDraft`)
  - Name — `<input type="search">` bound to `nameQuery`
  - Sort — `<select>` from `LEAD_SORT_OPTIONS`
- Use `.select-compact` for the selects, `.input` for the search box. Lay out as
  a `flex flex-wrap items-end gap-3` row, consistent with the existing search
  form directly above it.
- Show `Showing {shown} of {total}` (slate-500 text-xs).
- When `activeFilterCount(filters) > 0` (or sort differs from `"newest"`), show a
  "Reset" text button (Lucide `X` icon, `text-slate-500 hover:text-slate-700`)
  that calls `onChange(DEFAULT_LEAD_FILTERS)` and `onSortChange("newest")`.
- No data fetching, no `localStorage`, no side effects beyond the callbacks.

### Task 5 — `src/app/(app)/leads/page.tsx` (rework)

Current behavior: search POST → `setLeads(data.leads)`. New behavior:

1. **Load the backlog on mount.** `useEffect` → `GET /api/leads` →
   `setLeads(data.leads ?? [])`. Show a lightweight loading state (reuse the
   existing "Searching…" style or a simple "Loading leads…"). On fetch failure,
   set the existing `error` state.
2. **Search merges instead of replaces.** After `POST /api/leads/search`
   succeeds, merge results into the existing list by `id` (incoming wins — a
   re-search may carry fresh `rating` / `websiteStatus` / `existingUrl`). Keep
   the merged list in a stable base order (e.g. newest `createdAt` first); the
   display order is controlled by the sort dropdown, not this array.
   - After a merge, show a transient status line:
     `Added {newCount} new, refreshed {existingCount} already in your backlog.`
     using the existing `FormStatus` or a small inline `<p>`. (`newCount` =
     incoming ids not previously present.)
3. **Filter + sort.** Hold `filters` (`useState(DEFAULT_LEAD_FILTERS)`) and
   `sortKey` (`useState<LeadSortKey>("newest")`). Compute
   `const facets = useMemo(() => leadFacets(leads), [leads])` and
   `const visible = useMemo(() => sortLeads(filterLeads(leads, filters), sortKey), [leads, filters, sortKey])`.
4. **Render cap.** `const [visibleCount, setVisibleCount] = useState(60)`.
   Render `visible.slice(0, visibleCount)`. If `visible.length > visibleCount`,
   show a "Load more" button (`+60`) below the grid and a
   `Showing {min(visibleCount, visible.length)} of {visible.length}` line.
   Reset `visibleCount` to 60 whenever `filters` or `sortKey` changes.
5. **Remove the standalone "Only show opportunities" checkbox** — it's now the
   default `website: "opportunities"` filter. The `onlyOpportunities` state and
   its `visibleLeads` derivation go away, replaced by `visible`.
6. **Keep the `usingLiveData` banner** and the radius/city/category search form
   exactly as they are (including the barbershop default categories added in
   `2efef3b`).
7. **In-place edits already work** via `updateInstagramHandle`, `updateEmail`,
   `updateOutreach`, `markLeadDrafted` mutating `leads` state — keep them. A lead
   edited so it no longer matches the active filter (e.g. marked WON while
   `workState: "unworked"`) will drop out of `visible` on the next render. That's
   acceptable and matches how the old "only opportunities" checkbox behaved.
8. **Empty states:**
   - backlog empty after load, no search yet →
     `No leads yet — run a search above to start building your backlog.`
   - backlog non-empty but the filters match nothing →
     `No leads match these filters.` + the Reset button.
9. Put `<LeadFilterBar>` between the search form block and the results grid.
10. The `Lead` type in this file must stay compatible with `BacklogLead` — it
    already has all the needed fields; just make sure `filterLeads`/`sortLeads`
    accept it (structural typing — no cast needed if the shape is a superset).

Keep the page a client component. No new deps.

### Task 6 — copy touch-up: `src/app/(app)/page.tsx`

Update the "1. Find leads" step description to mention persistence, e.g.:

> Search a city and category to surface local businesses with no website or a
> weak one. Everything you find stays in your backlog — filter it by trade,
> city, or status and work it down over time.

One-line change. No layout change.

### Task 7 — (OPTIONAL / stretch) persist filter + sort to `localStorage`

Only if Tasks 1–6 are done, reviewed-clean in your own gate, and time allows.
Persist `filters` and `sortKey` under a single key (`launchlocal.leadFilters`)
and rehydrate on mount (validate the parsed shape against `DEFAULT_LEAD_FILTERS`
keys; fall back to defaults on any mismatch or parse error). Guard all
`localStorage` access in `try/catch`. If you do this, add a
`parseStoredFilters(raw: string | null): { filters: LeadFilters; sortKey: LeadSortKey }`
pure helper to `leadBacklog.ts` **with tests** (valid blob, missing keys, extra
keys, garbage, `null`). If you skip it, say so in the PR/commit notes — it is
not required for the feature to land.

---

## 4. Edge cases to get right

- **Re-search of the same area** must not create duplicate cards — merge by `id`.
- **`createdAt` is a string** from JSON — parse before comparing in `sortLeads`.
- **Null `rating`/`reviewCount`** everywhere — no `NaN` in scores, nulls sort last.
- **`trade` filter is exact, not substring** — `"barber"` must not select
  `"barbershop"` leads (deliberate; the dropdown lists both as separate facets).
- **Whitespace Instagram handles** (`"  "`) count as "no handle" — same rule the
  outreach queue uses (`instagramHandle.trim()`).
- **Filter/sort change resets the 60-cap** so "Load more" state can't strand the
  user on a stale slice.
- **500-lead API cap**: fine for v1, but leave the code comment so the next
  person knows filtering is client-side and bounded.
- Large numbers of distinct cities/trades in the dropdowns — acceptable, no
  virtualization needed at this scale.

---

## 5. Definition of done

- [ ] `npm test` green — new `leadBacklog.test.ts` included, existing 248 still pass.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run lint` clean.
- [ ] `/leads` loads all existing leads on mount; a search adds to them rather
      than replacing; filter + sort + "Load more" all work.
- [ ] No changes outside the scope-class paths in the header. `git diff --stat`
      shows only: `src/lib/leadBacklog.ts`, `src/lib/leadBacklog.test.ts`,
      `src/app/api/leads/route.ts`, `src/components/LeadFilterBar.tsx`,
      `src/app/(app)/leads/page.tsx`, `src/app/(app)/page.tsx`
      (+ optional Task 7 keeps it within `leadBacklog.ts` / its test / the page).
- [ ] Commit message notes: the skill query result (or that it returned nothing
      useful), and whether Task 7 was done or skipped.
- [ ] One commit (or a short clean series), branched off `master`, not pushed
      unless asked.

---

## 6. Review checklist (boss fills this in on the diff)

- Logic in `leadBacklog.ts` matches this spec's predicates and weights exactly.
- Tests assert behavior/values, not smoke.
- Filter bar holds operator-app conventions (palette, `.input`/`.select-compact`,
  labels, focus rings, Lucide).
- No scope creep into templates / design systems / schema / Stats / consoles.
- Empty and no-match states both handled.
- Merge-by-id dedupe verified against a re-search.
