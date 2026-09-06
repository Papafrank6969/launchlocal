# Coordination board

Single source of truth for who's doing what. **The boss owns this file** and
keeps it current. Every agent runs `git pull origin master` and re-reads this
(and their PR comments) at the **start of every turn** before doing anything.

Cross-agent pings that don't belong on a PR go on **tracking issue #6**
(`gh issue view 6`, `gh issue comment 6 -b "..."`).

Last updated: 2026-09-06 by boss. App **live** at https://launchlocal-silk.vercel.app. Tracks 1 + 2 shipped. **Track 3 (`/today` DM worklist) is specced** — `docs/TODAY-QUEUE-PLAN.md`, ready to assign to whichever agent starts next. Direction locked with user 2026-09-06: `/today` is **DM-only** ("kill the phone angle"), which retires the cold `/outreach` console and adds an IG-handle-enrichment step to the daily cron. **Blocked for prod verification** on the operator enabling the Custom Search API + CSE on GCP `155038052653` (see plan §0) — code lands without waiting.

---

## Roster

| Agent | Model / tool | Working dir |
| --- | --- | --- |
| **boss** | Claude Code (claude-sonnet-5) | `C:\Users\frank\Documents\Projects\smallbiz-launchpad` |
| **agent-1** | opencode / Big Pickle | (its own clone) |
| **agent-2** | opencode / Big Pickle | `…\launchlocal-places` |
| **agent-3** | opencode / Big Pickle | `…\launchlocal-instagram` |

`master` HEAD when last updated: `099b752` (bumped again by this spec commit — see the push).

---

## Active tracks

| Track | Spec | Owner | Branch | PR | Status | Next action (whose) |
| --- | --- | --- | --- | --- | --- | --- |
| **Track 3 — `/today` DM worklist** | `docs/TODAY-QUEUE-PLAN.md` | _unassigned_ | `feature/today-queue` (off `origin/master`) | — | specced, not started | Assign to the next agent that starts; agent builds per plan. Boss+user owe plan §0 (enable Custom Search API + CSE) for prod verification. |

**Goal context:** user wants a server that queues ~25 fresh leads/day (NYC + Long Island barbershops & salons) to DM manually after school (~3pm ET, 3yr-old IG account). Tracks 1 (deploy) + 2 (lead cron) SHIPPED. Track 3 (`/today` DM worklist) is the last one — specced.

**Track 3 — `/today` DM worklist (SPECCED):** `docs/TODAY-QUEUE-PLAN.md`. Bounded daily list of ≤25 uncontacted IG-handle leads, oldest-first (FIFO drain = automatic carryover), one-tap DM + mark-sent. DM-only per user (2026-09-06): retires the cold `/outreach` console (→ redirect to `/today`), keeps `/outreach/follow-up`. Adds a ≤25/run IG-handle-lookup pass to the daily cron + a one-off backfill script. **§0 blocker (boss+user):** enable "Custom Search API" on GCP `155038052653`, create a Programmable Search Engine, set `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` in Vercel, redeploy. Code lands without it; `/today` is empty until it's done.

**Track 2 — Daily lead cron (SHIPPED):** `docs/DAILY-LEAD-CRON-PLAN.md`, PR [#11](https://github.com/Papafrank6969/launchlocal/pull/11) merged `6f2bba4`. Vercel Cron `0 17 * * *` → `/api/cron/daily-leads`, 94 NYC/LI barber+salon targets, banks exactly 25 net-new/day. Verified with a live local run (25/25, dedup working). **Boss + user still need to:** (a) add `CRON_SECRET` to Vercel + redeploy — _in progress 2026-09-06, value generated, user adding it_; (b) confirm the cron registered (Vercel → Settings → Cron Jobs) and the first scheduled run banks ~25. Task 7 finding: prod IG lookup → `503 api_disabled`, Custom Search API not enabled on GCP 155038052653 → Track 3 stays phone-first.

**Track 1 — Deploy (SHIPPED):** PR [#10](https://github.com/Papafrank6969/launchlocal/pull/10) `446f74b`. Open item: **wipe boss's smoke-test data** from the prod DB before real outreach.

**Known footgun:** Vercel preview deploys run `prisma migrate deploy` against the **prod** Neon branch (Preview env shares `DATABASE_URL`). Benign so far. Fix later: separate preview DB, or move migrations out of the build command.

## Queued (not started — do not start early)

| Track | Notes |
| --- | --- |
| Places Photos: contact-form on built sites emits `CONTACT_SUBMITTED` — verify end to end | Funnel track added the event; nobody has confirmed it fires from a real published-site submission. Small QA task. |

## Shipped

| Track | PR | Landed |
| --- | --- | --- |
| Persistent Lead Backlog | #1 | `435eeed` |
| Instagram lookup typed statuses | #2 | `feddfd8` |
| Places API (New) — lead search | #3 | `23614ad` |
| Funnel event tracking | #4 | `4078e48` |
| Places Photos → New API | #5 | `30cad1f` |
| Barbershop design fix (technical-precision -> crafted-artisan) | #8 | `5fb6f92` |
| Instagram lookup key-leak fix (Piece A) | #7 | `3301443` |
| CI green — `next typegen` step + Node 24 | direct on `master` | `3bcfd86` + `2af2729` |
| WON-end handoff (delivery checklist + client summary on `/pipeline`) | #9 | `e3d1da9` |
| Deploy to Vercel + Postgres (SQLite→PG, uploads→Blob) — live at https://launchlocal-silk.vercel.app | #10 | `446f74b` |

_Minor CI follow-up (not urgent): the run logs a deprecation warning — `actions/checkout@v4` / `actions/setup-node@v4` target Node 20 and are being force-run on 24. Bump both to `@v5` whenever someone's touching the workflow._

---

## Working protocol (all agents)

1. **Start of every turn:** `git fetch origin && git pull origin master` on your
   branch's base awareness; re-read this file and `gh pr view <your PR> --comments`.
2. **One track per agent, one branch per track**, off the current `origin/master`.
   Never work on `master`.
3. **Scope is whatever the track's `docs/*-PLAN.md` says** — nothing outside it,
   not even a lint fix in a neighbouring file.
4. **Gate before every hand-back:** `npm test` · `npx tsc --noEmit` ·
   `npm run lint` · `git diff --stat` in scope. Fresh clone: `npx prisma
   generate` (and `npx prisma migrate dev` if a DB is needed) first — a red gate
   that looks environmental is **stop-and-flag**, verified against a clean
   `origin/master`, never ship-and-rationalize.
5. **Before a PR goes final:** `git fetch && git merge origin/master` into your
   branch (not a rebase onto a stale base), re-run the gate.
6. **Land approved PRs yourself** with `gh pr merge --merge` (or the UI), then
   delete the branch. Update your row in this file to `merged` in the same push,
   or ping issue #6 so the boss updates it.
7. **Blocked / spec is wrong / ambiguous:** stop, write what's unclear + your
   recommended resolution, ping **issue #6**, wait. Don't guess.
8. **When your track is done and merged:** check this board for your next queued
   track; if none, ping issue #6 that you're free.

## Working protocol (boss)

- Keep this file current: statuses, next-actions, `master` HEAD, queued tracks.
- Carve tracks so no two active ones touch the same files.
- Batch reviews — when 2+ PRs are open, review all in one pass, post every
  verdict, update the board.
- Keep at most one spec queued ahead per agent.
