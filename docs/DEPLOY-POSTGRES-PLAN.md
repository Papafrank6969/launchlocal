# Feature plan: Deploy to Vercel + Postgres (foundation for the daily lead cron)

**Status:** specced, not started
**Owner:** boss + user (needs live Vercel / Neon accounts + secret handling; not a headless-agent track). An agent may take the **code tasks (1–3)** on a branch; tasks 4–6 are a runbook the boss + user do together.
**Scope class:** `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/migration_lock.toml`, `src/lib/imageUpload.ts`, the six upload routes + two readers listed in Task 2, `src/lib/generateDesign.ts`, `next.config.ts`, `package.json`, `.env.example`, `vercel.json` (new). **Nothing else** — no feature work, no `/leads` / `/pipeline` / `/stats` changes, no cron (that's the next track).

---

## 1. Goal

Get the app running on a public URL with a persistent database and working image
uploads, so the daily lead cron (next track) has somewhere to run and write to.

### Why

The app has never been deployed. It uses **SQLite** (a local file — doesn't
survive on Vercel's serverless filesystem) and **writes uploaded images to
`public/uploads/**`** (a read-only filesystem in production). Both must move to
managed services before anything can be scheduled.

Decisions already made (2026-08-30): **Vercel** for hosting, **hosted Postgres**
(Neon) for the DB, Google Places billing is enabled.

### Non-goals

- **No cron / scheduled jobs** — that's `docs/` Track 2, specced after this lands.
- **No `/today` queue** — Track 3.
- **No custom domain** for the operator app — use the `*.vercel.app` URL.
- **No per-client custom domains** for generated sites — still manual, later.
- **No migration of existing dev data.** `prisma/dev.db` and any
  `public/uploads/*` are throwaway. Production starts empty.
- No auth. The deployed operator app is unauthenticated for now (same as local) —
  acceptable because the URL is unlisted; revisit before it holds real client
  data at volume.

---

## 2. Tasks

### Task 1 — Prisma: SQLite → Postgres

`prisma/schema.prisma` datasource block:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (PgBouncer) — app runtime
  directUrl = env("DIRECT_URL")     // unpooled — migrations / introspection
}
```

- **Squash the migration history.** The 20 existing migrations are SQLite-dialect
  and won't replay on Postgres. With no production data to preserve:
  `rm -rf prisma/migrations/*`, then against a scratch Postgres
  (`docker run --rm -e POSTGRES_PASSWORD=x -p 5432:5432 postgres:16`, or a Neon
  dev branch) run `npx prisma migrate dev --name init`. Commit the single new
  `prisma/migrations/<ts>_init/` folder.
- `prisma/migration_lock.toml` → `provider = "postgresql"`.
- The five enums (`WebsiteStatus`, `LeadSource`, `OutreachStatus`, `SiteStatus`,
  `EventType`) become **native Postgres enum types** — expected, no code change
  (the app never treats an enum value as an arbitrary string; verified: no
  `contains:` / raw SQL in `src/`).
- `prisma/seed.ts` — run it against the scratch Postgres, confirm it completes.
- `npm test` must stay green — the 350 tests are pure (`src/lib/*.test.ts`), no
  DB. If any test suddenly needs a DB, stop and flag; that's a scope surprise.

### Task 2 — Image storage: local disk → Vercel Blob

`npm i @vercel/blob`.

Rewrite `src/lib/imageUpload.ts`:
- `saveCompressedImage(bytes, prefix)` → `put(\`${prefix}-${Date.now()}-${rand}.webp\`, bytes, { access: "public", contentType: "image/webp" })` from `@vercel/blob`; **return the blob's public URL** (absolute), not a bare filename. Drop the `dir` argument.
- `deleteUploadedFile(url)` → `del(url)` from `@vercel/blob`, best-effort
  (`.catch(() => {})`), keyed on the stored absolute URL.
- `compressImage` / `validateUploadedImage` unchanged.

Update every caller to store/return the absolute blob URL:
- `src/app/api/sites/[id]/gallery/route.ts`
- `src/app/api/sites/[id]/inspiration/route.ts`
- `src/app/api/sites/[id]/photo/route.ts`
- `src/app/api/sites/[id]/photos/route.ts`
- `src/app/api/sites/[id]/service-photo/route.ts`
- `src/app/api/sites/[id]/stock-images/route.ts`

These currently build a `UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", …)` and save a filename that becomes `/uploads/...`. After this task they call `saveCompressedImage` and persist the returned URL directly into the relevant `*.imageUrl` / `photoUrl` / `url` column.

Two readers that currently pull bytes back off local disk:
- `src/lib/generateDesign.ts:81` (`path.join(process.cwd(), "public", url)`)
- `src/app/api/sites/[id]/design/route.ts:13` (`readFile(path.join(process.cwd(), "public", url))`)

Change both to `fetch(url).then(r => r.arrayBuffer())` since `url` is now an
absolute blob URL. (Both use the bytes to sample colours for the design system.)

`next.config.ts` — allow the blob host for `next/image`:

```ts
images: {
  remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
},
```

(Check whether existing Google Places photo URLs already need a `remotePatterns`
entry — if `placesPhotos` output is rendered through `next/image`, add
`*.googleusercontent.com` / `places.googleapis.com` in the same change; if it's
plain `<img>`, leave it.)

### Task 3 — Build config

`package.json` scripts:

```jsonc
"build": "prisma generate && prisma migrate deploy && next build",
"postinstall": "prisma generate"
```

`vercel.json` (new):

```json
{ "framework": "nextjs" }
```

(Cron entries get added in the next track — not here.)

`.env.example` — add `DATABASE_URL`, `DIRECT_URL`, note that
`BLOB_READ_WRITE_TOKEN` is injected by Vercel when the Blob store is linked, and
update `NEXT_PUBLIC_SITE_URL` guidance to "the deployment's origin in
production".

### Task 4 — Vercel + Neon setup (runbook, boss + user)

1. **Neon:** create a project → copy the **pooled** connection string
   (`...-pooler...`) for `DATABASE_URL` and the **direct** one for `DIRECT_URL`.
2. **Vercel:** New Project → import `Papafrank6969/launchlocal` → framework
   auto-detected as Next.js. Don't deploy yet.
3. **Vercel → Storage:** create a **Blob** store, link it to the project (this
   sets `BLOB_READ_WRITE_TOKEN` automatically).
4. **Vercel → Settings → Environment Variables** (Production + Preview):
   `DATABASE_URL`, `DIRECT_URL`, `GOOGLE_PLACES_API_KEY`,
   `GOOGLE_CUSTOM_SEARCH_API_KEY`, `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`,
   `PEXELS_API_KEY`, `ANTHROPIC_API_KEY`, and `NEXT_PUBLIC_SITE_URL` = the
   `https://<project>.vercel.app` URL (set after the first deploy, then redeploy).
5. **Deploy.** The build runs `prisma migrate deploy` against Neon → schema
   created. If the build fails on `migrate deploy`, check `DIRECT_URL` is the
   unpooled string.
6. Set `NEXT_PUBLIC_SITE_URL` to the real URL, redeploy.

### Task 5 — Smoke test (on the deployed URL)

- [ ] `/leads` → run a real city+category search → results come back and persist
      (reload shows them).
- [ ] Draft a site from a lead → `/builder/[id]` loads.
- [ ] Upload a photo in the builder → it appears (served from
      `*.public.blob.vercel-storage.com`), and the DB stores the absolute URL.
- [ ] Publish the site → `/s/[slug]` renders with the image, correct canonical
      origin in `<head>` / `robots`.
- [ ] `/pipeline`, `/stats` (funnel + charts) render without error.
- [ ] Trigger the design-system generation path (draft with AI design) → the
      colour-sampling `fetch` of the blob URL works.

### Task 6 — Verify local dev still works

- [ ] Fresh `git pull` + `npm ci` + set `.env` with a local/Neon-dev
      `DATABASE_URL` + `DIRECT_URL` + a `BLOB_READ_WRITE_TOKEN` (from the Vercel
      Blob store — Blob has no local emulator; dev uploads go to the same store,
      which is fine at this scale).
- [ ] `npx prisma migrate dev` applies the `init` migration cleanly.
- [ ] `npm run dev` — app boots, a photo upload works.
- [ ] Update `docs/GOOGLE-APIS.md` and the README's setup section for the new
      env vars + the "you need a Vercel Blob token even in dev" note.

---

## 3. Edge cases / risks

- **`migrate deploy` in the build command** runs on every deploy. Fine now (one
  dev, tiny schema, no data). If it ever becomes risky, move to a manual
  `prisma migrate deploy` step — but not in this track.
- **Neon free tier** sleeps the DB after inactivity; first request after idle is
  slow (~1s cold start). Acceptable for an internal tool. The pooled connection
  string handles Vercel's connection fan-out.
- **Blob has no local emulator** — dev and prod share one store. At this volume
  (tens of images) that's fine; note it so nobody's surprised.
- **Existing `/uploads/*` URLs in dev data** will 404 after the switch — expected,
  dev data is throwaway, production starts clean.
- **`sharp` on Vercel** — supported natively by the Next.js builder, no config.
- **Places photo URLs through `next/image`** — if they are, and the
  `remotePatterns` entry is missed, they'll break in prod. Task 2 says to check.
- Secrets: the `.env` values go into Vercel's env store only. Never commit a real
  `.env`. `.gitignore` already covers it — confirm.

---

## 4. Definition of done

- [ ] `npm test` green (350+), `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] Single `prisma/migrations/<ts>_init/` folder; `migration_lock.toml` says
      `postgresql`.
- [ ] `git diff --stat` shows only the scope-class paths.
- [ ] The app is live at a `*.vercel.app` URL and Task 5's smoke test passes
      end to end.
- [ ] Local dev still works per Task 6.
- [ ] Branch `feature/deploy-postgres` off `origin/master`; before the PR goes
      final, `git fetch && git merge origin/master`, re-gate. PR against `master`.
- [ ] PR body: the code diff per task, the smoke-test results with the live URL,
      confirmation that image upload writes to Blob, and the env-var list that
      was set in Vercel (names only, no values).

---

## 5. Review checklist (boss)

1. `git diff --stat` — only scope-class paths. No feature files.
2. `schema.prisma` — `provider = "postgresql"`, `directUrl` present, enums
   unchanged, no model/field changes beyond the datasource block.
3. One `init` migration, generated (not hand-written), replays clean on an empty
   Postgres.
4. `imageUpload.ts` — returns absolute blob URLs; `deleteUploadedFile` uses
   `del()`; all six upload routes and both readers updated; no
   `path.join(process.cwd(), "public", …)` left in `src/`.
5. `next.config.ts` — `remotePatterns` covers the blob host (and Places photos
   if they go through `next/image`).
6. `package.json` build runs `prisma generate && prisma migrate deploy && next
   build`.
7. Smoke test evidence in the PR is real (screenshots or the live URL to click),
   not asserted.

---

## Next tracks (queued, specced after this lands)

- **Track 2 — Daily lead cron.** `target_rotation` config (city × category, with
  a cursor), `/api/cron/daily-leads` on a Vercel Cron (once daily, ~3pm user
  local), dedup by `placeId`, stop at ~25 net-new leads with a contact method,
  per-run Places-call cap, `CRON_SECRET`. Retest the Instagram handle lookup
  here.
- **Track 3 — `/today` queue.** The 25 freshest `NEW` leads with a contact
  method, best channel per lead, one-tap DM/email/call, "Mark contacted" →
  `LEAD_CONTACTED`, yesterday's uncontacted carried over. Multi-channel (not
  IG-only like the current outreach queue).
