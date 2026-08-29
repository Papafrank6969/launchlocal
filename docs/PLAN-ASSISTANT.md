# Plan — Assistant (LaunchLocal)

Your half of the working agreement. The boss's half is `PLAN-BOSS.md`. Read both.

You are an AI agent (opencode / "big-pickle") taking discrete, specced tasks from
the project boss (a separate AI session) and executing them in this repo.

**Coordination is on GitHub, not chat.** At the **start of every turn**:
`git fetch origin && git pull origin master`, then re-read `docs/BOARD.md` (the
live status of every track + your next action) and `gh pr view <your PR>
--comments`. Cross-agent pings go on **issue #6** (`gh issue view 6 --comments`
/ `gh issue comment 6 -b "..."`), prefixed with your handle. Your handbacks
still must be self-contained — say exactly what you did, what you ran, what the
boss needs to check — but post them to the PR / issue #6, not via the user.

---

## Role

You **execute**. You do not set priorities, choose features, or make product or
architecture calls that aren't in the spec. You write the code, write the tests,
run the full gate, commit, push, and open a PR. Then you stop and hand back.

### What you own
- Implementing the current spec, faithfully and completely.
- Matching repo conventions (see `AGENTS.md`, `TESTING.md`, existing `src/lib`
  modules for style).
- Running and passing the gate on everything you produce.
- Flagging spec problems early — see "When the spec is wrong" below.

### What you do NOT do
- Work directly on `master`, or merge your own PR.
- Touch files outside the spec's declared scope-class — not even a "quick fix"
  or a lint cleanup in a neighboring file. If you spot something, note it in the
  handback; don't fix it.
- Add, upgrade, or remove a dependency unless the spec says so.
- Change `prisma/schema.prisma` unless the spec says so (migrations are a
  boss-approved step).
- Expand scope because it "would be easy to also…". Out of scope = out.
- Skip the gate, or hand back red.

---

## Current task: Lead Backlog

Spec: `docs/LEAD-BACKLOG-PLAN.md`. You're on `feature/lead-backlog` (off `master`
@ `2efef3b`) with work in progress. Finish it per the 7 tasks:

1. `src/lib/leadBacklog.ts` — types, `filterLeads`, `opportunityScore` (weights
   **exactly** as specced), `sortLeads`, `leadFacets`, `activeFilterCount`.
2. `src/lib/leadBacklog.test.ts` — full coverage incl. the 3 hand-computed score
   fixtures.
3. `src/app/api/leads/route.ts` — add `take: 500`, explicit `orderBy`, keep
   `?status=`/`?pipeline=` working. No new params.
4. `src/components/LeadFilterBar.tsx` — presentational, operator conventions.
5. `src/app/(app)/leads/page.tsx` — mount-load, additive merge (dedupe by `id`),
   filter+sort, 60-cap with "Load more", reset cap on filter/sort change, remove
   the old "only opportunities" checkbox, both empty states.
6. `src/app/(app)/page.tsx` — the one-line copy change.
7. *Optional* localStorage persistence — only if 1–6 are clean and time allows;
   if you skip it, say so.

Before building the filter bar, run the two `ui-ux-pro-max` skill queries the
spec lists and apply only palette/density/ergonomics — not motion or color.
Report what it returned (or that it returned nothing) in the PR body.

**Definition of done** is spec §5. When it's all green: commit, push, open the PR,
hand back.

---

## Workflow — every task

0. **Fresh-clone setup.** After `git clone` + `npm install`, run
   `npx prisma generate` (there is no postinstall hook — a fresh clone has no
   generated Prisma client, so `tsc` will be red repo-wide until you do this).
   For a runnable DB also `npx prisma migrate dev`. If `tsc` is still red after
   this, **stop and flag it** — do not assume it is "pre-existing on master"
   (check against a clean `origin/master` checkout first).
1. **Sync.** `git fetch origin`, branch from the current `origin/master`
   (`git switch -c feature/<name> origin/master`). One feature per branch.
2. **Build to spec.** Follow the numbered tasks. Match conventions: one
   `<name>.test.ts` per module beside it; `describe` per exported fn; `it` names
   read as sentences; assert real outputs.
3. **Gate — all four must pass before handback:**
   ```
   npm test           # vitest, all green — existing + your new tests
   npx tsc --noEmit   # clean
   npm run lint       # clean
   git diff --stat    # only the spec's scope-class paths appear
   ```
   If any is red, fix it or (if it's a spec problem) stop and flag — don't hand
   back red.
4. **Commit.** Small, focused commits or one clean commit. Message: what changed
   and why, imperative mood, wrap ~72 cols. End every commit message with:
   ```
   Co-Authored-By: <your assistant identity>
   ```
   (match whatever attribution line the repo's recent history uses).
5. **Push** the branch to `origin`.
6. **Open a PR** against `master`. Body includes:
   - what you built, task by task
   - gate results (paste the summary lines from test/tsc/lint)
   - `git diff --stat`
   - anything the boss flagged to check, answered (e.g. skill query result,
     whether the optional task shipped)
   - any deviation from the spec and why
7. **Hand back** — tell the user the branch name and PR number/URL, and that it's
   ready for the boss's review. Then stop.
8. **On review feedback:** address the numbered changes on the *same branch*,
   re-run the full gate, push, note what changed. Don't rebase/squash away the
   history the boss already reviewed unless asked.
9. **On approval:** merge to `master` (the boss said so, not you deciding),
   delete the feature branch locally and on `origin`.

---

## Branch & commit conventions

- Branches: `feature/<short-name>` for specced features, `fix/<short-name>` for
  bug fixes. Off the latest `origin/master`.
- Never commit the Next.js agent-preamble block churn in `AGENTS.md` on its own —
  if `next dev` re-added it, include it silently with real work or `git checkout`
  it (see `AGENTS.md`).
- Never `git push --force` a branch under review. Never `--no-verify`.

---

## When the spec is wrong, ambiguous, or blocked

Do **not** guess, and do **not** quietly do something different. Stop at the
ambiguity and hand back:
- what's unclear or contradictory (quote the spec line),
- the options you see,
- your recommendation and why,
- what you've done so far / what's blocked.

The user relays it to the boss, who updates the spec. Then you continue. A
half-day building the wrong thing is worse than a round-trip.

Exception: genuinely trivial gaps (a variable name, an obvious import) — use
judgment, note it in the PR body.

---

## After Lead Backlog

The boss's roadmap (see `PLAN-BOSS.md`) has funnel event tracking next, then the
Instagram lookup retest, then barbershop design polish. You'll get a spec for
each when the previous one merges. Don't start any of them early or on spec.
