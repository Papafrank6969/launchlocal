# Feature plan: Frat House: `approvals-flow`

**Status:** specced, awaiting Frank's approval
**Module:** `approvals-flow` (see `docs/FRAT-HOUSE-MAP.md`; depends on `agent-runtime` #14, `brothers` #16, and the panel from `house-ui` #15)
**Branch:** `feature/frat-house-approvals`, stacked on `feature/frat-house-brothers` (#16)
**Scope class:**
- `src/lib/approvalDecision.ts` + test (pure)
- `src/app/api/approvals/[id]/route.ts` (new)
- `src/lib/leadOutreach.ts`: the body of `PATCH /api/leads/[id]`, moved out
  unchanged so the approval route makes the exact same lead update and event
- `src/lib/siteCreate.ts`: `createSite` + the one-click "draft from lead" branch
  of `POST /api/sites`, moved out unchanged
- `src/app/api/leads/[id]/route.ts` and `src/app/api/sites/route.ts` (now call
  the moved code; no behavior change)
- `src/components/house/AgentPanel.tsx` (Approvals tab gets actions)
- `docs/FRAT-HOUSE-MAP.md`, `docs/BOARD.md`

**Nothing else.** No schema change, no new dependency, no change to `/today`
or `/outreach`.

---

## 1. Objective

Turn the read-only Approvals tab into the place Frank acts on what the brothers
drafted. Each draft is a card with buttons. Everything that leaves the building
still goes through Frank's own hands: Instagram DMs are **copied and opened in
Instagram for him to send himself**, never sent by the app.

| Draft | Frank sees | Buttons | What each does |
| --- | --- | --- | --- |
| `DM_DRAFT` | Editable message, the lead, its handle | **Copy & open Instagram** · **Mark sent** · **Reject** · **Not a fit** | Copy & open: clipboard + `ig.me/m/<handle>` in a new tab (same as `/today`). Mark sent: saves the edited text, approval → APPROVED, lead → CONTACTED with follow-up in 3 days (`outreachPatchForAction("send")`), `LEAD_CONTACTED` event. Reject: approval → REJECTED, lead untouched (Rush Chair may redraft tomorrow). Not a fit: approval → REJECTED, lead → LOST (same as `/today`'s reject). |
| `FOLLOW_UP_DRAFT` | Same | **Copy & open Instagram** · **Mark sent** · **Reject** · **Give up** | Mark sent: lead gets the bump patch (`followUpPatchForAction("bump")`: next follow-up in 4 days, count +1). Give up: lead → LOST, follow-up cleared (`"giveUp"`). |
| `SITE_DRAFT` | The preview: name, category, rating, services, Instagram | **Create site** · **Reject** | Create site: runs the **exact** one-click draft path (`POST /api/sites {leadId}`), then the card links to the new site in the builder. |
| `NOTE` | The note text | **Done** | Approval → APPROVED. |

All decisions set `decidedAt`. A decided card leaves the list, and the house
badge and "Drafts waiting" count drop on the next poll.

### Guards (in `approvalDecision.ts`, tested)

- Only a **PENDING** approval can be decided. The update is
  `updateMany where state = PENDING`, so a double click or a second tab gets
  `409 Already decided` instead of applying twice.
- **Stale drafts:** a `DM_DRAFT` needs its lead still `NEW`, and a
  `FOLLOW_UP_DRAFT` needs it still `CONTACTED`. Otherwise Mark sent returns
  `409` with a message like "Fade Lab is already CONTACTED". The card offers
  Reject. Nothing about the lead changes.
- `SITE_DRAFT` whose lead already has a site: Create site returns the existing
  site (the one-click path already does this) and approves.
- Edited DM text: 1–1,000 chars, `scrubDraft` applied (no em dashes), stored as
  the approval's `body` so the log shows what was actually sent.
- Lead deleted since the draft: `409 Lead no longer exists`, Reject still works.

### Non-goals

- No auto-send, ever (map's standing rule; Instagram account safety).
- No bulk approve. One card at a time, like `/today`.
- No editing of `SITE_DRAFT` content. Frank edits in the builder after creating.
- No changes to how brothers draft.

---

## 2. API

```
POST /api/approvals/[id]
  { action: "sent" | "reject" | "notFit" | "giveUp" | "create" | "done", body?: string }
→ 200 { approval, lead?, site? }
→ 400 bad action for this kind / bad body · 404 no approval · 409 already decided / stale lead
```

Behind the operator password (it's under `/api/`).

`approvalDecision.ts` is the pure core:

```ts
export type Decision =
  | { ok: true; state: "APPROVED" | "REJECTED"; body?: string; leadPatch: LeadPatch | null; createSite: boolean }
  | { ok: false; status: 400 | 409; error: string };
export function decide(approval: { kind; state; leadId }, lead: { name; outreachStatus; followUpCount } | null,
                       action: string, editedBody: unknown, now: Date): Decision
```

The route loads the approval and lead, calls `decide`, then does the work in
this order: claim (`updateMany PENDING → state`), lead patch through
`leadOutreach.updateLead`, then site through `siteCreate.draftSiteFromLead`. If
the lead patch or site creation throws after the claim, the approval goes back
to PENDING and the route returns 500, so Frank can retry.

## 3. UI (Approvals tab in `AgentPanel.tsx`)

- One card per PENDING approval, newest first, same `slate-*` / `blue-600`
  style as the rest of the panel.
- DM cards: a `<textarea>` prefilled with the draft (labelled, 1,000 max),
  **Copy & open Instagram** (disabled with a note if the lead has no handle),
  then **Mark sent** as the primary button. Mark sent stays enabled whether or
  not Copy & open was clicked, because Frank may have sent from his phone.
- Errors show inline on the card (`role="alert"`). A 409 stale card keeps Reject.
- After any decision: the panel reloads its detail and calls `onChanged()` so the
  house badge and stats update right away.
- Drops the "Approve / edit / reject arrives next" note.

## 4. Testing strategy

`approvalDecision.test.ts`, every row of the table plus the guards:
- each kind × each allowed action → right state, lead patch and createSite flag;
- a disallowed action for a kind (`create` on a DM) → 400;
- non-PENDING → 409; stale lead status → 409 with the lead's name; missing lead
  → 409 for lead actions, while reject and done still work;
- edited body: scrubbed, empty → 400, 1,001 chars → 400, absent → keeps the draft;
- `sent` on a DM uses `outreachPatchForAction("send", now)` (follow-up exactly
  3 days out); `sent` on a follow-up increments the count.

The moved route code keeps its behavior: the existing tests stay green, and I
check `/today` and the one-click draft by hand once.

## 5. Success criteria

1. Gate clean: `npm test`, `tsc`, `lint`.
2. Locally with test leads: Mark sent on a DM draft → lead CONTACTED with
   follow-up in 3 days, one `LEAD_CONTACTED` event, card gone, badge down.
3. Clicking Mark sent twice quickly → second gets 409, one event only.
4. Create site on a SITE_DRAFT → a site exists for the lead and the card links to it.
5. A DM draft for a lead Frank already contacted from `/today` → 409 stale, Reject works.
6. `/today` send and the one-click Draft button still work exactly as before.

## 6. Boundaries

- **Always:** lead changes only through `leadOutreach.updateLead` (same events as
  the console); site creation only through the existing one-click path.
- **Ask first:** bulk actions; auto-anything; schema changes.
- **Never:** send a DM, email or anything else from the server; publish anything
  except through the existing one-click draft path Frank already uses.

## 7. Open questions

1. **Frank:** Create site makes the site **PUBLISHED** (a live, noindexed pitch
   link), exactly like the one-click Draft button, so the link works in a DM
   right away. The alternative is DRAFT, meaning not reachable until you publish
   it in the builder. Default: **PUBLISHED, same as the button.**
2. **Frank:** Should DM cards have both **Reject** (Rush Chair may redraft that
   lead tomorrow) and **Not a fit** (lead → LOST, never drafted again)?
   Default: **both**.
