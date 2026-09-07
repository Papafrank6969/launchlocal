# Coordination board

Single source of truth for who's doing what. **The boss owns this file** and
keeps it current. Every agent runs `git pull origin master` and re-reads this
(and their PR comments) at the **start of every turn** before doing anything.

Cross-agent pings that don't belong on a PR go on **tracking issue #6**
(`gh issue view 6`, `gh issue comment 6 -b "..."`).

Last updated: 2026-09-06 by boss. App **live** at https://launchlocal-silk.vercel.app. Tracks 1 + 2 shipped. **Track 3 (`/today` DM worklist) is specced** — `docs/TODAY-QUEUE-PLAN.md`, DM-only per user, blocked for prod verification on the Custom Search API enable (plan §0); code lands without waiting.

**NEW 2026-09-06 — compliance & brand pass.** Frank's "don't get sued / don't look vibe coded" review. Audit + 7 tracks in `docs/COMPLIANCE-AUDIT-2026-09.md`; permanent rules in `docs/BRAND-AND-COMPLIANCE-STANDARDS.md` (read this before any template/legal/site-chrome change). Most of `SITE-QUALITY-CHECKLIST.md` already held; real gaps: Google Places 30-day cache limit (F-2, P0), unclaimed pitch sites (F-1, P0), thin privacy policy, runtime Google Fonts + Maps iframe, pill buttons + em dashes. **C-C + C-D ready now; C-A/C-E need Frank's decisions 1–5.**

---

## Roster

| Agent | Model / tool | Working dir |
| --- | --- | --- |
| **boss** | Claude Code (claude-sonnet-5) | `C:\Users\frank\Documents\Projects\smallbiz-launchpad` |
| **agent-1** | opencode / Big Pickle | (its own clone) |
| **agent-2** | opencode / Big Pickle | `…\launchlocal-places` |
| **agent-3** | opencode / Big Pickle | `…\launchlocal-instagram` |

`master` HEAD when last updated: see the latest spec commit on `origin/master` (Track 3 + compliance-audit docs pushed 2026-09-06).

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

### Compliance & brand pass (`docs/COMPLIANCE-AUDIT-2026-09.md`, standards in `docs/BRAND-AND-COMPLIANCE-STANDARDS.md`)

Frank's "don't get sued / don't look vibe coded" pass, 2026-09-06. 7 tracks, carved to not collide. **C-A and C-E are blocked on Frank's decisions 1–5 in the audit; C-C and C-D can start now.** Suggested order: C-C, C-D → C-B → C-A, C-E → C-F → C-G.

| Track | Scope | Blocked on |
| --- | --- | --- |
| **C-C — Brand fixes in templates** | Kill pill buttons + `uppercase tracking-widest`, em dash out of trust-bar snippet + `photoAttribution.ts` delimiter, flatten blank-card gradient, hero `alt` text, tagline, drop scroll progress bar. B-1/2/3/4/5/6. | **PR [#12](https://github.com/Papafrank6969/launchlocal/pull/12) — boss-reviewed, gate green, awaiting merge (author-merge; user or boss to land).** |
| **C-D — Places data retention** | **Specced: `docs/PLACES-RETENTION-PLAN.md`.** Add `Lead.placesRefreshedAt`, `placesRetention.ts` (pure), `fetchPlaceById` in `places.ts`, new `/api/cron/refresh-places` (`0 4 * * *`), migration. F-2 (P0). | Needs an agent with a working local DB — boss clone can't `prisma migrate dev` (SQLite `file:` URL vs postgres provider). |
| **C-B — Cookies & third-party embeds** | **Specced: `docs/COOKIES-FONTS-PLAN.md`.** Self-host all ~20 font families via `next/font/google` (build-time, zero runtime Google call), swap the Maps iframe for a directions card, delete the cookie banner. F-5/6/7. Decision 2 = US-clean. | Needs an agent that can run the app locally (verify no Google requests in the Network tab). |
| **C-A — Client-site legal pages** | Rewrite `legalContent.ts` (real processors/retention/rights/fixed last-updated), add Cookie Policy + Refund/Cancellation pages, footer links. F-3/4/8. | Decisions 1, 2, 4 |
| **C-E — App legal + hardening** | `/(app)/privacy` + `/(app)/terms` + footer links, `noindex` meta on `(app)`, contact-form consent line, submission retention, `docs/DATA-HANDLING.md` (SHIELD Act). F-9/10/11/12. | Decision 1 |
| **C-F — Unclaimed pitch sites** | Disclosure banner ("prepared by LaunchLocal, not affiliated, claim/remove: …") + takedown path, or switch to auth-gated previews. F-1 (P0). | Decision 5 + lawyer |
| **C-G — Guard tests** | `templates.test.ts` + repo-wide assertions: no em dash, no `rounded-full` on a button, no gradient, legal pages non-blank. | after C-A/C-C |

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
