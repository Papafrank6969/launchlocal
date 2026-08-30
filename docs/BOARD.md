# Coordination board

Single source of truth for who's doing what. **The boss owns this file** and
keeps it current. Every agent runs `git pull origin master` and re-reads this
(and their PR comments) at the **start of every turn** before doing anything.

Cross-agent pings that don't belong on a PR go on **tracking issue #6**
(`gh issue view 6`, `gh issue comment 6 -b "..."`).

Last updated: 2026-08-30 by boss. PR create/merge works for all agents (gh re-authed machine-wide). **The gh PAT still lacks `workflow` scope** — `.github/workflows/**` can only be changed via the GitHub web editor (as `3bcfd86` was).

---

## Roster

| Agent | Model / tool | Working dir |
| --- | --- | --- |
| **boss** | Claude Code (claude-sonnet-5) | `C:\Users\frank\Documents\Projects\smallbiz-launchpad` |
| **agent-1** | opencode / Big Pickle | (its own clone) |
| **agent-2** | opencode / Big Pickle | `…\launchlocal-places` |
| **agent-3** | opencode / Big Pickle | `…\launchlocal-instagram` |

`master` HEAD when last updated: `3bcfd86`.

---

## Active tracks

| Track | Spec | Owner | Branch | PR | Status | Next action (whose) |
| --- | --- | --- | --- | --- | --- | --- |
| WON-end handoff | `docs/WON-END-HANDOFF-PLAN.md` | agent-1 | `feature/won-end-handoff` (not started) | — | **specced → build** | agent-1: build per the plan. Prisma migration + new `src/lib/handoff.ts` + `handoff/route.ts` + `HandoffPanel.tsx` + a one-line `customDomain` add to `api/sites/[id]/route.ts` + the `/pipeline` conditional. Gate, `git merge origin/master`, PR against `master`. |
| CI: Node version | — (infra) | boss/user | direct on `master` (web editor) | — | **1 of 2 done** | ✅ `npx next typegen` added before `tsc` (`3bcfd86`) — fixes the `LayoutProps` error. ❌ still red: `npm test` fails on the runner's Node 20.20.2 (`webidl.util.markAsUncloneable is not a function`). Root cause confirmed from the `npm ci` EBADENGINE warnings: `jsdom@30` needs `^22.22.2 || ^24.15.0 || >=26`, `undici@8` needs `>=22.19.0`, `@testing-library/jest-dom@7` needs `>=22`. **Fix: bump `node-version: 20` → `24` in `.github/workflows/test.yml`** (web editor — the gh PAT still can't push workflow files; local dev is Node 24.18.1). Not a merge blocker; still worth green. |

**agent-2: free** (photos merged). Candidate next: the `CONTACT_SUBMITTED` end-to-end QA task in Queued below — ping issue #6 to claim it, or wait for a boss spec. **agent-3: free** (key-leak merged).

## Queued (not started — do not start early)

| Track | Notes |
| --- | --- |
| Custom Search / Instagram lookup retest | Google-side `PERMISSION_DENIED` unconfirmed-cleared. Needs a real `.env` with `GOOGLE_CUSTOM_SEARCH_*`. Low priority. |
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
