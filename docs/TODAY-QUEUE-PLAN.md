# Feature plan: `/today` — the daily DM worklist

**Status:** specced, not started
**Assignee:** TBD (one agent) · boss + user (enable Custom Search API + CSE on GCP
`155038052653`, set `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` in Vercel)
**Scope class:** `src/lib/todayQueue.ts` (new) + test, `src/lib/leadCron.ts` +
test, `src/app/api/today/route.ts` (new), `src/app/(app)/today/page.tsx` (new),
`src/app/(app)/outreach/page.tsx` (becomes a redirect), `src/components/OutreachNav.tsx`,
`src/components/AppHeader.tsx`, `src/app/api/cron/daily-leads/route.ts`,
`scripts/backfill-instagram-handles.ts` (new), `docs/GOOGLE-APIS.md`,
`.env.example`. **Nothing else** — do not touch `src/lib/places.ts`,
`src/lib/instagramLookup.ts`, `src/app/api/leads/**`, `src/lib/outreachQueue.ts`,
`src/lib/followUpQueue.ts`, or the `/outreach/follow-up` console.

---

## 0. Blocking dependency (boss + user, before this can ship green in prod)

`/today` is **DM-only**. It only shows leads that have an Instagram handle. The
daily cron banks leads from Google Places, which does **not** return handles, so
handles have to be looked up via the Custom Search JSON API — which is currently
**disabled** on GCP project `155038052653` (`503 api_disabled`, confirmed in
Track 2 Task 7).

**The operator must, in the Google Cloud console for project `155038052653`:**

1. **APIs & Services → Library → "Custom Search API" → Enable.**
2. Create a Programmable Search Engine at
   <https://programmablesearchengine.google.com/> with **"Search the entire web"
   ON**. Copy its **Search engine ID**.
3. In **Vercel → Settings → Environment Variables** (Production + Preview) set:
   - `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` = the Search engine ID from step 2.
   - *(optional)* `GOOGLE_CUSTOM_SEARCH_API_KEY` = a key scoped to Custom Search
     only. If unset, the code already falls back to `GOOGLE_PLACES_API_KEY`.
4. Redeploy.

Free tier is **100 queries/day**, ~$5/1k after. The cron's enrichment step
(Task 3) is capped at 25/run to stay inside it.

**This track's code is written and merged without waiting on the above.** Until
the API is live, `/today` shows its empty state and the cron's enrichment step
no-ops on `api_disabled` (already a typed result — see `lookupInstagramHandle`).
The DoD separates "code landed" from "verified in prod."

---

## 1. Goal

One page — `/today` — that answers "who do I DM right now?" It shows up to **25
uncontacted leads that have an Instagram handle**, oldest first, so the operator
sits down after school, works straight down the list, and is *done for the day*
when it's empty. Marking a lead contacted drops it off immediately; anything not
worked today is still there tomorrow, at the top.

### Why

The cron banks ~25 fresh leads/day and the operator wants to send ~25 DMs/day
from a 3-year-old Instagram account (past ~40/day cold, IG starts limiting). The
existing `/outreach` console shows the *entire* eligible backlog with no daily
boundary — it never says "you're done," and if the operator falls behind, newer
leads pile on top and old ones rot at the bottom. `/today` is the bounded,
FIFO-drained version: a finite daily target that matches the cron's supply and
IG's safe pace, with carryover so nothing is lost.

### Non-goals

- **No phone / SMS / email channel.** DM-only. (Decision locked with the user
  2026-09-06: "kill the phone angle." Places gives us a phone but the operator
  works exclusively through Instagram DMs.)
- **No message *sending*.** Same as `/outreach` — the button opens the real
  `ig.me` DM thread and copies the text; the operator pastes and sends by hand.
- **No new follow-up logic.** `/outreach/follow-up` stays exactly as is and owns
  everything post-CONTACTED.
- **No "snapshot" table.** Carryover is derived from lead age + status, not a
  persisted per-day list (see §3).
- **No change to `outreachQueue.ts`.** `/outreach`'s cold console is *retired*
  (Task 4), not refactored — `/today` is a fresh, smaller surface.
- **No handle lookup on the interactive `/leads` path.** That button already
  exists and is out of scope.

---

## 2. Tasks

### Task 1 — `src/lib/todayQueue.ts` (new, pure — no Prisma, no fetch, no React)

```ts
export type TodayLead = {
  id: string;
  name: string;
  category: string;
  city: string;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
  instagramHandle: string | null;
  rating: number | null;
  createdAt: string; // ISO
  sites?: { id: string; slug: string; status: string }[];
};

export const TODAY_QUEUE_SIZE = 25;
```

**`isEligibleForToday(lead: TodayLead): boolean`** — true when
`websiteStatus !== "HAS_SITE"` **and** `instagramHandle` is a non-empty string
(after `.trim()`). (No status field here — the route filters `outreachStatus:
"NEW"` in the query; keep this helper about the fields it's given.)

**`compareTodayLeads(a, b): number`** — **oldest `createdAt` first** (FIFO).
Tie-break: leads that already have a draft site first (the pitch is a live link),
then higher `rating`, then `id` for total order. Oldest-first is deliberate and
is *the* carryover mechanism: a lead untouched yesterday is older than everything
banked today, so it sits at the top of tomorrow's list until it's worked.

> Note the intentional deviation from the board's "25 *freshest*" wording. A
> freshest-first cap buries carryover under each day's new 25 — the opposite of
> the "yesterday's uncontacted carried over" requirement. Oldest-first with a cap
> satisfies both: bounded list, nothing rots. Called out here so the review
> doesn't read it as a bug.

**`buildTodayQueue(leads: TodayLead[]): TodayLead[]`** — filter by
`isEligibleForToday`, sort by `compareTodayLeads`, `slice(0, TODAY_QUEUE_SIZE)`.

**Re-exports for the page** (so the page imports pacing from one place):
`export { pacingLevel, PACING_CAUTION, PACING_LIMIT, type PacingLevel } from "./outreachQueue";`
— reading `outreachQueue.ts` as a value module is fine; the "don't touch" rule is
about *editing* it.

**Tests** (`src/lib/todayQueue.test.ts`): each `isEligibleForToday` branch
(HAS_SITE out, null handle out, whitespace handle out, POOR+handle in);
`compareTodayLeads` orders oldest-first and applies each tie-break; `buildTodayQueue`
caps at 25 and drops ineligible leads before capping (26 eligible + 5 ineligible
→ 25 eligible, oldest kept).

### Task 2 — `src/app/api/today/route.ts` (new)

`export async function GET()`:

```ts
const leads = await db.lead.findMany({
  where: {
    outreachStatus: "NEW",
    websiteStatus: { not: "HAS_SITE" },
    NOT: { instagramHandle: null },
  },
  orderBy: { createdAt: "asc" },
  take: 100, // headroom over TODAY_QUEUE_SIZE so tie-breaks in the comparator have material to work with
  include: { sites: { select: { id: true, slug: true, status: true } } },
});
return NextResponse.json({ leads: buildTodayQueue(leads.map(toTodayLead)) });
```

`toTodayLead` maps the row (dates → `.toISOString()`), same shape as
`outreach-queue/route.ts`. No auth (same as every other `/api/leads/*` read).

### Task 3 — cron handle enrichment: `src/app/api/cron/daily-leads/route.ts` + `src/lib/leadCron.ts`

After the existing bank-leads loop and **before** `cronState.update`, add a
bounded enrichment pass so the leads the cron banks actually reach `/today`.

`src/lib/leadCron.ts` — add:

```ts
export const MAX_HANDLE_LOOKUPS_PER_RUN = 25;

export type EnrichCandidate = { id: string; name: string; city: string };

/** Oldest NEW, handle-less, non-HAS_SITE leads first — same FIFO drain as /today. */
export function selectForHandleLookup<T extends EnrichCandidate>(
  candidates: T[],
  limit = MAX_HANDLE_LOOKUPS_PER_RUN,
): T[] {
  return candidates.slice(0, limit);
}
```

(Trivial now, but it's the pure seam the test hangs off and where a smarter
policy — skip leads looked up before, prefer higher-rated — lands later.)

Route, new block:

```ts
const needHandles = await db.lead.findMany({
  where: {
    outreachStatus: "NEW",
    websiteStatus: { not: "HAS_SITE" },
    instagramHandle: null,
  },
  orderBy: { createdAt: "asc" },
  take: MAX_HANDLE_LOOKUPS_PER_RUN,
  select: { id: true, name: true, city: true },
});

let handlesFound = 0;
let lookupHalted: string | null = null;
for (const lead of selectForHandleLookup(needHandles)) {
  const result = await lookupInstagramHandle(lead.name, lead.city);
  if (result.status === "found") {
    await db.lead.update({ where: { id: lead.id }, data: { instagramHandle: result.handle } });
    handlesFound += 1;
  } else if (result.status === "api_disabled" || result.status === "not_configured" || result.status === "rate_limited") {
    lookupHalted = result.status; // stop the loop — every remaining call fails the same way
    break;
  }
  // "not_found" / "error": skip this lead, keep going
}
```

- Import `lookupInstagramHandle` from `@/lib/instagramLookup` (no edit to that
  file).
- Fold the outcome into the run summary: append
  `` ` · handles +${handlesFound}` `` to `note`, or
  `` ` · handle lookup ${lookupHalted}` `` when halted. Keep `summarizeRun`'s
  signature unchanged — just concatenate in the route, or add an optional
  `handleNote?: string` param to `summarizeRun` and test that branch.
- The enrichment pass must be wrapped so a thrown error there **cannot** lose the
  `cronState.update` for the leads already banked — `try/catch` around the whole
  block, log and move on.
- `maxDuration` is already 60. 25 sequential Custom Search calls ≈ 5–15s on top
  of the Places work. If that gets tight in practice, drop
  `MAX_HANDLE_LOOKUPS_PER_RUN` to 15 — do **not** raise `maxDuration` past 60
  (Hobby cap).

`src/lib/leadCron.test.ts` — add: `selectForHandleLookup` respects the limit and
preserves order; if you parametrised `summarizeRun`, cover the handle-note branch.

### Task 4 — retire the cold `/outreach` console, add `/today` to nav

- **`src/app/(app)/outreach/page.tsx`** → replace the whole file with a redirect:

  ```ts
  import { redirect } from "next/navigation";
  export default function OutreachPage() {
    redirect("/today");
  }
  ```

  (The cold console's logic lived in `outreachQueue.ts` + this page. `outreachQueue.ts`
  stays on disk untouched — still imported by nothing after this, removing it is a
  separate cleanup, not this track.)

- **`src/components/OutreachNav.tsx`** — first tab becomes
  `{ key: "today", href: "/today", label: "Today" }`; keep
  `{ key: "follow-up", href: "/outreach/follow-up", label: "Follow-ups" }`. Update
  the `active` prop type to `"today" | "follow-up"`. The follow-up page passes
  `active="follow-up"` (unchanged).

- **`src/components/AppHeader.tsx`** — `NAV_LINKS`: replace
  `{ href: "/outreach", label: "Outreach" }` with
  `{ href: "/today", label: "Today" }`, keep it in the same position (2nd, after
  Lead Finder). `pathname?.startsWith("/today")` highlights it. `/outreach/follow-up`
  is reachable from the `OutreachNav` tab on `/today`; it no longer needs a
  top-nav entry (it never had its own one).

### Task 5 — `src/app/(app)/today/page.tsx` (new)

A trimmed-down version of the old `/outreach` console. Client component.

- Fetch `/api/today` → `{ leads }`. States: loading, empty, working, done.
- **Empty state:** _"Nothing to DM right now."_ + _"The daily cron tops this up
  each afternoon with new leads that have an Instagram handle. Add handles to
  existing leads with the "Find it" button on the [Lead Finder](/leads)."_
- **Header:** `Lead {index + 1} of {queue.length}` + progress bar +
  session counter (`sent` / `skipped`). Same layout as `/outreach` now.
- **`PacingBanner`** — reuse via the `todayQueue` re-exports. Since the list is
  capped at 25 and `PACING_CAUTION` is 25, the caution banner only ever shows on
  the very last card; that's correct and enough.
- **LeadCard** (one at a time):
  - name · `category · city` · rating star (if present)
  - `@handle` line, with the "has a weak site" amber pill when `websiteStatus === "POOR"`
  - `<DraftSiteButton leadId={...} site={lead.sites?.[0]} onCreated={...} />` —
    reused as-is. Drafting swaps the message to the preview-link variant (same as
    `/outreach` does today).
  - Editable message textarea seeded from
    `generateOutreachMessage(lead, variant, { previewUrl })`, "Try another"
    cycles `variant` (`OUTREACH_VARIANT_COUNT`).
  - Buttons: **Open DM ⏎** (`instagramDmUrl(handle)` → `window.open`, copy text
    to clipboard first, best-effort), **Sent · 1**, **Skip · 2**.
  - Keyboard: `Enter` = open DM, `1` = sent, `2` = skip. Inline the 3-key map in
    this page (`{ Enter: "open", 1: "send", 2: "skip" }`) — do **not** import
    from `outreachQueue.ts`; there's no "reject" here (that lived on the old
    console; leads that aren't a fit just get skipped and the operator can mark
    LOST from `/pipeline`).
  - Ignore keystrokes while the textarea is focused (same guard as `/outreach`).
- **Actions:**
  - `sent` → optimistically remove the lead from local `queue`, bump
    `session.sent`, `PATCH /api/leads/{id}` with
    `{ outreachStatus: "CONTACTED", followUpAt: <now + SEND_FOLLOW_UP_DAYS> }`.
    Import `SEND_FOLLOW_UP_DAYS` from `outreachQueue.ts` (value import, allowed),
    or hard-code `3` with a comment. The PATCH route already emits
    `LEAD_CONTACTED` and sets `lastContactedAt`.
  - `skip` → advance index only, bump `session.skipped`, no PATCH. Skipped leads
    are still `NEW`, so they're back at the top tomorrow.
  - Removing on `sent` vs. advancing on `skip`: keep a single `index` and a
    `worked` set, or splice the array — match whatever the existing `/outreach`
    page does so the two read alike.
- **Done state:** _"That's the list — {sent} DMs sent, {skipped} skipped."_ +
  _"Sent leads are in the [Pipeline](/pipeline) with a follow-up in 3 days.
  New leads land here tomorrow afternoon."_ + the pacing reminder line from
  `/outreach`.

No new server round-trips beyond the initial GET and the per-`sent` PATCH.

### Task 6 — `scripts/backfill-instagram-handles.ts` (new, one-off)

Standalone script (run once by the operator after the Custom Search API is
enabled) to enrich the leads already sitting in the backlog:

```
npx tsx scripts/backfill-instagram-handles.ts [--limit N] [--dry-run]
```

- Query: `outreachStatus: "NEW"`, `websiteStatus: { not: "HAS_SITE" }`,
  `instagramHandle: null`, oldest first, `take: limit` (default 90 — one day's
  free-tier budget minus headroom).
- For each: `lookupInstagramHandle(name, city)`, 1100ms sleep between calls
  (stay well under any per-second quota), write the handle on `found`, log a
  one-line result per lead (`✓ @handle` / `– not found` / `✗ error`).
- Stop the whole run on the first `api_disabled` / `not_configured` /
  `rate_limited` and print the remediation (point at this doc's §0).
- `--dry-run` does the lookups but skips the writes.
- Reuses `src/lib/db.ts` (`db`). No test (one-off operational script; keep it
  small and obvious). Add a one-liner to `README.md`'s scripts section if there
  is one — otherwise a header comment in the file is enough.

### Task 7 — docs

- **`docs/GOOGLE-APIS.md`** — the Custom Search row and the paragraph under the
  table currently say the cron does **not** call Custom Search. Update: the cron
  now makes up to 25 Custom Search calls/run (handle enrichment for `/today`),
  ~25/day, inside the 100/day free tier; interactive `/leads` "Find it" lookups
  share that budget. Add the §0 enable steps (or link this doc).
- **`.env.example`** — under `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`, note it's now
  required for the daily cron's handle-enrichment step, not just the interactive
  button; without it `/today` stays empty for cron-banked leads.

---

## 3. Edge cases

- **Carryover.** Not stored. A `NEW` lead with a handle that the operator didn't
  work is still `NEW` tomorrow and — being older than everything banked overnight
  — sorts to the top. If the operator does 10/day against 25/day inflow, the
  queue grows and the *oldest* 25 are always what's shown; newer leads wait. This
  is the intended FIFO behaviour, not starvation to fix.
- **More than 25 eligible.** Capped at 25. The rest appear as they age to the
  front. `/outreach` (now retired) was the "work the whole backlog" escape hatch;
  if the operator wants that back it's a future toggle, not this track.
- **Fewer than 25 eligible** (the likely early state — enrichment is new). List
  is short; that's fine. Empty → empty state.
- **Custom Search still disabled in prod.** `lookupInstagramHandle` returns
  `api_disabled`, the cron's enrichment loop breaks on the first one and records
  `handle lookup api_disabled` in the run note, lead-banking is unaffected,
  `/today` shows whatever handle-having leads exist (from Places URLs via
  `extractInstagramHandle`, which the cron already does). No crash, no partial
  writes.
- **A lead's handle is wrong** (Custom Search picked a bad `instagram.com` link).
  Same risk the `/leads` "Find it" button already carries. Operator sees the
  business name + `@handle` + can open the DM to sanity-check before sending.
  Out of scope to fix here.
- **Cron runs twice in a day.** Enrichment re-queries `instagramHandle: null`, so
  already-enriched leads aren't re-looked-up; it just spends more of the daily
  quota on the next batch. Harmless.
- **`sent` PATCH fails** (network). Lead was optimistically removed from the
  local list but is still `NEW` server-side — it's back tomorrow. Acceptable for
  v1; a toast on failure is a nice-to-have, not required.
- **Operator opens `/outreach`** (old bookmark). `redirect("/today")` handles it.

---

## 4. Definition of done

**Code landed:**
- [ ] `npm test` green (existing suite + new `todayQueue` tests + `leadCron`
      additions).
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] `git diff --stat` shows only scope-class paths.
- [ ] `/today` renders locally: seed ≥26 `NEW` leads with handles + a few
      HAS_SITE / handle-less, confirm exactly 25 show, oldest first, HAS_SITE and
      handle-less excluded. Screenshot in the PR.
- [ ] Mark one **Sent** → it disappears, `/pipeline` shows it `CONTACTED` with a
      follow-up ~3 days out, `/stats` funnel "Contacted" ticks up. **Skip** →
      still `NEW`, reappears on reload.
- [ ] `/outreach` redirects to `/today`; `OutreachNav` + top nav say "Today";
      `/outreach/follow-up` still works and its tab is highlighted.
- [ ] Local cron hit (`GET /api/cron/daily-leads`, no `CRON_SECRET`): with
      Custom Search unconfigured locally, the run still banks leads and the note
      ends `handle lookup not_configured`. Paste the JSON in the PR.
- [ ] `scripts/backfill-instagram-handles.ts --dry-run` runs against the local DB
      and prints per-lead results.
- [ ] Branch off `origin/master` (`099b752` or later); `git fetch && git merge
      origin/master` before final; re-gate. PR against `master`.
- [ ] PR body: per-task summary, gate output, the two screenshots, the local
      cron JSON, and a **"blocked on prod verification until §0 is done"** note.

**Verified in prod (boss + user, after §0):**
- [ ] Custom Search API enabled + `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` set in Vercel;
      redeployed.
- [ ] `scripts/backfill-instagram-handles.ts` run once against prod (or via a
      one-off `vercel env pull` + local run) — record how many handles it filled.
- [ ] Next scheduled cron run's `CronState.lastRunNote` ends `handles +N` with
      `N > 0`.
- [ ] `/today` on the live site shows a real queue; one end-to-end DM open +
      mark-sent works.

---

## 5. Review checklist (boss)

1. `git diff --stat` — only scope-class paths. `places.ts`, `instagramLookup.ts`,
   `outreachQueue.ts`, `followUpQueue.ts`, `/api/leads/**` **untouched**.
2. `todayQueue.ts` pure — no Prisma/fetch/React. `isEligibleForToday` = not
   HAS_SITE + non-empty trimmed handle. `compareTodayLeads` oldest-first +
   tie-breaks, total order. `buildTodayQueue` filters *then* caps at 25.
3. `/api/today` query filters `NEW` + not-HAS_SITE + handle present; `take` gives
   the comparator headroom; maps dates to ISO.
4. Cron: enrichment block is *after* banking and *before* `cronState.update`,
   wrapped so it can't drop the state write; breaks the loop on
   `api_disabled`/`not_configured`/`rate_limited`; `MAX_HANDLE_LOOKUPS_PER_RUN`
   respected; run note reflects the outcome. `lookupInstagramHandle` imported,
   not reimplemented.
5. `/today` page: keyboard map inlined (Enter/1/2, no "reject"), textarea-focus
   guard present, `sent` PATCHes `CONTACTED` + `followUpAt`, `skip` is local-only.
   Reuses `DraftSiteButton`, `generateOutreachMessage`, `instagramDmUrl`.
6. `/outreach` → redirect; nav labels updated; follow-up console + its tab intact.
7. `backfill-instagram-handles.ts`: bounded, throttled, dry-run flag, stops on
   API-disabled with a pointer to §0.
8. Docs: `GOOGLE-APIS.md` no longer claims the cron skips Custom Search;
   `.env.example` notes the CSE id is now cron-required.
9. Gate evidence + both screenshots + local cron JSON in the PR. Prod-verification
   boxes explicitly deferred to boss + user.

---

## Board note

This is the **last** track in the "bank 25 leads/day → DM them after school"
arc. After it lands and §0 is verified, the loop is closed:
cron fills → `/today` drains → `/pipeline` + `/outreach/follow-up` carry the rest.
