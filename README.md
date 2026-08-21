# LaunchLocal

A prototype pipeline for finding small businesses that need a website, building
them one, and tracking how it's doing.

## Features

- **Lead Finder** (`/leads`) — search a city + category. Uses the Google Places
  API if `GOOGLE_PLACES_API_KEY` is set in `.env`; otherwise falls back to
  generated sample data so the app works out of the box. Each result is scored
  `NONE` / `POOR` / `HAS_SITE` based on whether it has a real website.
- **Site Builder** (`/builder`) — turn a lead (or a blank form) into a real
  small multi-page site with a live preview, then publish it to a public URL
  at `/s/[slug]`. Each site gets whatever pages it actually has content for —
  Home, About, per-service pages, Blog, Gallery, FAQ, Contact (with a working
  form), Privacy Policy, and Terms of Service. Nav only ever links to pages
  that exist. Manage FAQ, Blog posts, and before/after Gallery photos from
  their own tabs on the site editor; contact-form messages show up in an
  inbox on the same page.
- **Site chrome** — dark mode, sticky header with a mobile menu, scroll
  progress bar, back-to-top button, floating call/DM button, cookie consent
  banner, skip-to-content link, and a print stylesheet, all on every
  published site.
- **SEO** — per-site `sitemap.xml`, `llms.txt`, canonical + Open Graph tags on
  every page, and a root `robots.txt` that lists every published site's
  sitemap. A per-site field for a Google Search Console verification code
  renders as a meta tag (full auto-verification isn't possible since sites
  share a domain rather than owning their own).
- **Stats** (`/stats`) — leads found, sites built, conversion rate, and site
  views over time.
- **Instagram outreach** — every lead and every generated site can carry an
  Instagram handle, which renders as a one-click "DM on Instagram" link
  (`ig.me/m/<handle>` — opens the DM thread ready to send; there's no public
  API for a third party to auto-send a DM, this is the legitimate ceiling).
  Handles are picked up two ways:
  1. **Automatic, free** — if Google Places returns a business's "website" as
     literally their Instagram profile, the handle is extracted with zero
     setup.
  2. **On-demand lookup** — click "Find it" on a lead with no handle yet to
     search Google (via the Custom Search API, restricted to
     `site:instagram.com`) for it. Requires the two env vars below.

## Getting started

```bash
npm install
npx prisma migrate dev   # creates dev.db
npx prisma db seed       # optional demo data
npm run dev
```

To use live business search instead of sample data, add to `.env`:

```
GOOGLE_PLACES_API_KEY=your-key-here
```

To enable on-demand Instagram handle lookup, add to `.env`:

```
GOOGLE_CUSTOM_SEARCH_API_KEY=your-key-here   # falls back to GOOGLE_PLACES_API_KEY if unset
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your-cx-id-here
```

Get these at:
- API key: [Google Cloud Console](https://console.cloud.google.com/) → enable
  "Custom Search API" → Credentials → Create API Key (can reuse the Places key
  if it's on the same project and unrestricted).
- Search Engine ID (`cx`): [Programmable Search Engine](https://programmablesearchengine.google.com/)
  → Create a search engine → turn on "Search the entire web" → copy the Search
  engine ID.

Free tier is 100 queries/day, ~$5 per 1,000 after that — which is why lookup
is a manual per-lead button, not run automatically on every search.

## Stack

Next.js (App Router) + TypeScript + Tailwind, Prisma + SQLite, Recharts.

See [`docs/SITE-QUALITY-CHECKLIST.md`](docs/SITE-QUALITY-CHECKLIST.md) before touching
the site templates or public pages — it's the standing bar for what a
LaunchLocal-built site is and isn't allowed to look like.
