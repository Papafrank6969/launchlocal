# Feature plan: Frat House — `agent-runtime`

**Status:** approved by Frank 2026-10-04, in progress
**Module:** `agent-runtime` (see `docs/FRAT-HOUSE-MAP.md`; first in build order)
**Scope class:** `prisma/schema.prisma`, `prisma/migrations/**`, `package.json` +
lockfile (one new dep: `@anthropic-ai/sdk`), `src/proxy.ts` (new),
`src/lib/agentCost.ts` + test, `src/lib/agentBudget.ts` + test,
`src/lib/agentRunner.ts` + test, `src/lib/agentTypes.ts`, `src/lib/claude.ts`,
`src/lib/operatorAuth.ts` + test, `src/lib/agentDeps.ts` (Prisma-backed runner
I/O), `src/lib/brothers/{index,pledge}.ts`, `src/app/api/cron/agents/route.ts`,
`src/app/api/agents/[id]/run/route.ts`, `vercel.json`, `.env.example`.
**Nothing else.** No brothers (real jobs), no `/house` UI, no approval actions.
Those are the next three modules.

---

## 1. Objective

Build the engine every brother runs on, so the next modules only have to write
"what this brother does" and "how the house looks."

When this module ships:

- The database knows about agents, every run they make, their task queue, the
  drafts waiting for approval, and their chat history.
- One function, `runBrother()`, runs any brother the same way: check the money
  cap, mark it busy, let it work, record cost and outcome, mark it idle. It never
  lets a crash or an over-budget call through.
- A daily Vercel cron runs every enabled brother, and a "run now" endpoint runs
  one on demand.
- The `/house` page and its APIs sit behind a password, since running a brother
  spends real money.

A **test brother** (`pledge`) ships with the runtime. It makes one tiny Claude
call ("say hi in five words") and files one approval. It proves the pipe works
end to end and is deleted when `brothers` lands.

### Non-goals

- No real jobs (Scout, Rush Chair, etc.). That's `brothers`.
- No UI. You check this module through the API, the DB and logs. That's `house-ui`.
- No approve/reject actions. Approvals are only *created* here. That's `approvals-flow`.
- No tool-using agent loops. Each brother run is a small number of single Claude
  calls, orchestrated by our code. That's cheaper, testable, and enough for
  drafting work.

---

## 2. Tech stack

Existing stack, unchanged: Next.js 16.3 (App Router; **read
`node_modules/next/dist/docs/` before writing code**, because middleware is now
`proxy.ts`, see `01-app/01-getting-started/16-proxy.md`), React 19, Prisma 6 on
Neon Postgres, Vitest 4, Vercel (Hobby plan).

New: `@anthropic-ai/sdk` (latest). Default model **`claude-haiku-4-5`**
($1 / $5 per million input / output tokens). Model is a per-agent column, so
any brother can be moved to `claude-sonnet-5-5` ($2 / $10) later without code changes.

---

## 3. Commands

```bash
npm install @anthropic-ai/sdk            # the one new dependency
npx prisma migrate dev --name add_frat_house_runtime
npm test                                 # Vitest, must stay green
npx tsc --noEmit                         # types
npm run lint                             # eslint
npm run dev                              # local server on :3000

# Manual checks against the dev server (password = OPERATOR_PASSWORD):
curl -u frank:$OPERATOR_PASSWORD -X POST localhost:3000/api/agents/pledge/run
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/agents
```

---

## 4. Project structure (new files)

```
prisma/schema.prisma                   + Agent, AgentRun, AgentTask, Approval, AgentMessage
src/proxy.ts                           password gate for /house/** and /api/agents/**
src/lib/agentTypes.ts                  BrotherDefinition + BrotherContext types (no logic)
src/lib/agentCost.ts        + .test    usage → cost in micro-dollars (pure)
src/lib/agentBudget.ts      + .test    "today" window (America/New_York) + cap checks (pure)
src/lib/agentRunner.ts      + .test    runBrother(): orchestration with injected deps
src/lib/operatorAuth.ts     + .test    Basic-auth header check (pure)
src/lib/claude.ts                      thin SDK wrapper: ask() → { text, usage }
src/lib/brothers/pledge.ts             the throwaway test brother
src/app/api/cron/agents/route.ts       daily: run every enabled brother in sequence
src/app/api/agents/[id]/run/route.ts   POST: run one brother now
```

### Data model

```prisma
enum AgentStatus   { IDLE RUNNING ERROR OFF }
enum RunTrigger    { CRON MANUAL }
enum RunOutcome    { OK ERROR SKIPPED_BUDGET SKIPPED_BUSY }
enum TaskStatus    { QUEUED DONE FAILED }
enum ApprovalKind  { DM_DRAFT FOLLOW_UP_DRAFT SITE_DRAFT NOTE }
enum ApprovalState { PENDING APPROVED REJECTED }

model Agent {
  id          String      @id              // slug: "scout", "rush-chair", "pledge"
  name        String                       // display name on the house
  role        String                       // one line: "Grades new leads"
  model       String      @default("claude-haiku-4-5")
  enabled     Boolean     @default(true)
  status      AgentStatus @default(IDLE)
  currentTask String?                      // "drafting DM for Fade Lab" (the "Now" tab)
  lastRunAt   DateTime?
  runs        AgentRun[]
  tasks       AgentTask[]
  approvals   Approval[]
  messages    AgentMessage[]
}

model AgentRun {
  id           String     @id @default(cuid())
  agentId      String
  agent        Agent      @relation(fields: [agentId], references: [id])
  trigger      RunTrigger
  outcome      RunOutcome?                 // null while running
  startedAt    DateTime   @default(now())
  finishedAt   DateTime?
  inputTokens  Int        @default(0)
  outputTokens Int        @default(0)
  costMicros   Int        @default(0)      // 1_000_000 = $1.00
  summary      String?                     // one line for the house feed
  error        String?
  approvals    Approval[]
  @@index([startedAt])
}

model AgentTask {                          // the "Queue" tab
  id        String     @id @default(cuid())
  agentId   String
  agent     Agent      @relation(fields: [agentId], references: [id])
  kind      String                         // brother-defined, e.g. "grade_lead"
  leadId    String?
  status    TaskStatus @default(QUEUED)
  createdAt DateTime   @default(now())
  doneAt    DateTime?
  @@index([agentId, status])
}

model Approval {                           // the "Approvals" tab
  id        String        @id @default(cuid())
  agentId   String
  agent     Agent         @relation(fields: [agentId], references: [id])
  runId     String?
  run       AgentRun?     @relation(fields: [runId], references: [id])
  kind      ApprovalKind
  leadId    String?
  siteId    String?
  title     String                         // "DM for Fade Lab (Bay Shore)"
  body      String                         // the draft itself
  state     ApprovalState @default(PENDING)
  createdAt DateTime      @default(now())
  decidedAt DateTime?
  @@index([state, createdAt])
}

model AgentMessage {                       // the "Chat" tab (UI comes in house-ui)
  id        String   @id @default(cuid())
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  role      String                         // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
  @@index([agentId, createdAt])
}
```

`leadId` / `siteId` are plain strings, not relations, on purpose. That keeps this
migration off the `Lead`/`Site` tables. `approvals-flow` can promote them to
relations if it needs to.

### The brother contract (`agentTypes.ts`)

```ts
export type BrotherContext = {
  /** One Claude call. Cost is metered and the cap is re-checked before each call. */
  ask(input: { system: string; prompt: string; maxTokens: number }): Promise<string>;
  /** File a draft for Frank. Never sends anything anywhere. */
  propose(input: { kind: ApprovalKind; title: string; body: string; leadId?: string; siteId?: string }): Promise<void>;
  /** Update the "Now" line on the house. */
  setNow(text: string): Promise<void>;
};

export type BrotherDefinition = {
  id: string;            // matches Agent.id
  name: string;
  role: string;
  /** Do the work. Return a one-line summary for the run log. */
  run(ctx: BrotherContext): Promise<string>;
};
```

---

## 5. Code style

Match `src/lib/leadCron.ts`: exported `UPPER_SNAKE` constants for tunables,
small pure functions, structural input types instead of importing Prisma types
into pure modules, and a Prisma-free core with I/O pushed to the route. Example
of the expected shape:

```ts
// src/lib/agentCost.ts
export const MODEL_PRICES: Record<string, { inputPerM: number; outputPerM: number }> = {
  "claude-haiku-4-5": { inputPerM: 1_000_000, outputPerM: 5_000_000 },   // micros per 1M tokens
  "claude-sonnet-5-5": { inputPerM: 2_000_000, outputPerM: 10_000_000 },
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Cost of one call in micro-dollars, rounded up. Unknown model → throws (never silently free). */
export function costMicros(model: string, usage: Usage): number { … }
```

- Money is **integer micro-dollars** everywhere. No floats.
- Cache writes bill at 1.25× input and cache reads at 0.1× input.
- `runBrother(def, trigger, deps)` takes its I/O as a `deps` object (`db`-shaped
  functions, `ask`, `now`) so the test can pass fakes. Same idea as `leadCron`
  keeping Prisma out of the logic, one level up.
- `claude.ts` uses the SDK's typed errors (`Anthropic.RateLimitError` etc.), never
  string matching, and reads only `ANTHROPIC_API_KEY` from env.
- Lucide/palette rules don't apply. There's no UI in this module.

---

## 6. Behavior: `runBrother()`

In order:

1. **Busy check.** If the agent's `status` is `RUNNING` and `lastRunAt` is
   under 10 minutes old, record outcome `SKIPPED_BUSY` and stop. If it's older,
   treat it as a crashed run and continue.
2. **Budget check.** Sum `costMicros` of runs started since midnight
   America/New_York. If the sum is ≥ `DAILY_BUDGET_MICROS` (1_000_000), record
   `SKIPPED_BUDGET` and stop.
3. Create the `AgentRun`, set agent `RUNNING`.
4. Call `def.run(ctx)`. Inside, every `ctx.ask()`:
   - re-checks `spentToday + thisRunSoFar < cap`. If over, it throws
     `BudgetExceededError`, which ends the run as `SKIPPED_BUDGET`;
   - meters `usage` into the run's token and cost totals, *even if the brother
     later throws*.
5. On success: outcome `OK`, `summary` = return value, agent `IDLE`,
   `currentTask` cleared, `lastRunAt` = now.
6. On any other error: outcome `ERROR`, `error` = message (truncated to 500
   chars), agent `ERROR`. Never rethrow out of `runBrother`, so one bad brother
   can't stop the cron from running the rest.

Worst case for the cap: one call can overshoot by its own cost (a few cents on
Haiku with `maxTokens` ≤ 2000). `ask()` enforces `maxTokens ≤ 2000`.

### Routes

- `GET /api/cron/agents`: same `CRON_SECRET` bearer check as
  `daily-leads`. Upserts each registered brother into `Agent`, so a new brother
  shows up automatically. Then runs every `enabled` brother **sequentially**
  and returns `{ results: [{ id, outcome, costMicros, summary }] }`.
  `maxDuration = 60`. Schedule `"30 17 * * *"` in `vercel.json`, which is 30
  minutes after `daily-leads`, so Scout sees that day's fresh leads.
- `POST /api/agents/[id]/run`: behind the operator gate. Runs one brother
  with trigger `MANUAL` and returns the same result shape. 404 for an
  unknown id.

### Operator gate (`src/proxy.ts`)

**Decision (Frank, 2026-10-04): the gate covers the whole operator app**, not
just `/house`. HTTP Basic auth on every route **except** this public allowlist:

- `/s/**`: published client sites (incl. their `llms.txt`, `sitemap.xml`)
- `/api/public/**`: the client-site contact form posts here
- `/api/cron/**`: protected by `CRON_SECRET` instead
- `/privacy`, `/terms`: LaunchLocal's own legal pages
- `/robots.txt`, `/icon.svg`, `/_next/**`, and files in `public/`

The allowlist decision is a pure function, `isPublicPath(pathname)` in
`operatorAuth.ts`, and is unit-tested route by route. The password comes from
`OPERATOR_PASSWORD`, and any username is accepted. If `OPERATOR_PASSWORD` is
unset, fail **closed** (503 "operator password not configured"); never open.
Header parsing and constant-time comparison also live in `operatorAuth.ts`.

---

## 7. Testing strategy

Vitest, sibling `*.test.ts`, real values (per `TESTING.md`):

- `agentCost.test.ts`: Haiku and Sonnet cost for a known usage, cache
  read/write pricing, rounding up, unknown model throws.
- `agentBudget.test.ts`: the "today" window across ET midnight and both
  DST changes (2026-03-08, 2026-11-01); `canSpend` at, under and over the cap.
- `agentRunner.test.ts` (fake deps, no DB, no network). Each outcome path:
  OK, ERROR (brother throws), SKIPPED_BUDGET before start, SKIPPED_BUDGET
  mid-run (second `ask` crosses the cap and the first call's cost is still
  recorded), SKIPPED_BUSY, stale RUNNING gets reclaimed, `maxTokens` > 2000
  rejected, `propose` writes PENDING, and an error message is truncated to 500.
- `operatorAuth.test.ts`: right password passes, wrong fails, malformed or
  missing header fails, unset password fails closed.
- Not unit-tested (I/O shells, like existing routes): `claude.ts`, the two
  routes, `proxy.ts`. Covered by the manual checks in §8.

---

## 8. Success criteria

1. `npm test`, `npx tsc --noEmit` and `npm run lint` are all clean. The existing
   suite stays green.
2. The migration applies cleanly on a fresh DB and on a copy of prod.
3. Locally, with a real `ANTHROPIC_API_KEY`:
   `POST /api/agents/pledge/run` returns `outcome: "OK"`, with cost > 0 and
   under 1000 micros. An `AgentRun` row has matching tokens, and a PENDING
   `Approval` exists.
4. With `DAILY_BUDGET_MICROS` temporarily set to 1, the same call returns
   `SKIPPED_BUDGET` and **no** Claude request is made (check the console logs).
5. `/`, `/leads`, `/builder`, `/api/leads` and `/api/agents/*` return 401
   without the password and 503 when `OPERATOR_PASSWORD` is unset. Every
   allowlisted path (a published `/s/<slug>`, its contact-form POST, `/privacy`,
   `/robots.txt`, the cron route) still works with no password.
6. `GET /api/cron/agents` with the bearer token runs `pledge`; without the
   token it returns 401.
7. After deploy: Frank adds `ANTHROPIC_API_KEY` and `OPERATOR_PASSWORD` in Vercel,
   and the next day's cron run shows one `pledge` run in the DB.

---

## 9. Boundaries

- **Always:** route every Claude call through `ctx.ask()` (metered and capped);
  keep money in integer micros; write a test with every new function and branch;
  run the full gate before pushing; read the Next 16 docs for `proxy.ts`.
- **Ask first:** any dependency beyond `@anthropic-ai/sdk`; any change to
  `Lead`/`Site` tables; raising the $1/day cap; any model other than Haiku 4.5
  or Sonnet 5.5; moving off the Hobby plan or adding cron entries beyond the one.
- **Never:** send, post or publish anything outward from an agent; log or
  commit `ANTHROPIC_API_KEY`/`OPERATOR_PASSWORD`; let the gate fail open; call
  the SDK directly from a brother; touch files outside the scope class.

---

## 10. Open questions

1. **Frank:** add `ANTHROPIC_API_KEY` (the key you already have) and a new
   `OPERATOR_PASSWORD` to Vercel → Settings → Environment Variables, and to local
   `.env`. Don't paste either into chat.
2. ~~Gate the whole operator app?~~ **Resolved 2026-10-04: yes**, see §6.
3. **Boss:** Vercel Hobby functions get 60s here. Sequential brothers each
   making a few Haiku calls fit easily. If `brothers` grows past roughly 40s total,
   split the cron by brother.
