# Compliance & brand audit — September 2026

Triggered by Frank's "don't want to get sued / don't want it to look vibe
coded" pass. Covers the app (`launchlocal-silk.vercel.app`) and the generated
client sites. Standards this measures against:
[`BRAND-AND-COMPLIANCE-STANDARDS.md`](BRAND-AND-COMPLIANCE-STANDARDS.md).

**Not legal advice.** A licensed lawyer should review the legal templates and
the unclaimed-pitch-site practice (F-1 below) at least once.

## What's already right (no action)

The repo has been disciplined here — `SITE-QUALITY-CHECKLIST.md` predates this
audit and most of it holds:

- No analytics, no tracking pixels, no third-party JS beyond Google Fonts/Maps.
- Reviews are real Google reviews only, verbatim, or the section is absent.
  No fabricated counts, no fake testimonials. (`templates.tsx`, `googleReviews.ts`)
- No AI-written visitor-facing copy. The one LLM call is forced tool-use
  selecting a design-system id from a fixed list. (`generateDesign.ts`)
- No AI/stock photos in hero/About. Pexels only as a credited, operator-opt-in
  service-card placeholder. (`stockPhotos.ts`, checklist)
- Design systems are hand-built and WCAG-AA gated by a test sweep; no purple
  primaries. (`designSystems.ts`, `contrast.ts`)
- Client sites already have Privacy + Terms pages (non-blank), a per-site
  favicon, skip links, labelled + validated contact form, LocalBusiness JSON-LD
  from real fields only, and noindex on still-being-pitched sites. (`robots.ts`,
  `siteVisibility.ts`)
- App tool pages are disallowed in `robots.txt`; app has a favicon (`icon.svg`).
- Outreach is manual IG DMs — no CAN-SPAM/TCPA surface.

## Findings

Severity: **P0** legal/at-risk now · **P1** clear gap vs. standards · **P2**
polish / defense-in-depth. Surface: **App** / **Site** (client sites) / **Both**.

### Legal / data

| # | Sev | Surface | Finding | Fix |
| --- | --- | --- | --- | --- |
| **F-1** | P0 | Site | **Publishing "unclaimed pitch sites"** — a public (noindexed) site using a real business's name, real Google reviews, and photos, before they've agreed. Trademark / false-association / passing-off / publicity exposure. `siteVisibility.ts` confirms these exist. | Decision for Frank + lawyer. Minimum: on-page "Prepared by LaunchLocal — not affiliated with or endorsed by this business; claim or removal: <contact>" banner on unclaimed sites, instant takedown path, hard rule that every fact is theirs. Ideal: don't publish pre-agreement (share a preview auth-gated instead). |
| **F-2** | P0 | Both | **Google Places data stored indefinitely** (`Lead.name/address/phone/rating/reviewCount`, `Site.googleReviewsJson`). Google Maps Platform Terms §3.2.3 prohibit caching Places content > 30 days (place ID excepted). Key-ban / breach-of-contract risk. | Add a refresh-or-purge job: re-fetch or null non-ID Places fields older than 30 days; store `placesRefreshedAt`. Reviews: re-pull on a ≤30-day TTL or don't persist the text. |
| **F-3** | P1 | Site | **Privacy Policy is too thin & partly inaccurate** — says "we don't share with third parties" while the site sends visitor data to Vercel (hosting/logs), Google (Fonts, Maps), and Neon (DB). No processors, retention, legal basis, rights, children's-data, or real last-updated date named. `legalContent.ts` `updatedAt` changes on every edit. | Rewrite `generatePrivacyPolicy` per standards §2.1: processors list, retention, "used only to reply to you," rights + contact, fixed `LEGAL_LAST_UPDATED` constant. |
| **F-4** | P1 | Site | **No Cookie Policy page**; the consent banner links nowhere. | Add `/s/[slug]/cookie-policy` (generator in `legalContent.ts`), link from banner + footer. |
| **F-5** | P1 | Site | **Cookie banner is not valid consent** — accept-only ("Got it"), fires after the page (and the Maps iframe) already loaded, implies a choice with no reject. `CookieConsentBanner.tsx`. | Per standards §2.2: because the audience is US and cookies are otherwise necessary-only, the clean fix is (a) self-host fonts, (b) click-to-load the map, then (c) replace the banner with a one-line footer disclosure + Cookie Policy link. If Frank wants EU-safe, build a real reject/accept manager instead. **Frank decides.** |
| **F-6** | P1 | Site | **Runtime Google Fonts** (`AsyncGoogleFont.tsx`, `fonts.googleapis.com`/`gstatic.com`) — sends visitor IP to Google; the exact pattern German courts have fined. | Self-host the ~13 font families with `next/font/local` (or `next/font/google`, which self-hosts at build). Removes the third-party request entirely; also faster. The app already does this (`next/font/google` for Geist). |
| **F-7** | P1 | Site | **Google Maps iframe** on every contact page (`MapEmbed.tsx`) sets Google cookies + phones home before any consent. | Replace with a static map image + "Open in Google Maps" link, or a click-to-load wrapper. Removes the only cookie-setting embed. |
| **F-8** | P1 | Site | **No Refund/Cancellation Policy** and no form-consent line. | Add a `/s/[slug]/policies` (or cancellation) page shown when the site has a booking URL / takes deposits; add the consent notice line to `ContactForm.tsx` (standards §2.3). |
| **F-9** | P1 | App | **No Privacy Policy / Terms / imprint for the app itself**, which is publicly reachable (no auth) and stores consumer contact submissions + scraped business data. | Add `/(app)/privacy` + `/(app)/terms` (short, honest: what the tool stores, that submissions come via client sites, contact, no selling of data). Link from `AppFooter`. |
| **F-10** | P2 | App | App pages aren't `noindex` at the meta level (only `robots.txt` disallow). | Add `robots: { index: false, follow: false }` to the `(app)` layout metadata. |
| **F-11** | P2 | Both | **SHIELD Act** — need a written note that reasonable safeguards + breach-notification are in place for NY-resident data (contact submissions). | One `docs/DATA-HANDLING.md`: what's stored where, access, retention, breach steps. No code. |
| **F-12** | P2 | App | Contact submissions have no retention limit — they accrue forever. | Add a purge (e.g. 24 months) or a documented retention period in the privacy policy. |

### Brand / "not vibe coded"

| # | Sev | Surface | Finding | Fix |
| --- | --- | --- | --- | --- |
| **B-1** | P1 | Site | **Pill buttons** — `HeroCtaRow` `shape="pill"` → `rounded-full px-6 py-3 uppercase tracking-widest`, used by the centered hero (`HeroCentered`). Violates "no pill buttons." | Drop the `pill` shape; centered hero uses `soft` (`rounded-lg`). Remove `uppercase tracking-widest`. `templates.tsx:172-181,337`. |
| **B-2** | P1 | Both | **Em dashes in user-facing output** — `templates.tsx:380` trust-bar review snippet `"…" — author` (`&mdash;`); `photoAttribution.ts` uses `" — "` as the credit delimiter, rendered in the site footer. | `templates.tsx`: `"…" · author`. `photoAttribution.ts`: delimiter `": "` → `"Photos via Pexels: Jane Doe"`; update `photoAttribution.test.ts`. Grep the tree for `—`, `&mdash;`, `–`, `&ndash;` and add a lint rule / test guard. |
| **B-3** | P2 | Site | **Gradient fill** — `templates.tsx:414` `linear-gradient(135deg, accent33, primary1f)` behind blank service cards. Not purple, but it's a gradient. | Flat tint: `background-color: color-mix(...)` or `${accent}22`. |
| **B-4** | P2 | Site | **Scroll progress bar** (`ScrollProgressBar` in `StickyHeader`) — a moving 0.5px bar on a 5-section brochure site. Borderline "unnecessary chrome." | Recommend removing it for the "real business made this" goal. Frank's call — low stakes. |
| **B-5** | P2 | Site | **Vague default tagline** — `leadToSite.ts` `"Your trusted {category} in {city}"` ships if the operator doesn't personalise it. "Trusted" is an unsupported claim + generic. | Neutral factual default: `"{category} in {city}"`, or leave blank and block publish until set. |
| **B-6** | P2 | Site | Hero/story `alt` text is just `site.businessName` — weak for screen readers. | `alt="{businessName} — storefront"` / `"— our space"`, or `alt=""` where truly decorative. |
| **B-7** | P2 | Site | Eyebrow labels are `uppercase tracking-[0.2em]` throughout — a mild AI-storefront tell but widely used and legible. | Leave unless Frank wants it toned down; note only. |
| **B-8** | — | Both | "Made with AI" tag: **none found** user-facing. "AI picked …" text is operator-only (`SiteEditorForm.tsx:75`). No action. |
| **B-9** | — | App | Custom domain: not connected (`*.vercel.app`). Launch gate — tracked separately with the deploy follow-ups. |

## Track breakdown

Carved so no two touch the same files. Legal-content tracks need Frank's
decisions (below) before they finalise.

| Track | Files | Findings | Depends on |
| --- | --- | --- | --- |
| **C-A — Client-site legal pages** | `legalContent.ts` (+test), `s/[slug]/privacy`, `s/[slug]/terms`, new `s/[slug]/cookie-policy`, new `s/[slug]/policies`, footer links in `templates.tsx` (legal-links block only) | F-3, F-4, F-8 (page half) | Decisions 1, 2, 4 |
| **C-B — Cookies & third-party embeds** | `CookieConsentBanner.tsx`, `MapEmbed.tsx` (+ a static-map or click-to-load), `SiteFonts.tsx` + `AsyncGoogleFont.tsx` + new `src/lib/fonts.ts` self-host, `next.config` font assets | F-5, F-6, F-7 | Decision 2 |
| **C-C — Brand fixes in templates** | `templates.tsx` (button shapes, em dash, gradient, alt text), `photoAttribution.ts` (+test), `leadToSite.ts` (tagline), optional `ScrollProgressBar`/`StickyHeader` | B-1, B-2, B-3, B-5, B-6, B-4 | Decision 3 |
| **C-D — Places data retention** | `places.ts`, `placesPhotos.ts`, `schema.prisma` (`placesRefreshedAt`), new `api/cron/refresh-places` or fold into daily cron, `googleReviews` pull TTL | F-2 | — (start anytime) |
| **C-E — App legal + hardening** | new `(app)/privacy`, `(app)/terms`, `AppFooter.tsx`, `(app)/layout.tsx` metadata, `ContactForm.tsx` consent line, `api/public/.../contact` retention, `docs/DATA-HANDLING.md` | F-9, F-10, F-11, F-12, F-8 (form line) | Decision 1 |
| **C-F — Unclaimed pitch sites** | `siteVisibility.ts`, `templates.tsx` (disclosure banner), `s/[slug]/layout.tsx`, takedown route | F-1 | Decision 5 (+ lawyer) |
| **C-G — Guard tests** | `templates.test.ts`, a repo-wide "no em dash / no rounded-full button / no gradient" assertion, `legalContent.test.ts` | keeps B-1/B-2/B-3 from regressing | after C-A/C-C |

Suggested order: **C-C** and **C-D** first (no decisions needed, high signal),
then **C-B**, then **C-A** + **C-E** once decisions land, then **C-F**, then
**C-G**.

## Decisions from Frank (2026-09-06) — resolved

1. **Legal identity:** sole proprietor — **"Frank Sulawa, operating as
   LaunchLocal."** Contact email still to be supplied → drafts use
   `[CONTACT EMAIL]` until Frank gives a real support address (do NOT default to
   his personal iCloud address on a public page).
2. **Cookies posture:** **US-clean.** Self-host the ~13 Google Font families,
   replace the Google Maps iframe with a static map image + "Open in Google
   Maps" link, remove the accept-only banner, ship a one-line footer disclosure
   + a Cookie Policy page. No consent gate. (C-B, C-A.)
3. **Scroll progress bar (B-4):** drop it. **Eyebrow caps (B-7):** keep. (C-C.)
4. **Refund/cancellation:** **generic pass-through text** — "Cancellations and
   refunds are handled directly by {business}; contact them using the details on
   this page." Auto-generated, shown on any site with a booking URL. No new
   editor field. (C-A.)
5. **Unclaimed pitch sites (F-1):** **disclosure banner** — keep publishing, but
   an unclaimed site shows "Prepared by LaunchLocal — not affiliated with or
   endorsed by {business}. To claim this site or request its removal, contact
   {LaunchLocal contact}." + a one-click takedown. Still flagged for a lawyer's
   review. (C-F.)

## Status

Specced 2026-09-06, decisions resolved same day. **All tracks unblocked** except
the still-open item of a real contact email (blocks C-A/C-E from *final*, not
from starting) and the lawyer review of C-F. Standards + audit committed
`77baa1d`.

- **C-C** — brand fixes: _in progress (boss)._
- **C-D** — Places retention: ready.
- **C-B / C-A / C-E / C-F** — ready to assign.
- **C-G** — after C-A/C-C.
