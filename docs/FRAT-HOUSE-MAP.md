# Capability map: Frat House

**Status:** approved by Frank 2026-10-04 (module split, build order, daily
Vercel schedule, $1/day budget).
**Inspiration:** a TikTok of a 3D isometric farm where each building is an AI
agent working a reselling business. Ours is an original isometric **frat house**
where each room is a "brother" (a real Claude agent) working LaunchLocal.

This file is the index. Each module gets its own `docs/FRAT-HOUSE-<MODULE>-PLAN.md`,
specced and built in the order below. Module ids are fixed; never rename them.

| Module id | Responsibility | Depends on | Spec |
| --- | --- | --- | --- |
| `agent-runtime` | DB models (agents, runs, tasks, approvals, chat), the shared "run a brother" engine, Claude client wrapper, cost accounting + hard $1/day cap, cron + manual-run routes, operator password gate | — | `FRAT-HOUSE-RUNTIME-PLAN.md` |
| `brothers` | The actual jobs: Scout (grade new leads), Rush Chair (draft first DMs), Follow-up (draft follow-ups for due leads), Builder (draft a site for warm leads), Treasurer (daily stats digest). Handle Hunter (finds IG handles via the Brave Search API; see brothers plan §9). | `agent-runtime` | `FRAT-HOUSE-BROTHERS-PLAN.md` |
| `house-ui` | `/house`: Frank's 3D house (rotatable), one lit window per brother, stats bar (leads, DMs sent, replies, sites, spend vs budget), per-agent panel with Now / Queue / Schedule / Chat / Approvals tabs | `agent-runtime` | `FRAT-HOUSE-UI-PLAN.md` |
| `approvals-flow` | Approve / edit / reject drafts. Approved DM = copy + open Instagram + mark sent (same mechanics as `/today`). Approved site = publish. | `agent-runtime`, `brothers` | `FRAT-HOUSE-APPROVALS-PLAN.md` |

**Build order:** `agent-runtime` → (`brothers` ∥ `house-ui`) → `approvals-flow`

## Standing rules for every module

- **Nothing outward without Frank.** Agents draft; they never send a DM, email,
  or publish a site. Instagram DMs stay manual forever (account-safety call).
- **Hard money cap.** No Claude call is made once the day's spend hits the cap.
- Repo conventions apply: `docs/PLAN-BOSS.md` / `PLAN-ASSISTANT.md` workflow,
  pure logic in `src/lib/*.ts` with a sibling test, `BOARD.md` row per track.
