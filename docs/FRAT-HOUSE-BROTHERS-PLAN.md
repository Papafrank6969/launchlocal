# Feature plan: Frat House: `brothers`

**Status:** specced, awaiting Frank's approval
**Module:** `brothers` (see `docs/FRAT-HOUSE-MAP.md`; depends on `agent-runtime`, merged in #14)
**Branch:** `feature/frat-house-brothers`, cut from `master` @ `2266dd5`. Rebase
onto `master` after #15 (`house-ui`) merges: Treasurer reuses its `formatMicros`.
**Scope class:** `src/lib/brothers/**` (one file per brother plus a sibling
test, `index.ts`, and a shared `brotherData.ts` for the Prisma reads),
`src/lib/brothers/pledge.ts` (deleted), `docs/FRAT-HOUSE-MAP.md` (spec link),
`docs/BOARD.md` (one row). **Nothing else.** No schema change, no new route, no
new dependency, no UI (`house-ui` is PR #15), no approve/send/publish (that's
`approvals-flow`).

---

## 1. Objective

Replace the `pledge` test brother with the five real ones. Each runs once a day
from the existing cron, does one small job, and leaves its output as
**PENDING approvals** for Frank. Nothing leaves the building: no DM is sent, no
lead status changes, no site is created or published.

| Brother (`id`) | Job | Claude? | Files |
| --- | --- | --- | --- |
| Scout (`scout`) | Picks today's 10 best untouched leads and writes a one-line "why this one" for each | 1 call | 1 `NOTE`: "Today's top leads" |
| Rush Chair (`rush-chair`) | Drafts a personalized first Instagram DM for up to 8 leads in the outreach queue | 1 call | 1 `DM_DRAFT` per lead |
| Follow-up (`follow-up`) | Drafts a short bump for up to 8 leads whose follow-up is due | 1 call | 1 `FOLLOW_UP_DRAFT` per lead |
| Builder (`builder`) | Finds warm leads (RESPONDED, no site) and proposes a draft site for each, using the existing deterministic `leadToDraftSite` | **none** | 1 `SITE_DRAFT` per lead (max 3) |
| Treasurer (`treasurer`) | Writes yesterday's numbers: spend vs cap, runs per brother, drafts waiting, funnel moves | **none** | 1 `NOTE`: "Daily digest, <date>" |

Expected cost is about $0.01–0.03/day on Haiku 4.5, well under the $1 cap. Each
brother makes **at most one** Claude call, so the whole cron stays far inside
Vercel's 60s limit.

### Why the shapes are what they are

- **Builder doesn't call Claude, and doesn't create the site.**
  `docs/BRAND-AND-COMPLIANCE-STANDARDS.md` bans LLM-written tagline, about, story
  and service copy. Also, `POST /api/sites {leadId}` creates the site as
  **PUBLISHED** (a live pitch link), which would break the map's rule that
  nothing goes out without Frank. So Builder only files a `SITE_DRAFT` whose body
  is a preview of what `leadToDraftSite` would produce. `approvals-flow` creates
  the site when Frank approves.
- **Treasurer doesn't call Claude.** It's arithmetic. Prose from a model would
  only add cost and a chance of a wrong number.
- **One batched call per brother**, not one per lead. Claude returns a JSON array
  for all of the day's leads at once. That's faster and cheaper, and one bad
  reply fails one brother, not twenty calls.

### Drafted-DM rules (Rush Chair and Follow-up)

The system prompt gives Claude **only facts from the lead row** (name, category,
city, rating, review count, website status, preview link if a site exists) and
these rules:

1. Use only the facts given. Never invent reviews, awards, years in business,
   prices or anything else.
2. No em dashes. No emoji. No profanity. Under 400 characters.
3. Casual, first person, from Frank. One question at the end.
4. Never promise a price or a timeline. Never claim we've talked before (except
   for a follow-up's "following up on my last message").

Then `cleanDraft()` enforces what it can in code: it replaces every `—` and `–`
with `, `, collapses whitespace, strips emoji, and rejects drafts over 400 chars
or under 40. **Fallback:** if Claude's reply doesn't parse, or a draft is
rejected, that lead gets the existing template (`generateOutreachMessage` /
`generateFollowUpMessage`, variant by lead-id hash) passed through
`cleanDraft()`, so every eligible lead still gets a draft. The approval title
says "(template)" so Frank can tell them apart.

### No duplicates, no pile-up

- A lead never gets a second PENDING draft of the same kind. Each brother skips
  leads that already have one.
- If Frank has **16 or more** PENDING `DM_DRAFT`s, Rush Chair files nothing that
  day (`setNow("waiting on Frank: 16 drafts")`). The same rule applies to
  Follow-up. Unread drafts shouldn't grow forever. (The /today pacing caution is 25 sent per day, so
  16 waiting is more than a day's work.)
- Builder skips leads with any site or a PENDING `SITE_DRAFT`.
- Scout and Treasurer file at most one NOTE per ET day each (an earlier one from
  the same day means the run summary says "already filed today").

### Eligibility (reuses existing logic, no new rules)

- **Scout:** `outreachStatus NEW`, `websiteStatus ≠ HAS_SITE`. Ranked by the
  existing `opportunityScore` (`leadBacklog.ts`), top 10.
- **Rush Chair:** the same query as `/api/leads/outreach-queue`, then
  `buildOutreachQueue`, top 8 not already drafted.
- **Follow-up:** the same query as `/api/leads/follow-up-queue`, then
  `buildFollowUpQueue`, top 8.
- **Builder:** `outreachStatus RESPONDED`, no `sites`, oldest first, max 3.
- **Treasurer:** yesterday's ET day (`startOfDayET`) for `AgentRun`, `Approval`
  and `Event`.

Heads-up: Rush Chair and Follow-up need an Instagram handle, and Handle Hunter
is parked (Custom Search API is still broken). So expect few or zero DM drafts
until leads have handles. That's correct behavior, and the run summary says
"0 leads with a handle in the queue".

### Non-goals

- No sending, no status changes, no site creation (`approvals-flow`).
- No Handle Hunter (parked in the map).
- No per-brother schedules. Everyone runs in the existing daily cron.
- No tool-use loops or multi-turn agents (runtime non-goal).

---

## 2. Code shape

Each brother is a pure job plus a thin loader, so the job is tested without a DB:

```ts
// src/lib/brothers/rushChair.ts
export type RushChairInput = { leads: QueueLead[]; pendingDrafts: number; previewBase: string };
export async function rushChairJob(input: RushChairInput, ctx: BrotherContext): Promise<string> { … }
export const rushChair: BrotherDefinition = {
  id: "rush-chair", name: "Rush Chair", role: "Drafts first Instagram DMs for new leads",
  run: async (ctx) => rushChairJob(await loadRushChairInput(), ctx),
};
```

- `brotherData.ts`: the Prisma reads (`loadScoutInput`, `loadRushChairInput`,
  and so on). These are the only DB calls brothers make, and they're **reads
  only**. Writes go through `ctx.propose()`.
- `draftText.ts` + test: `cleanDraft`, `parseDraftJson` (tolerates code fences
  and leading or trailing prose, keyed by lead id, ignores unknown ids),
  `templateIndex(leadId)`.
- Preview links use `NEXT_PUBLIC_SITE_URL` + `/s/<slug>` (the same shape the
  outreach pages build client-side).
- `index.ts`: `BROTHERS = [scout, rushChair, followUp, builder, treasurer]`, in
  cron order. Pledge is removed. Its existing `Agent` row stays and is
  `enabled: false`'d by hand (one SQL line in §3), so old runs keep their history.
- `SITE_DRAFT` approval body is JSON: `{ leadId, preview: DraftSiteInput }`, so
  `approvals-flow` can create the site without recomputing.

## 3. Commands

```bash
npm test && npx tsc --noEmit && npm run lint
npm run dev    # then POST /api/agents/<id>/run for each brother (operator password)
# after merge, prod: UPDATE "Agent" SET enabled = false WHERE id = 'pledge';
```

## 4. Testing strategy

One test file per brother plus `draftText.test.ts`, all with a fake `ctx`:

- **Scout:** ranks by `opportunityScore`, files exactly one NOTE with 10 lines;
  skips if one was already filed today; with 0 leads, files nothing and makes
  no Claude call.
- **Rush Chair / Follow-up:** one Claude call for N leads; each lead gets a
  draft with its `leadId`; an unparseable reply → all template drafts titled
  "(template)"; one bad draft (em dash only gets replaced, 500 chars gets
  rejected) → only that lead falls back; ≥16 pending → no call, no drafts;
  already-drafted leads are skipped; preview link present only when the lead
  has a site.
- **Builder:** no `ask` calls ever; body JSON round-trips to `leadToDraftSite`
  output; max 3; skips leads with a site or pending `SITE_DRAFT`.
- **Treasurer:** no `ask` calls; numbers match the fixture (spend formatted
  with `formatMicros` from `houseStats.ts`, runs grouped by brother); one per day.
- **draftText:** em/en dash replacement, emoji strip, length bounds, fenced
  JSON, prose around JSON, unknown ids ignored.
- `agentRunner` tests stay green, and nothing in the runtime changes.

## 5. Success criteria

1. Gate clean: `npm test`, `tsc`, `lint`.
2. Locally, each brother's Run now finishes `OK` with a sensible summary, and the
   approvals match §1 (kinds, counts, no duplicates on a second run).
3. Running all five via the cron route stays under 30s locally and costs under
   $0.05.
4. No DM draft contains an em dash, and every draft uses only facts from its lead.
5. No lead, site or event row changes. Brothers only read, plus approvals and runs.

## 6. Boundaries

- **Always:** Claude only via `ctx.ask`; reads via `brotherData.ts`; writes via
  `ctx.propose`; a test with every job.
- **Ask first:** any schema change; any brother making more than one Claude
  call; raising the 8 / 3 / 10 / 16 limits.
- **Never:** send, publish, create a site, or change a lead's status; call
  `chooseDesign` (unmetered Claude) from a brother; let a model write site copy.

## 7. Open questions

1. **Frank:** Should drafts be Claude-personalized as above, or templates only
   (no Claude for Rush Chair and Follow-up at all, $0/day)? Default:
   **personalized, with the template fallback.**
2. **Frank:** Is Builder propose-only (no site until you approve) OK? The
   alternative is that Builder creates the PUBLISHED pitch site right away, like
   the one-click button does. Default: **propose-only**, per the map's standing
   rule.
3. **Frank:** Limits: 10 Scout picks, 8 DM drafts, 8 follow-ups, 3 site
   proposals, pause at 16 unread. Default: as listed.
