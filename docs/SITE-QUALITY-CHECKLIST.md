# Site quality checklist

Standing design constraint for anyone (human or AI) extending `src/lib/templates.tsx`,
the `src/app/s/[slug]/**` pages, `src/lib/designSystems.ts`, or the site-chrome
components under `src/components/site/`. LaunchLocal's whole pitch is that the
sites it builds look like a real business made them — not like a template mill
or an AI slop generator. Every item here should stay true; if a change would
violate one, don't make it without calling it out first.

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
- A same-3-templates-with-colors-swapped look — see the design system section below

## Bespoke design, not a template picker

Every site's fonts/colors/layout come from `src/lib/designSystems.ts` — a curated
list of pre-built systems, each with a real Google Font pairing and a 4-role color
system, picked per-business by `src/lib/generateDesign.ts` (AI-driven when
`ANTHROPIC_API_KEY` is set, deterministic category-based fallback otherwise).

- **Never let an LLM emit raw colors, fonts, or code.** The AI call is
  constrained via forced tool-use to select only from the vetted `DESIGN_SYSTEMS`
  ids — this is a hard safety boundary, not a style preference. If you add a new
  design system, hand-build and WCAG-check it yourself before it's selectable.
- **Every system must pass `src/lib/contrast.ts`'s AA check** (4.5:1 body /
  reduced bar for large-text-only uses) before being added to
  `DESIGN_SYSTEMS`. Verify with a quick script, not by eyeballing hex codes.
- **Never hardcode `text-white` (or any fixed color) on a dynamic
  `backgroundColor`.** Use `readableTextColor()` — a system's primary color is
  data, not a color you can assume contrasts with white. This was a real bug,
  found and fixed three times over (hero/CTA buttons, the contact submit
  button, the per-site favicon) before this rule existed.
- **Category-based matching must check exact matches before substrings.**
  `deterministicDesignSystem` does this — a naive substring check let "hair
  salon" get shadowed by "salon" from an unrelated, earlier-in-the-list system.

## Always true for a published site

Confirmed working, verified live in the browser (not just typechecked):

- Real per-site favicon generated from the business's initial + resolved
  design system color, with contrast-safe text (`s/[slug]/icon.tsx`)
- Uploaded photos are compressed (`src/lib/imageUpload.ts`, shared by the hero
  photo and gallery uploads)
- Every page in the nav actually exists — `buildSiteNav` only links to pages
  with real content, never a stub
- Contact form has real client + server-side validation, labels properly
  associated with inputs (`htmlFor`/`id`, `aria-invalid`, `aria-describedby`),
  and a Google Maps embed when an address exists
- Legal pages (Privacy/Terms) render actual generic boilerplate, never blank —
  see the note below on their limits
- `sitemap.xml`, `robots.txt`, and `llms.txt` reflect only pages that exist
- LocalBusiness JSON-LD on the home page, built only from real site fields
  (never fabricated) — see `src/lib/jsonLd.ts`
- Every page has a `<main id="top">` landmark (`s/[slug]/layout.tsx`) — the
  skip-to-content link depends on this existing on every page, not just home
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
- **The Google Fonts stylesheet loads asynchronously** (`AsyncGoogleFont.tsx`)
  specifically so it never blocks first paint — this trades a brief
  fallback-font flash for a much faster page. Don't "simplify" this back to a
  plain `<link rel="stylesheet">`; that reintroduced an ~800ms render-blocking
  hit on LCP when tested with Lighthouse.
- **Lighthouse's default (simulated/Lantern) throttling mode gave a misleading
  Performance score** (~80s) on this dev machine, tracing to the LCP metric
  specifically — `--throttling-method=devtools` (real applied throttling) and
  `--throttling-method=provided` (unthrottled) both showed 95-100. Font file
  transfer itself completed in ~200ms per the network trace, ruling out a real
  font-loading regression. If Performance ever looks anomalously low again,
  re-check with real throttling before assuming a regression — Lantern's
  simulation seems to mismeasure this specific page/CDN combination.
