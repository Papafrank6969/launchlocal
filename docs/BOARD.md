# Coordination board

Single source of truth for who's doing what. **The boss owns this file** and
keeps it current. Every agent runs `git pull origin master` and re-reads this
(and their PR comments) at the **start of every turn** before doing anything.

Cross-agent pings that don't belong on a PR go on **tracking issue #6**
(`gh issue view 6`, `gh issue comment 6 -b "..."`).

Last updated: 2026-08-29 by boss. PR create/merge works for all agents (gh re-authed machine-wide).

---

## Roster

| Agent | Model / tool | Working dir |
| --- | --- | --- |
| **boss** | Claude Code (claude-sonnet-5) | `C:\Users\frank\Documents\Projects\smallbiz-launchpad` |
| **agent-1** | opencode / Big Pickle | (its own clone) |
| **agent-2** | opencode / Big Pickle | `…\launchlocal-places` |
| **agent-3** | opencode / Big Pickle | `…\launchlocal-instagram` |

`master` HEAD when last updated: `9920f7e`.

---

## Active tracks

| Track | Spec | Owner | Branch | PR | Status | Next action (whose) |
| --- | --- | --- | --- | --- | --- | --- |
| Lookup key-leak fix (Piece A) | `docs/LOOKUP-LEAK-AND-BARBER-CHECK-PLAN.md` | agent-3 | `feature/lookup-leak-and-barber-check` | [#7](https://github.com/Papafrank6969/launchlocal/pull/7) | **approved** | agent-3: `git merge origin/master` in, re-gate, land `gh pr merge --merge`, delete branch, mark row `merged`. (The `BARBERSHOP-DESIGN-FINDINGS.md` stub in the PR is fine — boss overwrites it.) |
| Barbershop design findings | `docs/DESIGN-PROCESS.md` (2026-08-29 note) | boss | — | — | **in progress** | boss: run the app, draft a barbershop site, evaluate `technical-precision`, write the real `docs/BARBERSHOP-DESIGN-FINDINGS.md` → spec a change or close the note. |

**agent-1: free** (funnel merged). **agent-2: free** (photos merged). No tracks queued — see below; ping issue #6.

## Queued (not started — do not start early)

| Track | Notes |
| --- | --- |
| WON-end handoff | Nothing exists for "lead said yes → deliver the site" (domain steps, export, client-facing package). Not specced. **Candidate next track for agent-1 or agent-2** — boss to spec. |
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
| Instagram lookup key-leak fix | #7 | _pending agent-3 land_ |

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
