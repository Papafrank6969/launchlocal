# Feature plan: Funnel event tracking + Stats rework

**Status:** specced, not started
**Assignee:** Agent 1 — single track (a Prisma migration serializes it; not splittable)
**Scope class:** `prisma/schema.prisma`, `prisma/migrations/**`,
`src/lib/funnel.ts` (new) + test, `src/app/api/leads/[id]/route.ts`,
`src/app/api/public/sites/[slug]/contact/route.ts`,
`src/app/(app)/stats/page.tsx`, `src/components/StatsCharts.tsx`.
**Nothing else.** Do not touch the outreach/follow-up console pages, the `/leads`
page, `places.ts`, `placesPhotos.ts`, or `instagramLookup.ts` — other agents own
those or they're unrelated.

---

## 1. Goal

Record lead-lifecycle and contact-form events as `Event` rows so `/stats` can
show the **funnel as it actually flows over time**, not just a snapshot of
current lead statuses.

### Why

`Event` today only has `LEAD_FOUND / SITE_CREATED / SITE_PUBLISHED / SITE_VIEW`.
`/stats` derives "Contacted / Response rate / Won" by counting current
`lead.outreachStatus` values — so there's no time dimension, and a lead that
went NEW→WON in a day is indistinguishable from one that took a month. There's
also no signal at all for **contact-form submissions on the built sites**, which
is the clearest "this site is working" conversion.

### Non-goals

- No change to how `outreachStatus` transitions happen (the console pages, the
  `/leads` page, the queue libs stay as they are — they already PATCH
  `/api/leads/[id]`, which is the one place we hook).
- No backfill of historical events — the funnel starts accumulating from deploy.
- No new page. `/stats` is reworked in place.
- No auth/multi-user anything.

---

## 2. Tasks

### Task 1 — schema + migration

`prisma/schema.prisma`:

- Add to `enum EventType`: `LEAD_CONTACTED`, `LEAD_RESPONDED`, `LEAD_WON`,
  `LEAD_LOST`, `CONTACT_SUBMITTED`.
- Add to `model Event`: `leadId String?` and
  `lead Lead? @relation(fields: [leadId], references: [id])`.
- Add the back-relation on `model Lead`: `events Event[]`.

Run `npx prisma migrate dev --name add_funnel_events` (needs a `.env` with
`DATABASE_URL`; a fresh clone runs `npx prisma migrate dev` once to create
`dev.db` first). **Commit the generated `prisma/migrations/<ts>_add_funnel_events/`
folder** — it's part of the PR.

### Task 2 — emit lead-lifecycle events

`src/app/api/leads/[id]/route.ts`, in the `PATCH` handler:

After the `db.lead.update(...)`, if the request changed `outreachStatus` **to a
different value than `existing.outreachStatus`**, create one `Event`:

| new `outreachStatus` | event `type` |
| --- | --- |
| `CONTACTED` | `LEAD_CONTACTED` |
| `RESPONDED` | `LEAD_RESPONDED` |
| `WON` | `LEAD_WON` |
| `LOST` | `LEAD_LOST` |
| `NEW` | *(none — a reset, don't record)* |

Set `{ type, leadId: id }` on the event. Use the existing `existing` lookup for
the before-value (it's already fetched). Only emit on an actual transition, so
re-saving the same status (the console does this) doesn't double-count. A genuine
re-transition (e.g. RESPONDED → CONTACTED → RESPONDED) legitimately emits twice —
that's fine, the aggregation dedupes by `leadId` for stage counts.

Keep this best-effort: wrap the `db.event.create` in its own try/catch that
logs and swallows — a telemetry write must never fail the status update.

### Task 3 — emit contact-form events

`src/app/api/public/sites/[slug]/contact/route.ts`: after
`db.contactSubmission.create(...)` succeeds, create an `Event`
`{ type: "CONTACT_SUBMITTED", siteId: site.id }`. Same best-effort try/catch.

### Task 4 — `src/lib/funnel.ts` (new, pure)

Structural input types (don't import Prisma):

```ts
export type FunnelLead = {
  id: string;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
  outreachStatus: "NEW" | "CONTACTED" | "RESPONDED" | "WON" | "LOST";
};
export type FunnelEvent = {
  type: string;          // EventType as string
  leadId: string | null;
  siteId: string | null;
  createdAt: string;     // ISO
};
```

**`buildFunnel(leads: FunnelLead[], events: FunnelEvent[]): FunnelStage[]`**
Returns the ordered stages, each `{ key, label, count, ofPreviousPct }`:

1. `found` — `leads.length`
2. `opportunity` — leads with `websiteStatus !== "HAS_SITE"`
3. `contacted` — distinct `leadId` across `LEAD_CONTACTED` events **plus** any
   lead currently at `CONTACTED`/`RESPONDED`/`WON`/`LOST` (so pre-existing leads
   that were advanced before events existed still count). Union, deduped by id.
4. `responded` — distinct `LEAD_RESPONDED` leadIds ∪ leads currently
   `RESPONDED`/`WON`
5. `won` — distinct `LEAD_WON` leadIds ∪ leads currently `WON`

`ofPreviousPct` = `round(count / previousStage.count * 100)` (0 when previous is
0). Stage 1 has no pct (null/undefined).

**`funnelEventsByDay(events, days: number, now?: Date): DayRow[]`**
`DayRow = { date: string; contacted: number; responded: number; won: number; contactForm: number }`.
One row per day for the last `days` days (oldest first), counting raw events of
`LEAD_CONTACTED` / `LEAD_RESPONDED` / `LEAD_WON` / `CONTACT_SUBMITTED` by
`createdAt` day (local midnight buckets, same approach as the existing
`SITE_VIEW` series in `stats/page.tsx`). `date` label formatted like the
existing chart (`toLocaleDateString(undefined, { month: "short", day: "numeric" })`).

**`FUNNEL_STAGE_KEYS`** exported const array for the labels/order.

### Task 5 — tests (`src/lib/funnel.test.ts`, new)

- `buildFunnel`:
  - stage counts with a clean fixture (some HAS_SITE, some contacted-by-event,
    some advanced-by-status-only, some both)
  - the union/dedupe: a lead with a `LEAD_CONTACTED` event **and** current status
    `CONTACTED` counts once
  - a lead currently `WON` with no events still counts in contacted/responded/won
  - `ofPreviousPct` math, incl. previous-stage-zero → 0
  - monotonic sanity: each stage count ≤ the previous (assert on the fixture)
- `funnelEventsByDay`:
  - correct per-day bucketing across a 7-day fixture, event types separated
  - days with no events are present with zeros
  - events outside the window are excluded
  - row count === `days`, oldest first

### Task 6 — `/stats` rework

`src/app/(app)/stats/page.tsx`:

- Also fetch `db.event.findMany` for the funnel types + `LEAD_FOUND` (currently
  only `SITE_VIEW` is fetched). Fetch leads with `id, websiteStatus,
  outreachStatus` (already fetched, add `id`).
- Keep the existing 6 top tiles as they are.
- **Replace** the current "Contacted / Response rate / Won" tile row with a
  **funnel bar**: the 5 stages from `buildFunnel`, each a horizontal bar whose
  width is `count / found.count`, showing `label`, `count`, and the
  `ofPreviousPct` as "→ N% of previous". Monochrome slate bars; `blue-600` for
  the bar the funnel is "narrowest useful" at is overkill — keep all bars one
  color, `emerald-600` only for the `won` bar.
- Add a **funnel-over-time** chart below `StatsCharts` (or inside it): the
  `funnelEventsByDay` series, 30 days, as a small multi-line or stacked-area
  Recharts chart — contacted / responded / won / contact-form. Reuse the
  existing chart's container styling.
- The "Sites" table stays.

### Task 7 — `StatsCharts.tsx`

Add the funnel-over-time chart component here (props: the `DayRow[]`). Recharts
is already the dep. Match the existing `StatsCharts` visual conventions
(container, height, axis styling, `slate-*` grid). Operator palette only —
`blue-600` / `emerald-600` / a third `slate` or `amber` line if you need four
distinguishable series; no new palette. Respect the design rules in
`docs/DESIGN-PROCESS.md` §3 — run `python "$SEARCH" "funnel chart stage
conversion" --domain ux` and `"time series small multiples legend" --domain ux`
first, apply density/legend/label guidance only.

---

## 3. Edge cases

- Telemetry writes are best-effort — never let an `Event` create failure break a
  status PATCH or a contact submission (try/catch + log).
- `existing.outreachStatus === body.outreachStatus` → no event (the console
  re-saves the same status routinely).
- Leads advanced before this feature shipped have no events — the union with
  current-status in `buildFunnel` is what keeps them counted. Don't skip it.
- `funnelEventsByDay` day bucketing must match the existing `SITE_VIEW` series
  (local `startOfDay`), so the two charts line up.
- `ofPreviousPct` with a zero previous stage → 0, not `NaN`/`Infinity`.
- A `CONTACT_SUBMITTED` event has `siteId` but `leadId: null` — `buildFunnel`
  ignores it (it's only in the time series), don't let it break the leadId dedupe.

---

## 4. Definition of done

- [ ] `npm test` green — new `funnel.test.ts` included, all prior pass.
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] `npx prisma migrate dev` ran; the migration folder is committed.
- [ ] `git diff --stat` shows only the scope-class paths + the migration folder.
- [ ] `/stats` renders the funnel bar + the over-time chart; existing tiles and
      Sites table intact.
- [ ] Branch `feature/funnel-tracking` off `origin/master`. **Before the PR goes
      final: `git fetch && git merge origin/master`** into the branch (not a
      rebase onto a partial base), re-run the gate. PR against `master`; land
      with `gh pr merge --merge` / the UI, not local `git merge` + push.
- [ ] PR body: what changed per task, gate output, `git diff --stat`, the skill
      query results, and a note that a migration is included.

---

## 5. Review checklist (boss)

- Migration is minimal (5 enum values + one nullable column + relations), no
  data migration, committed.
- Events emit **only on real transitions**, best-effort, `leadId` set.
- `buildFunnel` union-with-current-status logic present and tested (the
  pre-events-era leads case).
- Funnel bar + time chart hold operator palette; no scroll/motion from skill
  output.
- Aggregation is pure and in `src/lib/funnel.ts`; `/stats` just wires it.
- No console-page / `/leads` / `places*` / `instagramLookup` files in the diff.
