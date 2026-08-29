# Feature plan: Migrate Lead Finder to Places API (New)

**Status:** specced, not started
**Assignee:** parallel agent — "Track A"
**Scope class:** `src/lib/places.ts`, `src/lib/places.test.ts`, and a note in
`.env.example` + `docs/`. **Nothing else.** Specifically **do not touch**
`src/lib/instagramLookup.ts` (a parallel agent owns it), `src/app/api/leads/**`,
`src/lib/placesPhotos.ts`, or any `/leads` page/component (another agent owns
those).

---

## 1. Goal

Replace the legacy Google Places endpoints in `src/lib/places.ts` with **Places
API (New)** (`places.googleapis.com/v1`), so a lead search is **one request per
category** instead of one search + up to 60 per-place Details calls, and
pagination actually works.

### Why

`findBusinessesViaGooglePlaces` today:
1. calls legacy `textsearch`/`nearbysearch` (returns place_ids only, no website),
2. then fires a `Promise.all` of legacy `place/details` calls — one per result —
   just to get `website`, `phone`, `rating`, `user_ratings_total`,
3. and its `next_page_token` pagination is documented in-file as unreliable
   ("never became valid even after 12s" on a real project).

Places API (New) `places:searchText` returns `websiteUri`,
`nationalPhoneNumber`, `rating`, and `userRatingCount` **inline** via a field
mask, and its `pageToken` pagination is reliable. Net: ~60 fewer HTTP calls per
search, faster, and it can actually reach page 2–3.

### Non-goals

- No change to `findBusinesses`'s **signature or behaviour contract** — same
  params `(city, category, radiusMiles?)`, same `RawBusiness[]` return shape,
  same MOCK fallback when there's no key or the API errors.
- No change to `extractInstagramHandle`, `scoreWebsite`, `RawBusiness`,
  `WebsiteStatus`, or the mock-data generators — they're imported elsewhere and
  stay byte-for-byte unless a type genuinely must widen (call it out if so).
- No caller changes. `src/app/api/leads/search/route.ts` must work untouched.
- No new dependency. Use `fetch`.
- Not migrating `placesPhotos.ts` (Places Photos) — separate module, separate task.

---

## 2. Operator prerequisite (document, don't code around)

Places API (New) is a **separate API** from the legacy one and must be enabled
in Google Cloud (APIs & Services → enable "Places API (New)"). It uses the
**same** `GOOGLE_PLACES_API_KEY` already in `.env`. Until it's enabled, the New
endpoint returns HTTP 403 — the code's fallback chain (below) handles that
gracefully, but searches will be degraded until an operator flips it on.

Add this to `.env.example` (near the `GOOGLE_PLACES_API_KEY` line) and a short
paragraph to `docs/` (a new `docs/GOOGLE-APIS.md`, or append to an existing
setup doc if there is one — check first).

---

## 3. Tasks

### Task 1 — new-API search path

In `src/lib/places.ts`, add `findBusinessesViaPlacesNew(city, category, apiKey,
radiusMiles?)` returning `RawBusiness[]`.

- **Text search:** `POST https://places.googleapis.com/v1/places:searchText`
  - Headers: `Content-Type: application/json`, `X-Goog-Api-Key: <apiKey>`,
    `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount`
  - Body: `{ "textQuery": "<category> in <city>", "pageSize": 20 }`
  - Response: `{ places?: [...], nextPageToken?: string }`
- **Radius search** (`radiusMiles` given and > 0): geocode `city` first (keep the
  existing `geocode()` helper and the legacy Geocoding endpoint — it is not
  deprecated), then add to the body:
  `"locationRestriction": { "circle": { "center": { "latitude": lat, "longitude": lng }, "radius": <meters, min(miles*1609.34, 50000)> } }`
- **Pagination:** follow `nextPageToken` (pass it as `"pageToken"` in the next
  POST body, all other params unchanged) up to `MAX_PLACES_PAGES` (3) / 60
  results. No artificial delay is needed for the New API's token, but guard the
  loop with the page cap and a "stop if a page errors, keep what we have" rule,
  same resilience posture as the current legacy code.
- **Map** each `place` → `RawBusiness`:
  - `name` ← `place.displayName?.text ?? ""`
  - `category` ← the passed-in `category` (as today)
  - `address` ← `place.formattedAddress ?? ""`
  - `city` ← the passed-in `city`
  - `phone` ← `place.nationalPhoneNumber` (undefined if absent)
  - `existingUrl` ← `place.websiteUri`
  - `rating` ← `place.rating`
  - `reviewCount` ← `place.userRatingCount`
  - `placeId` ← `place.id ?? \`${name}-${address}\``
  - `source: "GOOGLE_PLACES"`
- On a non-OK HTTP status or a network throw: **throw** (so the caller's
  try/catch triggers the fallback). Include the HTTP status and any
  `error.message` from the JSON body in the thrown error, like the legacy code.

### Task 2 — fallback chain in `findBusinesses`

Rework the existing `findBusinesses` so the order is:

1. no `apiKey` → `mockBusinessesFor(city, category)` (unchanged)
2. try `findBusinessesViaPlacesNew(...)`
3. on throw: `console.warn` a one-liner (if the error looks like a 403, say
   "Places API (New) may not be enabled — see docs/GOOGLE-APIS.md"), then try the
   **existing** `findBusinessesViaGooglePlaces(...)` (legacy) as a second tier
4. on throw again: `console.error` + `mockBusinessesFor(...)` (unchanged final
   fallback)

Keep the legacy function and all its helpers (`fetchAllPlacesPages`, etc.) in
the file — they're the tier-2 fallback now, not dead code. Add a short comment
at the top of the legacy function saying so.

### Task 3 — tests (`src/lib/places.test.ts`)

The file currently only covers `extractInstagramHandle` / `scoreWebsite` (keep
those). Add a `describe("findBusinesses")` block using a **mocked `fetch`**
(`vi.stubGlobal("fetch", vi.fn()...)` or `vi.spyOn(globalThis, "fetch")`;
`vi.restoreAllMocks()` in `afterEach`). No real network.

Cover:
- **new-API happy path:** one `searchText` response with 2 places (one with a
  website, one without) → `findBusinesses("Austin, TX", "barber")` returns 2
  `RawBusiness` with the fields mapped correctly, `source: "GOOGLE_PLACES"`, and
  **exactly one** `fetch` call (no Details N+1).
- **pagination:** first response has `nextPageToken`, second doesn't → results
  concatenated, `pageToken` sent on the 2nd call, stops at 2 pages.
- **page cap:** responses always include `nextPageToken` → stops at
  `MAX_PLACES_PAGES` (3) calls, doesn't loop forever.
- **radius search:** `radiusMiles: 5` → a geocode call happens first, then
  `searchText` body includes a `locationRestriction.circle` with radius in
  metres, capped at 50 000 for an over-cap mileage.
- **fallback to legacy:** new-API `fetch` resolves 403 → the legacy
  `textsearch` + `details` path runs and its result is returned (mock enough
  legacy responses to prove the tier-2 path fires).
- **fallback to mock:** both new and legacy throw → returns
  `mockBusinessesFor(...)` output (assert shape / `source: "MOCK"`).
- **no key:** `GOOGLE_PLACES_API_KEY` unset (`vi.stubEnv`) → mock, zero `fetch`
  calls.

Match the repo's test conventions (`TESTING.md`): `describe` per function, `it`
names as sentences, assert real values.

### Task 4 — env + docs

- `.env.example`: note that `GOOGLE_PLACES_API_KEY` now also needs **Places API
  (New)** enabled, same key.
- `docs/GOOGLE-APIS.md` (new, short) or append to the existing setup doc: which
  Google APIs LaunchLocal uses (Places API New, Places API legacy as fallback,
  Geocoding, Places Photos, Custom Search for handle lookup), which env var,
  and the "enable Places API (New)" step.

---

## 4. Edge cases

- `place.displayName` is an object `{ text, languageCode }`, not a string — use
  `.text`.
- A place with no `websiteUri` → `existingUrl: undefined` → `scoreWebsite`
  already returns `"NONE"`. Don't synthesize a URL.
- `rating` / `userRatingCount` absent on a brand-new business → leave
  `undefined`, don't default to 0 (matches legacy).
- The New API caps `pageSize` at 20 and total results around 60 — don't try to
  request more.
- Geocoding failure on a radius search → throw (caller falls back), same as today.
- Keep `MAX_RADIUS_METERS` (50 000) enforcement.

---

## 5. Definition of done

- [ ] `npm test` green — new `findBusinesses` tests included, all prior tests
      still pass.
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] `git diff --stat` shows only: `src/lib/places.ts`, `src/lib/places.test.ts`,
      `.env.example`, `docs/GOOGLE-APIS.md` (or the existing doc).
- [ ] `findBusinesses` signature and `RawBusiness` shape unchanged;
      `src/app/api/leads/search/route.ts` untouched and still compiles.
- [ ] `extractInstagramHandle` / `scoreWebsite` untouched.
- [ ] Branch `feature/places-api-new` off `origin/master`, PR against `master`,
      not merged. PR body: what changed, gate output, `git diff --stat`, and a
      one-line note that an operator must enable Places API (New).

---

## 6. Review checklist (boss)

- New-API request shape correct (field mask, body, pagination token as body param).
- Fallback chain is new → legacy → mock, each tier logged, legacy code retained.
- No Details N+1 in the new path — verified by the "exactly one fetch" test.
- Signature/þcontract stability — search route diff is empty.
- Tests mock fetch, assert real mapped values, cover all fallback tiers.
