# Feature plan: Frat House: `house-ui`

**Status:** built 2026-10-04 (see §11 for how the build differs from this plan)
**Module:** `house-ui` (see `docs/FRAT-HOUSE-MAP.md`; depends on `agent-runtime`, PR #14)
**Branch:** `feature/frat-house-ui`, on `master` after #14 merged
**Scope class:** `package.json` + lockfile (deps below), `prisma/schema.prisma` +
one migration (adds `CHAT` to `RunTrigger`), `src/app/(app)/house/**`,
`src/components/house/**`, `src/app/api/house/route.ts`,
`src/app/api/agents/[id]/route.ts`, `src/app/api/agents/[id]/chat/route.ts`,
`src/lib/houseLayout.ts` + test, `src/lib/houseStats.ts` + test,
`src/lib/agentChat.ts` + test, `src/lib/agentRunner.ts` (export the shared
metering helper, no behavior change), `src/components/AppHeader.tsx` (one nav
link), `public/house/**` (the house and car models, already copied in) and
`docs/house-prototype/**` (Frank's working prototype). **Nothing else.** No approve/reject buttons (that's `approvals-flow`), no
real brothers (that's `brothers`).

---

## 1. Objective

`/house` is the home screen for the agents: a **real 3D frat house you can
rotate**, with one room per brother. You can see at a glance who's working,
what they're doing, what it's costing, and what's waiting for you.

### What Frank sees

- **Stats bar** across the top: leads in backlog · DMs sent (7d) · replies (7d)
  · sites published · drafts waiting · **today's spend vs $1.00** (with a bar).
- **The house** (three.js): Frank's modern house model (`public/house/house-final.glb`)
  on its lot, with six supercars parked on the driveway pad out front and a
  street beyond. This is a port of his working prototype,
  `docs/house-prototype/scene.html`: same lights, ground, pad, street and car
  placement (`placeCar`). Drag to orbit, scroll or pinch to zoom, and it slowly
  auto-rotates when idle. Each brother owns a room, shown as a glowing window
  hotspot placed on the model. The window light and floating name tag show his
  state:
  - **IDLE**: warm window glow, name tag only
  - **RUNNING**: brighter glow that pulses, plus a "Now" line under the name tag
  - **ERROR**: red window
  - **OFF**: dark window, greyed tag
  - A small badge with a count appears when he has drafts waiting.
- **Click a room** (or its name in the brother list) to open his **panel**:
  - **Now**: status, current task, last run summary, cost, time, and a
    **Run now** button (calls the existing `POST /api/agents/[id]/run`).
  - **Queue**: his QUEUED tasks.
  - **Schedule**: "Runs daily at 1:30pm ET" plus his last 10 runs (outcome,
    cost, summary).
  - **Chat**: live conversation. He knows his role, his last 5 runs and his
    pending drafts. Metered and capped.
  - **Approvals**: his PENDING drafts, read-only for now. A note says
    "Approve / edit / reject arrives next".
- The page refreshes the house and stats every **15s** while open, so
  RUNNING/IDLE changes show up without reloading.

### Rooms (hotspots on the imported house)

The house is one mesh, so a "room" is a clickable, state-colored glow panel
sitting just in front of a real window or opening on the model, with an `<Html>`
name tag above it. Positions are measured on the model (orbit the prototype,
read the coordinates) and stored in `ROOMS`. No props are modeled.

| Brother | Spot on the model |
| --- | --- |
| Scout | roof / top floor |
| Rush Chair | front entrance |
| Follow-up | upper-floor window |
| Builder | garage / driveway side |
| Treasurer | ground-floor window |
| Pledge (test) | smallest side window |

Brothers without a mapped room (future ones) fill numbered overflow rooms
automatically, so the page never breaks when a brother is added.

### Non-goals

- No approve/edit/reject actions (`approvals-flow`). No real brothers (`brothers`).
- No 3D models beyond the seven in `public/house/` (house + six cars). No new
  textures or fonts beyond what drei ships.
- No re-converting or re-optimizing the models. They're already
  meshopt-compressed (conversion scripts are in `docs/house-prototype/`).
- No sound, no day/night cycle, no physics.

---

## 2. Tech stack

New deps (Frank chose real 3D on 2026-10-04):

| Package | Version | Why |
| --- | --- | --- |
| `three` | ^0.186 | 3D engine |
| `@react-three/fiber` | ^9.8 | React renderer for three (supports React ≥19 <19.4; repo is 19.2.8) |
| `@react-three/drei` | ^10.7 | `OrbitControls`, `Html` name tags, `useGLTF` (meshopt decoding built in) |
| `@types/three` | ^0.186 (dev) | types |

Pinned to three 0.186 because that's what the prototype runs on.

The scene loads **only on `/house`**, through `next/dynamic` with `ssr: false`,
so no other page's bundle grows. The models are static files in `public/house/`
(about 18.5 MB total: house 8 MB, cars 1–2.4 MB each). The house loads first
and the cars load after it, each one failing on its own like the prototype's
`Promise.allSettled`. Everything else uses the existing stack:
Next 16 App Router, Tailwind, Lucide and the operator palette.

---

## 3. Commands

```bash
npm install three @react-three/fiber @react-three/drei && npm install -D @types/three
npx prisma migrate dev --name run_trigger_chat      # local Docker DB (see .env.local)
npm test && npx tsc --noEmit && npm run lint
npm run dev                                          # then open /house (operator password)
```

Visual QA: gstack `/browse` against the dev server. Screenshots at desktop and
375px widths, plus room click → panel open → Run now → status flip.

---

## 4. Project structure

```
src/app/(app)/house/page.tsx           server: auth'd by proxy; renders <HouseView/>
src/components/house/HouseView.tsx     client: polling, stats bar, brother list, panel state
src/components/house/HouseScene.tsx    client: <Canvas> + lights + ground/pad/street + house + cars + rooms (dynamic, ssr:false), ported from the prototype
src/components/house/Room.tsx          one hotspot: glow panel (state color), <Html> tag, click target
public/house/*.glb                     house-final + porsche, rolls, ferrari, svj, revuelto, bugatti (in repo)
docs/house-prototype/                  scene.html prototype + conversion scripts (reference, not shipped)
src/components/house/StatsBar.tsx      the six stats + spend bar
src/components/house/AgentPanel.tsx    slide-over with the five tabs
src/components/house/ChatTab.tsx       message list + composer
src/lib/houseLayout.ts      + test     ROOMS map, layoutRooms(ids), roomLook(status)  (pure)
src/lib/houseStats.ts       + test     buildHouseStats(rows) → stats bar numbers     (pure)
src/lib/agentChat.ts        + test     buildChatPrompt(...) + chat turn via metered ask (pure core)
src/app/api/house/route.ts             GET: stats + agent summaries (for polling)
src/app/api/agents/[id]/route.ts       GET: one brother's runs, tasks, approvals, messages
src/app/api/agents/[id]/chat/route.ts  POST {message}: one metered chat turn
```

### Data contracts

```ts
// GET /api/house
type HouseResponse = {
  stats: {
    backlog: number;          // leads with outreachStatus NEW and no site
    dmsSent7d: number;        // LEAD_CONTACTED events, last 7 days
    replies7d: number;        // LEAD_RESPONDED events, last 7 days
    sitesPublished: number;
    draftsWaiting: number;    // Approval state PENDING
    spentTodayMicros: number; // same window as the runtime's budget
    budgetMicros: number;
  };
  agents: {
    id: string; name: string; role: string;
    status: "IDLE" | "RUNNING" | "ERROR" | "OFF";
    currentTask: string | null;
    lastRun: { outcome: string; summary: string | null; costMicros: number; finishedAt: string | null } | null;
    queued: number; pending: number;
  }[];
};
```

### Chat

`POST /api/agents/[id]/chat {message}`:
1. Rejects an empty message or one over 1,000 chars (400).
2. Uses the **same budget gate and cost metering as `runBrother`**, recorded as
   an `AgentRun` with the new trigger `CHAT`, so chat spend counts toward the
   $1/day cap and shows in Schedule history. Over budget returns 429 with
   "Daily budget reached".
3. `buildChatPrompt()` builds the system prompt (his name, role, last 5 run
   summaries, his pending draft titles, and "you can't send anything; drafts
   need Frank's approval") plus the last 20 messages. `maxTokens` is 400.
4. Saves both messages to `AgentMessage` and returns the reply.

---

## 5. Code style

Same conventions as the runtime: pure logic in `src/lib` with sibling tests,
I/O in routes, and integer micros. Components follow the operator app:
`slate-*` / `blue-600`, Lucide icons, visible focus rings, 150–300ms
transitions. Example of the pure layout seam the scene consumes:

```ts
// src/lib/houseLayout.ts
export type RoomSpec = { label: string; position: [number, number, number]; size: [number, number]; facing: number };
export const ROOMS: Record<string, RoomSpec> = { scout: {…}, "rush-chair": {…}, … };

/** Mapped brothers get their room; unknown ids fill OVERFLOW slots in id order. */
export function layoutRooms(ids: string[]): { id: string; room: RoomSpec }[] { … }

/** Visual state for a room. Pure, so it's tested without WebGL. */
export function roomLook(status: AgentStatus, reducedMotion: boolean): { window: string; glow: number; pulse: boolean } { … }
```

The 3D scene's colors (the prototype's sky `#0b1020`, ground, pad, street, and
the window state colors) are its own palette, not the operator palette, and are
kept in one `PALETTE` const in `houseLayout.ts`. Every piece of text (tags, panel, stats) is
regular DOM, so it can be read and has real contrast.

---

## 6. Accessibility and performance

- The canvas is decorative for screen readers (`aria-hidden`). The **brother
  list** next to it (a list of buttons, keyboard-reachable) opens the same
  panels. You can do everything without touching the 3D.
- With `prefers-reduced-motion`, there's no auto-rotate and no window pulse.
- The panel is a dialog: focus moves in, Esc closes it, and focus returns to
  the room or button that opened it.
- Pixel ratio is capped at 2 and `frameloop="demand"` when nothing animates, so
  an idle phone doesn't burn battery.
- WebGL unavailable, or the house model failing to load, means the canvas falls
  back to the brother list plus a short note. The page still works.
- While the ~18.5 MB of models download, the canvas shows a loading state and the
  stats bar and brother list are already usable. Cars appear as they arrive.
- Shadow map stays at 2048 like the prototype. Drop it to 1024 if phones stutter.

---

## 7. Testing strategy

- `houseLayout.test.ts`: every mapped brother gets its room; unknown ids fill
  overflow in a stable order; two unknowns never share a slot; `roomLook` for
  all four statuses × reduced motion.
- `houseStats.test.ts`: backlog excludes contacted leads and leads with sites;
  7-day windows include day 7 and exclude day 8; spend uses the ET day window.
- `agentChat.test.ts`: the prompt includes role, run summaries and draft titles;
  history is capped at 20; empty or 1,001-char messages are rejected; an over-budget
  chat makes no Claude call; chat cost is recorded with trigger `CHAT`.
- `agentRunner` tests stay green; the metering refactor must not change any expectation.
- Visual and interaction checks via `/browse` (not Vitest): canvas renders, a
  room click opens the right panel, Run now flips RUNNING → IDLE, the 375px
  layout stacks, and reduced motion stops the rotation.

---

## 8. Success criteria

1. `npm test`, `tsc` and `lint` are all clean.
2. `/house` renders the rotatable house and all six cars, matching the
   prototype's look, with the pledge's room lit. Dragging
   orbits and the page has no console errors.
3. Clicking the pledge's room opens his panel. Run now turns the window pulsing
   (RUNNING), then back to IDLE, and the run appears in Schedule with its cost.
4. Chat: "what did you do today?" gets a reply that mentions his last run, and
   the spend in the stats bar goes up.
5. At 375px wide the stats wrap, the canvas fits the screen, and the panel goes
   full-screen.
6. No other page's JS bundle grows (three only loads on `/house`).
7. Keyboard only: Tab to the brother list, Enter opens the panel, Esc closes it,
   and focus returns.

---

## 9. Boundaries

- **Always:** all Claude calls go through the runtime's metering and budget;
  write a test with every pure function; keep three inside the dynamic import;
  read the relevant `node_modules/next/dist/docs` page before using a Next API.
- **Ask first:** any dep beyond the four listed; models beyond the seven in
  `public/house/`, or new textures or fonts; schema changes beyond adding `CHAT`;
  touching any page other than `/house` and the nav link.
- **Never:** approve, send or publish from this UI; call Claude outside the
  runtime; put three in a shared or root bundle; link `/house` or its models from
  any public or client-facing page; reproduce any existing game's or show's
  characters. The brothers are original.

---

## 10. Open questions

1. **Boss:** Should the nav label be "Frat House" or "House"? Default: "Frat House".
2. **Boss:** 15s polling is cheap (two small queries) but runs whenever the tab
   is open. It pauses while the tab is hidden (`visibilitychange`).
3. ~~**Frank, blocking before deploy:** licenses for the house and car models.~~
   **Resolved 2026-10-04:** Frank knows the creator personally, and they gave him
   permission to use the house and the six car models. The files stay behind the
   operator password (`/house/*.glb` returns 401 without it).

---

## 11. As built (2026-10-04)

- **Fewer files:** `Room` lives in `HouseScene.tsx`, the stats bar in
  `HouseView.tsx`, and `ChatTab` in `AgentPanel.tsx`. There's no separate
  `StatsBar.tsx`, `Room.tsx` or `ChatTab.tsx`.
- **`houseStats.ts`** holds the time windows (`houseWindows`), the brother list
  merge (`mergeAgents`: registered brothers ∪ Agent rows) and `formatMicros`. The
  counting itself is SQL in `/api/house`.
- **Metering:** `agentRunner.ts` exports `createMeter()`, and both `runBrother`
  and `chatTurn` use it. The runner tests are unchanged and still pass.
- **Rooms** are measured by raycasting the model's front (see the comment on
  `ROOMS`), two per floor across three floors.
- **Loading:** the "Loading the house…" message is a DOM overlay, not drei
  `<Html>`. `<Html>` inside a Suspense fallback threw React unmount errors.
- **Verified with `/browse`:** the house, cars and lit room render; Run now goes
  RUNNING → OK; chat replies and mentions the last run; Enter opens the panel, Esc
  closes it and focus returns to the brother button; no sideways scroll at 375px;
  `/stats` loads no three.js; no console errors.
- **Known perf ceiling:** the house is 1.4M vertices. Headless software
  rendering struggles with it; not yet tried on a real phone. If phones stutter, simplify
  the mesh (`gltf-transform simplify`) before cutting features.
