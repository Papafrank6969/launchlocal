# Google APIs used by LaunchLocal

Which Google APIs LaunchLocal talks to, which env var powers each, and the one
operator step that makes live lead search work.

## API inventory

| API | Purpose | Env var | Notes |
| --- | --- | --- | --- |
| **Places API (New)** (`places.googleapis.com/v1`) | Live lead search — `places:searchText` returns website, phone, rating, and review count inline, one request per category, reliable `pageToken` pagination | `GOOGLE_PLACES_API_KEY` | **Must be enabled — this is the only setup step that isn't "paste a key".** Legacy Places being already enabled does **not** enable this; they are separate APIs. Until enabled, search returns HTTP 403 and `findBusinesses` falls back to the legacy API (slower, one Details call per result, unreliable pagination), so searches work but are degraded. |
| **Places API (legacy)** (`maps.googleapis.com/maps/api/place/...`) | Tier-2 fallback in `findBusinesses` when Places API (New) errors; also powers review pulls | `GOOGLE_PLACES_API_KEY` | Kept as the fallback path — see `src/lib/places.ts`. |
| **Geocoding API** (`maps.googleapis.com/maps/api/geocode/...`) | Resolves a `city` to lat/lng for radius searches | `GOOGLE_PLACES_API_KEY` | Not deprecated; used by both the New path (radius `locationRestriction`) and the legacy path. |
| **Places Photos (New)** | "Pull photos from Google" in the site editor — place lookup with a `photos` field mask → photo resource names (`places/…/photos/…`) → `/media?maxWidthPx=` for bytes | `GOOGLE_PLACES_API_KEY` | Same key + "Places API (New)" enablement as the search path (no extra step). Legacy `place/photo` + Details `photos` kept as the fallback tier — see `src/lib/placesPhotos.ts`. |
| **Custom Search JSON API** | On-demand Instagram handle lookup for leads with no website | `GOOGLE_CUSTOM_SEARCH_API_KEY` (+ `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`) | Falls back to `GOOGLE_PLACES_API_KEY` if the dedicated key is unset. 100 queries/day free, ~$5/1k after — which is why lookup is a manual per-lead button. |

The daily lead cron (`/api/cron/daily-leads`) makes ~4–6 Places searches/day
(~120–180/month) on top of interactive use — well inside the free tier. The
cron does **not** call the Custom Search API. See `.env.example` for
`CRON_SECRET`, which authenticates the Vercel Cron request.

The non-Google env vars used alongside these: `PEXELS_API_KEY` (stock photos),
`ANTHROPIC_API_KEY` (AI design selection), `DATABASE_URL` + `DIRECT_URL`
(Postgres — Neon), and `BLOB_READ_WRITE_TOKEN` (image uploads — Vercel Blob,
injected automatically on Vercel). See `README.md` and `.env.example`.

## Enabling "Places API (New)"

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → your project
   → **APIs & Services** → **Library**.
2. Search for and select **Places API (New)** → **Enable**.
3. It uses the **same** `GOOGLE_PLACES_API_KEY` already in `.env` (no new key, no
   code change).

That's it. Until this is enabled, live lead search hits the legacy tier and is
slower; the code degrades gracefully and logs a warning pointing here on 403.