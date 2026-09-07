# Feature plan: Track C-D — Google Places data retention

**Status:** specced, not started
**Assignee:** an agent with a working local DB (boss clone can't run `prisma
migrate dev` — SQLite `file:` URL vs the `postgresql` provider, no `DIRECT_URL`)
**Scope class:** `prisma/schema.prisma` + `prisma/migrations/**`,
`src/lib/placesRetention.ts` (new) + test, `src/lib/places.ts` (add one
function, no change to existing behaviour), `src/app/api/cron/refresh-places/route.ts`
(new), `vercel.json`, `docs/GOOGLE-APIS.md`, `docs/BRAND-AND-COMPLIANCE-STANDARDS.md`
(§2.5 — mark F-2 done), `docs/COMPLIANCE-AUDIT-2026-09.md` (status).
**Nothing else** — do not touch `src/lib/leadCron.ts`, the daily-leads route,
`templates.tsx`, or any `/s/[slug]` page.

---

## 1. Goal

Stop indefinitely caching Google Places content. Google Maps Platform Terms
§3.2.3 permit storing **Place IDs** forever but everything else (name, address,
phone, rating, review count, review text, photos) for at most **30 consecutive
days** — then it must be refreshed or deleted. Right now `Lead` rows and the
Google fields on `Site` never expire. Finding **F-2 (P0)** in the audit.

### Non-goals

- No change to how leads are *found* or *displayed*.
- No UI. This is a background job + a schema column.
- Not touching operator-entered fields (`category`, `city`, outreach state) or
  a `Site`'s own editable content — only the Google-derived fields.
- No re-architecture to fetch Places data live at render time (a bigger change;
  the 30-day refresh job is the sanctioned mitigation).

---

## 2. Tasks

### Task 1 — schema: `Lead.placesRefreshedAt`

`prisma/schema.prisma`, on `model Lead`:

```prisma
placesRefreshedAt DateTime @default(now())
```

`Site` already has `googleReviewsUpdatedAt DateTime?` — reuse it as the
staleness marker for the Google fields on `Site` (reviews, rating, reviewCount,
mapsUrl). No new `Site` column.

`npx prisma migrate dev --name add_lead_places_refreshed_at`, commit the folder.
Existing rows get `now()` as the default — acceptable (one 30-day grace window
from the migration date; the job catches them next cycle).

### Task 2 — `src/lib/placesRetention.ts` (new, pure — no Prisma/fetch/React)

```ts
export const PLACES_MAX_AGE_DAYS = 30;
/** An untouched NEW lead we can't refresh (place gone) is deleted past this age. */
export const LEAD_ABANDON_DAYS = 120;

export type RetentionLead = {
  outreachStatus: "NEW" | "CONTACTED" | "RESPONDED" | "WON" | "LOST";
  source: "GOOGLE_PLACES" | "MOCK";
  placeId: string | null;
  placesRefreshedAt: string | Date;
  createdAt: string | Date;
  hasSite: boolean;
};

export type RetentionAction = "keep" | "refresh" | "downgrade" | "delete";
```

**`ageDays(then: string | Date, now?: Date): number`** — whole days elapsed.

**`isStale(refreshedAt, now?, maxAgeDays = PLACES_MAX_AGE_DAYS): boolean`**

**`retentionAction(lead: RetentionLead, now = new Date()): RetentionAction`**
- `MOCK` source, or not stale → `"keep"`.
- stale + `NEW` + `GOOGLE_PLACES`:
  - has `placeId` → `"refresh"`.
  - no `placeId` + `hasSite` → `"downgrade"` (can't refresh, but a draft exists — keep the name, drop the stale aggregates).
  - no `placeId` + no site + `createdAt` older than `LEAD_ABANDON_DAYS` → `"delete"`.
  - no `placeId` + no site + newer than that → `"downgrade"` (give the operator time).
- stale + past `NEW` (`CONTACTED`/`RESPONDED`/`WON`/`LOST`) → `"downgrade"`.
  The operator now has a business relationship: name/address/phone/email are
  legitimately retained as first-party CRM contact data; `rating` +
  `reviewCount` are pure Places content with no relationship basis, so they go.

**Tests** (`placesRetention.test.ts`): `ageDays`/`isStale` boundaries (29 vs 30
vs 31 days); every `retentionAction` branch including the `hasSite` and
`LEAD_ABANDON_DAYS` splits and the `MOCK` short-circuit.

### Task 3 — `src/lib/places.ts`: `fetchPlaceById`

Add (does not touch `findBusinesses` or any existing export):

```ts
/**
 * Re-fetch a single place's current details by Place ID, for the 30-day
 * retention refresh. Returns null when Google says the place no longer exists
 * (NOT_FOUND / INVALID_REQUEST) so the caller can delete the row. Places API
 * (New) first, legacy Details as the fallback — same pattern as findBusinesses.
 */
export async function fetchPlaceById(
  placeId: string,
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
): Promise<Pick<RawBusiness, "name" | "address" | "phone" | "existingUrl" | "rating" | "reviewCount"> | null>
```

- New API: `GET https://places.googleapis.com/v1/places/{placeId}` with
  `X-Goog-FieldMask: id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount`.
- 404 / `NOT_FOUND` → `null`. Other non-OK → throw (caller logs + skips, keeps
  the row for next run — never delete on a transient error).
- Legacy fallback: `place/details/json?fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total`.
- No `apiKey` → `null` (local dev without a key just no-ops the job).

Unit-test the response parsing for both shapes + the not-found path with a
mocked `fetch` (there's prior art — see `places.test.ts`).

### Task 4 — `src/app/api/cron/refresh-places/route.ts` (new)

`export const dynamic = "force-dynamic"; export const maxDuration = 60;`

`GET(req)`:

1. **Auth** — same block as `daily-leads/route.ts`: if `CRON_SECRET` set,
   require `Authorization: Bearer <secret>` else 401.
2. **Stale NEW leads** — `db.lead.findMany({ where: { outreachStatus: "NEW",
   source: "GOOGLE_PLACES", placesRefreshedAt: { lt: cutoff(30) } },
   include: { _count: { select: { sites: true } } }, take: 60,
   orderBy: { placesRefreshedAt: "asc" } })`.
   For each, `retentionAction({ ...lead, hasSite: lead._count.sites > 0 })`:
   - `refresh` → `fetchPlaceById(lead.placeId!)`:
     - object → `db.lead.update` name/address/phone/existingUrl/rating/reviewCount,
       `websiteStatus: scoreWebsite(existingUrl)`,
       `instagramHandle: extractInstagramHandle(existingUrl) ?? lead.instagramHandle`,
       `placesRefreshedAt: now`. `refreshed++`.
     - `null` (place gone) → if `hasSite` treat as `downgrade`; else `db.lead.delete`. `deleted++`.
     - thrown → `console.error`, leave the row, `errors++`.
   - `downgrade` → `db.lead.update({ data: { rating: null, reviewCount: null, placesRefreshedAt: now } })`. `downgraded++`.
   - `delete` → `db.lead.delete`. `deleted++`.
   - `keep` → nothing.
3. **Stale non-NEW leads** — `where: { outreachStatus: { not: "NEW" }, source:
   "GOOGLE_PLACES", placesRefreshedAt: { lt: cutoff(30) } }, take: 100`.
   `db.lead.updateMany` in slices? No — need per-row `retentionAction` (all
   resolve to `downgrade` here) so a simple loop: `update({ data: { rating: null,
   reviewCount: null, placesRefreshedAt: now } })`. `downgraded++`.
3b. **Old contact submissions** (folded in from audit F-12 / C-E) —
   `db.contactSubmission.deleteMany({ where: { createdAt: { lt: cutoff(730) } } })`
   (24 months). `submissionsPurged = result.count`. One line, no per-row logic.
4. **Stale published-site Google data** — `db.site.findMany({ where: { status:
   "PUBLISHED", googleReviewsUpdatedAt: { not: null, lt: cutoff(30) } },
   take: 40 })`. For each with a `googlePlaceId ?? lead?.placeId`:
   - `fetchGoogleReviews(placeId, apiKey)` (existing):
     - success → `update` `googleReviewsJson`, `rating`, `reviewCount`,
       `googleMapsUrl`, `googleReviewsUpdatedAt: now`. `sitesRefreshed++`.
     - throw → `update` `googleReviewsJson: null`, `googleMapsUrl: null`,
       `rating: null`, `reviewCount: null`, `googleReviewsUpdatedAt: null` — the
       site stops showing stale Google content rather than keeping it. `sitesCleared++`.
   - no place ID → same clear path. `sitesCleared++`.
5. Wrap each of the four phases in its own `try/catch` so one failing phase
   doesn't abort the others.
6. Respond `200` `{ refreshed, deleted, downgraded, submissionsPurged, sitesRefreshed, sitesCleared, errors }`.

Helper: `cutoff(days: number) => new Date(Date.now() - days * 864e5)`.

### Task 5 — `vercel.json`

Add a second cron (Vercel Hobby allows 2):

```json
"crons": [
  { "path": "/api/cron/daily-leads", "schedule": "0 17 * * *" },
  { "path": "/api/cron/refresh-places", "schedule": "0 4 * * *" }
]
```

`0 4 * * *` = overnight, away from the afternoon lead run.

### Task 6 — docs

- `docs/GOOGLE-APIS.md`: new row / paragraph — a daily `refresh-places` cron
  keeps cached Places data inside the 30-day Maps Platform limit; it makes up to
  ~100 Details calls/run, well inside the free tier.
- `docs/BRAND-AND-COMPLIANCE-STANDARDS.md` §2.5: change "This is currently
  violated" → "Enforced by `/api/cron/refresh-places` (30-day refresh/purge)."
- `docs/COMPLIANCE-AUDIT-2026-09.md`: F-2 status → done; C-D → shipped.

---

## 3. Edge cases

- **Lead has a draft site, place goes away.** Never delete — `downgrade` (keep
  the name the operator's pitching, drop the stale rating).
- **Transient Google 5xx / rate limit.** Throw → row untouched, retried next
  run. Never delete or downgrade on an error, only on a definitive NOT_FOUND.
- **`GOOGLE_PLACES_API_KEY` unset (local).** `fetchPlaceById` returns null,
  `fetchGoogleReviews` throws → everything would look "gone". Guard: at the top
  of the route, if no key, skip phases 2 & 4 (the ones that need Google) and
  only run phase 3 (the pure downgrade of aggregates on contacted leads) — or
  just return early with `{ skipped: "no api key" }`. Pick the early return.
- **Cron double-fires.** Idempotent: a just-refreshed row has
  `placesRefreshedAt = now`, excluded from the next query.
- **Big backlog on first run.** `take` caps bound each run; the `orderBy:
  placesRefreshedAt asc` means oldest-first, so it drains steadily over a few
  days. Don't raise the caps to clear it in one shot (cost + 60s limit).
- **Mock leads** (`source: "MOCK"`, from a keyless dev search). `retentionAction`
  returns `keep` — never touched.

---

## 4. Definition of done

- [ ] `npm test` green (new `placesRetention` + `fetchPlaceById` tests).
- [ ] `npx tsc --noEmit` clean (run `npx prisma generate` after the schema
      edit), `npm run lint` clean.
- [ ] `npx prisma migrate dev --name add_lead_places_refreshed_at` ran; migration
      committed. `git diff --stat` = scope-class paths + the migration only.
- [ ] Local hit of `GET /api/cron/refresh-places` (no `CRON_SECRET`) against a
      seeded DB with a mix of fresh / >30-day NEW / >30-day contacted / >120-day
      abandoned leads — paste the JSON and the before/after row states in the PR.
- [ ] `vercel.json` has both cron entries.
- [ ] Docs updated (Task 6).
- [ ] Branch off `origin/master`; `git fetch && git merge origin/master` before
      final; re-gate. PR against `master`.
- [ ] PR body notes boss+user must confirm the new cron registers in Vercel and
      the first run's JSON looks sane.

---

## 5. Review checklist (boss)

1. `git diff --stat` — scope only. `findBusinesses` and every existing
   `places.ts` export byte-identical.
2. `placesRetention.ts` pure. `retentionAction` never returns `delete` for a
   lead with a site or one past `NEW`. `MOCK` always `keep`.
3. `fetchPlaceById` returns `null` only on definitive NOT_FOUND, throws on
   transient errors; New→legacy fallback; keyless → null.
4. Route: auth gate, keyless early-return, four phases each in `try/catch`,
   `take` caps present, `placesRefreshedAt`/`googleReviewsUpdatedAt` stamped on
   every write path, delete only via the vetted `retentionAction` result.
5. Migration is one column with a sane default, no data migration.
6. `vercel.json` schedule `0 4 * * *`. Docs mark F-2 closed.
