# Feature plan: Migrate Places Photos to Places API (New)

**Status:** specced, not started
**Assignee:** Agent 2 — "Track: Photos"
**Scope class:** `src/lib/placesPhotos.ts`, `src/lib/placesPhotos.test.ts`, and
a one-row update to `docs/GOOGLE-APIS.md`. **Nothing else.** Keep
`fetchPlacePhotoRefs` and `fetchPlacePhotoBytes` signatures identical so
`src/app/api/sites/route.ts` and `src/app/api/sites/[id]/photos/route.ts` stay
untouched. Do not touch `places.ts` (shares nothing with this file), the funnel
work, or `instagramLookup.ts`.

---

## 1. Goal

Move `src/lib/placesPhotos.ts` off the legacy Places Photos endpoints
(`maps.googleapis.com/maps/api/place/...`) to **Places API (New)**
(`places.googleapis.com/v1`), the sibling of the lead-search migration that
already landed (PR #3). `docs/GOOGLE-APIS.md` currently lists this module as
"not yet migrated" — close that out.

### Why

Same reasons as the search migration: the legacy Places Photos API is on the
deprecated surface, and consolidating on the New API means one enabled API, one
auth style (`X-Goog-Api-Key` header), and richer inline metadata
(`authorAttributions` as structured data instead of HTML blobs to regex).

### Non-goals

- No change to `fetchPlacePhotoRefs(placeId, apiKey)` or
  `fetchPlacePhotoBytes(ref, apiKey, maxWidth?)` **signatures** — callers must
  not need edits. (`ref` just means "photo resource name" now instead of
  "photo_reference"; both are opaque strings to the caller.)
- No change to `ParsedPlacePhotos` (`{ refs: string[]; attribution: string }`).
- Not touching the site-photo routes, the editor, or attribution rendering.
- Keep the legacy functions as a fallback tier (same posture as `places.ts`).

---

## 2. Places API (New) photo flow

1. **Place lookup for photo metadata:**
   `GET https://places.googleapis.com/v1/places/<PLACE_ID>`
   Headers: `X-Goog-Api-Key: <apiKey>`,
   `X-Goog-FieldMask: photos`
   Response: `{ photos?: [{ name, widthPx, heightPx, authorAttributions?: [{ displayName, uri, photoUri }] }] }`
   - `name` is the photo **resource name**, e.g.
     `places/ChIJ.../photos/AeJbb3...` — this is what replaces `photo_reference`.
2. **Photo bytes:**
   `GET https://places.googleapis.com/v1/<PHOTO_RESOURCE_NAME>/media?maxWidthPx=<n>&key=<apiKey>`
   → 302s to the real image host and returns image bytes (same behaviour as the
   legacy `place/photo` endpoint). `key` goes in the query string for this one
   (the media endpoint accepts it there; header also works — either is fine, be
   consistent).

---

## 3. Tasks

### Task 1 — `parsePlacePhotos` reads the New shape

Rework `parsePlacePhotos(result, max=6)` to read the New place response:

- photos from `result.photos` (array), same guard style.
- each photo's ref is `p.name` (string, non-empty) — push to `refs`.
- attribution: collect `p.authorAttributions?.[].displayName` (already plain
  text — **no HTML, so `stripTags` is not needed on this path**). Same output
  format: `"Photos via Google — <names joined>"`, or `"Photos via Google"` when
  there are refs but no names, or `""` when no refs.
- Keep `stripTags` / `ENTITIES` in the file **only if** the legacy fallback path
  still needs them (it does — see Task 3). If nothing uses them after the
  refactor, delete them.

### Task 2 — new-API fetch functions

- `fetchPlacePhotoRefsViaNew(placeId, apiKey): Promise<ParsedPlacePhotos>` —
  the `GET /v1/places/<id>` call with the `photos` field mask, then
  `parsePlacePhotos(json)`. Throw on non-OK (include status + any
  `json.error.message`), like the search migration does.
- `fetchPlacePhotoBytesViaNew(resourceName, apiKey, maxWidth=1600): Promise<Buffer | null>` —
  `GET /v1/<resourceName>/media?maxWidthPx=<maxWidth>&key=<apiKey>`; return
  `null` on non-OK or a non-`image/*` content-type (same contract as the
  current `fetchPlacePhotoBytes`).

### Task 3 — wire the fallback into the exported functions

Keep the current legacy bodies, renamed to `...ViaLegacy`. Then:

- `fetchPlacePhotoRefs(placeId, apiKey)`: try `...ViaNew`; on throw, `console.warn`
  (403 → mention enabling Places API (New), point at `docs/GOOGLE-APIS.md`) and
  try `...ViaLegacy`; let a second throw propagate (callers already handle it —
  `api/sites/[id]/photos/route.ts` catches and returns a 502-ish message).
- `fetchPlacePhotoBytes(ref, apiKey, maxWidth?)`: try `...ViaNew`; if it returns
  `null` **or** throws, fall back to `...ViaLegacy(ref, ...)`. Note: a legacy
  `photo_reference` and a New `resourceName` are different strings — but within
  one draft/editor request the ref always comes from the matching `...Refs`
  call, so new-refs → new-bytes and legacy-refs → legacy-bytes stay paired.
  Just make sure `fetchPlacePhotoRefs` and `fetchPlacePhotoBytes` fall back
  **together** (if refs came from legacy, bytes must go to legacy). Simplest:
  have `fetchPlacePhotoRefs` return which tier produced the refs and thread that
  through — or, cleaner, tag the ref strings (New ones already start with
  `places/`; legacy ones don't). Use that prefix check in `fetchPlacePhotoBytes`
  to route to the right tier instead of guessing. Document the check.

### Task 4 — tests (`src/lib/placesPhotos.test.ts`)

The current file only tests `parsePlacePhotos`. Update those to the New shape
and add fetch-mocked tests:

- `parsePlacePhotos` with New-shaped input: refs from `name`, attribution from
  `authorAttributions[].displayName`, the `max` cap, the no-attribution case,
  the empty/`null` cases (keep those).
- `fetchPlacePhotoRefs`: mocked `fetch` → a New `/v1/places/<id>` response →
  correct `{ refs, attribution }`, one call.
- `fetchPlacePhotoRefs` 403 → falls back to a mocked legacy
  `place/details/json` response, returns its parse.
- `fetchPlacePhotoBytes`: New `resourceName` (starts `places/`) → hits
  `/v1/.../media`, returns a Buffer; non-image content-type → `null`.
- `fetchPlacePhotoBytes` with a legacy-style ref (no `places/` prefix) → routes
  straight to the legacy `place/photo` endpoint.
- `fetchPlacePhotoBytes` New path returns null → legacy fallback fires.

Mock `fetch` with `vi.stubGlobal`; `vi.restoreAllMocks()` in `afterEach`. For
the bytes tests, mock `res.arrayBuffer()` and `res.headers.get("content-type")`.

### Task 5 — docs

Update the **Places Photos** row in `docs/GOOGLE-APIS.md` from "not yet
migrated" to describe the New flow (place lookup with `photos` field mask →
`/media` endpoint) with legacy as the fallback tier — matching how the Places
(New) and Places (legacy) rows already read.

---

## 4. Edge cases

- A place with no `photos` in the New response → `{ refs: [], attribution: "" }`,
  no throw (same as today).
- New `authorAttributions` may be absent even when photos exist → attribution
  `"Photos via Google"`.
- The `/media` endpoint returns bytes via a redirect — `fetch` follows redirects
  by default; don't set `redirect: "manual"`.
- Legacy `photo_reference` strings never start with `places/`; New resource
  names always do — that's the tier-routing signal in `fetchPlacePhotoBytes`.
- `maxWidth` default stays 1600; the draft call passes 640 and the editor passes
  the default — both must keep working.

---

## 5. Definition of done

- [ ] `npm test` green — updated + new `placesPhotos.test.ts`, all prior pass.
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] `git diff --stat` = only `src/lib/placesPhotos.ts`,
      `src/lib/placesPhotos.test.ts`, `docs/GOOGLE-APIS.md`.
- [ ] `fetchPlacePhotoRefs` / `fetchPlacePhotoBytes` signatures unchanged;
      `api/sites/route.ts` and `api/sites/[id]/photos/route.ts` untouched and
      still compile.
- [ ] Branch `feature/places-photos-new` off `origin/master`. `git fetch &&
      git merge origin/master` before the PR goes final. PR against `master`,
      land with `gh pr merge --merge` / the UI.
- [ ] PR body: what changed, gate output, `git diff --stat`, note that the same
      "enable Places API (New)" operator step already covers this.

---

## 6. Review checklist (boss)

- New photo flow correct: place lookup with `photos` field mask → resource name
  → `/media?maxWidthPx=`.
- `parsePlacePhotos` reads `name` + `authorAttributions[].displayName`; HTML
  stripping only on the retained legacy path.
- Tier routing in `fetchPlacePhotoBytes` uses the `places/` prefix, not a guess.
- Fallback: new → legacy per function, refs+bytes stay on the same tier.
- Caller routes show an empty diff.
