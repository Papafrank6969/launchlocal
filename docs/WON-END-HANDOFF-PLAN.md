# Feature plan: WON-end handoff

**Status:** specced, not started
**Assignee:** Agent 1 — single track (a Prisma migration serializes it; not splittable)
**Scope class:** `prisma/schema.prisma`, `prisma/migrations/**`,
`src/lib/handoff.ts` (new) + `src/lib/handoff.test.ts` (new),
`src/app/api/sites/[id]/handoff/route.ts` (new),
`src/app/api/sites/[id]/route.ts` (one line — add `customDomain` to the editable
field list, nothing else in that file),
`src/app/(app)/pipeline/page.tsx`, `src/components/HandoffPanel.tsx` (new).
**Nothing else.** Do not touch the builder pages, `templates.tsx`,
`designSystems.ts`, `/leads`, `/stats`, `places*`, `instagramLookup*`, the
outreach/follow-up libs or pages, or `siteVisibility.ts`.

---

## 1. Goal

Give the operator a concrete, tracked **delivery workflow** for the moment a lead
becomes `WON`: the steps to move the pitch site onto a real domain, and a
copy-pasteable client-facing handoff summary.

### Why

Today `WON` is just a status chip. `siteVisibility.ts` already flips the site
from noindex pitch-site to indexable the instant the lead is `WON` — but nothing
tells the operator what to *do*: point a domain, update the Google listing, send
the client something, arrange payment. The pipeline ends mid-air. This track adds
the missing last mile as a checklist that persists per site, plus the "here's
your live site" package the client actually receives.

### Non-goals

- **No hosting/DNS automation.** The checklist tracks steps the operator does by
  hand elsewhere (registrar, DNS, Google Business Profile). We record progress,
  we don't perform the actions.
- **No change to `siteVisibility.ts` or the noindex logic** — it already keys off
  `WON` and is correct. The `search-visible` checklist step is a *confirmation
  prompt* for the operator, not new gating.
- **No `/stats` funnel change.** `SITE_DELIVERED` events are emitted (Task 3) so a
  later track can add a "delivered" funnel stage; wiring it into `/stats` is out
  of scope here.
- **No builder-page surface.** The handoff panel lives only on `/pipeline`.
- No auth / client login / multi-user anything. The client gets a URL, not an
  account (the summary text says so explicitly).
- No email sending. "Send to client" means the operator copies the text and sends
  it themselves.

---

## 2. Tasks

### Task 1 — schema + migration

`prisma/schema.prisma`:

- Add to `enum EventType`: `SITE_DELIVERED`.
- Add to `model Site`: `customDomain String?` and `deliveredAt DateTime?`, plus
  the back-relation `handoffTasks HandoffTask[]`.
- New model:

  ```prisma
  model HandoffTask {
    id        String    @id @default(cuid())
    siteId    String
    site      Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)
    key       String
    done      Boolean   @default(false)
    doneAt    DateTime?
    order     Int       @default(0)
    createdAt DateTime  @default(now())
    updatedAt DateTime  @updatedAt

    @@unique([siteId, key])
  }
  ```

Run `npx prisma migrate dev --name add_site_handoff` (needs a `.env` with
`DATABASE_URL`; a fresh clone runs `npx prisma migrate dev` once first to create
`dev.db`). **Commit the generated
`prisma/migrations/<ts>_add_site_handoff/` folder** — it's part of the PR.

### Task 2 — `src/lib/handoff.ts` (new, pure — no Prisma import)

```ts
export type HandoffStep = { key: string; label: string; help: string };
```

**`HANDOFF_STEPS: HandoffStep[]`** — canonical, ordered. Exactly these seven,
in this order:

| key | label | help |
| --- | --- | --- |
| `domain` | Domain registered / confirmed | The client owns the domain, or you've registered it for them. |
| `dns` | DNS pointed at the host | A/ALIAS or CNAME records updated so the domain resolves to the deployment. |
| `live-on-domain` | Loads on the custom domain over HTTPS | Visit the real domain — valid cert, site renders. |
| `search-visible` | Search indexing confirmed | The pitch-site noindex clears automatically on WON; confirm robots.txt and the sitemap now include this site. |
| `google-business` | Google Business Profile updated | The website field on the client's Google listing points at the new domain. |
| `client-package-sent` | Handoff summary sent to client | The client has the live URL, what's included, and how to request changes (use *Copy summary*). |
| `payment-arranged` | Payment / invoice arranged | First invoice sent or payment collected. |

**`export const HANDOFF_STEP_KEYS`** — `HANDOFF_STEPS.map(s => s.key)` as a
`readonly string[]` (or `as const` tuple). Used for PATCH validation.

**`reconcileHandoffTasks(existingKeys: string[], steps?: HandoffStep[]): { key: string; order: number }[]`**
Pure. Returns one row-spec per canonical step **not** present in `existingKeys`,
each carrying that step's canonical index as `order`. `steps` defaults to
`HANDOFF_STEPS`. Order of the returned array follows `HANDOFF_STEPS`. (Same shape
of job as `serviceReconcile` — the route uses it to lazily backfill task rows,
and it backfills correctly if we add an eighth step later.)

**`buildHandoffProgress(tasks: { key: string; done: boolean }[]): HandoffProgress`**
where

```ts
export type HandoffProgress = {
  total: number;              // HANDOFF_STEPS.length — always, not tasks.length
  done: number;               // canonical keys whose task exists AND done === true
  pct: number;                // round(done / total * 100); 0 when total is 0
  complete: boolean;          // done === total
  nextStep: HandoffStep | null; // first canonical step whose task isn't done; null when complete
};
```

- A canonical key with no row in `tasks` counts as **not done**.
- Keys in `tasks` that aren't canonical are **ignored** (don't inflate `done`).
- `nextStep` walks `HANDOFF_STEPS` in order.

**`handoffSummaryText(input: HandoffSummaryInput): string`** — pure,
deterministic, plain text (no markdown). 

```ts
export type HandoffSummaryInput = {
  businessName: string;
  liveUrl: string;              // absolute, e.g. https://…/s/slug
  customDomain: string | null;  // bare host, e.g. "joesbarbers.com", or null
  pages: string[];              // nav labels: ["Home", "Services", "Contact", …]
  contactEmail?: string | null;
};
```

Exact output (tests assert this literally):

```
Your new website is live
========================

Business: {businessName}
Web address: {customDomain ? "https://" + customDomain : liveUrl}
{customDomain ? "Preview link (always works): " + liveUrl + "\n" : ""}
What's included
{pages.map(p => "  - " + p).join("\n")}

Requesting changes
Reply with what you'd like changed - copy, photos, hours, services.
There's no login and nothing for you to manage; send the change to us
and we'll make it.
{contactEmail ? "\nQuestions: " + contactEmail + "\n" : ""}
```

- Trailing whitespace: the string ends with exactly one `\n`. Build it with a
  join of sections so the with/without-`customDomain` and with/without-email
  cases differ only by their line, not by stray blank lines. Pin the precise
  form in the tests and match it in the implementation — if the table above and
  a clean implementation disagree on a blank line, the **test is the contract**;
  make it sane and consistent.

### Task 3 — API `src/app/api/sites/[id]/handoff/route.ts` (new)

**`GET`** — `{ params: Promise<{ id: string }> }`:

1. `db.site.findUnique({ where: { id }, include: { lead: true, _count: { select: { serviceItems: true, blogPosts: true, galleryItems: true, faqItems: true } }, ... } })` — enough to build nav flags and the summary. 404 `{ error: "Not found" }` if no site.
2. Load existing `handoffTask` rows for the site. `reconcileHandoffTasks(existing.map(t => t.key))` → if non-empty, `db.handoffTask.createMany` the missing rows (`siteId`, `key`, `order`), then re-load.
3. `about` presence → treat a non-empty `site.about` as `hasAbout`. Feed
   `buildSiteNav(site.slug, flags)` and map to labels for `pages`.
4. `liveUrl` = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/s/${site.slug}` (same base as `metadataBase` in `src/app/layout.tsx`).
5. Respond:

   ```jsonc
   {
     "tasks": [ { "key", "label", "help", "done", "doneAt", "order" }, … ],  // canonical order
     "progress": HandoffProgress,
     "summary": "…",            // handoffSummaryText(...)
     "customDomain": string | null,
     "deliveredAt": string | null
   }
   ```

**`PATCH`** — body `{ key: string; done: boolean }`:

1. 400 `{ error: "Unknown handoff step" }` if `key` not in `HANDOFF_STEP_KEYS`.
2. 404 if no site.
3. `db.handoffTask.upsert({ where: { siteId_key: { siteId, key } }, create: { siteId, key, done, doneAt: done ? new Date() : null, order: <canonical index> }, update: { done, doneAt: done ? new Date() : null } })`.
4. Reconcile+reload all tasks (so a first-ever PATCH still returns the full set),
   compute `buildHandoffProgress`.
5. Delivery transition, best-effort, in its own try/catch that logs and swallows:
   - `progress.complete && !site.deliveredAt` → `db.site.update({ deliveredAt: new Date() })` **and** `db.event.create({ type: "SITE_DELIVERED", siteId: id })`.
   - `!progress.complete && site.deliveredAt` → `db.site.update({ deliveredAt: null })`. **No event** on this path, and **no event** on a later re-complete (guard strictly on `!site.deliveredAt` → set). One `SITE_DELIVERED` per site per delivery; a toggle-off/toggle-on doesn't emit a second.
6. Respond with the same shape as `GET`.

A telemetry/`deliveredAt` write failing must **never** fail the task toggle.

### Task 4 — `src/app/api/sites/[id]/route.ts`

Add `"customDomain"` to the `EDITABLE_FIELDS` tuple. That is the **entire** change
to this file — no new handler, no validation helper, no other field.

### Task 5 — tests (`src/lib/handoff.test.ts`, new)

- **`reconcileHandoffTasks`**
  - `[]` → all 7 specs, `order` 0..6 in canonical sequence.
  - `["domain","dns"]` → the other 5, each with its canonical `order` (2..6).
  - all 7 keys → `[]`.
  - unknown key in input (`["bogus"]`) → still returns all 7 (unknowns don't
    suppress canonical rows).
- **`buildHandoffProgress`**
  - `[]` → `{ total: 7, done: 0, pct: 0, complete: false, nextStep: HANDOFF_STEPS[0] }`.
  - 3 done (non-contiguous, e.g. `domain`, `live-on-domain`, `google-business`)
    → `done: 3`, `pct: 43`, `nextStep.key === "dns"` (first *canonical* not-done).
  - all 7 done → `complete: true`, `pct: 100`, `nextStep: null`.
  - a `{ key: "bogus", done: true }` mixed in → ignored, `done` unchanged.
  - a canonical key absent from the array → counts as not done (`total` stays 7).
- **`handoffSummaryText`**
  - with `customDomain` → asserts the full literal string incl. the
    `https://{domain}` web address line and the `Preview link (always works):`
    line.
  - without `customDomain` (`null`) → web address line is `liveUrl`, **no**
    preview-link line, no stray blank line where it would have been.
  - `pages: ["Home","Services","Contact"]` → renders `  - Home` / `  - Services`
    / `  - Contact`.
  - `contactEmail` present → trailing `Questions: …` line; absent/null → no such
    line and the string still ends in exactly one `\n`.

Assert real strings and values, not smoke. The suite is currently 27 files /
331 tests green — keep every prior test passing.

### Task 6 — `src/components/HandoffPanel.tsx` (new) + wire into `/pipeline`

**`HandoffPanel({ siteId }: { siteId: string })`** — client component.

- On mount, `GET /api/sites/${siteId}/handoff`; hold `{ tasks, progress, summary, deliveredAt }` in state. Show nothing (or a one-line skeleton) until loaded.
- **Progress row:** a slim bar — `bg-slate-200` track, `bg-emerald-600` fill at
  `progress.pct`% — and the text `{progress.done}/{progress.total} handoff steps`.
  When `progress.complete`, show `Delivered {date}` in `text-emerald-700` instead
  of "next step".
- **Checklist:** collapsed by default behind a `Handoff` disclosure button
  (chevron from `lucide-react`, matches how the app uses Lucide elsewhere).
  Expanded: each step is a `<label>` with a real checkbox, the `label` text, and
  the `help` string as `text-xs text-slate-500` below it. Toggling a box
  optimistically updates local state and fires
  `PATCH /api/sites/${siteId}/handoff` with `{ key, done }`; on response, replace
  state with the payload (so `progress`/`deliveredAt` stay authoritative). On
  fetch failure, revert the optimistic toggle and show an inline
  `text-xs text-red-600` "Couldn't save" for that row.
- **Copy summary:** reuse `<CopyButton text={summary} label="Copy summary" />`.
- Operator palette only: `slate-*`, `blue-600`, `emerald-600`. No motion beyond a
  CSS height/opacity on the disclosure. Lucide icons only. Follow
  `docs/DESIGN-PROCESS.md` §3 — run, before building the panel:

  ```
  python "$SEARCH" "delivery checklist progress disclosure" --domain ux
  python "$SEARCH" "inline optimistic toggle save feedback" --domain ux
  ```

  Apply only density / disclosure / feedback-affordance guidance; ignore any
  motion/palette/landing output. If a query is empty, say so in the PR and fall
  back to the operator conventions above.

**`src/app/(app)/pipeline/page.tsx`:** in the lead card, directly after the
`<DraftSiteButton …/>` block, add:

```tsx
{lead.outreachStatus === "WON" && lead.sites?.[0] && (
  <HandoffPanel siteId={lead.sites[0].id} />
)}
```

Nothing else changes in this file. The `?pipeline=1` query already returns `WON`
leads (`outreachStatus: { not: "NEW" }`) with their `sites`, so no API-list
change is needed — confirm the `sites` select includes `id` and add it to the
query's `select`/`include` **only if** it's missing (that's still within
`pipeline/page.tsx`'s data needs — but the fetch is `/api/leads?pipeline=1`; if
`id` isn't returned, STOP and flag on issue #6 rather than editing
`api/leads/route.ts`, which is out of scope).

---

## 3. Edge cases

- **Lazy task creation races:** two GETs land together on a site with no rows —
  both try to `createMany`. The `@@unique([siteId, key])` makes the second a
  no-op conflict; use `skipDuplicates: true` on `createMany` and re-read.
- **A step added later:** `reconcileHandoffTasks` backfills it on the next GET;
  `buildHandoffProgress.total` is `HANDOFF_STEPS.length`, so an old site's
  percentage drops correctly rather than showing 100% of a stale set.
- **`deliveredAt` idempotency:** exactly one `SITE_DELIVERED` per site per
  delivery. Toggle the last box off then on → `deliveredAt` clears then re-sets,
  but **no** second event. Guard strictly on `!site.deliveredAt` before emit.
- **Non-WON leads:** the panel simply isn't rendered (guard in `pipeline`). The
  API route itself doesn't check `WON` — it's keyed on the site, and a site can
  be inspected before the lead flips. That's fine.
- **Site with no `lead`:** `handoffSummaryText` still works (no lead-derived
  fields are required); `contactEmail` falls back to `site.email` or is omitted.
- **`customDomain` empty string vs null:** treat `""` as `null` everywhere
  (summary, response). The PATCH to `/api/sites/[id]` that sets it should store
  `null` for a blank — the existing string-field handling stores `""`; if that's
  a problem for the summary, normalise in `handoffSummaryText` (`customDomain?.trim() || null`) rather than special-casing the route.
- Telemetry / `deliveredAt` writes are best-effort — a failure logs and is
  swallowed, the toggle still succeeds.
- `buildHandoffProgress([])` must not divide by zero (guard `total === 0 → pct 0`,
  even though `total` is a non-zero constant today).

---

## 4. Definition of done

- [ ] `npm test` green — new `handoff.test.ts` included, all prior pass.
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] `npx prisma migrate dev` ran; the migration folder is committed.
- [ ] `git diff --stat` shows only the scope-class paths + the migration folder.
- [ ] `/pipeline`: a `WON` lead with a site shows the handoff panel; progress bar
      + checklist toggle and persist across reload; "Copy summary" copies the
      text; completing all steps flips it to "Delivered <date>" and (verified in
      the DB or a quick query) writes one `SITE_DELIVERED` event.
- [ ] A non-WON lead shows no panel; nothing else on `/pipeline` changed.
- [ ] Branch `feature/won-end-handoff` off `origin/master`. **Before the PR goes
      final: `git fetch && git merge origin/master`** into the branch (not a
      rebase onto a partial base), re-run the gate. PR against `master`; land
      with `gh pr merge --merge` / the UI.
- [ ] PR body: what changed per task, gate output, `git diff --stat`, the
      `ui-ux-pro-max` query results, and a note that a migration is included.

---

## 5. Review checklist (boss)

1. `git diff --stat` — only the scope-class paths. Any `templates.tsx`,
   `designSystems.ts`, `siteVisibility.ts`, `/stats`, `/leads`, `/builder`,
   `outreach*`, `places*` file → reject on sight. `api/sites/[id]/route.ts` shows
   a **one-line** diff (the `customDomain` field) and nothing else.
2. `src/lib/handoff.ts` — `HANDOFF_STEPS` matches the table exactly (keys,
   order, labels). `buildHandoffProgress.total` is the constant, not
   `tasks.length`. `nextStep` walks canonical order. `handoffSummaryText` is
   pure and its output matches the test literals with no stray blank lines.
3. `src/lib/handoff.test.ts` — the 4 progress cases, the reconcile backfill
   case, and both summary branches (domain / no-domain, email / no-email) are
   present and assert real strings/values.
4. `handoff/route.ts` — lazy reconcile with `skipDuplicates`; PATCH validates
   `key`; the `deliveredAt`/`SITE_DELIVERED` transition is guarded on
   `!site.deliveredAt` (exactly-once) and is best-effort try/catch; response
   shape identical between GET and PATCH.
5. `HandoffPanel.tsx` — operator palette, Lucide, disclosure collapsed by
   default, optimistic toggle with revert-on-failure, `CopyButton` reused, no
   motion/color from skill output. `pipeline/page.tsx` diff is the single
   conditional render after `DraftSiteButton` and the import.
6. Migration is minimal — one enum value, two nullable `Site` columns, one new
   model, no data migration — and committed.
7. Gate evidence in the PR: `npm test` (334+ passing), `tsc --noEmit`,
   `npm run lint` all clean.
