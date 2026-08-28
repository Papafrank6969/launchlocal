# LaunchLocal

A prototype pipeline for finding small businesses that need a website, building
them one, and tracking how it's doing.

## Features

- **Lead Finder** (`/leads`) — search a city + category. Uses the Google Places
  API if `GOOGLE_PLACES_API_KEY` is set in `.env`; otherwise falls back to
  generated sample data so the app works out of the box. Each result is scored
  `NONE` / `POOR` / `HAS_SITE` based on whether it has a real website.
- **Draft site in one click** — the "Draft site" button on any lead (Lead Finder
  or Pipeline) builds a real, published site from the business's Google data
  alone: name, contact, address, rating, up to 5 real Google reviews, a bespoke
  design, and category-typical services. The lead's DM message rewrites itself
  to lead with the live link ("I went ahead and built you one — take a look:
  …"). These pitch sites are `noindex` until the lead is marked `WON`, at which
  point the site becomes a normal indexed one.
- **Site Builder** (`/builder`) — turn a lead (or a blank form) into a real
  small multi-page site with a live preview, then publish it to a public URL
  at `/s/[slug]`. Each site gets whatever pages it actually has content for —
  Home, About, per-service pages, Blog, Gallery, FAQ, Contact (with a working
  form), Privacy Policy, and Terms of Service. Nav only ever links to pages
  that exist. Manage FAQ, Blog posts, and before/after Gallery photos from
  their own tabs on the site editor; contact-form messages show up in an
  inbox on the same page. Set an **online booking link** (Vagaro, Booksy,
  Square, GlossGenius, Calendly, Fresha…) and "Book Now" becomes the primary
  call to action across the whole site. The Services page renders as a
  printable price-menu.
- **Real Google reviews** — with `GOOGLE_PLACES_API_KEY` set, the operator can
  pull up to 5 real reviews for a site (by Place ID, auto-filled from a Google
  lead) and they render verbatim on the home page, attributed and linked back
  to the Google listing. Never generated, never filtered by rating; the editor
  shows when the cached copy was last refreshed.
- **Section-rich pages** — each generated site has a sticky nav, an enriched
  hero (one of three curated layouts), a trust bar (real rating + top review),
  a service-card grid, an about section, the reviews section, and a
  pre-footer CTA banner. Sections with no real content don't render.
- **Photos from Google** — with `GOOGLE_PLACES_API_KEY` set, a "Pull photos
  from Google" button in the editor fetches the business's own Google photos
  (compressed + stored, shown with attribution) to fill the hero, about, and
  service cards. Starting imagery, meant to be swapped for the business's real
  photos before the site is handed off. A separate "Fill blank service images"
  button drops generic Pexels stock onto image-less service cards (needs a free
  `PEXELS_API_KEY`) — placeholder-only, credited, and never used for the hero.
- **Bespoke design generation** — every site's fonts, colors, and layout come
  from a curated design system (`src/lib/designSystems.ts`) picked for that
  specific business. With `ANTHROPIC_API_KEY` set, an AI call picks the best
  fit from the business's real name/category/services; without it, a
  deterministic category-based fallback keeps the app working out of the box.
  Every curated system is pre-validated for WCAG AA contrast. The operator can
  regenerate or manually override the pick from the site editor.
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

The same key powers "Pull photos from Google" and real-review pulls in the site
editor. For the "Fill blank service images" button, add a free Pexels key
([pexels.com/api](https://www.pexels.com/api/), instant):

```
PEXELS_API_KEY=your-key-here
```

To enable AI-driven bespoke design selection instead of the deterministic
category fallback, add to `.env`:

```
ANTHROPIC_API_KEY=your-key-here
```

Get one at [console.anthropic.com](https://console.anthropic.com/). Generation
runs once per site (on creation, or when the operator clicks "Regenerate
design") using `claude-haiku-4-5-20251001`.

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
