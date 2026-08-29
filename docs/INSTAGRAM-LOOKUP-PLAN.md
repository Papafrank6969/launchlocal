# Feature plan: Instagram handle lookup — typed failure modes + tests + retest

**Status:** specced, not started
**Assignee:** parallel agent — "Track B"
**Scope class:** `src/lib/instagramLookup.ts`, a new
`src/lib/instagramLookup.test.ts`, and
`src/app/api/leads/[id]/lookup-instagram/route.ts`. **Nothing else.** Specifically
**do not touch** `src/lib/places.ts` (a parallel agent owns it — you only
*import* `extractInstagramHandle` from it, don't edit it) or any `/leads`
page/component (another agent owns those).

---

## 1. Goal

Make the Instagram-handle lookup **distinguish its failure modes** and add the
test coverage it's completely missing, so that when an operator clicks "Find it"
they (and we) can tell *"the Custom Search API is disabled"* from *"the API
worked, found nothing"* from *"not configured"*.

### Why

`lookupInstagramHandle` currently returns a 3-way union
(`found` / `not_found` / `not_configured`) and **throws** for everything else.
The route turns a throw into a generic 502 `{ error: <message> }`. In practice
the Custom Search API has been returning `403 PERMISSION_DENIED: This project
does not have access to Custom Search JSON API` across multiple fresh keys — and
right now that's indistinguishable from a transient network error or a quota
hit. There is also **no test file** for this module at all.

This is the groundwork for a later `/leads` UX pass (not in this task — that file
is owned by another agent): once the lib reports *why* it failed, the page can
show "lookup unavailable — enter the handle manually" instead of a red error.

### Non-goals

- **No `/leads` page changes.** The button/UX work is a follow-up task after the
  Lead Backlog PR merges.
- No change to `extractInstagramHandle` (imported from `places.ts`).
- No new dependency, no Custom Search query-shape change (still
  `site:instagram.com "<name>" "<city>"`, still `num=3`).
- Don't try to "fix" the underlying Google permission issue in code — it's a
  cloud-console problem. Just report it clearly.

---

## 2. Tasks

### Task 1 — widen the result type

In `src/lib/instagramLookup.ts`, change `InstagramLookupResult` to:

```ts
export type InstagramLookupResult =
  | { status: "found"; handle: string }
  | { status: "not_found" }
  | { status: "not_configured" }        // no API key / no CSE id
  | { status: "api_disabled" }          // 403 / SERVICE_DISABLED / PERMISSION_DENIED
  | { status: "rate_limited" }          // 429 / quota
  | { status: "error"; detail: string }; // anything else — network, 5xx, malformed
```

`lookupInstagramHandle` should **no longer throw** for API failures — it returns
one of these. (A genuinely unexpected programming error can still throw, but
every HTTP outcome is a return.)

Classification from the Custom Search response:
- `!apiKey || !cx` → `not_configured` (unchanged).
- `res.ok` and an item's link yields a handle via `extractInstagramHandle` →
  `found`.
- `res.ok`, no usable item → `not_found` (unchanged).
- `res.status === 403`, or the JSON body's `error.status` is `PERMISSION_DENIED`
  / `error.errors[].reason` is `SERVICE_DISABLED` or `accessNotConfigured` →
  `api_disabled`.
- `res.status === 429`, or `error.status === "RESOURCE_EXHAUSTED"`, or a
  `reason` of `rateLimitExceeded` / `quotaExceeded` → `rate_limited`.
- any other non-OK, JSON parse failure, or fetch throw → `error` with a short
  `detail` string (status + `error.message` if present; the caught error's
  message for a network throw).

Keep the doc comment accurate; note that `api_disabled` is the state the project
has actually been stuck in.

### Task 2 — route maps each status to a sensible response

`src/app/api/leads/[id]/lookup-instagram/route.ts`:

| status | HTTP | body |
|---|---|---|
| `found` | 200 | `{ lead: <updated>, found: true }` |
| `not_found` | 200 | `{ lead, found: false, reason: "not_found" }` |
| `not_configured` | 400 | `{ error: "Instagram lookup isn't configured — add GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID to .env.", reason: "not_configured" }` |
| `api_disabled` | 503 | `{ error: "The Custom Search API is disabled for this Google project — enable 'Custom Search API' in the Cloud console, or enter the handle manually.", reason: "api_disabled" }` |
| `rate_limited` | 429 | `{ error: "Instagram lookup is rate-limited right now — try again later or enter the handle manually.", reason: "rate_limited" }` |
| `error` | 502 | `{ error: "Instagram lookup failed — enter the handle manually.", reason: "error", detail: <the detail string> }` |

Only the `found` branch writes to the DB (`db.lead.update`), as today. Add a
`reason` field to every non-found JSON so the client can branch without string-
matching the message.

Remove the now-dead `try/catch` around `lookupInstagramHandle` that produced the
502 — or keep a thin one that maps a true throw to the `error` row. Your call;
note which in the PR.

### Task 3 — tests (`src/lib/instagramLookup.test.ts`, new)

Mock `fetch` (`vi.spyOn(globalThis, "fetch")` / `vi.stubGlobal`), `vi.stubEnv`
for the two env vars, `vi.restoreAllMocks()` + `vi.unstubAllEnvs()` in
`afterEach`. Cover:

- `not_configured` when either env var is missing — and **no** `fetch` call.
- `found` — a Custom Search body whose first item link is
  `https://www.instagram.com/bella.lashes/` → `{ status: "found", handle: "bella.lashes" }`.
- `found` skips an item whose link is a reserved path
  (`instagram.com/explore/...`) and uses the next real one.
- `not_found` — `res.ok`, `items: []`.
- `api_disabled` — (a) `res.status === 403`; (b) `res.ok === false` with body
  `{ error: { status: "PERMISSION_DENIED", message: "...Custom Search JSON API" } }`;
  (c) body with `error.errors: [{ reason: "SERVICE_DISABLED" }]`. All three →
  `{ status: "api_disabled" }`.
- `rate_limited` — `res.status === 429`, and separately `error.status ===
  "RESOURCE_EXHAUSTED"`.
- `error` — a 500, a malformed-JSON response, and a `fetch` that rejects →
  `{ status: "error", detail: <non-empty string> }`.
- the request URL contains `site:instagram.com`, the quoted name, the quoted
  city, and `num=3` (one assertion on the composed query).

### Task 4 — no route integration test

The repo has no API-route test harness yet (`TESTING.md`). Don't add one. The
lib tests above are the coverage. If there's an existing test that asserts the
old 502 behaviour, update it.

---

## 3. Edge cases

- The Custom Search error body shape varies: sometimes `{ error: { code, message,
  status, errors: [{ reason, domain }] } }`, sometimes just `{ error: { message } }`.
  Read defensively — optional-chain everything, fall through to `error` status if
  the shape is unrecognised but the HTTP status isn't a clean 403/429.
- `extractInstagramHandle` already rejects reserved paths — don't re-implement
  that logic, just call it.
- Don't log the API key. If you log the failure detail, make sure the key
  (which is in the request URL) isn't in the logged string.
- A `found` result still needs the lead to exist — the route's existing
  `db.lead.findUnique` 404 guard stays.

---

## 4. Definition of done

- [ ] `npm test` green — new `instagramLookup.test.ts` included, all prior pass.
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] `git diff --stat` shows only: `src/lib/instagramLookup.ts`,
      `src/lib/instagramLookup.test.ts`,
      `src/app/api/leads/[id]/lookup-instagram/route.ts`.
- [ ] `places.ts` untouched. No `/leads` page/component changes.
- [ ] Branch `feature/instagram-lookup-status` off `origin/master`, PR against
      `master`, not merged. PR body: what changed, gate output, `git diff --stat`.
- [ ] PR body also reports the result of a **live retest** if the agent can run
      one (`GOOGLE_CUSTOM_SEARCH_*` present in `.env` + network): call the real
      endpoint once with a sample query and paste the status/error — this tells
      the boss whether the Google-side issue has cleared. If no key or no
      network, say so.

---

## 5. Review checklist (boss)

- The 403 / PERMISSION_DENIED / SERVICE_DISABLED cases all land on `api_disabled`,
  not `error` — this is the whole point.
- No throw for HTTP failures; every branch returns a typed status.
- Route adds `reason` to every non-found body; only `found` writes the DB.
- Tests mock fetch + env, assert real statuses, cover all three `api_disabled`
  body shapes.
- API key never logged.
