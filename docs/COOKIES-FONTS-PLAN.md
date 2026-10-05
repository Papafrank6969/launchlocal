# Feature plan: Track C-B — self-host fonts, drop third-party embeds

**Status:** specced, not started
**Assignee:** an agent that can run the app locally (needs a working DB to
render `/s/[slug]` and eyeball fonts). Boss clone can't run the app.
**Scope class:** `src/lib/siteFonts.ts` (new), `src/components/site/SiteFonts.tsx`,
`src/components/site/AsyncGoogleFont.tsx` (delete), `src/lib/designSystems.ts`
(`googleFontsHref` only — delete it + its callers), `src/components/site/MapEmbed.tsx`,
`src/app/s/[slug]/contact/page.tsx` (map usage), `src/app/s/[slug]/layout.tsx`
(remove `<CookieConsentBanner/>`), `src/components/site/CookieConsentBanner.tsx`
(delete), plus tests. **Nothing else** — no template redesign, no legal-page
work (that's C-A).

Decision 2 (Frank, 2026-09-06): **US-clean.** No third-party calls from the
visitor's browser, no consent gate. Findings F-5, F-6, F-7.

---

## 1. Goal

A published client site should make **zero requests to Google** (or any third
party) from the visitor's browser. Today it pulls font CSS + woff2 from
`fonts.googleapis.com` / `fonts.gstatic.com` at runtime and embeds a
`google.com/maps` iframe on every contact page — both send the visitor's IP
(and the map, cookies) to Google with no consent. That's the exact pattern
German courts have fined, and it's why the current accept-only cookie banner
exists. Remove the cause, remove the banner.

### Non-goals

- No visual redesign. Same fonts, same layout — just served from our origin.
- No interactive map. An address + "Get directions" link replaces the iframe.
  A click-to-load embedded map is a possible later follow-up, not this track.
- No consent-management tooling. After this track the only browser storage is
  the theme preference and (until C-A) nothing else — both strictly necessary.
- The **app** (`src/app/layout.tsx`) already self-hosts via `next/font/google`
  (Geist). Untouched.

---

## 2. Tasks

### Task 1 — `src/lib/siteFonts.ts` (new): self-hosted font registry

Use `next/font/google` — Next downloads each family at **build time**, self-hosts
the woff2 on our origin, and emits `@font-face` with no runtime Google request.

`next/font/google` needs literal family names + weights, so declare each family
the design systems use, once, at module scope:

```ts
import { Fraunces, Work_Sans, Newsreader, /* … */ } from "next/font/google";

const fraunces600 = Fraunces({ subsets: ["latin"], weight: "600", display: "swap", preload: false });
// … one per (family, weight) pair present in DESIGN_SYSTEMS …

/** design-system id → the two font-family CSS strings to render through. */
export const SITE_FONTS: Record<string, { heading: string; body: string }> = {
  "warm-editorial": { heading: fraunces600.style.fontFamily, body: workSans400.style.fontFamily },
  // … all 13 …
};

export function siteFontsFor(systemId: string): { heading: string; body: string } {
  return SITE_FONTS[systemId] ?? SITE_FONTS["sharp-corporate"];
}
```

- `preload: false` on every face (matches today's deliberately-async intent —
  paint immediately with the fallback, swap when the woff2 arrives).
- `display: "swap"` (carry over the current behaviour).
- Families are the union of `DESIGN_SYSTEMS[*].fontHeading` and `.fontBody`.
  Roughly: Fraunces, Work Sans, Newsreader, Source Sans 3, DM Serif Display,
  Mulish, Poppins, Inter, Cormorant Garamond, Karla, Bodoni Moda, Oswald,
  Barlow, Quicksand, Nunito, Zilla Slab, Playfair Display, Libre Caslon Text,
  Jost, Manrope — each at the single weight its system(s) specify (a couple of
  families appear at two weights, e.g. Fraunces 600 + 500). `next/font` dedupes
  identical requests.

### Task 2 — `SiteFonts.tsx`: render through the registry

```tsx
import { siteFontsFor } from "@/lib/siteFonts";

export function SiteIdentity({ system }: { system: DesignSystem }) {
  const fonts = siteFontsFor(system.id);
  return (
    <style>{`
      :root {
        --site-bg: ${system.colorNeutralLight};
        --site-fg: ${system.colorNeutralDark};
        --site-font-heading: ${fonts.heading};
        --site-font-body: ${fonts.body};
      }
      .dark { --site-bg: ${system.colorNeutralDark}; --site-fg: ${system.colorNeutralLight}; }
      .site-card-bg { background-color: color-mix(in srgb, var(--site-bg) 92%, var(--site-fg) 8%); }
      .site-border { border-color: color-mix(in srgb, var(--site-fg) 15%, transparent); }
    `}</style>
  );
}
```

- Drop the `preconnect("https://fonts.googleapis.com" …)` calls.
- Drop `<AsyncGoogleFont …>`.
- `templates.tsx` renders body text via `fontCssValue(system.fontBody)` in a few
  places (`SitePreview` wrapper, headings). Those still work — `fontCssValue`
  just builds `'Family', fallback`, and the `@font-face` now exists locally. **Or**
  switch those to `var(--site-font-body)` / `var(--site-font-heading)` for
  consistency. Keep the change minimal; if `fontCssValue` stays, leave it.

### Task 3 — delete the Google Fonts runtime path

- Delete `src/components/site/AsyncGoogleFont.tsx`.
- Delete `googleFontsHref` from `src/lib/designSystems.ts` and any import of it.
  Grep: it's used only by `SiteFonts.tsx`. `fontCssValue` **stays** (still used).
- Remove the "Google Fonts stylesheet loads asynchronously" bullet from
  `docs/SITE-QUALITY-CHECKLIST.md`'s "Known limits" (it's no longer true) and
  replace with a one-liner: fonts are self-hosted via `next/font/google`
  (`src/lib/siteFonts.ts`); no runtime third-party request.

### Task 4 — replace the Google Maps iframe

`src/components/site/MapEmbed.tsx` → rename intent to a directions card (keep the
file name or rename to `LocationCard.tsx`; if renamed, update the import in
`contact/page.tsx`):

```tsx
export function LocationCard({ address, businessName }: { address: string; businessName: string }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${businessName} ${address}`)}`;
  return (
    <div className="site-border site-card-bg mt-8 rounded-xl border p-5">
      <p className="font-medium">Find us</p>
      <p className="mt-1 text-sm opacity-80">{address}</p>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
         className="mt-3 inline-block text-sm font-semibold underline-offset-4 hover:underline">
        Get directions
      </a>
    </div>
  );
}
```

The Google link is only followed on an explicit click — no passive third-party
request. No API key, no iframe, no cookies.

### Task 5 — remove the cookie banner

- Delete `src/components/site/CookieConsentBanner.tsx`.
- Remove `<CookieConsentBanner />` and its import from `src/app/s/[slug]/layout.tsx`.
- The banner published `--cookie-safe` for the floating buttons to clear it.
  `BackToTopButton` / `FloatingContactButton` read
  `bottom-[calc(1.5rem+var(--cookie-safe,0px))]` — with the banner gone the var
  is just never set, so `var(--cookie-safe, 0px)` → `0px`. Leave the calc or
  simplify to `bottom-6`; either is fine. **Minimal:** leave it.
- After this track the only client-site browser storage is the theme key and
  the (now-removed) consent key. A Cookie Policy page + a one-line footer
  disclosure are **C-A**'s job — note in the PR that C-A follows. The gap is
  legally fine: strictly-necessary storage needs no notice.

### Task 6 — tests

- `src/lib/siteFonts.test.ts`: for every `system` in `DESIGN_SYSTEMS`,
  `siteFontsFor(system.id)` returns non-empty `heading` + `body` strings, and
  the family name in `system.fontHeading.family` appears (normalised) in the
  returned `heading` string — the guard that keeps `siteFonts.ts` in sync with
  `designSystems.ts` when someone adds a system.
- `siteFontsFor("nonsense")` falls back, doesn't throw.
- Existing tests stay green. `designSystems.test.ts` may reference
  `googleFontsHref` — update/remove those assertions.

### Task 7 — verify locally (the reason this needs an app-capable clone)

- `npm run build` succeeds (this is where `next/font` fetches the families — a
  bad family name or weight fails the build).
- Run the app, open 3–4 published sites across different design systems, in
  DevTools **Network**: **zero** requests to `fonts.googleapis.com`,
  `fonts.gstatic.com`, or `google.com/maps`. Fonts load from `/_next/…`.
- Fonts render the same as before (screenshot a couple, before/after, in the PR).
- Contact page shows the directions card, link opens Google Maps in a new tab.

---

## 3. Edge cases

- **`next/font` build fetch fails in CI** (offline build). `next/font/google`
  caches in `.next/cache`; CI has network. If it becomes flaky, the fallback is
  `next/font/local` with the woff2 committed — don't do that pre-emptively.
- **A design system references a family not in `siteFonts.ts`.** `siteFontsFor`
  falls back to `sharp-corporate`'s fonts; the Task 6 test fails loudly so it's
  caught in review, not in prod.
- **FOUT** (flash of fallback font). Same as today — `display: swap`,
  `preload: false`. Acceptable, deliberate.
- **Old published pages cached with the Google Fonts `<link>`.** Next
  revalidates on deploy; `/s/[slug]` is dynamic (DB-backed) so the next request
  re-renders without the link. No stale third-party call persists.

---

## 4. Definition of done

- [ ] `npm run build` succeeds (fonts fetched + self-hosted at build).
- [ ] `npm test` green (new `siteFonts` test; `designSystems` test updated).
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean.
- [ ] `git grep -n "fonts.googleapis\|fonts.gstatic\|google.com/maps\|AsyncGoogleFont\|googleFontsHref\|CookieConsentBanner"` → **no hits** in `src/`.
- [ ] Network-tab proof (screenshot) that a published site makes no Google
      request; before/after font screenshots.
- [ ] `git diff --stat` = scope-class paths only.
- [ ] Branch off `origin/master`; merge master before final; re-gate. PR vs `master`.
- [ ] PR notes: C-A (cookie policy page + footer legal/disclosure links) follows;
      the app was already clean.

---

## 5. Review checklist (boss)

1. No `fonts.googleapis.com` / `fonts.gstatic.com` / `google.com/maps` /
   `AsyncGoogleFont` / `googleFontsHref` / `CookieConsentBanner` anywhere in `src/`.
2. `siteFonts.ts` covers every family in `DESIGN_SYSTEMS` at the right weight;
   the sync test exists and passes.
3. `preload: false`, `display: "swap"` on every face.
4. `MapEmbed`/`LocationCard` renders no iframe and no `<img>` pointing at a
   third-party host; the Maps link is `rel="noopener noreferrer"` + `target="_blank"`.
5. `s/[slug]/layout.tsx` no longer renders the banner; floating-button
   positioning still works with `--cookie-safe` unset.
6. `fontCssValue` still present and used; only `googleFontsHref` removed.
7. Network-tab evidence in the PR (this is the whole point of the track).
