# Feature plan: Daily lead cron

**Status:** specced, not started
**Assignee:** agent-2 (code + tests + config) · boss + user (add `CRON_SECRET` in Vercel, verify the first live run)
**Scope class:** `prisma/schema.prisma`, `prisma/migrations/**`,
`src/lib/leadTargets.ts` (new) + test, `src/lib/leadCron.ts` (new) + test,
`src/app/api/cron/daily-leads/route.ts` (new), `vercel.json`, `.env.example`,
`docs/GOOGLE-APIS.md` (one note). **Nothing else** — do not touch
`src/lib/places.ts`, `src/app/api/leads/search/route.ts`, the `/leads` UI, or
anything in Track 3's future scope (`/today`).

---

## 1. Goal

Every afternoon, before the operator gets home (~3pm ET), automatically top up the
lead backlog with ~25 fresh, messageable barbershop/salon leads across NYC + Long
Island — so there's a full day's worth of outreach waiting instead of a
search-from-scratch.

### Why

The operator wants to send ~25 outreach messages/day. Right now every session
starts with a manual search. A scheduled job that works through a rotation of
city × category targets and banks net-new qualifying leads turns "sit down and
go prospecting" into "sit down and start messaging." The backlog + funnel
tracking already handle everything downstream.

### Non-goals

- **No `/today` queue UI** — that's Track 3. This track only *fills* the backlog.
- **No message sending / Instagram automation.** The operator sends by hand.
- **No notification** ("your leads are ready") — nice-to-have, later.
- **No change to the interactive `/leads` search** or `src/lib/places.ts`.
- **No multiple runs/day or precise timing** — Vercel Hobby crons run once daily
  on an approximate schedule. One run, ~25 leads, good enough.
- No Instagram handle lookup inside the cron (keeps it cheap; the CSE path is
  retested separately in Task 7).

---

## 2. Tasks

### Task 1 — schema: `CronState`

`prisma/schema.prisma`:

```prisma
model CronState {
  id           String    @id            // fixed key, e.g. "daily-leads"
  cursor       Int       @default(0)    // index into LEAD_TARGETS for the next run
  lastRunAt    DateTime?
  lastRunAdded Int?                      // net-new leads created on the last run
  lastRunNote  String?                   // human-readable summary of the last run
  updatedAt    DateTime  @updatedAt
}
```

Single-row table. `npx prisma migrate dev --name add_cron_state`, commit the
migration folder.

### Task 2 — `src/lib/leadTargets.ts` (new, pure)

```ts
export type LeadTarget = { city: string; category: string };
```

**`LEAD_TARGETS: LeadTarget[]`** — every entry is one `{ city, category }` pair,
`category` being one of exactly `"barber"` or `"salon"` (the values
`/api/leads/search` already accepts — confirmed against a live run). The list is
**`city` × `{barber, salon}`** for this set of areas, in this order (barber then
salon for each city):

NYC:
`Manhattan, NY` · `Harlem, NY` · `Washington Heights, NY` · `Brooklyn, NY` ·
`Williamsburg, Brooklyn, NY` · `Bushwick, Brooklyn, NY` ·
`Bedford-Stuyvesant, Brooklyn, NY` · `Flatbush, Brooklyn, NY` ·
`Bay Ridge, Brooklyn, NY` · `Park Slope, Brooklyn, NY` · `Astoria, Queens, NY` ·
`Long Island City, NY` · `Flushing, Queens, NY` · `Jamaica, Queens, NY` ·
`Ridgewood, Queens, NY` · `Forest Hills, NY` · `The Bronx, NY` ·
`Fordham, Bronx, NY` · `Staten Island, NY`

Long Island (Nassau):
`Hempstead, NY` · `Long Beach, NY` · `Freeport, NY` · `Rockville Centre, NY` ·
`Garden City, NY` · `Mineola, NY` · `Hicksville, NY` · `Levittown, NY` ·
`Massapequa, NY` · `Farmingdale, NY` · `Valley Stream, NY` · `Elmont, NY` ·
`Westbury, NY` · `Glen Cove, NY`

Long Island (Suffolk):
`Huntington, NY` · `Babylon, NY` · `Islip, NY` · `Patchogue, NY` ·
`Bay Shore, NY` · `Central Islip, NY` · `Brentwood, NY` · `Riverhead, NY` ·
`Smithtown, NY` · `Commack, NY` · `Deer Park, NY` · `Lindenhurst, NY` ·
`Copiague, NY` · `Amityville, NY`

That's 47 cities × 2 categories = **94 targets**. At ~4 targets/run that's a
~24-day cycle before any pair repeats — well past the "don't repeat within a
couple weeks" bar.

**`rotateTargets(cursor: number, count: number, targets?: LeadTarget[]): { batch: LeadTarget[]; nextCursor: number }`**
Pure. Returns `count` targets starting at `cursor % targets.length`, wrapping
around the end of the list; `nextCursor` is `(cursor + count) % targets.length`.
`targets` defaults to `LEAD_TARGETS`.

### Task 3 — `src/lib/leadCron.ts` (new, pure — no Prisma, no fetch)

Constants:

```ts
export const DAILY_LEAD_GOAL = 25;
export const MAX_SEARCHES_PER_RUN = 6;   // hard cap on Places calls per run (cost)
```

Structural input type (don't import Prisma or places.ts types):

```ts
export type CandidateBusiness = {
  placeId: string | null;
  name: string;
  address: string;
  phone?: string | null;
  existingUrl?: string | null;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
};
```

**`qualifies(b: CandidateBusiness): boolean`** — true when
`websiteStatus !== "HAS_SITE"` **and** `b.phone` is a non-empty string. (No
website / weak website + a phone to call or text. Places doesn't return email,
and IG handles aren't looked up here.)

**`selectNewLeads(candidates: CandidateBusiness[], knownPlaceIds: Set<string>): CandidateBusiness[]`**
Returns the candidates that `qualifies()` **and** whose `placeId` is non-null and
not in `knownPlaceIds`. Dedupes within the batch too (same `placeId` twice → once).

**`summarizeRun(input: { added: number; searches: number; goal: number; areasHit: string[] }): string`**
Deterministic one-line summary for `CronState.lastRunNote`, e.g.
`"added 25/25 in 4 searches — Manhattan barber, Manhattan salon, Harlem barber, Harlem salon"`.
If `added < goal` after `MAX_SEARCHES_PER_RUN`, say so:
`"added 18/25 (search cap hit) — ..."`.

Tests cover: `qualifies` (each branch), `selectNewLeads` (filter + dedupe +
known-id exclusion + null placeId), `summarizeRun` (goal met / cap hit).

### Task 4 — `src/app/api/cron/daily-leads/route.ts` (new)

`export async function GET(req: NextRequest)`:

1. **Auth.** If `process.env.CRON_SECRET` is set, require
   `req.headers.get("authorization") === \`Bearer ${process.env.CRON_SECRET}\``
   — else `401`. (Vercel Cron sends exactly this header automatically when
   `CRON_SECRET` is an env var.) If `CRON_SECRET` is unset, allow (local dev).
2. Load-or-create the `CronState` row (`id: "daily-leads"`).
3. Pull the set of existing `placeId`s:
   `new Set((await db.lead.findMany({ where: { placeId: { not: null } }, select: { placeId: true } })).map(r => r.placeId!))`.
4. Loop, up to `MAX_SEARCHES_PER_RUN` times, advancing a local cursor from
   `state.cursor`:
   - `const [target] = rotateTargets(cursor, 1).batch; cursor = rotateTargets(cursor, 1).nextCursor;`
   - `const businesses = await findBusinesses(target.city, target.category);`
     (import from `@/lib/places` — no change to that file)
   - Map each to a `CandidateBusiness` using `scoreWebsite(b.existingUrl)` for
     `websiteStatus` (also from `@/lib/places`).
   - `const fresh = selectNewLeads(candidates, knownPlaceIds);`
   - For each `fresh`: `db.lead.create({ data: { ...map fields..., websiteStatus,
     instagramHandle: extractInstagramHandle(b.existingUrl), source: "GOOGLE_PLACES",
     placeId } })`, add its `placeId` to `knownPlaceIds`, increment `added`.
   - `db.event.createMany({ data: created.map(() => ({ type: "LEAD_FOUND" })) })`
     after each target (or once at the end).
   - Wrap each target's work in its own `try/catch` — one failing search logs and
     is skipped, the run continues.
   - Break as soon as `added >= DAILY_LEAD_GOAL`.
5. Write `CronState`: `cursor` = the local cursor, `lastRunAt` = now,
   `lastRunAdded` = `added`, `lastRunNote` = `summarizeRun(...)`.
6. Respond `200` with `{ added, searches, goal: DAILY_LEAD_GOAL, cursor, note }`.

Use `export const dynamic = "force-dynamic"` and `export const maxDuration = 60`
(Places pagination + sequential creates can take 20–40s).

### Task 5 — tests

- `src/lib/leadTargets.test.ts`: `LEAD_TARGETS` length is 94 and every entry's
  `category` is `"barber"` or `"salon"`; `rotateTargets` wraps at the end
  (`cursor` near `length` returns a batch that spans the wrap); `nextCursor` math;
  `count` larger than remaining still returns `count` items.
- `src/lib/leadCron.test.ts`: per Task 3.
- All 350+ existing tests stay green.

### Task 6 — `vercel.json` + `.env.example`

`vercel.json` — add:

```json
{
  "framework": "nextjs",
  "crons": [{ "path": "/api/cron/daily-leads", "schedule": "0 17 * * *" }]
}
```

`0 17 * * *` = 17:00 UTC = **12:00 pm ET in winter / 1:00 pm ET in summer** —
comfortably before a 3pm arrival even with Hobby's approximate timing. (Hobby =
one run/day, may drift within the hour. Fine for this.)

`.env.example` — add:

```
# Protects the /api/cron/daily-leads endpoint. Generate a random string
# (e.g. `openssl rand -hex 32`) and set the SAME value in Vercel → Settings →
# Environment Variables. Vercel Cron automatically sends it as
# `Authorization: Bearer <CRON_SECRET>` on the scheduled request.
CRON_SECRET=
```

`docs/GOOGLE-APIS.md` — one line under the Places section: the cron makes ~4–6
Places searches/day (~120–180/month) on top of interactive use; stays well
inside the free tier.

### Task 7 — Instagram lookup retest (folded in from the queue)

Not part of the cron. A standalone check, results written into the PR description
(no code unless it's broken):

- Against the deployed app, call the Instagram handle lookup for one known
  handle-having business (use the existing "Find it" button on a `/leads` result,
  or `POST /api/leads/[id]/lookup-instagram`).
- If it returns a handle: note "CSE lookup works in prod" in the PR, done.
- If it still 4xx/403s: note the exact error and that the `/today` queue (Track 3)
  must not depend on IG handles. Do **not** try to fix it in this PR.

---

## 3. Edge cases

- **Overlapping searches.** Adjacent Long Island towns share border businesses;
  `selectNewLeads` dedupes by `placeId` against the whole existing set, so a
  business found yesterday in "Hempstead" won't be re-added today under
  "Freeport."
- **A search returns mock data** (Places both APIs down → `findBusinesses` falls
  back to mock). Mock businesses have `source: "MOCK"` and synthetic
  `placeId`-less entries — `selectNewLeads` drops null `placeId`, so a fallback
  run just adds nothing rather than polluting the backlog with fake leads.
- **Fewer than 25 qualify.** After `MAX_SEARCHES_PER_RUN` the run stops and
  records `added: 18/25 (search cap hit)`. Next day picks up where the cursor
  left off. Acceptable — don't raise the cap to chase the number.
- **Cron fires twice** (Vercel retry / manual trigger). Idempotent on leads
  (dedupe by `placeId`); the cursor advances further, which just means the next
  scheduled run starts later in the rotation. Harmless.
- **`CRON_SECRET` unset in prod** — the endpoint is then unauthenticated. Task 6
  makes setting it a required deploy step; call it out in the PR.
- **Long run.** 6 searches × (up to 3 Places pages + up to ~60 sequential
  `db.lead.create`) — keep creates sequential (Postgres is fine, but it bounds
  memory and keeps the transaction log sane), rely on `maxDuration = 60`.

---

## 4. Definition of done

- [ ] `npm test` green (350+ incl. new `leadTargets` + `leadCron` tests).
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] `npx prisma migrate dev` ran; `add_cron_state` migration committed.
- [ ] `git diff --stat` shows only scope-class paths + the migration.
- [ ] Local hit of `GET /api/cron/daily-leads` (no `CRON_SECRET` set) runs a real
      rotation, creates leads, updates `CronState` — paste the JSON response and
      the row state in the PR.
- [ ] `vercel.json` cron entry present; `.env.example` documents `CRON_SECRET`.
- [ ] Task 7 Instagram-lookup result written in the PR.
- [ ] Branch `feature/daily-lead-cron` off `origin/master`; `git fetch && git
      merge origin/master` before final, re-gate. PR against `master`.
- [ ] PR body: per-task summary, gate output, the local cron-run JSON, the
      Instagram-lookup finding, and a note that boss+user must add `CRON_SECRET`
      to Vercel and confirm the first scheduled run.

---

## 5. Review checklist (boss)

1. `git diff --stat` — only scope-class paths. `src/lib/places.ts` and
   `search/route.ts` **untouched**.
2. `LEAD_TARGETS` — 94 entries, `barber`/`salon` only, covers the NYC + LI list;
   `rotateTargets` wrap logic correct and tested.
3. `leadCron.ts` pure — no Prisma/fetch imports. `qualifies` = not-HAS_SITE +
   phone. `selectNewLeads` dedupes and excludes known ids and null placeId.
4. Route: auth gate on `CRON_SECRET` (bearer), `MAX_SEARCHES_PER_RUN` respected,
   per-target try/catch, breaks at `DAILY_LEAD_GOAL`, `CronState` written once at
   the end, `maxDuration`/`dynamic` set.
5. Leads created (not upserted) with `source: "GOOGLE_PLACES"`, `LEAD_FOUND`
   events emitted, `instagramHandle` auto-filled from URL only.
6. `vercel.json` schedule is `0 17 * * *`; migration is one table, no data.
7. Gate evidence + the local run's JSON + `CronState` row in the PR.

---

## Next track (queued, spec after this lands)

- **Track 3 — `/today` queue.** The 25 freshest `NEW` leads with a contact
  method (phone or IG handle), best channel shown per lead, one-tap
  DM/email/call, "Mark contacted" → `LEAD_CONTACTED` + drops off the list,
  yesterday's uncontacted carried over. Multi-channel — not IG-only like the
  current `/outreach` console. Informed by Task 7's Instagram-lookup finding.
