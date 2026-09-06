# Brand & compliance standards

**Standing law for this repo.** Applies to *both* surfaces:

- **the app** — `launchlocal-silk.vercel.app`, everything under `src/app/(app)/**`
  and the operator-facing components.
- **client sites** — the generated sites under `src/app/s/[slug]/**`,
  `src/lib/templates.tsx`, `src/lib/designSystems.ts`, `src/components/site/**`.

If a change would break an item here, it's a bug — stop and flag it, don't ship
it. The deeper site-implementation gate lives in
[`SITE-QUALITY-CHECKLIST.md`](SITE-QUALITY-CHECKLIST.md); this file is the
top-level owner and covers the app too.

> **Not legal advice.** The legal-page generators (`src/lib/legalContent.ts`)
> produce generic, defensible boilerplate. LaunchLocal publishes sites *on behalf
> of other businesses*, which raises real liability; a lawyer should review the
> templates and the "publishing unclaimed pitch sites" practice at least once.
> See [`COMPLIANCE-AUDIT-2026-09.md`](COMPLIANCE-AUDIT-2026-09.md).

---

## 1. Brand rules (never violate)

Frank's rules, verbatim intent. These are hard constraints, not preferences.

**Visual**
- No purple/violet as a primary or default, and **no gradient fills** as a
  design element — flat color only. (One deliberate exception already in the
  code: the faint two-stop wash behind a *blank* service card with no photo;
  keep it subtle and non-purple, or replace with a flat tint.)
- **No pill-shaped buttons.** Buttons are `rounded-md` / `rounded-lg`, never
  `rounded-full`. (`rounded-full` is fine for genuine circles — avatars, dots,
  icon-only FABs, a status badge.)
- No emoji used as icons. Use `lucide-react` (app) or inline SVG (client sites).
- No cursive / script display fonts.
- No over-the-top scroll animation. A hover state and a short (<200ms)
  transition are fine; parallax, scroll-triggered reveals on every element,
  scroll-jacking, and progress-storytelling are not.
- Text wordmark always ships with a favicon.

**Copy**
- No em dashes (`—`) anywhere user-facing — prose, separators, attribution
  lines, generated copy. Use a comma, "·", ":" or a rewrite.
- No vacuous text that could describe any business ("Excellence in service",
  "Your trusted partner"). Every line names something real about *this*
  business or it's cut.
- No profanity.
- No AI-slop copy. The app never generates a business's `tagline`, `about`,
  `story`, or service descriptions with an LLM — those are operator-written.
  The only LLM call picks a *design system id* from a fixed list (forced
  tool-use), never free text that ships to a visitor.

**Integrity — no fabrication, ever**
- No fake reviews, testimonials, or review counts. The Reviews section renders
  **only** real Google reviews (verbatim, newest-first) pulled through
  `src/lib/googleReviews.ts`, and renders nothing when there are none.
- No fake metrics ("10,000+ customers"), fake counters, fake urgency
  ("3 spots left"), fake visitor activity.
- No AI-generated photos of people, places, or products — anywhere.
- No AI-slop stock photography in the hero or About slots (those are statements
  about the specific business). Operator-opt-in Pexels placeholders on blank
  service cards only, always credited, meant to be replaced before the client
  takes over.
- No fake customer accounts / fake social proof.

**Launch gates (a client site or an app release does not go live until):**
1. Custom domain connected (not a `.vercel.app` URL).
2. Favicon present.
3. No "Made with AI" / "Built with AI" / template-mill badge anywhere
   user-facing.
4. Privacy Policy **and** Terms pages exist and render real content.
5. Every item in §2 (compliance baseline) satisfied for that surface.

---

## 2. Compliance baseline

### 2.1 Legal pages

| Page | App | Client sites |
| --- | --- | --- |
| Privacy Policy | required | required (`/s/[slug]/privacy`) |
| Terms | required | required (`/s/[slug]/terms`) |
| Cookie Policy | required if any non-essential cookie/embed | required (linked from the banner + footer) |
| Refund / Cancellation Policy | required if money changes hands | required when the site takes bookings, deposits, or sells |

Legal pages must: state a real **last-updated date** (a fixed date, not a
row's `updatedAt`), name the controller/business, describe **what data is
collected, why, the legal basis, how long it's kept**, name **processors**
(hosting, maps, fonts, email), and state the visitor's rights and how to
exercise them. Never blank, never a single vague paragraph.

### 2.2 Cookies & tracking

- **Data minimisation:** collect only what a feature needs. The contact form
  takes name + email + message and nothing else. No hidden fields, no
  fingerprinting, no "just in case" columns.
- **No analytics or third-party tracking scripts** without an explicit decision
  recorded here. As of this writing there are **none** (no GA, no Plausible, no
  pixels) — keep it that way unless Frank signs off, and if one is added it goes
  in the cookie policy and (for non-essential cookies) behind consent.
- **Necessary-only cookies/storage** (theme preference, the consent flag
  itself) need disclosure but **not** a consent gate.
- **Third-party embeds that set cookies or send visitor IPs** (Google Maps
  iframe, runtime Google Fonts) are **non-essential**. Either:
  - self-host / remove them (preferred — self-host fonts, "click to load" or
    static-map the map), or
  - gate them behind real opt-in consent (reject as easy as accept, nothing
    loads before a choice).
  A notice-only "Got it" banner is not consent and must not sit in front of
  cookie-setting embeds.
- **Consent banner honesty:** if the banner implies a choice, it must offer
  Reject, and must not fire cookies before the choice. If cookies really are
  necessary-only, prefer a short disclosure link over a fake choice.

### 2.3 Forms

- A visible consent/notice line tied to the submit action, linking the Privacy
  Policy: *"We'll only use your details to reply to you — see our Privacy
  Policy."* (A checkbox only if Frank wants the stronger record; default is the
  notice.)
- Real client + server validation, `label`/`htmlFor`, `aria-invalid`,
  `aria-describedby`, keyboard operable, visible focus ring.
- Store the submission's timestamp and the site it came from; nothing more than
  the visitor typed.

### 2.4 Accessibility (WCAG 2.2 AA target)

- Every non-decorative image has meaningful `alt`; decorative images have
  `alt=""`. A hero photo of the shop is `alt="<Business> — <what's shown>"`,
  not just the business name.
- All text/UI meets AA contrast (4.5:1 body, 3:1 large text / UI) — enforced by
  `src/lib/contrast.ts` and the design-system test sweep. Never hardcode a fixed
  text color on a dynamic background; use `readableTextColor()`.
- Full keyboard operability, visible focus indicator, logical tab order, skip
  link on every page.
- Touch targets ≥ 44px. Respect `prefers-reduced-motion`.
- One `<h1>` per page, headings in order, landmarks (`main`, `nav`, `footer`).

### 2.5 Content & IP

- **Images:** hero/story = operator upload or the business's own Google photos;
  service cards = branded block or credited Pexels placeholder. Pexels license
  permits commercial use; credit is still shown. Never hotlink or scrape images
  from the business's site/socials without the operator having the right to use
  them.
- **Google Places / Maps data:** Place data (name, address, phone, rating,
  reviews) is cached from the Places API. Google's terms **prohibit storing
  Places content beyond 30 days** except the place ID. Review text has the same
  limit. This is currently violated — see the audit; the fix is a refresh/TTL
  policy, track owned.
- **Publishing a site for a business that hasn't signed up** ("unclaimed pitch
  site"): uses their name + real reviews + real photos at a public (noindexed)
  URL. This is the single biggest legal exposure. Minimum: noindex (done), a
  clear "prepared by LaunchLocal, not affiliated / not yet claimed" disclosure
  on the page, instant takedown on request, and never any content that isn't
  factually theirs. Ideally: don't publish until they've agreed.
- **Business details** (real name, address, contact) appear in the footer of
  every client site and in its Terms/Privacy.

### 2.6 Jurisdiction notes (informational, not advice)

- **Audience is NYC + Long Island small businesses / their local customers** —
  overwhelmingly US persons. GDPR/UK-GDPR and the EU ePrivacy consent regime
  are low practical risk but not zero (any EU visitor). The cheap
  fixes (self-host fonts, click-to-load map, honest banner) close most of it.
- **New York:** no comprehensive consumer-privacy law in force yet (NYPA not
  enacted). The **SHIELD Act** requires reasonable data-security safeguards and
  breach notification for any private info of NY residents — applies here. NY
  General Business Law §349 (deceptive practices) is why the "no fake
  anything" rules are also legal hygiene, not just taste.
- **CCPA/CPRA (California):** only bites above revenue/volume thresholds and
  only needs a "Do Not Sell or Share" link if you sell/share — LaunchLocal
  doesn't, so keep not doing that.
- **ADA web accessibility:** US plaintiffs routinely sue small-business sites
  over WCAG failures. §2.4 is the mitigation.
- **TCPA / CAN-SPAM:** outreach is manual Instagram DMs, not email or SMS
  autodialing — out of scope, keep it that way. (Instagram's own ToS restrict
  bulk/automated DMing; that's a platform-ban risk, handled by sending by hand.)

---

## 3. Where each rule is enforced

| Rule area | File(s) | Test |
| --- | --- | --- |
| Design systems (no purple, contrast) | `src/lib/designSystems.ts`, `src/lib/contrast.ts` | `designSystems.test.ts`, `contrast.test.ts` |
| Button shape, gradients, em dashes, copy | `src/lib/templates.tsx`, `src/components/site/**` | add `templates.test.ts` assertions |
| Legal page content | `src/lib/legalContent.ts` | `legalContent.test.ts` |
| Cookie/consent | `src/components/site/CookieConsentBanner.tsx`, cookie-policy page | — |
| Form consent + a11y | `src/components/site/ContactForm.tsx` | `ContactForm` RTL test |
| Places data retention | `src/lib/places.ts` + a refresh job | new test |
| App noindex + favicon + footer legal links | `src/app/(app)/**`, `src/components/AppFooter.tsx` | — |

Full remediation plan and status: **[`COMPLIANCE-AUDIT-2026-09.md`](COMPLIANCE-AUDIT-2026-09.md)**.
