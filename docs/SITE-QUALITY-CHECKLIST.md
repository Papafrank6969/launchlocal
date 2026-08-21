# Site quality checklist

Standing design constraint for anyone (human or AI) extending `src/lib/templates.tsx`,
the `src/app/s/[slug]/**` pages, or the site-chrome components under
`src/components/site/`. LaunchLocal's whole pitch is that the sites it builds look
like a real business made them — not like a template mill or an AI slop generator.
Every item here should stay true; if a change would violate one, don't make it
without calling it out first.

## Never do this (the sell.app tell)

These are the tells of a lazy AI-generated storefront. If a change introduces any
of these, it's a bug, not a feature:

- Purple/gradient hero backgrounds as a default look
- Stock "AI slop" photography instead of the business's own photo (or none)
- Fake reviews, fake testimonials, or fabricated review counts
- Fake visitor counters, fake "X people viewed this," fake urgency ("3 left!")
- Fake or padded metrics ("10,000+ happy customers") with no source
- Emoji used as icons in place of real iconography
- Cursive/script display fonts
- Heavy em-dash usage or other AI-writing tics in generated copy
- Scroll-triggered animations on every element ("animate everything" syndrome)
- Broken or dead buttons (a CTA that goes nowhere)
- A text-only wordmark with no favicon
- Vague hero copy that could apply to any business ("Excellence in service")
- Empty Privacy Policy / Terms of Service pages, or pages that don't exist at all

## Always true for a published site

Confirmed working as of the Phase 1–3 pass — keep these true:

- Real per-site favicon generated from the business's initial + accent color
  (`s/[slug]/icon.tsx`)
- Uploaded photos are compressed (`src/lib/imageUpload.ts`, shared by the hero
  photo and gallery uploads)
- Every page in the nav actually exists — `buildSiteNav` only links to pages
  with real content, never a stub
- Contact form has real validation and real error messages, not a silent no-op
- Legal pages (Privacy/Terms) render actual generic boilerplate, never blank —
  see the note below on their limits
- `sitemap.xml`, `robots.txt`, and `llms.txt` reflect only pages that exist
- Dark mode, print stylesheet, and mobile nav all render the same real content —
  no chrome-only feature that leaves content broken in some mode

## Known limits (be honest about these, don't paper over them)

- **Legal pages are boilerplate, not legal advice.** `src/lib/legalContent.ts`
  generates generic, defensible text — it is not a substitute for a lawyer. Don't
  make it sound more authoritative than that.
- **Google Search Console can't be auto-verified.** Sites live at `/s/[slug]` on
  a shared domain, not their own domain, so there's no automated ownership proof.
  The `googleSiteVerification` field is a manual paste-in, not a real integration.
- **Opening-hours parsing is best-effort.** `src/lib/hours.ts` only understands
  the common `"Mon-Fri: 8am-6pm"` shape. Unparseable input silently falls back to
  showing the raw text with no "Open now" badge — that's the correct failure
  mode, don't try to force a badge onto text that doesn't parse.
