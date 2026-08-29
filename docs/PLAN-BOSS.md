# Plan — Project Boss (LaunchLocal)

My half of the working agreement. The assistant's half is `PLAN-ASSISTANT.md`.
Read both together.

---

## Role

I own the repo direction. I **plan, spec, review, and decide**. I may write code
directly, but the default is: I write a spec, the assistant builds it, I review
the diff. I do **not** merge my own unreviewed feature code to `master` without
the same gate the assistant is held to.

### What I own
- The feature roadmap and its priority order.
- Every spec that goes to the assistant (`docs/<FEATURE>-PLAN.md`).
- Design decisions — recorded in `docs/DESIGN-PROCESS.md`'s audit log.
- Reviewing and deciding on every diff/PR: approve / request changes / reject,
  explicitly.
- Holding the line: `docs/SITE-QUALITY-CHECKLIST.md` outranks feature count.

### What I will not do
- Hand over a task without a self-contained written spec.
- Expand scope during review — new ideas become the next spec, not review comments.
- Touch the assistant's working branch or working tree.
- Approve a diff I haven't actually read against the spec.

---

## Active work: Lead Backlog

Spec: `docs/LEAD-BACKLOG-PLAN.md`. Assistant is implementing on
`feature/lead-backlog` (branched off `master` @ `2efef3b`).

**I am waiting on:** the assistant to finish, pass its gate, push, and open a PR
against `master`.

**When the PR lands, I review in this order:**
1. `git diff --stat` — nothing outside the spec's scope-class paths
   (`src/lib/leadBacklog.*`, `src/app/api/leads/route.ts`,
   `src/components/LeadFilterBar.tsx`, `src/app/(app)/leads/page.tsx`,
   `src/app/(app)/page.tsx`, + optional Task 7 in `leadBacklog.ts`/its test).
   Any stray file in `src/lib/templates.tsx`, `src/app/s/**`,
   `src/components/site/**`, `designSystems.ts`, or `prisma/` → reject on sight.
2. `src/lib/leadBacklog.ts` — predicates and the `opportunityScore` weights match
   the spec **exactly**. This is the contract.
3. `src/lib/leadBacklog.test.ts` — asserts real values/ordering, not smoke; the
   3 fixture score cases are present and correct.
4. `LeadFilterBar.tsx` — operator palette only, `.input`/`.select-compact`,
   labelled controls, focus rings, Lucide, no motion/color from skill output.
5. The `leads/page.tsx` rework — mount-load, additive merge (dedupe by `id`,
   verified against a re-search), 60-cap + reset-on-filter-change, empty vs
   no-match states both handled.
6. Gate evidence in the PR: `npm test` (249+ passing), `tsc --noEmit`,
   `npm run lint` all clean.
7. Commit notes say whether Task 7 shipped and what the skill query returned.

**Decision output:** a written verdict on the PR — approve, or a numbered list of
required changes, or reject with reason. If approved, I say so and the assistant
merges (I don't).

---

## Roadmap (priority order)

I drive these one at a time. Each gets a `docs/<FEATURE>-PLAN.md` before it goes
to the assistant. I don't spec ahead more than one deep — the next spec is
informed by how the last one landed.

### 1. Lead Backlog — *in progress*
Persistent leads on `/leads`, filter/sort, opportunity score. See above.

### 2. Funnel event tracking + Stats rework — *next; spec after #1 merges*
The gap: `Event` only records `LEAD_FOUND / SITE_CREATED / SITE_PUBLISHED /
SITE_VIEW`. There is no event when a lead is contacted, replies, is won/lost, or
when a contact form is submitted on a built site. So `/stats` derives its funnel
from current lead status counts — it can't show flow over time, and a lead that
goes NEW→WON in a day looks identical to one that took a month.
- Add `LEAD_CONTACTED`, `LEAD_WON`, `LEAD_LOST`, `CONTACT_SUBMITTED` event types.
- Emit them from the existing PATCH / outreach-queue / follow-up / public contact
  routes.
- Rework `/stats` into a real funnel (found → opportunity → contacted → responded
  → won) with a 30/90-day time series, built from events.
- Pure aggregation logic in `src/lib/` with tests, same as everything else.
- Migration needed (new enum values) — spec will call that out explicitly.

### 3. Instagram handle lookup — retest + honest fallback UX
Custom Search API has been returning `PERMISSION_DENIED` across fresh keys
(Google-side, unresolved). It blocks auto-finding handles for no-website leads,
which is most of the barbershop pipeline.
- Retest the live path first — it may have propagated.
- If still broken: make the `/leads` handle flow manual-first and unembarrassing
  — the "Search Google ↗" link stays, "Find it" degrades to a clear "lookup
  unavailable" state instead of a generic error, and the Outreach queue stops
  hiding handle-less NEW leads so they can be triaged (the backlog from #1
  already helps here).

### 4. Barbershop design polish
`technical-precision`'s blue primary may read too "contractor" for a barbershop
(flagged in `DESIGN-PROCESS.md`, 2026-08-29 entry). Revisit only if it actually
looks wrong on a built barbershop site — run `/leads` → draft a barbershop →
look at `/s/[slug]`. Options: a warmer variant bias for the grooming categories,
or accept it. Small, design-led, follows `DESIGN-PROCESS.md` §1.

### 5. (later) Places API (New) migration
Legacy endpoints + the per-place N+1 Details fan-out (1 request vs ~60) +
unreliable `next_page_token`. Migrating to `places.googleapis.com/v1` with a
field mask returns website/phone/rating inline and paginates reliably. Bigger
task, needs "Places API (New)" enabled in Google Cloud. Not urgent while volume
is low.

---

## Spec standard

Every spec I hand over has: the goal and the *why*, explicit non-goals, the
scope-class paths (and what's off-limits), numbered tasks with exact
files/functions/signatures, the edge cases, a definition-of-done gate, and my
review checklist. If the assistant has to guess, the spec failed.

---

## Cadence

- Assistant finishes a task → pushes → opens PR → tells me (via the user).
- I review within the same session it's raised, produce a written verdict.
- Changes requested → assistant revises on the same branch → I re-review the
  delta only.
- Approved → assistant merges to `master`, deletes the branch.
- I write the next spec. Repeat.
- Design decisions get an audit-log entry in `DESIGN-PROCESS.md` as they're made,
  not in a batch.
