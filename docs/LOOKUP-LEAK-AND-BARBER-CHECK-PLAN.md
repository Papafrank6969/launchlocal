# Plan: Instagram-lookup detail leak fix + barbershop design check

**Status:** specced, not started
**Assignee:** Agent 3 — two small independent pieces
**Scope class:**
- Piece A: `src/app/api/leads/[id]/lookup-instagram/route.ts`, and if needed
  `src/lib/instagramLookup.ts` + its test.
- Piece B: `docs/BARBERSHOP-DESIGN-FINDINGS.md` (new) **only** — no code.

Do not touch `places.ts`, `placesPhotos.ts`, the funnel work, `/stats`, or
`designSystems.ts` (Piece B is a report that *feeds* a future design change, it
does not make one).

---

## Piece A — stop leaking the API key in the lookup error response

### Why

`src/app/api/leads/[id]/lookup-instagram/route.ts` returns `result.detail` (and,
in the catch block, `err.message`) in the JSON response body for the `error`
case. The Custom Search request URL carries `?key=<GOOGLE_CUSTOM_SEARCH_API_KEY>`,
and a network-layer / undici error message can include that URL — so the key can
end up in a response the browser sees. Local single-user tool, low real risk,
but it's sloppy and trivial to fix.

### Task

- In the route's `error` branch and its outer `catch`:
  - `console.error("[instagram-lookup]", <the detail / err>)` **server-side**.
  - Return `{ error: "Instagram lookup failed — enter the handle manually.",
    reason: "error" }` — **no `detail` field** in the body.
- `src/lib/instagramLookup.ts`: the `error` result variant **keeps**
  `{ status: "error"; detail: string }` — that's useful for the server log. Just
  don't forward `detail` to the client. If you'd rather also scrub the key at
  the source, add a tiny `redactKey(s: string): string` that replaces
  `key=<value>` with `key=REDACTED` and run `detail` through it before it's
  logged too — optional, your call, note which way you went.
- Tests: if `instagramLookup.test.ts` asserts anything about `detail` contents,
  keep those (the lib still produces `detail`). There are no route tests; don't
  add a harness. If you add `redactKey`, unit-test it (has a key param → redacted;
  no key param → unchanged).

### Done when

`npm test` / `tsc` / `lint` green; `git diff --stat` = the route (+ optionally
`instagramLookup.ts` + its test); the `error` response body no longer contains
`detail`; server still logs the real reason.

---

## Piece B — does `technical-precision` actually look wrong on a barbershop site?

### Background

On 2026-08-29 `barber` / `barbershop` were routed to the `technical-precision`
design system (Oswald + Barlow, deep-blue primary, burnt-orange accent,
full-bleed hero, near-black neutral). `docs/DESIGN-PROCESS.md` (2026-08-29 entry)
flags the blue primary as a possible mismatch — "revisit if operators report the
built sites read too 'contractor'." Nobody has actually *looked* at a built
barbershop site yet. This piece is that look.

### Task (investigation + report — no code change)

1. Start the app: `npm run dev` (needs `npx prisma migrate dev` first in a fresh
   clone). No API keys needed — the Lead Finder falls back to generated sample
   data.
2. On `/leads`, search a city with `barber` selected → sample data returns mock
   barbershops. Draft a site from one (the "Draft site" button). Open the
   published preview at `/s/<slug>`.
3. Look at it against `docs/SITE-QUALITY-CHECKLIST.md` and the core bar ("looks
   like a real barbershop made it, not a template mill"). Specifically judge:
   - Does the deep-blue primary read as "plumber/HVAC contractor" rather than
     "barbershop"?
   - Do Oswald headings + full-bleed hero + near-black neutral carry the
     barbershop feel, or fight it?
   - Try 2–3 of the 6 color variants (the editor's accent swatches) — does any
     variant land closer?
   - Compare mentally to `crafted-artisan` (Zilla Slab, warm browns) and
     `minimal-luxury` (Cormorant, black+gold) — would either fit better, or is
     the issue just the accent hue within `technical-precision`?
4. Capture 2–4 screenshots (hero, services, one variant).
5. Write `docs/BARBERSHOP-DESIGN-FINDINGS.md`:
   - what you observed (with the screenshots referenced/attached in the PR)
   - a clear recommendation, one of:
     a) **keep as-is** — it's fine, close the DESIGN-PROCESS.md note;
     b) **bias the variant pick** for grooming categories toward a warmer accent
        (small, stays in `technical-precision`);
     c) **re-route** to `crafted-artisan` or `minimal-luxury`;
     d) **new/!sharpened system** needed (least likely — the standing call is the
        12 cover the space).
   - enough detail that the boss can turn the recommendation into a spec without
     re-doing the investigation.

If you **can't run the app** in your environment, don't fake it — write that in
the findings doc and hand back; the boss will do this piece.

### Done when

`docs/BARBERSHOP-DESIGN-FINDINGS.md` exists with observations + a specific
recommendation (or a clear "couldn't run the app"). No code, no `designSystems.ts`
change. `git diff --stat` = just the new doc.

---

## Delivery

One branch `feature/lookup-leak-and-barber-check`, off `origin/master`. Both
pieces can go in one PR (they're unrelated but both tiny) or two commits. `git
fetch && git merge origin/master` before final. PR against `master`, land with
`gh pr merge --merge`. PR body: piece A diff + gate; piece B recommendation
summary + screenshots.

## Review checklist (boss)

- A: no `detail` in the client `error` body; server-side log still has it;
  `redactKey` (if added) tested.
- B: findings doc has concrete observations and a single clear recommendation;
  no `designSystems.ts` touched.
