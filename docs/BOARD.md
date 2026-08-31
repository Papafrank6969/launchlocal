# Coordination board

Single source of truth for who's doing what. **The boss owns this file** and
keeps it current. Every agent runs `git pull origin master` and re-reads this
(and their PR comments) at the **start of every turn** before doing anything.

Cross-agent pings that don't belong on a PR go on **tracking issue #6**
(`gh issue view 6`, `gh issue comment 6 -b "..."`).

Last updated: 2026-08-30 by boss. PR create/merge works for all agents; boss's `gh` token has `workflow` scope. CI (`Test` workflow) is green. **No active tracks — all three agents free. Boss to spec the next one.**

---

## Roster

| Agent | Model / tool | Working dir |
| --- | --- | --- |
| **boss** | Claude Code (claude-sonnet-5) | `C:\Users\frank\Documents\Projects\smallbiz-launchpad` |
| **agent-1** | opencode / Big Pickle | (its own clone) |
| **agent-2** | opencode / Big Pickle | `…\launchlocal-places` |
| **agent-3** | opencode / Big Pickle | `…\launchlocal-instagram` |

`master` HEAD when last updated: `e3d1da9`.

---

## Active tracks

| Track | Spec | Owner | Branch | PR | Status | Next action (whose) |
| --- | --- | --- | --- | --- | --- | --- |
| _(none)_ | | | | | | |

**Goal context:** user wants a server that queues ~25 fresh leads/day to message manually after school. This deploy track is step 1 of 3 → then Track 2 (daily lead cron) → Track 3 (`/today` queue). See the "Next tracks" section at the bottom of `DEPLOY-POSTGRES-PLAN.md`.

## Queued (not started — do not start early)

| Track | Notes |
| --- | --- |
| **Track 2 — Daily lead cron** | Specced after the deploy track lands. `target_rotation` config, `/api/cron/daily-leads` on Vercel Cron (~3pm user local), dedup by `placeId`, stop at ~25 net-new with a contact method, per-run Places-call cap, `CRON_SECRET`. Folds in the Instagram lookup retest. |
| **Track 3 — `/today` queue** | Specced after Track 2. 25 freshest `NEW` leads with a contact method, best channel per lead, one-tap DM/email/call, "Mark contacted" → `LEAD_CONTACTED`, yesterday's uncontacted carried over. Multi-channel. |
| Custom Search / Instagram lookup retest | Google-side `PERMISSION_DENIED` unconfirmed-cleared. Needs a real `.env` with `GOOGLE_CUSTOM_SEARCH_*`. **Folded into Track 2.** |
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
